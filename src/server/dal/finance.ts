import "server-only";

import { cache } from "react";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireContext, requirePermission } from "@/server/context";
import { formatDateCourte, formatDateLongue } from "@/lib/format";

export interface FraisRowDTO {
  id: string; // fraisEleveId
  eleve: string;
  eleveId: string;
  classe: string;
  echeance: string;
  montantDu: number;
  montantPaye: number;
  remises: number;
  solde: number;
  statut: "Soldé" | "Partiel" | "Impayé" | "Annulé";
}

const statutLisible = (s: string): FraisRowDTO["statut"] =>
  s === "solde" ? "Soldé" : s === "partiel" ? "Partiel" : s === "annule" ? "Annulé" : "Impayé";

export async function listerFrais(params: {
  classeId?: string;
  statut?: string;
  q?: string;
}): Promise<FraisRowDTO[]> {
  const { etablissementId, anneeScolaireId, role } = await requireContext();
  requirePermission(role, "paiement:view");

  const frais = await prisma.fraisEleve.findMany({
    where: {
      inscription: {
        etablissementId,
        anneeScolaireId,
        ...(params.classeId ? { classeId: params.classeId } : {}),
      },
      ...(params.statut ? { statut: params.statut } : {}),
    },
    include: {
      echeance: { include: { typeFrais: true } },
      remises: true,
      inscription: { include: { eleve: true, classe: true } },
    },
    orderBy: { inscription: { eleve: { nom: "asc" } } },
  });

  const filtre = params.q?.toLowerCase().trim();
  return frais
    .map((f) => {
      const remises = f.remises.reduce((s, r) => s + Number(r.montant), 0);
      const du = Number(f.montantDu);
      const paye = Number(f.montantPaye);
      return {
        id: f.id,
        eleve: `${f.inscription.eleve.prenom} ${f.inscription.eleve.nom}`,
        eleveId: f.inscription.eleveId,
        classe: f.inscription.classe.nom,
        echeance: f.echeance.libelle ?? f.echeance.typeFrais.nom,
        montantDu: du,
        montantPaye: paye,
        remises,
        solde: Math.max(0, du - paye - remises),
        statut: statutLisible(f.statut),
      };
    })
    .filter((r) => !filtre || r.eleve.toLowerCase().includes(filtre) || r.classe.toLowerCase().includes(filtre));
}

export interface FraisEleveLigne {
  id: string;
  libelle: string;
  montantDu: number;
  montantPaye: number;
  solde: number;
}

/** Frais de l'inscription active d'un élève (pour l'écran de finalisation). */
export async function listerFraisEleve(eleveId: string): Promise<FraisEleveLigne[]> {
  const { etablissementId, anneeScolaireId, role } = await requireContext();
  requirePermission(role, "paiement:view");

  const frais = await prisma.fraisEleve.findMany({
    where: { inscription: { eleveId, etablissementId, anneeScolaireId } },
    include: { echeance: { include: { typeFrais: true } }, remises: true },
    orderBy: { echeance: { dateEcheance: "asc" } },
  });

  return frais.map((f) => {
    const remises = f.remises.reduce((s, r) => s + Number(r.montant), 0);
    const du = Number(f.montantDu);
    const paye = Number(f.montantPaye);
    return {
      id: f.id,
      libelle: f.echeance.libelle ?? f.echeance.typeFrais.nom,
      montantDu: du,
      montantPaye: paye + remises,
      solde: Math.max(0, du - paye - remises),
    };
  });
}

export const getFraisDetail = cache(async (id: string) => {
  const { etablissementId, role } = await requireContext();
  requirePermission(role, "paiement:view");

  const f = await prisma.fraisEleve.findFirst({
    where: { id, inscription: { etablissementId } },
    include: {
      echeance: { include: { typeFrais: true } },
      inscription: { include: { eleve: true, classe: true } },
      paiements: { include: { recu: true }, orderBy: { createdAt: "desc" } },
      remises: { orderBy: { createdAt: "desc" } },
    },
  });
  if (!f) notFound();

  const remises = f.remises.reduce((s, r) => s + Number(r.montant), 0);
  return {
    id: f.id,
    eleve: `${f.inscription.eleve.prenom} ${f.inscription.eleve.nom}`,
    classe: f.inscription.classe.nom,
    echeance: f.echeance.libelle ?? f.echeance.typeFrais.nom,
    montantDu: Number(f.montantDu),
    montantPaye: Number(f.montantPaye),
    remisesTotal: remises,
    solde: Math.max(0, Number(f.montantDu) - Number(f.montantPaye) - remises),
    statut: statutLisible(f.statut),
    paiements: f.paiements.map((p) => ({
      id: p.id,
      numeroRecu: p.numeroRecu,
      montant: Number(p.montant),
      mode: p.modePaiement,
      statut: p.statut,
      date: formatDateCourte(p.createdAt),
    })),
    remises: f.remises.map((r) => ({
      id: r.id,
      montant: Number(r.montant),
      motif: r.motif,
      date: formatDateCourte(r.createdAt),
    })),
  };
});

