import type { NextAuthConfig } from "next-auth";
import type { RoleUtilisateur } from "@prisma/client";

// Préfixes d'espaces authentifiés.
const PROTECTED_PREFIXES = ["/portail", "/compta", "/parent", "/enseignant", "/saimo-admin"];
// Pages de connexion (un utilisateur déjà connecté n'a rien à y faire).
const AUTH_PAGES = ["/connexion", "/login"];

const matchesPrefix = (pathname: string, prefixes: string[]) =>
  prefixes.some((p) => pathname === p || pathname.startsWith(`${p}/`));

/**
 * Page d'accueil par défaut selon le rôle.
 * Réutilisé par le proxy, les Server Actions de connexion et les layouts de segment.
 */
export function homeForRole(role?: string | null): string {
  if (role === "SUPER_ADMIN_SAIMO") return "/saimo-admin";
  if (role === "COMPTABLE") return "/compta";
  if (role === "PARENT" || role === "ELEVE") return "/parent";
  if (role === "ENSEIGNANT" || role === "PROF_PRINCIPAL") return "/enseignant";
  return "/portail";
}

export const authConfig = {
  pages: {
    signIn: "/connexion",
  },
  callbacks: {
    // Contrôle « optimiste » exécuté par le proxy. L'enforcement fin par rôle
    // se fait dans src/app/{portail,compta,parent}/layout.tsx et la couche DAL.
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const { pathname } = nextUrl;

      if (matchesPrefix(pathname, PROTECTED_PREFIXES)) {
        return isLoggedIn; // false → redirection vers pages.signIn
      }

      if (isLoggedIn && matchesPrefix(pathname, AUTH_PAGES)) {
        const role = (auth?.user as { role?: string } | undefined)?.role;
        return Response.redirect(new URL(homeForRole(role), nextUrl));
      }

      return true;
    },
    jwt({ token, user, trigger, session }) {
      if (user) {
        token.id = user.id;
        token.etablissementId = user.etablissementId;
        token.role = user.role;
      }
      // Bascule d'établissement via useSession().update({ etablissementId, role }).
      if (trigger === "update" && session?.etablissementId) {
        token.etablissementId = session.etablissementId;
        token.role = session.role;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        if (token.sub) session.user.id = token.sub;
        if (token.role) session.user.role = token.role as RoleUtilisateur;
        if (token.etablissementId) {
          session.user.etablissementId = token.etablissementId as string;
        }
      }
      return session;
    },
  },
  providers: [], // Les providers (Credentials) sont ajoutés dans src/lib/auth.ts
} satisfies NextAuthConfig;
