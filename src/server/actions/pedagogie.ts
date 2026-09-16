"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireContext, requirePermission } from "@/server/context";
import { audit, AuditAction } from "@/server/logs/audit";
import type { ActionResult } from "./eleves";

import { messageErreur as msg } from "@/server/errors";
const s = (v: FormDataEntryValue | null) => {
  const t = typeof v === "string" ? v.trim() : "";
  return t === "" ? undefined : t;
};

/** Matricule enseignant : initiale du prénom + initiale du nom + 4 derniers chiffres du téléphone. */
function genererMatriculeEnseignant(prenom: string, nom: string, telephone?: string): string {
  const i1 = prenom.trim().charAt(0).toUpperCase() || "X";
  const i2 = nom.trim().charAt(0).toUpperCase() || "X";
  const chiffres = (telephone ?? "").replace(/\D/g, "");
  const derniersChiffres = chiffres.slice(-4).padStart(4, "0");
  return `${i1}${i2}${derniersChiffres}`;
}

// ─── Cycles & Niveaux ────────────────────────────────────────

export async function actionCreerCycle(formData: FormData): Promise<ActionResult> {
  try {
    const ctx = await requireContext();
    requirePermission(ctx.role, "classe:manage");
    const nom = s(formData.get("nom"));
    const ordre = Number(formData.get("ordre") ?? 0);
    if (!nom) return { succes: false, erreur: "Le nom du cycle est requis" };

    const [etablissement, nbCycles] = await Promise.all([
      prisma.etablissement.findUnique({
        where: { id: ctx.etablissementId },
        select: { limiteCycles: true },
      }),
      prisma.cycle.count({ where: { etablissementId: ctx.etablissementId } }),
    ]);
    if (nbCycles >= (etablissement?.limiteCycles ?? 0)) {
      return {
        succes: false,
        erreur: `Limite de ${etablissement?.limiteCycles ?? 0} cycle(s) atteinte pour votre abonnement. Contactez SAIMO pour l'étendre.`,
      };
    }

    await prisma.cycle.create({
      data: { etablissementId: ctx.etablissementId, nom, ordre },
    });
    revalidatePath("/portail/cycles");
    return { succes: true, data: undefined };
  } catch (e) {
    return { succes: false, erreur: msg(e) };
  }
}

export async function actionModifierCycle(
  id: string,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const ctx = await requireContext();
    requirePermission(ctx.role, "classe:manage");
    const c = await prisma.cycle.findFirst({
      where: { id, etablissementId: ctx.etablissementId },
    });
    if (!c) return { succes: false, erreur: "Cycle introuvable" };
    const nom = s(formData.get("nom"));
    await prisma.cycle.update({
      where: { id },
      data: {
        nom: nom ?? c.nom,
        ordre: formData.get("ordre") != null ? Number(formData.get("ordre")) : c.ordre,
      },
    });
    revalidatePath("/portail/cycles");
    return { succes: true, data: undefined };
  } catch (e) {
    return { succes: false, erreur: msg(e) };
  }
}

export async function actionCreerNiveau(formData: FormData): Promise<ActionResult> {
  try {
    const ctx = await requireContext();
    requirePermission(ctx.role, "classe:manage");
    const cycleId = s(formData.get("cycleId"));
    const nom = s(formData.get("nom"));
    const ordre = Number(formData.get("ordre") ?? 0);
    if (!cycleId || !nom) return { succes: false, erreur: "Cycle et nom requis" };

    const cycle = await prisma.cycle.findFirst({
      where: { id: cycleId, etablissementId: ctx.etablissementId },
    });
    if (!cycle) return { succes: false, erreur: "Cycle introuvable" };

    await prisma.niveau.create({ data: { cycleId, nom, ordre } });
    revalidatePath("/portail/cycles");
    return { succes: true, data: undefined };
  } catch (e) {
    return { succes: false, erreur: msg(e) };
  }
}

export async function actionModifierNiveau(
  id: string,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const ctx = await requireContext();
    requirePermission(ctx.role, "classe:manage");
    const n = await prisma.niveau.findFirst({
      where: { id, cycle: { etablissementId: ctx.etablissementId } },
    });
    if (!n) return { succes: false, erreur: "Niveau introuvable" };
    const nom = s(formData.get("nom"));
    await prisma.niveau.update({
      where: { id },
      data: {
        nom: nom ?? n.nom,
        ordre: formData.get("ordre") != null ? Number(formData.get("ordre")) : n.ordre,
      },
    });
    revalidatePath("/portail/cycles");
    return { succes: true, data: undefined };
  } catch (e) {
    return { succes: false, erreur: msg(e) };
  }
}

