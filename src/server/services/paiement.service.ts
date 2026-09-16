import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { audit, AuditAction, AuditEntite } from "@/server/logs/audit";
import {
  creerPaiement,
  annulerPaiement,
  genererNumeroRecu,
} from "@/server/repositories/paiement.repo";

function estConflitNumeroRecu(e: unknown): boolean {
  return (
    e instanceof Prisma.PrismaClientKnownRequestError &&
    e.code === "P2002" &&
    (e.meta?.target as string[] | undefined)?.includes("numeroRecu") === true
  );
}

// ─── Enregistrer un paiement ──────────────────────────────────

export interface EnregistrerPaiementInput {
  fraisEleveId: string;
  montant: number;
  modePaiement: "especes" | "cheque" | "virement" | "mobile";
  reference?: string;
  observation?: string;
  encaisseParId: string;
  etablissementId: string;
}

export async function enregistrerPaiement(input: EnregistrerPaiementInput) {
  const fraisEleve = await prisma.fraisEleve.findUnique({
    where: { id: input.fraisEleveId },
    include: { inscription: { include: { eleve: true } } },
  });

  if (!fraisEleve) throw new Error("Frais introuvable");
  if (fraisEleve.statut === "annule") throw new Error("Ces frais sont annulés");

  const solde =
    Number(fraisEleve.montantDu) - Number(fraisEleve.montantPaye);
  if (input.montant <= 0) throw new Error("Le montant doit être supérieur à 0");
  if (input.montant > solde) {
    throw new Error(
      `Le montant (${input.montant}) dépasse le solde restant (${solde})`
    );
  }

  // RM-11 : numéro de reçu unique — en cas de collision (deux encaissements
  // quasi simultanés calculant le même numéro), on regénère et on réessaie.
  const MAX_TENTATIVES = 5;
  let numeroRecu = "";
  let paiement;
  for (let tentative = 1; tentative <= MAX_TENTATIVES; tentative++) {
    numeroRecu = await genererNumeroRecu(input.etablissementId);
    try {
      paiement = await creerPaiement({
        fraisEleveId: input.fraisEleveId,
        numeroRecu,
        montant: input.montant,
        modePaiement: input.modePaiement,
        reference: input.reference,
        observation: input.observation,
        encaisseParId: input.encaisseParId,
      });
      break;
    } catch (e) {
      if (!estConflitNumeroRecu(e) || tentative === MAX_TENTATIVES) throw e;
    }
  }
  if (!paiement) throw new Error("Impossible de générer un numéro de reçu unique");

  // Créer le reçu associé
  const recu = await prisma.recu.create({
    data: {
      paiementId: paiement.id,
      numero: numeroRecu,
    },
  });

  // RM-14 : audit
  await audit({
    utilisateurId: input.encaisseParId,
    etablissementId: input.etablissementId,
    action: AuditAction.PAYMENT,
    entite: AuditEntite.PAIEMENT,
    entiteId: paiement.id,
    apres: {
      numeroRecu,
      montant: input.montant,
      mode: input.modePaiement,
    },
  });

  return { paiement, recu };
}

// ─── Annuler un paiement ──────────────────────────────────────

export async function annulerUnPaiement(input: {
  paiementId: string;
  motif: string;
  annuleParId: string;
  etablissementId: string;
}) {
  const paiement = await prisma.paiement.findUnique({
    where: { id: input.paiementId },
  });

  if (!paiement) throw new Error("Paiement introuvable");
  if (paiement.statut === "annule") throw new Error("Ce paiement est déjà annulé");

  // RM-12 : l'annulation reste en historique avec motif et auteur
  const paiementAnnule = await annulerPaiement(
    input.paiementId,
    input.motif,
    input.annuleParId
  );

  await audit({
    utilisateurId: input.annuleParId,
    etablissementId: input.etablissementId,
    action: AuditAction.CANCEL_PAYMENT,
    entite: AuditEntite.PAIEMENT,
    entiteId: input.paiementId,
    avant: { statut: "valide", montant: paiement.montant },
    apres: { statut: "annule", motif: input.motif },
  });

  return paiementAnnule;
}

// ─── Rapport de caisse ────────────────────────────────────────

export async function rapportCaisse(
  etablissementId: string,
  dateDebut: Date,
  dateFin: Date
) {
  const paiements = await prisma.paiement.findMany({
    where: {
      statut: "valide",
      createdAt: { gte: dateDebut, lte: dateFin },
      fraisEleve: { inscription: { etablissementId } },
    },
    include: {
      fraisEleve: {
        include: {
          echeance: { include: { typeFrais: true } },
          inscription: { include: { eleve: true } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const total = paiements.reduce((sum, p) => sum + Number(p.montant), 0);

  return { paiements, total, dateDebut, dateFin };
}
