"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { RoleUtilisateur } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireContext, requirePermission } from "@/server/context";
import { audit, AuditAction } from "@/server/logs/audit";
import { soumettreDemandeIA, validerReponseIA, rejeterReponseIA } from "@/server/external/ia.service";
import { chatGrok, type TypeActionIA, type GrokMessage } from "@/lib/grok";
import { getContexteIA } from "@/server/dal/ia-context";
import type { ActionResult } from "./eleves";

import { messageErreur as msg } from "@/server/errors";
const s = (v: FormDataEntryValue | null) => {
  const t = typeof v === "string" ? v.trim() : "";
  return t === "" ? undefined : t;
};

// ─── Annonces ───────────────────────────────────────────────

export async function actionCreerAnnonce(formData: FormData): Promise<ActionResult> {
  try {
    const ctx = await requireContext();
    requirePermission(ctx.role, "annonce:create");

    const titre = s(formData.get("titre"));
    const contenu = s(formData.get("contenu"));
    const rolesVises = formData.getAll("rolesVises").map(String);
    const publier = formData.get("publier") === "on";
    if (!titre || !contenu) return { succes: false, erreur: "Titre et contenu requis" };

    const annonce = await prisma.annonce.create({
      data: {
        etablissementId: ctx.etablissementId,
        titre,
        contenu,
        rolesVises: rolesVises.length ? rolesVises : undefined,
        publie: publier,
        datePublication: publier ? new Date() : null,
        creePar: ctx.utilisateurId,
      },
    });
    await audit({
      utilisateurId: ctx.utilisateurId,
      etablissementId: ctx.etablissementId,
      action: AuditAction.CREATE,
      entite: "Annonce",
      entiteId: annonce.id,
      apres: { titre },
    });
    revalidatePath("/portail/annonces");
    return { succes: true, data: undefined };
  } catch (e) {
    return { succes: false, erreur: msg(e) };
  }
}

export async function actionBasculerAnnonce(id: string): Promise<ActionResult> {
  try {
    const ctx = await requireContext();
    requirePermission(ctx.role, "annonce:create");
    const a = await prisma.annonce.findFirst({
      where: { id, etablissementId: ctx.etablissementId },
    });
    if (!a) return { succes: false, erreur: "Annonce introuvable" };
    await prisma.annonce.update({
      where: { id },
      data: { publie: !a.publie, datePublication: !a.publie ? new Date() : a.datePublication },
    });
    revalidatePath("/portail/annonces");
    return { succes: true, data: undefined };
  } catch (e) {
    return { succes: false, erreur: msg(e) };
  }
}

// ─── Utilisateurs (staff) ──────────────────────────────────

const ROLES_STAFF: RoleUtilisateur[] = [
  "ADMIN_ETABLISSEMENT", "DIRECTEUR", "SECRETAIRE", "COMPTABLE", "ENSEIGNANT", "PROF_PRINCIPAL",
];

const schemaUser = z.object({
  prenom: z.string().min(1).max(80),
  nom: z.string().min(1).max(80),
  email: z.string().email(),
  telephone: z.string().max(30).optional(),
  role: z.string(),
});

export async function actionCreerUtilisateur(
  formData: FormData,
): Promise<ActionResult<{ motDePasse: string }>> {
  try {
    const ctx = await requireContext();
    requirePermission(ctx.role, "utilisateur:manage");

    const parsed = schemaUser.safeParse({
      prenom: formData.get("prenom"),
      nom: formData.get("nom"),
      email: formData.get("email"),
      telephone: s(formData.get("telephone")),
      role: formData.get("role"),
    });
    if (!parsed.success) {
      return { succes: false, erreur: parsed.error.issues[0]?.message ?? "Données invalides" };
    }
    const role = parsed.data.role as RoleUtilisateur;
    if (!ROLES_STAFF.includes(role)) {
      return { succes: false, erreur: "Rôle non autorisé" };
    }

    const existant = await prisma.utilisateur.findUnique({ where: { email: parsed.data.email } });
    if (existant) return { succes: false, erreur: "Cet email est déjà utilisé" };

    const bcrypt = (await import("bcryptjs")).default;
    const motDePasse = "Bienvenue123!";
    const hash = await bcrypt.hash(motDePasse, 10);

    const u = await prisma.$transaction(async (tx) => {
      const user = await tx.utilisateur.create({
        data: {
          email: parsed.data.email,
          prenom: parsed.data.prenom,
          nom: parsed.data.nom,
          telephone: parsed.data.telephone,
          motDePasseHash: hash,
          etablissements: { create: { etablissementId: ctx.etablissementId, role } },
        },
      });
      if (role === "ENSEIGNANT" || role === "PROF_PRINCIPAL") {
        await tx.enseignant.create({
          data: { utilisateurId: user.id, etablissementId: ctx.etablissementId },
        });
      }
      return user;
    });

    await audit({
      utilisateurId: ctx.utilisateurId,
      etablissementId: ctx.etablissementId,
      action: AuditAction.CREATE,
      entite: "Utilisateur",
      entiteId: u.id,
      apres: { email: parsed.data.email, role },
    });

    // Email d'identifiants — ne bloque jamais la création.
    try {
      const [etab, { libelleRole }, { envoyerIdentifiantsCompte }, { appUrl }] =
        await Promise.all([
          prisma.etablissement.findUnique({
            where: { id: ctx.etablissementId },
            select: { nom: true },
          }),
          import("@/lib/roles-labels"),
          import("@/server/external/email.service"),
          import("@/lib/url"),
        ]);
      await envoyerIdentifiantsCompte({
        email: parsed.data.email,
        prenom: parsed.data.prenom,
        motDePasse,
        roleLibelle: libelleRole(role),
        etablissementNom: etab?.nom ?? "SAIMO Ecole",
        lienConnexion: appUrl("/connexion"),
        etablissementId: ctx.etablissementId,
      });
    } catch (e) {
      console.error("[email identifiants]", e);
    }

    revalidatePath("/portail/utilisateurs");
    return { succes: true, data: { motDePasse } };
  } catch (e) {
    return { succes: false, erreur: msg(e) };
  }
}