// ─── Matières ────────────────────────────────────────────────

const schemaMatiere = z.object({
  nom: z.string().min(1).max(120),
  code: z.string().max(20).optional(),
  coefficient: z.coerce.number().min(0).max(20).default(1),
  niveauIds: z.array(z.string()).default([]),
});

export async function actionCreerMatiere(formData: FormData): Promise<ActionResult> {
  try {
    const ctx = await requireContext();
    requirePermission(ctx.role, "matiere:manage");

    const parsed = schemaMatiere.safeParse({
      nom: formData.get("nom"),
      code: s(formData.get("code")),
      coefficient: formData.get("coefficient") ?? 1,
      niveauIds: formData.getAll("niveauIds").map(String),
    });
    if (!parsed.success) {
      return { succes: false, erreur: parsed.error.issues[0]?.message ?? "Données invalides" };
    }

    const niveaux = await prisma.niveau.findMany({
      where: { id: { in: parsed.data.niveauIds }, cycle: { etablissementId: ctx.etablissementId } },
      select: { id: true },
    });

    await prisma.matiere.create({
      data: {
        etablissementId: ctx.etablissementId,
        nom: parsed.data.nom,
        code: parsed.data.code,
        niveaux: {
          create: niveaux.map((n) => ({
            niveauId: n.id,
            coefficient: parsed.data.coefficient,
          })),
        },
      },
    });
    revalidatePath("/portail/matieres");
    return { succes: true, data: undefined };
  } catch (e) {
    return { succes: false, erreur: msg(e) };
  }
}

export async function actionModifierMatiere(
  id: string,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const ctx = await requireContext();
    requirePermission(ctx.role, "matiere:manage");

    const m = await prisma.matiere.findFirst({
      where: { id, etablissementId: ctx.etablissementId },
    });
    if (!m) return { succes: false, erreur: "Matière introuvable" };

    const parsed = schemaMatiere.safeParse({
      nom: formData.get("nom"),
      code: s(formData.get("code")),
      coefficient: formData.get("coefficient") ?? 1,
      niveauIds: formData.getAll("niveauIds").map(String),
    });
    if (!parsed.success) {
      return { succes: false, erreur: parsed.error.issues[0]?.message ?? "Données invalides" };
    }

    const niveaux = await prisma.niveau.findMany({
      where: { id: { in: parsed.data.niveauIds }, cycle: { etablissementId: ctx.etablissementId } },
      select: { id: true },
    });

    await prisma.$transaction([
      prisma.matiere.update({
        where: { id },
        data: { nom: parsed.data.nom, code: parsed.data.code },
      }),
      prisma.matiereNiveau.deleteMany({ where: { matiereId: id } }),
      ...(niveaux.length
        ? [
            prisma.matiereNiveau.createMany({
              data: niveaux.map((n) => ({
                matiereId: id,
                niveauId: n.id,
                coefficient: parsed.data.coefficient,
              })),
            }),
          ]
        : []),
    ]);

    revalidatePath("/portail/matieres");
    return { succes: true, data: undefined };
  } catch (e) {
    return { succes: false, erreur: msg(e) };
  }
}

export async function actionBasculerMatiere(id: string): Promise<ActionResult> {
  try {
    const ctx = await requireContext();
    requirePermission(ctx.role, "matiere:manage");
    const m = await prisma.matiere.findFirst({
      where: { id, etablissementId: ctx.etablissementId },
    });
    if (!m) return { succes: false, erreur: "Matière introuvable" };
    await prisma.matiere.update({ where: { id }, data: { actif: !m.actif } });
    revalidatePath("/portail/matieres");
    return { succes: true, data: undefined };
  } catch (e) {
    return { succes: false, erreur: msg(e) };
  }
}

// ─── Classes ─────────────────────────────────────────────────

const schemaClasse = z.object({
  nom: z.string().min(1).max(60),
  niveauId: z.string().min(1),
  salle: z.string().max(40).optional(),
  capacite: z.coerce.number().int().positive().optional(),
});

