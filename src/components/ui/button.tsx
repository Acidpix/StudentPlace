import type { ButtonHTMLAttributes } from "react";

import { cn } from "@/lib/cn";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "accent" | "danger" | "ink";
export type ButtonSize = "sm" | "md" | "lg" | "icon" | "icon-sm";

/**
 * Boutons, à la forme de la maquette.
 *
 * **UN BOUTON EST UN APLAT. Aucun effet de volume, sur aucune variante.**
 * Pas de dégradé vertical, pas de liseré de tranche, pas d'ombre portée : rien
 * qui simule une pastille bombée. Un bouton plein est sa couleur, un bouton
 * secondaire est la surface avec un filet fin, un point c'est tout.
 *
 * Trois choses ont été retirées dans cet esprit, et ne doivent pas revenir :
 *
 * - `sheen`, un voile clair en haut et sombre en bas. C'était LUI le relief :
 *   il donnait à chaque bouton plein l'air d'un galet en plastique.
 * - `material` sur le secondaire, qui faisait la même chose en plus discret.
 * - la lueur colorée sous les boutons pleins. La maquette en pose une, mais
 *   elle lit comme une élévation dès qu'on la regarde ; l'aplat franc est plus
 *   proche de l'intention — des contours fins et de la couleur en petites
 *   touches — que la lettre du modèle.
 *
 * L'ÉTAT se lit donc uniquement à la teinte : la luminosité monte au survol,
 * et l'appui déplace d'un pixel.
 *
 * La règle a depuis GAGNÉ TOUTE L'INTERFACE : les cartes, les panneaux et les
 * modales ont perdu à leur tour le dégradé et l'ombre nette (`card.tsx`,
 * `globals.css`). Il n'y a plus de contraste à ménager entre un bouton calme et
 * une carte marquée — tout est aplat et filet.
 */
const PRESS = "active:translate-y-px";

/**
 * `ink` : le bouton plein NEUTRE de la maquette (l'encre sur fond clair).
 *
 * Il existe en propre, et n'est pas obtenu en passant `bg-foreground` en
 * `className` : `cn()` est une simple concaténation, sans `tailwind-merge`.
 * `bg-primary` et `bg-foreground` cohabiteraient alors dans l'attribut, à
 * spécificité égale, et c'est l'ordre dans la feuille générée — imprévisible —
 * qui trancherait.
 *
 * Il sert aux actions ENGAGEANTES MAIS NEUTRES : ouvrir un plan, enregistrer
 * une fiche. Le corail reste à ce qui crée ou calcule.
 */
const VARIANTS: Record<ButtonVariant, string> = {
  primary: `bg-primary text-primary-foreground hover:brightness-110 ${PRESS}`,
  ink: `bg-foreground text-background hover:brightness-125 ${PRESS}`,
  accent: `bg-accent text-accent-foreground hover:brightness-110 ${PRESS}`,
  danger: `bg-danger text-white hover:brightness-110 ${PRESS}`,
  secondary: `bg-surface text-foreground border border-border hover:bg-surface-muted hover:border-primary/50 ${PRESS}`,
  ghost: "text-muted hover:bg-surface-muted hover:text-foreground",
};

/**
 * Les deux tailles CARRÉES existent en propre, et ne s'obtiennent PAS en
 * passant `px-0` en `className` par-dessus une taille normale.
 *
 * `cn()` est une simple concaténation, sans `tailwind-merge` : `px-4` et `px-0`
 * se retrouvaient tous deux dans l'attribut, à spécificité égale, et c'est
 * l'ordre de la feuille générée qui tranchait — `px-4` gagnait. Un bouton de
 * 28 px gardait donc 32 px de rembourrage horizontal, son contenu était écrasé
 * à zéro, et l'icône DISPARAISSAIT en laissant une case vide. Le bouton de
 * thème, plus large, n'en gardait qu'un moignon de quelques pixels — d'où
 * l'impression, fausse, d'une icône trop petite.
 *
 * Le `shrink-0` sur l'icône est la seconde moitié du remède : un enfant de
 * flex se laisse comprimer sous sa taille intrinsèque, donc l'attribut `width`
 * du SVG ne suffit pas à le garantir.
 */
const SIZES: Record<ButtonSize, string> = {
  sm: "h-8 px-3 text-sm",
  md: "h-10 px-4 text-sm",
  lg: "h-11 px-5 text-[0.9375rem]",
  icon: "h-10 w-10 text-sm [&>svg]:shrink-0",
  "icon-sm": "h-8 w-8 text-sm [&>svg]:shrink-0",
};

const BASE =
  "inline-flex items-center justify-center gap-2 rounded-control font-semibold " +
  "transition-[background-color,border-color,filter,transform] duration-150 " +
  "disabled:pointer-events-none disabled:opacity-50";

/**
 * Les classes d'un bouton, sans le bouton.
 *
 * Pour les `<a>` et les `<Link>` qui doivent en avoir l'apparence — export PDF,
 * retour à l'accueil depuis la page 404, lien de téléchargement des données.
 * Ils recopiaient jusqu'ici la chaîne à la main et avaient déjà divergé : ni
 * appui, ni la bonne graisse. Une seule source, donc.
 */
export function buttonClasses(
  variant: ButtonVariant = "primary",
  size: ButtonSize = "md",
  className?: string,
): string {
  return cn(BASE, VARIANTS[variant], SIZES[size], className);
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Affiche un indicateur d'activité et désactive le bouton. */
  loading?: boolean;
}

/** Petit indicateur d'attente, en SVG pour éviter toute dépendance. */
function Spinner() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      className="animate-spin"
    >
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="3" opacity="0.25" />
      <path
        d="M21 12a9 9 0 0 0-9-9"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function Button({
  variant = "primary",
  size = "md",
  loading = false,
  disabled,
  className,
  type = "button",
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={buttonClasses(variant, size, className)}
      {...props}
    >
      {loading && <Spinner />}
      {children}
    </button>
  );
}
