/**
 * Les palettes de l'application.
 *
 * Une palette et un mode (clair / sombre) sont DEUX RÉGLAGES INDÉPENDANTS :
 * les six palettes existent chacune dans les deux modes. Le mode reste géré par
 * next-themes (classe `dark` sur `<html>`) ; la palette se pose en
 * `data-palette` sur le même élément, par `palette-provider.tsx`.
 *
 * Les valeurs des palettes elles-mêmes vivent dans `globals.css`, comme toutes
 * les couleurs du projet. Ce fichier ne porte que les IDENTIFIANTS, les
 * libellés, et les quelques teintes de l'APERÇU du sélecteur.
 */

export const PALETTE_IDS = ["atelier", "studio", "encre", "ambre", "prune", "graphite"] as const;

export type PaletteId = (typeof PALETTE_IDS)[number];

/**
 * « Atelier » est la palette par défaut, et la SEULE à ne pas porter
 * d'attribut : `globals.css` la définit dans `:root` / `.dark`, et le
 * fournisseur retire `data-palette` au lieu de l'écrire. La note de spécificité
 * en tête des blocs de palette explique pourquoi.
 */
export const DEFAULT_PALETTE: PaletteId = "atelier";

/** Clé de `localStorage`. Voisine de `theme`, celle de next-themes. */
export const PALETTE_STORAGE_KEY = "studentplace-palette";

/**
 * Aperçu du sélecteur : quatre pastilles par palette et par mode — fond,
 * surface, action, accent.
 *
 * Ces teintes RECOPIENT `globals.css`. On ne peut pas les en dériver : les
 * blocs de palette sont sélectionnés sur `:root`, donc inapplicables à une
 * vignette imbriquée, et une vignette en palette claire posée dans une page en
 * mode sombre mentirait. Toute retouche d'une palette doit donc passer ici
 * aussi — c'est le seul endroit du projet où une couleur est écrite deux fois.
 */
export interface PaletteSwatch {
  background: string;
  surface: string;
  primary: string;
  accent: string;
}

export interface PaletteInfo {
  id: PaletteId;
  label: string;
  /** Une ligne, affichée sous le nom dans le sélecteur. */
  description: string;
  light: PaletteSwatch;
  dark: PaletteSwatch;
}

export const PALETTES: readonly PaletteInfo[] = [
  {
    id: "atelier",
    label: "Atelier",
    description: "Papier chaud, corail et vert sapin.",
    light: {
      background: "#efeae0",
      surface: "#fdfbf7",
      primary: "oklch(0.72 0.14 25)",
      accent: "#0f6f5c",
    },
    dark: {
      background: "#12110f",
      surface: "#1c1a17",
      primary: "oklch(0.78 0.13 25)",
      accent: "#34d399",
    },
  },
  {
    id: "studio",
    label: "Studio",
    description: "Gris bleutés et violet.",
    light: {
      background: "#f1f3f8",
      surface: "#ffffff",
      primary: "oklch(0.55 0.19 285)",
      accent: "#0f766e",
    },
    dark: {
      background: "#0e1015",
      surface: "#171a22",
      primary: "oklch(0.7 0.16 285)",
      accent: "#2dd4bf",
    },
  },
  {
    id: "encre",
    label: "Encre",
    description: "Neutres froids et azur profond.",
    light: {
      background: "#eaf0f6",
      surface: "#ffffff",
      primary: "oklch(0.53 0.15 248)",
      accent: "#0e766a",
    },
    dark: {
      background: "#0a1119",
      surface: "#121a24",
      primary: "oklch(0.71 0.13 248)",
      accent: "#2dd4bf",
    },
  },
  {
    id: "ambre",
    label: "Ambre",
    description: "Sable et or brûlé. La plus chaude.",
    light: {
      background: "#f4eee2",
      surface: "#fffdf8",
      primary: "oklch(0.58 0.13 62)",
      accent: "#2f6b45",
    },
    dark: {
      background: "#14110c",
      surface: "#1e1a13",
      primary: "oklch(0.76 0.13 70)",
      accent: "#6ec28a",
    },
  },
  {
    id: "prune",
    label: "Prune",
    description: "Neutres mauves et magenta.",
    light: {
      background: "#f3eef4",
      surface: "#fffcfe",
      primary: "oklch(0.55 0.2 340)",
      accent: "#0f766e",
    },
    dark: {
      background: "#130f16",
      surface: "#1c161f",
      primary: "oklch(0.72 0.17 340)",
      accent: "#34d399",
    },
  },
  {
    id: "graphite",
    label: "Graphite",
    description: "Neutre, sans couleur de marque.",
    light: {
      background: "#f0f0f0",
      surface: "#ffffff",
      primary: "oklch(0.38 0.02 250)",
      accent: "#2f6f5f",
    },
    dark: {
      background: "#101010",
      surface: "#191919",
      primary: "oklch(0.82 0.015 250)",
      accent: "#34d399",
    },
  },
];

/** Ramène n'importe quelle valeur stockée à une palette connue. */
export function normalizePalette(value: unknown): PaletteId {
  return PALETTE_IDS.includes(value as PaletteId) ? (value as PaletteId) : DEFAULT_PALETTE;
}
