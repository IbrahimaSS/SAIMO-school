export const COLOR_MAP: Record<string, { label: string; primary: string; light: string }> = {
  blue:    { label: "Bleu SAIMO",   primary: "#2563EB", light: "#EFF6FF" },
  emerald: { label: "Vert Émeraude", primary: "#059669", light: "#ECFDF5" },
  violet:  { label: "Violet",       primary: "#7C3AED", light: "#F5F3FF" },
  orange:  { label: "Orange",       primary: "#EA580C", light: "#FFF7ED" },
  slate:   { label: "Ardoise",      primary: "#475569", light: "#F8FAFC" },
  rose:    { label: "Rose",         primary: "#E11D48", light: "#FFF1F2" },
  cyan:    { label: "Cyan",         primary: "#0891B2", light: "#ECFEFF" },
  amber:   { label: "Ambre",        primary: "#D97706", light: "#FFFBEB" },
  indigo:  { label: "Indigo",       primary: "#4F46E5", light: "#EEF2FF" },
  teal:    { label: "Sarcelle",     primary: "#0D9488", light: "#F0FDFA" },
};

export const GRADIENT_MAP: Record<string, { label: string; from: string; to: string }> = {
  blue:    { label: "Bleu",     from: "#2563EB", to: "#3B82F6" },
  emerald: { label: "Émeraude", from: "#059669", to: "#10B981" },
  violet:  { label: "Violet",   from: "#7C3AED", to: "#8B5CF6" },
  orange:  { label: "Orange",   from: "#EA580C", to: "#F97316" },
  slate:   { label: "Ardoise",  from: "#334155", to: "#475569" },
  rose:    { label: "Rose",     from: "#BE123C", to: "#E11D48" },
  cyan:    { label: "Cyan",     from: "#0E7490", to: "#0891B2" },
  amber:   { label: "Ambre",    from: "#B45309", to: "#D97706" },
  indigo:  { label: "Indigo",   from: "#3730A3", to: "#4F46E5" },
  teal:    { label: "Sarcelle", from: "#0F766E", to: "#0D9488" },
};

export const FONT_MAP: Record<string, { label: string; stack: string }> = {
  inter:   { label: "Inter (défaut)", stack: "var(--font-body), Inter, sans-serif" },
  georgia: { label: "Georgia",        stack: "Georgia, 'Times New Roman', serif" },
  arial:   { label: "Arial",          stack: "Arial, Helvetica, sans-serif" },
  verdana: { label: "Verdana",        stack: "Verdana, Geneva, sans-serif" },
  times:   { label: "Times New Roman", stack: "'Times New Roman', Times, serif" },
};

export const TAILLE_MAP: Record<string, { label: string; px: string }> = {
  sm: { label: "Petite", px: "14px" },
  base: { label: "Normale", px: "16px" },
  lg: { label: "Grande", px: "18px" },
};

export interface ThemeEtablissement {
  couleurTheme: string;
  degradeTheme: string;
  police: string;
  tailleTexte: string;
}

/** Résout la config de thème d'un établissement en valeurs CSS concrètes. */
export function resolveTheme(t: ThemeEtablissement) {
  const couleur = COLOR_MAP[t.couleurTheme] ?? COLOR_MAP.blue;
  const degrade = GRADIENT_MAP[t.degradeTheme] ?? GRADIENT_MAP.blue;
  const font = FONT_MAP[t.police] ?? FONT_MAP.inter;
  const taille = TAILLE_MAP[t.tailleTexte] ?? TAILLE_MAP.base;

  return {
    primary: couleur.primary,
    primaryLight: couleur.light,
    sidebarFrom: degrade.from,
    sidebarTo: degrade.to,
    fontFamily: font.stack,
    fontSize: taille.px,
  };
}

export type ResolvedTheme = ReturnType<typeof resolveTheme>;