export async function actionCreerClasse(formData: FormData): Promise<ActionResult<{ id: string }>> {
  try {
    const ctx = await requireContext();
    requirePermission(ctx.role, "classe:manage");

    const parsed = schemaClasse.safeParse({
      nom: formData.get("nom"),
      niveauId: formData.get("niveauId"),
      salle: s(formData.get("salle")),
      capacite: s(formData.get("capacite")),
    });
    if (!parsed.success) {
      return { succes: false, erreur: parsed.error.issues[0]?.message ?? "Données invalides" };
    }

    const niveau = await prisma.niveau.findFirst({
      where: { id: parsed.data.niveauId, cycle: { etablissementId: ctx.etablissementId } },
    });
    if (!niveau) return { succes: false, erreur: "Niveau invalide" };

    const classe = await prisma.classe.create({
      data: {
        etablissementId: ctx.etablissementId,
        anneeScolaireId: ctx.anneeScolaireId,
        niveauId: parsed.data.niveauId,
        nom: parsed.data.nom,
        salle: parsed.data.salle,
        capacite: parsed.data.capacite,
      },
    });
    await audit({
      utilisateurId: ctx.utilisateurId,
      etablissementId: ctx.etablissementId,
      action: AuditAction.CREATE,
      entite: "Classe",
      entiteId: classe.id,
      apres: { nom: classe.nom },
    });
    revalidatePath("/portail/classes");
    return { succes: true, data: { id: classe.id } };
  } catch (e) {
    return { succes: false, erreur: msg(e) };
  }
}

export async function actionModifierClasse(
  id: string,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const ctx = await requireContext();
    requirePermission(ctx.role, "classe:manage");
    const existante = await prisma.classe.findFirst({
      where: { id, etablissementId: ctx.etablissementId },
    });
    if (!existante) return { succes: false, erreur: "Classe introuvable" };

    const parsed = schemaClasse.partial().safeParse({
      nom: s(formData.get("nom")),
      niveauId: s(formData.get("niveauId")),
      salle: s(formData.get("salle")),
      capacite: s(formData.get("capacite")),
    });
    if (!parsed.success) {
      return { succes: false, erreur: parsed.error.issues[0]?.message ?? "Données invalides" };
    }

    // Ne pas ré-écrire le nom s'il est inchangé (évite la contrainte unique sur un no-op).
    const data: Record<string, unknown> = { ...parsed.data };
    if (data.nom === undefined || data.nom === existante.nom) {
      delete data.nom;
    } else {
      const conflit = await prisma.classe.findFirst({
        where: {
          etablissementId: ctx.etablissementId,
          anneeScolaireId: existante.anneeScolaireId,
          nom: data.nom as string,
          id: { not: id },
        },
        select: { id: true },
      });
      if (conflit) {
        return { succes: false, erreur: "Une autre classe porte déjà ce nom cette année." };
      }
    }
    if (data.niveauId) {
      const niveau = await prisma.niveau.findFirst({
        where: { id: data.niveauId as string, cycle: { etablissementId: ctx.etablissementId } },
        select: { id: true },
      });
      if (!niveau) return { succes: false, erreur: "Niveau invalide" };
    }

    await prisma.classe.update({ where: { id }, data });
    revalidatePath("/portail/classes");
    revalidatePath(`/portail/classes/${id}`);
    return { succes: true, data: undefined };
  } catch (e) {
    return { succes: false, erreur: msg(e) };
  }
}

// ─── Enseignants ─────────────────────────────────────────────

const schemaEnseignant = z.object({
  prenom: z.string().min(1).max(80),
  nom: z.string().min(1).max(80),
  email: z.string().email(),
  telephone: z.string().max(30).optional(),
  specialite: z.string().max(120).optional(),
});