export async function actionBasculerUtilisateur(id: string): Promise<ActionResult> {
  try {
    const ctx = await requireContext();
    requirePermission(ctx.role, "utilisateur:manage");
    if (id === ctx.utilisateurId) {
      return { succes: false, erreur: "Vous ne pouvez pas désactiver votre propre compte" };
    }
    const lien = await prisma.utilisateurEtablissement.findFirst({
      where: { utilisateurId: id, etablissementId: ctx.etablissementId },
    });
    if (!lien) return { succes: false, erreur: "Utilisateur introuvable" };
    const u = await prisma.utilisateur.findUnique({ where: { id } });
    await prisma.utilisateur.update({ where: { id }, data: { actif: !u?.actif } });
    revalidatePath("/portail/utilisateurs");
    return { succes: true, data: undefined };
  } catch (e) {
    return { succes: false, erreur: msg(e) };
  }
}

// ─── Paramètres établissement ──────────────────────────────

const logoSchema = z
  .string()
  .max(900_000, "Logo trop lourd (redimensionnez-le)")
  .refine(
    (v) => /^https?:\/\//.test(v) || /^data:image\/(png|jpe?g|webp|gif);base64,/.test(v),
    "Format d'image non pris en charge",
  )
  .optional();

export async function actionMajEtablissement(formData: FormData): Promise<ActionResult> {
  try {
    const ctx = await requireContext();
    requirePermission(ctx.role, "parametres:manage");

    const logoParsed = logoSchema.safeParse(s(formData.get("logo")));
    if (!logoParsed.success) {
      return { succes: false, erreur: logoParsed.error.issues[0]?.message ?? "Logo invalide" };
    }

    await prisma.etablissement.update({
      where: { id: ctx.etablissementId },
      data: {
        nom: s(formData.get("nom")) ?? undefined,
        logo: logoParsed.data,
        telephone: s(formData.get("telephone")),
        email: s(formData.get("email")),
        adresse: s(formData.get("adresse")),
        ville: s(formData.get("ville")),
        siteWeb: s(formData.get("siteWeb")),
        devise: s(formData.get("devise")) ?? undefined,
        mentionsLegales: s(formData.get("mentionsLegales")),
      },
    });
    await audit({
      utilisateurId: ctx.utilisateurId,
      etablissementId: ctx.etablissementId,
      action: AuditAction.UPDATE,
      entite: "Etablissement",
      entiteId: ctx.etablissementId,
    });
    revalidatePath("/portail/parametres");
    return { succes: true, data: undefined };
  } catch (e) {
    return { succes: false, erreur: msg(e) };
  }
}

const schemaApparence = z.object({
  couleurTheme: z.enum([
    "blue", "emerald", "violet", "orange", "slate", "rose", "cyan", "amber", "indigo", "teal",
  ]),
  degradeTheme: z.enum([
    "blue", "emerald", "violet", "orange", "slate", "rose", "cyan", "amber", "indigo", "teal",
  ]),
  police: z.enum(["inter", "georgia", "arial", "verdana", "times"]),
  tailleTexte: z.enum(["sm", "base", "lg"]),
});

