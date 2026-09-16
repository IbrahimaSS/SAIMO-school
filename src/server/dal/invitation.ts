import "server-only";

import { prisma } from "@/lib/prisma";

export interface InvitationEtat {
  valide: boolean;
  motif?: "introuvable" | "expiree" | "deja-acceptee";
  email?: string;
  etablissementNom?: string;
}

/** Vérifie un token d'invitation (page publique d'activation de compte). */
export async function getInvitationEtat(token: string): Promise<InvitationEtat> {
  const invitation = await prisma.invitation.findUnique({
    where: { token },
    include: { etablissement: { select: { nom: true } } },
  });

  if (!invitation) return { valide: false, motif: "introuvable" };
  if (invitation.accepteAt) return { valide: false, motif: "deja-acceptee" };
  if (invitation.expireAt < new Date()) return { valide: false, motif: "expiree" };

  return {
    valide: true,
    email: invitation.email,
    etablissementNom: invitation.etablissement.nom,
  };
}
