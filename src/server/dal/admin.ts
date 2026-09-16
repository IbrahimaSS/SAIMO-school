import "server-only";

import { cache } from "react";
import { notFound } from "next/navigation";
import type { RoleUtilisateur } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireContext, requirePermission, getSession } from "@/server/context";
import { formatDateCourte, formatDateLongue } from "@/lib/format";
import { libelleRole } from "@/lib/roles-labels";

// ─── Annonces ───────────────────────────────────────────────

export interface AnnonceDTO {
  id: string;
  titre: string;
  contenu: string;
  publie: boolean;
  rolesVises: string[];
  datePublication: string | null;
  auteur: string | null;
}

export async function listerAnnonces(): Promise<AnnonceDTO[]> {
  const { etablissementId, role } = await requireContext();
  requirePermission(role, "annonce:view");

  const annonces = await prisma.annonce.findMany({
    where: { etablissementId },
    orderBy: { createdAt: "desc" },
  });

  const auteurIds = [...new Set(annonces.map((a) => a.creePar).filter(Boolean))] as string[];
  const auteurs = auteurIds.length
    ? await prisma.utilisateur.findMany({
        where: { id: { in: auteurIds } },
        select: { id: true, prenom: true, nom: true },
      })
    : [];
  const nomAuteur = new Map(auteurs.map((u) => [u.id, `${u.prenom} ${u.nom}`]));

  return annonces.map((a) => ({
    id: a.id,
    titre: a.titre,
    contenu: a.contenu,
    publie: a.publie,
    rolesVises: Array.isArray(a.rolesVises) ? (a.rolesVises as string[]) : [],
    datePublication: a.datePublication ? formatDateLongue(a.datePublication) : null,
    auteur: a.creePar ? nomAuteur.get(a.creePar) ?? null : null,
  }));
}

// ─── Utilisateurs ───────────────────────────────────────────

export interface UtilisateurDTO {
  id: string;
  nom: string;
  email: string;
  telephone: string | null;
  role: RoleUtilisateur;
  roleLibelle: string;
  actif: boolean;
  derniereConnexion: string | null;
}

export async function listerUtilisateurs(): Promise<UtilisateurDTO[]> {
  const { etablissementId, role } = await requireContext();
  requirePermission(role, "utilisateur:view");

  const liens = await prisma.utilisateurEtablissement.findMany({
    where: { etablissementId },
    include: { utilisateur: true },
    orderBy: { utilisateur: { nom: "asc" } },
  });

  return liens.map((l) => ({
    id: l.utilisateur.id,
    nom: `${l.utilisateur.prenom} ${l.utilisateur.nom}`,
    email: l.utilisateur.email,
    telephone: l.utilisateur.telephone,
    role: l.role,
    roleLibelle: libelleRole(l.role),
    actif: l.utilisateur.actif && l.actif,
    derniereConnexion: l.utilisateur.derniereConnexion
      ? formatDateLongue(l.utilisateur.derniereConnexion)
      : null,
  }));
}

// ─── Journal d'audit ────────────────────────────────────────

export interface AuditRowDTO {
  id: string;
  action: string;
  entite: string;
  entiteId: string | null;
  who: string;
  ip: string | null;
  date: string;
  detail: string;
}

export async function listerAudit(params: { q?: string; entite?: string }): Promise<AuditRowDTO[]> {
  const { etablissementId, role } = await requireContext();
  requirePermission(role, "audit:view");

  const logs = await prisma.journalAudit.findMany({
    where: {
      etablissementId,
      ...(params.entite ? { entite: params.entite } : {}),
    },
    include: { utilisateur: { select: { prenom: true, nom: true } } },
    orderBy: { createdAt: "desc" },
    take: 300,
  });

  const filtre = params.q?.toLowerCase().trim();
  return logs
    .map((l) => ({
      id: l.id,
      action: l.action,
      entite: l.entite,
      entiteId: l.entiteId,
      who: l.utilisateur ? `${l.utilisateur.prenom} ${l.utilisateur.nom}` : "Système",
      ip: l.ipAdresse,
      date: formatDateLongue(l.createdAt),
      detail: l.apres ? JSON.stringify(l.apres) : l.avant ? JSON.stringify(l.avant) : "",
    }))
    .filter(
      (l) =>
        !filtre ||
        l.entite.toLowerCase().includes(filtre) ||
        l.who.toLowerCase().includes(filtre) ||
        l.action.toLowerCase().includes(filtre),
    );
}

// ─── Paramètres établissement ──────────────────────────────