export interface RecuDetail {
  paiementId: string;
  numero: string;
  etablissement: string;
  date: string;
  eleve: string;
  matricule: string | null;
  classe: string;
  tuteur: string | null;
  natureFrais: string;
  montant: number;
  mode: string;
  reference: string | null;
  encaissePar: string | null;
  montantDu: number;
  totalPaye: number;
  soldeRestant: number;
  annule: boolean;
}

const MODE_LISIBLE: Record<string, string> = {
  especes: "Espèces",
  cheque: "Chèque",
  virement: "Virement",
  mobile: "Mobile money",
};

/** Détail d'un reçu (clé = id du paiement), pour affichage / impression / PDF. */
export const getRecuDetail = cache(async (paiementId: string): Promise<RecuDetail> => {
  const { etablissementId, role } = await requireContext();
  requirePermission(role, "recu:generer");

  const p = await prisma.paiement.findFirst({
    where: {
      id: paiementId,
      fraisEleve: { inscription: { etablissementId } },
    },
    include: {
      fraisEleve: {
        include: {
          echeance: { include: { typeFrais: true } },
          remises: true,
          inscription: {
            include: {
              classe: true,
              eleve: {
                include: {
                  parents: { include: { parent: true }, orderBy: { principal: "desc" } },
                },
              },
            },
          },
        },
      },
    },
  });
  if (!p) notFound();

  const [etab, encaisseur] = await Promise.all([
    prisma.etablissement.findUnique({
      where: { id: etablissementId },
      select: { nom: true },
    }),
    p.encaisseParId
      ? prisma.utilisateur.findUnique({
          where: { id: p.encaisseParId },
          select: { prenom: true, nom: true },
        })
      : Promise.resolve(null),
  ]);

  const f = p.fraisEleve;
  const eleve = f.inscription.eleve;
  const parent = eleve.parents[0]?.parent ?? null;
  const remises = f.remises.reduce((s, r) => s + Number(r.montant), 0);

  return {
    paiementId: p.id,
    numero: p.numeroRecu,
    etablissement: etab?.nom ?? "SAIMO École",
    date: formatDateLongue(p.createdAt),
    eleve: `${eleve.prenom} ${eleve.nom}`,
    matricule: eleve.matricule,
    classe: f.inscription.classe.nom,
    tuteur: parent ? `${parent.prenom} ${parent.nom}` : null,
    natureFrais: f.echeance.libelle ?? f.echeance.typeFrais.nom,
    montant: Number(p.montant),
    mode: MODE_LISIBLE[p.modePaiement] ?? p.modePaiement,
    reference: p.reference,
    encaissePar: encaisseur ? `${encaisseur.prenom} ${encaisseur.nom}` : null,
    montantDu: Number(f.montantDu),
    totalPaye: Number(f.montantPaye),
    soldeRestant: Math.max(0, Number(f.montantDu) - Number(f.montantPaye) - remises),
    annule: p.statut === "annule",
  };
});

export interface RecuRowDTO {
  id: string;
  numero: string;
  eleveId: string;
  eleve: string;
  classe: string;
  montant: number;
  date: string;
  mode: string;
  statut: string;
}

export async function listerRecus(q?: string): Promise<RecuRowDTO[]> {
  const { etablissementId, anneeScolaireId, role } = await requireContext();
  requirePermission(role, "recu:generer");

  const paiements = await prisma.paiement.findMany({
    where: {
      fraisEleve: { inscription: { etablissementId, anneeScolaireId } },
    },
    include: {
      recu: true,
      fraisEleve: { include: { inscription: { include: { eleve: true, classe: true } } } },
    },
    orderBy: { createdAt: "desc" },
    take: 300,
  });

  const filtre = q?.toLowerCase().trim();
  return paiements
    .map((p) => ({
      id: p.id,
      numero: p.numeroRecu,
      eleveId: p.fraisEleve.inscription.eleve.id,
      eleve: `${p.fraisEleve.inscription.eleve.prenom} ${p.fraisEleve.inscription.eleve.nom}`,
      classe: p.fraisEleve.inscription.classe.nom,
      montant: Number(p.montant),
      date: formatDateCourte(p.createdAt),
      mode: p.modePaiement,
      statut: p.statut === "annule" ? "Annulé" : p.recu?.envoiEmail ? "Envoyé" : "Émis",
    }))
    .filter((r) => !filtre || r.eleve.toLowerCase().includes(filtre) || r.numero.toLowerCase().includes(filtre));
}

export interface RemiseRowDTO {
  id: string;
  eleve: string;
  classe: string;
  echeance: string;
  montant: number;
  motif: string;
  date: string;
}

