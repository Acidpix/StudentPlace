/**
 * Les polices du site.
 *
 * Un réglage INDÉPENDANT de la palette, sur le même modèle : l'identifiant vit
 * dans `localStorage`, posé en `data-font` sur `<html>` par `font-provider.tsx`.
 * Les fichiers .woff2 (auto-hébergés, `public/fonts/`) et les déclarations
 * `@font-face` / `[data-font]` vivent dans `globals.css` — ce fichier ne porte
 * que les identifiants, les libellés, et la pile CSS de PRÉVISUALISATION que le
 * sélecteur utilise pour donner un aperçu de chaque police sans encore la
 * choisir.
 */

export const FONT_IDS = ["system", "dm-sans", "nunito", "ubuntu", "work-sans", "montserrat"] as const;

export type FontId = (typeof FONT_IDS)[number];

/**
 * « Système » est la police par défaut, et la SEULE à ne pas porter
 * d'attribut : `globals.css` lui donne sa valeur dans `--font-body` (`:root`),
 * et le fournisseur retire `data-font` au lieu d'écrire `data-font="system"` —
 * même raison que la palette « Atelier ». Aucune fonte n'est alors demandée au
 * navigateur : c'est la pile système, comme partout ailleurs dans le projet
 * avant ce réglage.
 */
export const DEFAULT_FONT: FontId = "system";

/** Clé de `localStorage`. Voisine de `studentplace-palette`. */
export const FONT_STORAGE_KEY = "studentplace-font";

export interface FontInfo {
  id: FontId;
  label: string;
  /** Une ligne, affichée sous le nom dans le sélecteur. */
  description: string;
  /**
   * Pile CSS pour l'APERÇU du sélecteur : le nom de la police (absent pour
   * « Système ») suivi du même repli que `--font-fallback` dans globals.css.
   * Recopiée ici pour la même raison que les teintes de `palettes.ts` : cet
   * aperçu s'affiche AVANT que la police ne soit choisie, donc avant que
   * `--font-body` ne la porte.
   */
  previewFamily: string;
}

const FALLBACK =
  'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans", sans-serif';

export const FONTS: readonly FontInfo[] = [
  {
    id: "system",
    label: "Système",
    description: "La police de l'appareil du visiteur. Rien à télécharger.",
    previewFamily: FALLBACK,
  },
  {
    id: "dm-sans",
    label: "DM Sans",
    description: "Géométrique et neutre, proche de la pile système actuelle.",
    previewFamily: `"DM Sans", ${FALLBACK}`,
  },
  {
    id: "nunito",
    label: "Nunito",
    description: "Terminaisons arrondies, plus douce à l'écran.",
    previewFamily: `"Nunito", ${FALLBACK}`,
  },
  {
    id: "ubuntu",
    label: "Ubuntu",
    description: "Dessin plus affirmé, chasse légèrement plus large.",
    previewFamily: `"Ubuntu", ${FALLBACK}`,
  },
  {
    id: "work-sans",
    label: "Work Sans",
    description: "Contemporaine, pensée pour les petits corps de texte.",
    previewFamily: `"Work Sans", ${FALLBACK}`,
  },
  {
    id: "montserrat",
    label: "Montserrat",
    description: "Capitales larges, plus affichée que les autres.",
    previewFamily: `"Montserrat", ${FALLBACK}`,
  },
];

/** Ramène n'importe quelle valeur stockée à une police connue. */
export function normalizeFont(value: unknown): FontId {
  return FONT_IDS.includes(value as FontId) ? (value as FontId) : DEFAULT_FONT;
}
