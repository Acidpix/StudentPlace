import type { ButtonHTMLAttributes } from "react";

import { cn } from "@/lib/cn";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "accent" | "danger" | "ink";
export type ButtonSize = "sm" | "md" | "lg";

/**
 * Boutons, à la forme de la maquette.
 *
 * Point à ne pas défaire : **la maquette n'estampe QUE les cartes.** Un bouton
 * plein n'y porte pas l'ombre nette décalée du thème, mais une LUEUR DIFFUSE de
 * sa propre teinte (`--shadow-glow`) ; un bouton secondaire est un aplat de
 * surface à filet fin, sans ombre du tout. C'est ce qui fait qu'une barre
 * d'outils reste calme au milieu de cartes très marquées.
 *
 * Corollaire : l'ancien geste d'enfoncement — se déplacer de 2 px pour combler
 * son propre décalage — n'a plus d'ombre à combler. Il est remplacé par un
 * appui d'un pixel, qui va avec la lueur.
 *
 * `sheen` pose un voile clair en haut et sombre en bas : le bouton cesse d'être
 * un aplat sans qu'il faille définir deux teintes par variante. `material` fait
 * de même, en plus discret, pour le bouton secondaire.
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
  primary: `sheen bg-primary text-primary-foreground shadow-glow hover:brightness-110 ${PRESS}`,
  ink: `sheen bg-foreground text-background hover:brightness-125 ${PRESS}`,
  accent: `sheen bg-accent text-accent-foreground shadow-glow hover:brightness-110 ${PRESS}`,
  danger: `sheen bg-danger text-white shadow-glow-danger hover:brightness-110 ${PRESS}`,
  // Blanc à filet fin, sans ombre : le bouton « discret » de la maquette.
  secondary: `material bg-surface text-foreground border border-border hover:bg-surface-muted hover:border-primary/50 ${PRESS}`,
  ghost: "text-muted hover:bg-surface-muted hover:text-foreground",
};

const SIZES: Record<ButtonSize, string> = {
  sm: "h-8 px-3 text-sm",
  md: "h-10 px-4 text-sm",
  lg: "h-11 px-5 text-[0.9375rem]",
};

const BASE =
  "inline-flex items-center justify-center gap-2 rounded-control font-semibold " +
  "transition-[background-color,border-color,filter,box-shadow,transform] duration-150 " +
  "disabled:pointer-events-none disabled:opacity-50";

/**
 * Les classes d'un bouton, sans le bouton.
 *
 * Pour les `<a>` et les `<Link>` qui doivent en avoir l'apparence — export PDF,
 * retour à l'accueil depuis la page 404, lien de téléchargement des données.
 * Ils recopiaient jusqu'ici la chaîne à la main et avaient déjà divergé : ni
 * `sheen`, ni appui, ni la bonne graisse. Une seule source, donc.
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
