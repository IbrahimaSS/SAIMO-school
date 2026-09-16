"use server";

import { randomBytes } from "crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireSuperAdmin } from "@/server/context";
import { audit, AuditAction, AuditEntite } from "@/server/logs/audit";
import { envoyerInvitation } from "@/server/external/email.service";
import { appUrl } from "@/lib/url";
import { messageErreur as msg } from "@/server/errors";
import type { ActionResult } from "./eleves";

const DUREE_INVITATION_MS = 7 * 24 * 60 * 60 * 1000; // 7 jours

const s = (v: FormDataEntryValue | null) => {
  const t = typeof v === "string" ? v.trim() : "";
  return t === "" ? undefined : t;
};

const anneeCourante = () => {
  const maintenant = new Date();
  const anneeDebut = maintenant.getMonth() >= 7 ? maintenant.getFullYear() : maintenant.getFullYear() - 1;
  return {
    libelle: `${anneeDebut}-${anneeDebut + 1}`,
    dateDebut: new Date(anneeDebut, 8, 1),
    dateFin: new Date(anneeDebut + 1, 5, 30),
  };
};

const schemaEtablissement = z.object({
  nom: z.string().min(2, "Nom requis").max(150),
  code: z
    .string()
    .min(2, "Code requis")
    .max(30)
    .regex(/^[A-Za-z0-9-]+$/, "Lettres, chiffres et tirets uniquement"),
  ville: z.string().max(100).optional(),
  pays: z.string().min(2).max(100).default("Guinée"),
  adminPrenom: z.string().min(1, "Prénom requis").max(100),
  adminNom: z.string().min(1, "Nom requis").max(100),
  adminEmail: z.string().email("Email invalide"),
  adminTelephone: z.string().max(30).optional(),
  limiteCycles: z.coerce.number().int().min(1, "Au moins 1 cycle").max(10),
});

export async function actionCreerEtablissement(
  formData: FormData,
): Promise<ActionResult<{ etablissementId: string }>> {
  try {
    const ctx = await requireSuperAdmin();

    const parsed = schemaEtablissement.safeParse({
      nom: s(formData.get("nom")),
      code: s(formData.get("code")),
      ville: s(formData.get("ville")),
      pays: s(formData.get("pays")) ?? "Guinée",
      adminPrenom: s(formData.get("adminPrenom")),
      adminNom: s(formData.get("adminNom")),
      adminEmail: s(formData.get("adminEmail")),
      adminTelephone: s(formData.get("adminTelephone")),
      limiteCycles: formData.get("limiteCycles"),
    });
    if (!parsed.success) {
      return { succes: false, erreur: parsed.error.issues[0]?.message ?? "Données invalides" };
    }
    const d = parsed.data;
    const annee = anneeCourante();

    const { etablissement, token } = await prisma.$transaction(async (tx) => {
      const etablissement = await tx.etablissement.create({
        data: {
          nom: d.nom,
          code: d.code.toUpperCase(),
          ville: d.ville,
          pays: d.pays,
          limiteCycles: d.limiteCycles,
        },
      });

      // Année scolaire initiale — indispensable au fonctionnement de l'app
      // (requireContext() l'exige) ; tout le reste (cycles, niveaux, matières,
      // périodes) est laissé vide, à configurer par l'établissement lui-même.
      await tx.anneeScolaire.create({
        data: { etablissementId: etablissement.id, ...annee, active: true },
      });

      const admin = await tx.utilisateur.create({
        data: {
          email: d.adminEmail,
          prenom: d.adminPrenom,
          nom: d.adminNom,
          telephone: d.adminTelephone,
          etablissements: {
            create: { etablissementId: etablissement.id, role: "ADMIN_ETABLISSEMENT" },
          },
        },
      });

      const token = randomBytes(24).toString("hex");
      await tx.invitation.create({
        data: {
          email: d.adminEmail,
          role: "ADMIN_ETABLISSEMENT",
          etablissementId: etablissement.id,
          token,
          expireAt: new Date(Date.now() + DUREE_INVITATION_MS),
          invitePar: ctx.utilisateurId,
        },
      });

      return { etablissement, token, admin };
    });

    // Email d'invitation — ne bloque jamais la création (école déjà en base).
    try {
      await envoyerInvitation({
        email: d.adminEmail,
        prenom: d.adminPrenom,
        etablissementNom: etablissement.nom,
        lienInvitation: appUrl(`/invitation/${token}`),
        etablissementId: etablissement.id,
      });
    } catch (e) {
      console.error("[email invitation établissement]", e);
    }

    await audit({
      utilisateurId: ctx.utilisateurId,
      etablissementId: etablissement.id,
      action: AuditAction.CREATE,
      entite: AuditEntite.ETABLISSEMENT,
      entiteId: etablissement.id,
      apres: { nom: etablissement.nom, code: etablissement.code, admin: d.adminEmail },
    });

    revalidatePath("/saimo-admin");
    return { succes: true, data: { etablissementId: etablissement.id } };
  } catch (e) {
    return { succes: false, erreur: msg(e) };
  }
}

