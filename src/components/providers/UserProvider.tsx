"use client";

import { createContext, useContext, useEffect } from "react";
import type { RoleUtilisateur } from "@prisma/client";

export interface CurrentUser {
  id: string;
  name: string;
  email: string;
  photo: string | null;
  role: RoleUtilisateur;
  etablissementNom: string | null;
  etablissementLogo: string | null;
  theme: {
    primary: string;
    primaryLight: string;
    sidebarFrom: string;
    sidebarTo: string;
    fontFamily: string;
    fontSize: string;
  };
}

const UserContext = createContext<CurrentUser | null>(null);

export function UserProvider({
  value,
  children,
}: {
  value: CurrentUser;
  children: React.ReactNode;
}) {
  // Identité visuelle par établissement (pas les pages publiques, qui n'ont pas
  // de UserProvider) — appliquée côté client pour ne pas rendre tout le site
  // dynamique (le layout racine, lui, doit rester statique).
  // `--saimo-primary(-light)` recolore les boutons/accents bleus codés en dur
  // (règles globales.css scopées à `body.saimo-app`) ; la classe marque aussi
  // qu'on est dans un espace connecté (vs. le site vitrine).
  useEffect(() => {
    document.body.classList.add("saimo-app");
    document.documentElement.style.fontSize = value.theme.fontSize;
    document.body.style.setProperty("--font-body", value.theme.fontFamily);
    document.body.style.setProperty("--font-display", value.theme.fontFamily);
    document.body.style.setProperty("--saimo-primary", value.theme.primary);
    document.body.style.setProperty("--saimo-primary-light", value.theme.primaryLight);
    return () => {
      document.body.classList.remove("saimo-app");
      document.documentElement.style.fontSize = "";
      document.body.style.removeProperty("--font-body");
      document.body.style.removeProperty("--font-display");
      document.body.style.removeProperty("--saimo-primary");
      document.body.style.removeProperty("--saimo-primary-light");
    };
  }, [value.theme.fontSize, value.theme.fontFamily, value.theme.primary, value.theme.primaryLight]);

  return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
}

/** Utilisateur connecté. Doit être appelé sous un <UserProvider>. */
export function useCurrentUser(): CurrentUser {
  const ctx = useContext(UserContext);
  if (!ctx) {
    throw new Error("useCurrentUser doit être utilisé dans un <UserProvider>.");
  }
  return ctx;
}

/** Variante tolérante : renvoie null hors provider (composants en transition). */
export function useCurrentUserOptional(): CurrentUser | null {
  return useContext(UserContext);
}

export { libelleRole, initiales } from "@/lib/roles-labels";