export async function listerRemises(): Promise<RemiseRowDTO[]> {
  const { etablissementId, anneeScolaireId, role } = await requireContext();
  requirePermission(role, "paiement:view");

  const remises = await prisma.remise.findMany({
    where: {
      fraisEleve: { inscription: { etablissementId, anneeScolaireId } },
    },
    include: {
      fraisEleve: {
        include: {
          echeance: { include: { typeFrais: true } },
          inscription: { include: { eleve: true, classe: true } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return remises.map((r) => ({
    id: r.id,
    eleve: `${r.fraisEleve.inscription.eleve.prenom} ${r.fraisEleve.inscription.eleve.nom}`,
    classe: r.fraisEleve.inscription.classe.nom,
    echeance: r.fraisEleve.echeance.libelle ?? r.fraisEleve.echeance.typeFrais.nom,
    montant: Number(r.montant),
    motif: r.motif,
    date: formatDateCourte(r.createdAt),
  }));
}

export interface EcheanceRowDTO {
  id: string;
  typeFrais: string;
  niveau: string | null;
  montant: number;
  dateEcheance: string | null;
  libelle: string | null;
  nbFraisGeneres: number;
}

export async function listerEcheances(): Promise<EcheanceRowDTO[]> {
  const { etablissementId, anneeScolaireId, role } = await requireContext();
  requirePermission(role, "paiement:view");

  const echeances = await prisma.echeance.findMany({
    where: { anneeScolaireId, typeFrais: { etablissementId } },
    include: {
      typeFrais: true,
      niveau: true,
      _count: { select: { fraisEleves: true } },
    },
    orderBy: { dateEcheance: "asc" },
  });

  return echeances.map((e) => ({
    id: e.id,
    typeFrais: e.typeFrais.nom,
    niveau: e.niveau?.nom ?? null,
    montant: Number(e.montant),
    dateEcheance: e.dateEcheance ? formatDateCourte(e.dateEcheance) : null,
    libelle: e.libelle,
    nbFraisGeneres: e._count.fraisEleves,
  }));
}

export async function listerTypesFrais() {
  const { etablissementId, role } = await requireContext();
  requirePermission(role, "paiement:view");
  const types = await prisma.typeFrais.findMany({
    where: { etablissementId },
    orderBy: { nom: "asc" },
    select: { id: true, nom: true },
  });
  return types;
}

export interface RapportCaisseDTO {
  total: number;
  nombre: number;
  parMode: { mode: string; total: number; nombre: number }[];
  lignes: {
    id: string;
    numeroRecu: string;
    eleve: string;
    montant: number;
    mode: string;
    date: string;
  }[];
}

/**
 * Niveaux sans aucune échéance (frais) configurée pour l'année active.
 * Sert à avertir l'admin avant d'inscrire un élève dans une classe de ce niveau.
 */
export async function niveauxSansFrais(): Promise<string[]> {
  const { etablissementId, anneeScolaireId, role } = await requireContext();
  requirePermission(role, "classe:view");

  const [niveaux, echeances] = await Promise.all([
    prisma.niveau.findMany({
      where: { cycle: { etablissementId } },
      select: { id: true },
    }),
    prisma.echeance.findMany({
      where: { anneeScolaireId, typeFrais: { etablissementId } },
      select: { niveauId: true },
    }),
  ]);

  if (echeances.some((e) => e.niveauId === null)) return []; // un frais "tous niveaux" couvre tout
  const couverts = new Set(echeances.map((e) => e.niveauId).filter(Boolean));
  return niveaux.map((n) => n.id).filter((id) => !couverts.has(id));
}

export async function getRapportCaisse(debut: Date, fin: Date): Promise<RapportCaisseDTO> {
  const { etablissementId, role } = await requireContext();
  requirePermission(role, "rapport:financier");

  const paiements = await prisma.paiement.findMany({
    where: {
      statut: "valide",
      createdAt: { gte: debut, lte: fin },
      fraisEleve: { inscription: { etablissementId } },
    },
    include: {
      fraisEleve: { include: { inscription: { include: { eleve: true } } } },
    },
    orderBy: { createdAt: "desc" },
  });

  const parMode = new Map<string, { total: number; nombre: number }>();
  let total = 0;
  for (const p of paiements) {
    const m = Number(p.montant);
    total += m;
    const cur = parMode.get(p.modePaiement) ?? { total: 0, nombre: 0 };
    cur.total += m;
    cur.nombre += 1;
    parMode.set(p.modePaiement, cur);
  }

  return {
    total,
    nombre: paiements.length,
    parMode: [...parMode.entries()].map(([mode, v]) => ({ mode, ...v })),
    lignes: paiements.map((p) => ({
      id: p.id,
      numeroRecu: p.numeroRecu,
      eleve: `${p.fraisEleve.inscription.eleve.prenom} ${p.fraisEleve.inscription.eleve.nom}`,
      montant: Number(p.montant),
      mode: p.modePaiement,
      date: formatDateCourte(p.createdAt),
    })),
  };
}
