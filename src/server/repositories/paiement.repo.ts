import { prisma } from "@/lib/prisma";

export async function trouverFraisEleve(inscriptionId: string) {
  return prisma.fraisEleve.findMany({
    where: { inscriptionId },
    include: { echeance: { include: { typeFrais: true } }, paiements: true, remises: true },
    orderBy: { echeance: { dateEcheance: "asc" } },
  });
}

export async function trouverPaiementsEleve(eleveId: string, etablissementId: string) {
  return prisma.paiement.findMany({
    where: {
      fraisEleve: {
        inscription: { eleveId, etablissementId },
      },
    },
    include: { fraisEleve: { include: { echeance: { include: { typeFrais: true } } } }, recu: true },
    orderBy: { createdAt: "desc" },
  });
}

export async function genererNumeroRecu(etablissementId: string): Promise<string> {
  const annee = new Date().getFullYear();
  const [count, etablissement] = await Promise.all([
    prisma.paiement.count({
      where: {
        fraisEleve: {
          inscription: { etablissementId },
        },
        createdAt: {
          gte: new Date(`${annee}-01-01`),
        },
      },
    }),
    prisma.etablissement.findUnique({ where: { id: etablissementId }, select: { code: true } }),
  ]);
  const seq = String(count + 1).padStart(5, "0");
  // Le code établissement rend le numéro globalement unique entre écoles clientes
  // (Paiement.numeroRecu n'est pas unique par établissement mais sur toute la
  // plateforme) — sans ça, le tout premier reçu de chaque nouvelle école entre
  // en collision avec celui d'une autre.
  return `REC-${etablissement?.code ?? etablissementId}-${annee}-${seq}`;
}

export async function creerPaiement(data: {
  fraisEleveId: string;
  numeroRecu: string;
  montant: number;
  modePaiement: string;
  reference?: string;
  observation?: string;
  encaisseParId?: string;
}) {
  return prisma.$transaction(async (tx) => {
    const paiement = await tx.paiement.create({
      data: {
        fraisEleveId: data.fraisEleveId,
        numeroRecu: data.numeroRecu,
        montant: data.montant,
        modePaiement: data.modePaiement,
        reference: data.reference,
        observation: data.observation,
        encaisseParId: data.encaisseParId,
        statut: "valide",
      },
    });

    // Recalculer le montant payé sur le fraisEleve
    const tousLespaiements = await tx.paiement.aggregate({
      where: { fraisEleveId: data.fraisEleveId, statut: "valide" },
      _sum: { montant: true },
    });

    const frais = await tx.fraisEleve.findUnique({ where: { id: data.fraisEleveId } });
    const montantPaye = Number(tousLespaiements._sum.montant ?? 0);
    const montantDu = Number(frais?.montantDu ?? 0);
    const statut =
      montantPaye >= montantDu ? "solde" : montantPaye > 0 ? "partiel" : "impaye";

    await tx.fraisEleve.update({
      where: { id: data.fraisEleveId },
      data: { montantPaye, statut },
    });

    return paiement;
  });
}

export async function annulerPaiement(
  paiementId: string,
  motif: string,
  annuleParId: string
) {
  // RM-12 : annulation conservée en historique, jamais supprimée
  return prisma.$transaction(async (tx) => {
    const paiement = await tx.paiement.update({
      where: { id: paiementId },
      data: {
        statut: "annule",
        motifAnnulation: motif,
        annuleParId,
        dateAnnulation: new Date(),
      },
    });

    // Recalcul du montant payé
    const tousLesPaiements = await tx.paiement.aggregate({
      where: { fraisEleveId: paiement.fraisEleveId, statut: "valide" },
      _sum: { montant: true },
    });

    const frais = await tx.fraisEleve.findUnique({ where: { id: paiement.fraisEleveId } });
    const montantPaye = Number(tousLesPaiements._sum.montant ?? 0);
    const montantDu = Number(frais?.montantDu ?? 0);
    const statut =
      montantPaye >= montantDu ? "solde" : montantPaye > 0 ? "partiel" : "impaye";

    await tx.fraisEleve.update({
      where: { id: paiement.fraisEleveId },
      data: { montantPaye, statut },
    });

    return paiement;
  });
}