export async function actionMajApparence(formData: FormData): Promise<ActionResult> {
  try {
    const ctx = await requireContext();
    requirePermission(ctx.role, "parametres:manage");

    const parsed = schemaApparence.safeParse({
      couleurTheme: s(formData.get("couleurTheme")),
      degradeTheme: s(formData.get("degradeTheme")),
      police: s(formData.get("police")),
      tailleTexte: s(formData.get("tailleTexte")),
    });
    if (!parsed.success) {
      return { succes: false, erreur: "Choix invalide" };
    }

    await prisma.etablissement.update({
      where: { id: ctx.etablissementId },
      data: parsed.data,
    });

    revalidatePath("/portail", "layout");
    revalidatePath("/compta", "layout");
    revalidatePath("/parent", "layout");
    revalidatePath("/enseignant", "layout");
    return { succes: true, data: undefined };
  } catch (e) {
    return { succes: false, erreur: msg(e) };
  }
}

// ─── Périodes (trimestres/semestres) ─────────────────────────

const schemaPeriode = z.object({
  nom: z.string().min(1, "Nom requis").max(60),
  dateDebut: z.string().min(1, "Date de début requise"),
  dateFin: z.string().min(1, "Date de fin requise"),
});

export async function actionCreerPeriode(
  anneeScolaireId: string,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const ctx = await requireContext();
    requirePermission(ctx.role, "parametres:manage");

    const annee = await prisma.anneeScolaire.findFirst({
      where: { id: anneeScolaireId, etablissementId: ctx.etablissementId },
    });
    if (!annee) return { succes: false, erreur: "Année scolaire introuvable" };

    const parsed = schemaPeriode.safeParse({
      nom: s(formData.get("nom")),
      dateDebut: s(formData.get("dateDebut")),
      dateFin: s(formData.get("dateFin")),
    });
    if (!parsed.success) {
      return { succes: false, erreur: parsed.error.issues[0]?.message ?? "Données invalides" };
    }
    const dateDebut = new Date(parsed.data.dateDebut);
    const dateFin = new Date(parsed.data.dateFin);
    if (dateFin <= dateDebut) {
      return { succes: false, erreur: "La date de fin doit être après la date de début" };
    }

    const nbExistantes = await prisma.periode.count({ where: { anneeScolaireId } });

    await prisma.periode.create({
      data: {
        anneeScolaireId,
        nom: parsed.data.nom,
        ordre: nbExistantes + 1,
        dateDebut,
        dateFin,
        active: nbExistantes === 0,
      },
    });

    await audit({
      utilisateurId: ctx.utilisateurId,
      etablissementId: ctx.etablissementId,
      action: AuditAction.CREATE,
      entite: "Periode",
      apres: { nom: parsed.data.nom, anneeScolaireId },
    });

    revalidatePath("/portail/parametres");
    return { succes: true, data: undefined };
  } catch (e) {
    return { succes: false, erreur: msg(e) };
  }
}

export async function actionActiverPeriode(id: string): Promise<ActionResult> {
  try {
    const ctx = await requireContext();
    requirePermission(ctx.role, "parametres:manage");

    const periode = await prisma.periode.findFirst({
      where: { id, anneeScolaire: { etablissementId: ctx.etablissementId } },
    });
    if (!periode) return { succes: false, erreur: "Période introuvable" };

    await prisma.$transaction([
      prisma.periode.updateMany({
        where: { anneeScolaireId: periode.anneeScolaireId },
        data: { active: false },
      }),
      prisma.periode.update({ where: { id }, data: { active: true } }),
    ]);

    await audit({
      utilisateurId: ctx.utilisateurId,
      etablissementId: ctx.etablissementId,
      action: AuditAction.UPDATE,
      entite: "Periode",
      entiteId: id,
      apres: { active: true },
    });

    revalidatePath("/portail/parametres");
    return { succes: true, data: undefined };
  } catch (e) {
    return { succes: false, erreur: msg(e) };
  }
}

// ─── Assistant IA ───────────────────────────────────────────

export async function actionSoumettreIA(
  formData: FormData,
): Promise<ActionResult<{ reponse?: string }>> {
  try {
    const ctx = await requireContext();
    requirePermission(ctx.role, "ia:utiliser");
    const typeAction = (s(formData.get("typeAction")) ?? "redaction_annonce") as TypeActionIA;
    const prompt = s(formData.get("prompt"));
    if (!prompt) return { succes: false, erreur: "Décrivez votre demande" };

    const res = await soumettreDemandeIA({
      utilisateurId: ctx.utilisateurId,
      etablissementId: ctx.etablissementId,
      typeAction,
      prompt,
    });
    revalidatePath("/portail/ia");

    if (!res.succes || !res.reponse) {
      return {
        succes: false,
        erreur:
          "L'assistant IA n'a pas pu générer de réponse" +
          (res.motifEchec ? ` (${res.motifEchec.slice(0, 160)})` : "") +
          ". La demande a été enregistrée.",
      };
    }
    return { succes: true, data: { reponse: res.reponse } };
  } catch (e) {
    return { succes: false, erreur: msg(e) };
  }
}