export async function getParametresEtablissement() {
  const { etablissementId, role } = await requireContext();
  requirePermission(role, "parametres:manage");

  const [etab, annees, params] = await Promise.all([
    prisma.etablissement.findUnique({ where: { id: etablissementId } }),
    prisma.anneeScolaire.findMany({
      where: { etablissementId },
      orderBy: { dateDebut: "desc" },
      include: { periodes: { orderBy: { ordre: "asc" } } },
    }),
    prisma.parametre.findMany({ where: { etablissementId } }),
  ]);
  if (!etab) notFound();

  return {
    etablissement: {
      nom: etab.nom,
      code: etab.code,
      logo: etab.logo,
      telephone: etab.telephone,
      email: etab.email,
      adresse: etab.adresse,
      ville: etab.ville,
      pays: etab.pays,
      devise: etab.devise,
      siteWeb: etab.siteWeb,
      mentionsLegales: etab.mentionsLegales,
      couleurTheme: etab.couleurTheme,
      degradeTheme: etab.degradeTheme,
      police: etab.police,
      tailleTexte: etab.tailleTexte,
    },
    annees: annees.map((a) => ({
      id: a.id,
      libelle: a.libelle,
      active: a.active,
      verrouillee: a.verrouillee,
      debut: formatDateCourte(a.dateDebut),
      fin: formatDateCourte(a.dateFin),
      periodes: a.periodes.map((p) => ({
        id: p.id,
        nom: p.nom,
        active: p.active,
        debut: formatDateCourte(p.dateDebut),
        fin: formatDateCourte(p.dateFin),
      })),
    })),
    parametres: params.map((p) => ({ cle: p.cle, valeur: p.valeur, description: p.description })),
  };
}

// ─── Assistant IA ───────────────────────────────────────────

export async function listerDemandesIA() {
  const { etablissementId, utilisateurId, role } = await requireContext();
  requirePermission(role, "ia:utiliser");

  const demandes = await prisma.demandeIA.findMany({
    where: { etablissementId },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  const peutValider = role === "ADMIN_ETABLISSEMENT" || role === "DIRECTEUR";

  return {
    peutValider,
    demandes: demandes.map((d) => ({
      id: d.id,
      typeAction: d.typeAction,
      prompt: d.prompt,
      reponse: d.reponse,
      statut: d.statut,
      utilise: d.utilise,
      mienne: d.utilisateurId === utilisateurId,
      date: formatDateLongue(d.createdAt),
    })),
  };
}

// ─── Messagerie ─────────────────────────────────────────────

export interface ConversationApercu {
  id: string;
  sujet: string | null;
  interlocuteurs: string;
  dernierMessage: string;
  dernierAuteur: string;
  quand: string;
  nonLus: number;
}

export async function listerConversations(): Promise<ConversationApercu[]> {
  const session = await getSession();
  const uid = session?.user?.id;
  if (!uid) return [];
  const { etablissementId } = await requireContext();

  const convs = await prisma.conversation.findMany({
    where: { etablissementId, participants: { some: { utilisateurId: uid } } },
    include: {
      participants: { include: { utilisateur: { select: { id: true, prenom: true, nom: true } } } },
      messages: {
        orderBy: { createdAt: "desc" },
        take: 1,
        include: { expediteur: { select: { prenom: true, nom: true } } },
      },
    },
    orderBy: { updatedAt: "desc" },
  });

  const result: ConversationApercu[] = [];
  for (const c of convs) {
    const moi = c.participants.find((p) => p.utilisateurId === uid);
    const autres = c.participants
      .filter((p) => p.utilisateurId !== uid)
      .map((p) => `${p.utilisateur.prenom} ${p.utilisateur.nom}`)
      .join(", ");
    const nonLus = await prisma.message.count({
      where: {
        conversationId: c.id,
        expediteurId: { not: uid },
        ...(moi?.luJusquA ? { createdAt: { gt: moi.luJusquA } } : {}),
      },
    });
    const dm = c.messages[0];
    result.push({
      id: c.id,
      sujet: c.sujet,
      interlocuteurs: autres || "Conversation",
      dernierMessage: dm?.contenu ?? "",
      dernierAuteur: dm ? `${dm.expediteur.prenom} ${dm.expediteur.nom}` : "",
      quand: formatDateLongue(c.updatedAt),
      nonLus,
    });
  }
  return result;
}

export async function listerContactsMessagerie() {
  const { etablissementId, utilisateurId } = await requireContext();
  const liens = await prisma.utilisateurEtablissement.findMany({
    where: {
      etablissementId,
      actif: true,
      utilisateurId: { not: utilisateurId },
      utilisateur: { actif: true },
    },
    include: { utilisateur: { select: { id: true, prenom: true, nom: true } } },
    orderBy: { utilisateur: { nom: "asc" } },
  });
  return liens.map((l) => ({
    id: l.utilisateur.id,
    nom: `${l.utilisateur.prenom} ${l.utilisateur.nom}`,
    role: libelleRole(l.role),
  }));
}

export const getConversation = cache(async (id: string) => {
  const session = await getSession();
  const uid = session?.user?.id;
  const { etablissementId } = await requireContext();

  const c = await prisma.conversation.findFirst({
    where: { id, etablissementId, participants: { some: { utilisateurId: uid } } },
    include: {
      participants: { include: { utilisateur: { select: { id: true, prenom: true, nom: true } } } },
      messages: {
        orderBy: { createdAt: "asc" },
        include: { expediteur: { select: { id: true, prenom: true, nom: true } } },
      },
    },
  });
  if (!c) notFound();

  // marquer lu
  await prisma.participantConversation.updateMany({
    where: { conversationId: id, utilisateurId: uid },
    data: { luJusquA: new Date() },
  });

  return {
    id: c.id,
    sujet: c.sujet,
    participants: c.participants.map((p) => `${p.utilisateur.prenom} ${p.utilisateur.nom}`),
    messages: c.messages.map((m) => ({
      id: m.id,
      contenu: m.contenu,
      auteur: `${m.expediteur.prenom} ${m.expediteur.nom}`,
      mien: m.expediteurId === uid,
      quand: formatDateLongue(m.createdAt),
    })),
  };
});