export async function actionCreerEnseignant(
  formData: FormData,
): Promise<ActionResult<{ id: string; motDePasse: string }>> {
  try {
    const ctx = await requireContext();
    requirePermission(ctx.role, "enseignant:manage");

    const parsed = schemaEnseignant.safeParse({
      prenom: formData.get("prenom"),
      nom: formData.get("nom"),
      email: formData.get("email"),
      telephone: s(formData.get("telephone")),
      specialite: s(formData.get("specialite")),
    });
    if (!parsed.success) {
      return { succes: false, erreur: parsed.error.issues[0]?.message ?? "Données invalides" };
    }

    const existant = await prisma.utilisateur.findUnique({
      where: { email: parsed.data.email },
    });
    if (existant) return { succes: false, erreur: "Cet email est déjà utilisé" };

    const bcrypt = (await import("bcryptjs")).default;
    const motDePasse = "Bienvenue123!";
    const motDePasseHash = await bcrypt.hash(motDePasse, 10);

    const enseignant = await prisma.$transaction(async (tx) => {
      const u = await tx.utilisateur.create({
        data: {
          email: parsed.data.email,
          prenom: parsed.data.prenom,
          nom: parsed.data.nom,
          telephone: parsed.data.telephone,
          motDePasseHash,
          etablissements: {
            create: { etablissementId: ctx.etablissementId, role: "ENSEIGNANT" },
          },
        },
      });
      return tx.enseignant.create({
        data: {
          utilisateurId: u.id,
          etablissementId: ctx.etablissementId,
          specialite: parsed.data.specialite,
          matricule: genererMatriculeEnseignant(
            parsed.data.prenom,
            parsed.data.nom,
            parsed.data.telephone,
          ),
        },
      });
    });

    await audit({
      utilisateurId: ctx.utilisateurId,
      etablissementId: ctx.etablissementId,
      action: AuditAction.CREATE,
      entite: "Enseignant",
      entiteId: enseignant.id,
      apres: { email: parsed.data.email },
    });

    try {
      const [etab, { envoyerIdentifiantsCompte }, { appUrl }] = await Promise.all([
        prisma.etablissement.findUnique({
          where: { id: ctx.etablissementId },
          select: { nom: true },
        }),
        import("@/server/external/email.service"),
        import("@/lib/url"),
      ]);
      await envoyerIdentifiantsCompte({
        email: parsed.data.email,
        prenom: parsed.data.prenom,
        motDePasse,
        roleLibelle: "Enseignant",
        etablissementNom: etab?.nom ?? "SAIMO Ecole",
        lienConnexion: appUrl("/connexion"),
        etablissementId: ctx.etablissementId,
      });
    } catch (e) {
      console.error("[email identifiants enseignant]", e);
    }

    revalidatePath("/portail/enseignants");
    return { succes: true, data: { id: enseignant.id, motDePasse } };
  } catch (e) {
    return { succes: false, erreur: msg(e) };
  }
}

// ─── Affectations ────────────────────────────────────────────

export async function actionCreerAffectation(
  formData: FormData,
): Promise<ActionResult> {
  try {
    const ctx = await requireContext();
    requirePermission(ctx.role, "enseignant:manage");

    const enseignantId = s(formData.get("enseignantId"));
    const classeId = s(formData.get("classeId"));
    const matiereId = s(formData.get("matiereId"));
    const profPrincipal = formData.get("profPrincipal") === "on";
    if (!enseignantId || !classeId || !matiereId) {
      return { succes: false, erreur: "Enseignant, classe et matière requis" };
    }

    const [classe, ens] = await Promise.all([
      prisma.classe.findFirst({ where: { id: classeId, etablissementId: ctx.etablissementId } }),
      prisma.enseignant.findFirst({ where: { id: enseignantId, etablissementId: ctx.etablissementId } }),
    ]);
    if (!classe || !ens) return { succes: false, erreur: "Classe ou enseignant invalide" };

    await prisma.affectationEnseignant.create({
      data: {
        enseignantId,
        classeId,
        matiereId,
        anneeScolaireId: ctx.anneeScolaireId,
        estProfPrincipal: profPrincipal,
      },
    });
    revalidatePath("/portail/affectations");
    revalidatePath(`/portail/classes/${classeId}`);
    return { succes: true, data: undefined };
  } catch (e) {
    return { succes: false, erreur: msg(e) };
  }
}

export async function actionSupprimerAffectation(id: string): Promise<ActionResult> {
  try {
    const ctx = await requireContext();
    requirePermission(ctx.role, "enseignant:manage");
    const aff = await prisma.affectationEnseignant.findFirst({
      where: { id, classe: { etablissementId: ctx.etablissementId } },
    });
    if (!aff) return { succes: false, erreur: "Affectation introuvable" };
    await prisma.affectationEnseignant.delete({ where: { id } });
    revalidatePath("/portail/affectations");
    return { succes: true, data: undefined };
  } catch (e) {
    return { succes: false, erreur: msg(e) };
  }
}

// ─── Emploi du temps ─────────────────────────────────────────

export async function actionCreerCreneau(formData: FormData): Promise<ActionResult> {
  try {
    const ctx = await requireContext();
    requirePermission(ctx.role, "classe:manage");

    const classeId = s(formData.get("classeId"));
    const matiereId = s(formData.get("matiereId"));
    const enseignantId = s(formData.get("enseignantId"));
    const jour = Number(formData.get("jour"));
    const heureDebut = s(formData.get("heureDebut"));
    const heureFin = s(formData.get("heureFin"));
    const salle = s(formData.get("salle"));
    if (!classeId || !matiereId || !heureDebut || !heureFin || !jour) {
      return { succes: false, erreur: "Classe, matière, jour et horaires requis" };
    }

    const classe = await prisma.classe.findFirst({
      where: { id: classeId, etablissementId: ctx.etablissementId },
    });
    if (!classe) return { succes: false, erreur: "Classe invalide" };

    await prisma.creneauCours.create({
      data: {
        etablissementId: ctx.etablissementId,
        anneeScolaireId: ctx.anneeScolaireId,
        classeId,
        matiereId,
        enseignantId: enseignantId ?? null,
        jour,
        heureDebut,
        heureFin,
        salle,
      },
    });
    revalidatePath("/portail/emploi-du-temps");
    return { succes: true, data: undefined };
  } catch (e) {
    return { succes: false, erreur: msg(e) };
  }
}

