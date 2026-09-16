"use server";

import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { audit, AuditAction, AuditEntite } from "@/server/logs/audit";
import { messageErreur as msg } from "@/server/errors";
import type { ActionResult } from "./eleves";

const schema = z
  .object({
    token: z.string().min(1),
    motDePasse: z
      .string()
      .min(8, "8 caractères minimum")
      .regex(/[A-Z]/, "Au moins une majuscule")
      .regex(/[a-z]/, "Au moins une minuscule")
      .regex(/[0-9]/, "Au moins un chiffre"),
    confirmation: z.string().min(1),
  })
  .refine((d) => d.motDePasse === d.confirmation, {
    message: "La confirmation ne correspond pas",
    path: ["confirmation"],
  });

export async function actionAccepterInvitation(formData: FormData): Promise<ActionResult> {
  try {
    const parsed = schema.safeParse({
      token: formData.get("token"),
      motDePasse: formData.get("motDePasse"),
      confirmation: formData.get("confirmation"),
    });
    if (!parsed.success) {
      return { succes: false, erreur: parsed.error.issues[0]?.message ?? "Données invalides" };
    }

    const invitation = await prisma.invitation.findUnique({ where: { token: parsed.data.token } });
    if (!invitation) return { succes: false, erreur: "Invitation introuvable." };
    if (invitation.accepteAt) return { succes: false, erreur: "Cette invitation a déjà été utilisée." };
    if (invitation.expireAt < new Date()) return { succes: false, erreur: "Cette invitation a expiré." };

    const utilisateur = await prisma.utilisateur.findUnique({ where: { email: invitation.email } });
    if (!utilisateur) return { succes: false, erreur: "Compte introuvable." };

    const hash = await bcrypt.hash(parsed.data.motDePasse, 10);
    await prisma.$transaction([
      prisma.utilisateur.update({
        where: { id: utilisateur.id },
        data: { motDePasseHash: hash, emailVerifie: true },
      }),
      prisma.invitation.update({
        where: { id: invitation.id },
        data: { accepteAt: new Date() },
      }),
    ]);

    await audit({
      utilisateurId: utilisateur.id,
      etablissementId: invitation.etablissementId,
      action: AuditAction.UPDATE,
      entite: AuditEntite.UTILISATEUR,
      entiteId: utilisateur.id,
      apres: { compteActive: true },
    });

    return { succes: true, data: undefined };
  } catch (e) {
    return { succes: false, erreur: msg(e) };
  }
}