async function toggleActif(id: string, actif: boolean): Promise<ActionResult> {
  try {
    const ctx = await requireSuperAdmin();

    await prisma.etablissement.update({
      where: { id },
      data: { actif },
    });

    await audit({
      utilisateurId: ctx.utilisateurId,
      etablissementId: id,
      action: AuditAction.UPDATE,
      entite: AuditEntite.ETABLISSEMENT,
      entiteId: id,
      apres: { actif },
    });

    revalidatePath("/saimo-admin");
    return { succes: true, data: undefined };
  } catch (e) {
    return { succes: false, erreur: msg(e) };
  }
}

export async function actionSuspendreEtablissement(id: string): Promise<ActionResult> {
  return toggleActif(id, false);
}

export async function actionReactiverEtablissement(id: string): Promise<ActionResult> {
  return toggleActif(id, true);
}

export async function actionModifierLimiteCycles(
  id: string,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const ctx = await requireSuperAdmin();

    const limite = Number(formData.get("limiteCycles"));
    if (!Number.isInteger(limite) || limite < 1 || limite > 10) {
      return { succes: false, erreur: "Limite invalide (1 à 10)" };
    }

    await prisma.etablissement.update({ where: { id }, data: { limiteCycles: limite } });

    await audit({
      utilisateurId: ctx.utilisateurId,
      etablissementId: id,
      action: AuditAction.UPDATE,
      entite: AuditEntite.ETABLISSEMENT,
      entiteId: id,
      apres: { limiteCycles: limite },
    });

    revalidatePath("/saimo-admin");
    return { succes: true, data: undefined };
  } catch (e) {
    return { succes: false, erreur: msg(e) };
  }
}

const schemaModifierEtablissement = z.object({
  nom: z.string().min(2, "Nom requis").max(150),
  ville: z.string().max(100).optional(),
  pays: z.string().min(2).max(100),
});

export async function actionModifierEtablissement(
  id: string,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const ctx = await requireSuperAdmin();

    const parsed = schemaModifierEtablissement.safeParse({
      nom: s(formData.get("nom")),
      ville: s(formData.get("ville")),
      pays: s(formData.get("pays")) ?? "Guinée",
    });
    if (!parsed.success) {
      return { succes: false, erreur: parsed.error.issues[0]?.message ?? "Données invalides" };
    }

    await prisma.etablissement.update({
      where: { id },
      data: { nom: parsed.data.nom, ville: parsed.data.ville, pays: parsed.data.pays },
    });

    await audit({
      utilisateurId: ctx.utilisateurId,
      etablissementId: id,
      action: AuditAction.UPDATE,
      entite: AuditEntite.ETABLISSEMENT,
      entiteId: id,
      apres: parsed.data,
    });

    revalidatePath("/saimo-admin");
    return { succes: true, data: undefined };
  } catch (e) {
    return { succes: false, erreur: msg(e) };
  }
}

export async function actionRenvoyerInvitation(id: string): Promise<ActionResult> {
  try {
    const ctx = await requireSuperAdmin();

    const etablissement = await prisma.etablissement.findUnique({ where: { id } });
    if (!etablissement) return { succes: false, erreur: "Établissement introuvable" };

    const lien = await prisma.utilisateurEtablissement.findFirst({
      where: { etablissementId: id, role: "ADMIN_ETABLISSEMENT" },
      include: { utilisateur: true },
    });
    if (!lien) return { succes: false, erreur: "Aucun administrateur pour cet établissement" };
    if (lien.utilisateur.motDePasseHash) {
      return { succes: false, erreur: "Ce compte est déjà activé" };
    }

    const token = randomBytes(24).toString("hex");
    const expireAt = new Date(Date.now() + DUREE_INVITATION_MS);

    const invitationExistante = await prisma.invitation.findFirst({
      where: { etablissementId: id, email: lien.utilisateur.email, accepteAt: null },
    });
    if (invitationExistante) {
      await prisma.invitation.update({
        where: { id: invitationExistante.id },
        data: { token, expireAt },
      });
    } else {
      await prisma.invitation.create({
        data: {
          email: lien.utilisateur.email,
          role: "ADMIN_ETABLISSEMENT",
          etablissementId: id,
          token,
          expireAt,
          invitePar: ctx.utilisateurId,
        },
      });
    }

    await envoyerInvitation({
      email: lien.utilisateur.email,
      prenom: lien.utilisateur.prenom,
      etablissementNom: etablissement.nom,
      lienInvitation: appUrl(`/invitation/${token}`),
      etablissementId: id,
    });

    await audit({
      utilisateurId: ctx.utilisateurId,
      etablissementId: id,
      action: AuditAction.INVITE,
      entite: AuditEntite.ETABLISSEMENT,
      entiteId: id,
      apres: { email: lien.utilisateur.email },
    });

    revalidatePath("/saimo-admin");
    return { succes: true, data: undefined };
  } catch (e) {
    return { succes: false, erreur: msg(e) };
  }
}
