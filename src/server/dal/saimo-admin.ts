import "server-only";

import { prisma } from "@/lib/prisma";
import { requireSuperAdmin } from "@/server/context";

export interface EtablissementRow {
  id: string;
  nom: string;
  code: string;
  ville: string | null;
  pays: string;
  actif: boolean;
  nbEleves: number;
  nbCycles: number;
  limiteCycles: number;
  createdAt: string;
  adminEmail: string | null;
  adminInvitationEnAttente: boolean;
}

/** Liste des établissements de la plateforme, pour le back-office SAIMO. */
export async function listerEtablissements(): Promise<EtablissementRow[]> {
  await requireSuperAdmin();

  const etablissements = await prisma.etablissement.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      _count: { select: { eleves: true, cycles: true } },
      utilisateurs: {
        where: { role: "ADMIN_ETABLISSEMENT" },
        take: 1,
        include: { utilisateur: { select: { email: true, motDePasseHash: true } } },
      },
    },
  });

  return etablissements.map((e) => {
    const admin = e.utilisateurs[0]?.utilisateur;
    return {
      id: e.id,
      nom: e.nom,
      code: e.code,
      ville: e.ville,
      pays: e.pays,
      actif: e.actif,
      nbEleves: e._count.eleves,
      nbCycles: e._count.cycles,
      limiteCycles: e.limiteCycles,
      createdAt: e.createdAt.toISOString(),
      adminEmail: admin?.email ?? null,
      adminInvitationEnAttente: !!admin && !admin.motDePasseHash,
    };
  });
}