export async function actionChatIA(
  historique: { role: "user" | "assistant"; content: string }[],
): Promise<ActionResult<{ reponse: string }>> {
  try {
    const ctx = await requireContext();
    requirePermission(ctx.role, "ia:utiliser");

    const msgs = historique
      .filter((m) => m.content?.trim())
      .slice(-12)
      .map((m) => ({ role: m.role, content: m.content.trim() })) as GrokMessage[];
    const dernier = [...msgs].reverse().find((m) => m.role === "user");
    if (!dernier) return { succes: false, erreur: "Message vide" };

    const estEnseignant =
      ctx.role === "ENSEIGNANT" || ctx.role === "PROF_PRINCIPAL";
    const contexte = estEnseignant
      ? await import("@/server/dal/enseignant")
          .then((m) => m.getContexteIAEnseignant())
          .catch(() => "")
      : await getContexteIA().catch(() => "");
    const res = await chatGrok(msgs, contexte);

    // Traçabilité (RM-14)
    await prisma.demandeIA
      .create({
        data: {
          utilisateurId: ctx.utilisateurId,
          etablissementId: ctx.etablissementId,
          typeAction: "chat",
          prompt: dernier.content,
          reponse: res.reponse,
          contexte: {},
          statut: res.success ? "repondu" : "en_attente",
        },
      })
      .catch(() => null);

    if (!res.success || !res.reponse) {
      return {
        succes: false,
        erreur:
          "L'assistant n'a pas pu répondre" +
          (res.motifEchec ? ` (${res.motifEchec.slice(0, 140)})` : "") +
          ".",
      };
    }
    revalidatePath("/portail/ia");
    return { succes: true, data: { reponse: res.reponse } };
  } catch (e) {
    return { succes: false, erreur: msg(e) };
  }
}

export async function actionValiderIA(id: string, accepter: boolean): Promise<ActionResult> {
  try {
    const ctx = await requireContext();
    requirePermission(ctx.role, "ia:valider");
    if (accepter) {
      await validerReponseIA({ demandeId: id, valideParId: ctx.utilisateurId, etablissementId: ctx.etablissementId });
    } else {
      await rejeterReponseIA(id);
    }
    revalidatePath("/portail/ia");
    return { succes: true, data: undefined };
  } catch (e) {
    return { succes: false, erreur: msg(e) };
  }
}

// ─── Messagerie ─────────────────────────────────────────────

export async function actionCreerConversation(
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  try {
    const ctx = await requireContext();
    const destinataireId = s(formData.get("destinataireId"));
    const sujet = s(formData.get("sujet"));
    const premierMessage = s(formData.get("message"));
    if (!destinataireId || !premierMessage) {
      return { succes: false, erreur: "Destinataire et message requis" };
    }
    const dest = await prisma.utilisateurEtablissement.findFirst({
      where: { utilisateurId: destinataireId, etablissementId: ctx.etablissementId },
    });
    if (!dest) return { succes: false, erreur: "Destinataire invalide" };

    const conv = await prisma.conversation.create({
      data: {
        etablissementId: ctx.etablissementId,
        sujet,
        participants: {
          create: [
            { utilisateurId: ctx.utilisateurId, luJusquA: new Date() },
            { utilisateurId: destinataireId },
          ],
        },
        messages: { create: { expediteurId: ctx.utilisateurId, contenu: premierMessage } },
      },
    });
    revalidatePath("/portail/messagerie");
    return { succes: true, data: { id: conv.id } };
  } catch (e) {
    return { succes: false, erreur: msg(e) };
  }
}

export async function actionEnvoyerMessage(
  conversationId: string,
  contenu: string,
): Promise<ActionResult> {
  try {
    const ctx = await requireContext();
    if (!contenu.trim()) return { succes: false, erreur: "Message vide" };
    const part = await prisma.participantConversation.findFirst({
      where: { conversationId, utilisateurId: ctx.utilisateurId },
    });
    if (!part) return { succes: false, erreur: "Conversation introuvable" };

    await prisma.$transaction([
      prisma.message.create({
        data: { conversationId, expediteurId: ctx.utilisateurId, contenu: contenu.trim() },
      }),
      prisma.conversation.update({ where: { id: conversationId }, data: { updatedAt: new Date() } }),
      prisma.participantConversation.updateMany({
        where: { conversationId, utilisateurId: ctx.utilisateurId },
        data: { luJusquA: new Date() },
      }),
    ]);
    revalidatePath("/portail/messagerie");
    revalidatePath(`/portail/messagerie/${conversationId}`);
    return { succes: true, data: undefined };
  } catch (e) {
    return { succes: false, erreur: msg(e) };
  }
}