export async function actionModifierCreneau(
  id: string,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const ctx = await requireContext();
    requirePermission(ctx.role, "classe:manage");

    const cr = await prisma.creneauCours.findFirst({
      where: { id, etablissementId: ctx.etablissementId },
    });
    if (!cr) return { succes: false, erreur: "Créneau introuvable" };

    const classeId = s(formData.get("classeId"));
    const matiereId = s(formData.get("matiereId"));
    const enseignantId = s(formData.get("enseignantId"));
    const jour = formData.get("jour") != null ? Number(formData.get("jour")) : cr.jour;
    const heureDebut = s(formData.get("heureDebut"));
    const heureFin = s(formData.get("heureFin"));

    if (classeId) {
      const classe = await prisma.classe.findFirst({
        where: { id: classeId, etablissementId: ctx.etablissementId },
      });
      if (!classe) return { succes: false, erreur: "Classe invalide" };
    }

    await prisma.creneauCours.update({
      where: { id },
      data: {
        classeId: classeId ?? cr.classeId,
        matiereId: matiereId ?? cr.matiereId,
        enseignantId: formData.has("enseignantId") ? enseignantId ?? null : cr.enseignantId,
        jour,
        heureDebut: heureDebut ?? cr.heureDebut,
        heureFin: heureFin ?? cr.heureFin,
        salle: formData.has("salle") ? s(formData.get("salle")) ?? null : cr.salle,
      },
    });
    revalidatePath("/portail/emploi-du-temps");
    return { succes: true, data: undefined };
  } catch (e) {
    return { succes: false, erreur: msg(e) };
  }
}

export async function actionSupprimerCreneau(id: string): Promise<ActionResult> {
  try {
    const ctx = await requireContext();
    requirePermission(ctx.role, "classe:manage");
    const cr = await prisma.creneauCours.findFirst({
      where: { id, etablissementId: ctx.etablissementId },
    });
    if (!cr) return { succes: false, erreur: "Créneau introuvable" };
    await prisma.creneauCours.delete({ where: { id } });
    revalidatePath("/portail/emploi-du-temps");
    return { succes: true, data: undefined };
  } catch (e) {
    return { succes: false, erreur: msg(e) };
  }
}

// ─── Types d'évaluation ────────────────────────────────────────

const schemaTypeEvaluation = z.object({
  nom: z.string().min(1, "Le nom est requis").max(60),
  noteMaximale: z.coerce.number().positive("Barème invalide").max(1000),
});

export async function actionCreerTypeEvaluation(formData: FormData): Promise<ActionResult> {
  try {
    const ctx = await requireContext();
    requirePermission(ctx.role, "classe:manage");

    const parsed = schemaTypeEvaluation.safeParse({
      nom: s(formData.get("nom")),
      noteMaximale: formData.get("noteMaximale") || 20,
    });
    if (!parsed.success) {
      return { succes: false, erreur: parsed.error.issues[0]?.message ?? "Données invalides" };
    }

    await prisma.typeEvaluation.create({
      data: {
        etablissementId: ctx.etablissementId,
        nom: parsed.data.nom,
        noteMaximale: parsed.data.noteMaximale,
      },
    });
    revalidatePath("/portail/parametres");
    return { succes: true, data: undefined };
  } catch (e) {
    return { succes: false, erreur: msg(e) };
  }
}

export async function actionSupprimerTypeEvaluation(id: string): Promise<ActionResult> {
  try {
    const ctx = await requireContext();
    requirePermission(ctx.role, "classe:manage");
    const type = await prisma.typeEvaluation.findFirst({
      where: { id, etablissementId: ctx.etablissementId },
    });
    if (!type) return { succes: false, erreur: "Type d'évaluation introuvable" };
    await prisma.typeEvaluation.delete({ where: { id } });
    revalidatePath("/portail/parametres");
    return { succes: true, data: undefined };
  } catch (e) {
    return { succes: false, erreur: msg(e) };
  }
}
