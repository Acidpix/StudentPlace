import type { HTMLAttributes } from "react";

import { cn } from "@/lib/cn";

/**
 * Vocabulaire de la carte.
 *
 * Exposé en CONSTANTES et pas seulement en composant : les cartes de
 * l'application sont tantôt des `<li>`, tantôt des `<section>`, des `<form>` ou
 * des `<a>`. Un composant qui impose un `<div>` obligerait à imbriquer inutile‑
 * ment ; une chaîne de classes se compose partout avec `cn()`.
 */
/**
 * UNE CARTE EST UN APLAT, exactement comme un bouton (`button.tsx`).
 *
 * Deux choses ont été retirées et ne doivent pas revenir :
 *
 * - `material`, le dégradé vertical des surfaces. La classe n'existe plus dans
 *   globals.css ; la remettre ici ne ferait plus rien.
 * - `shadow-soft`, l'ombre nette décalée. Les jetons `--elev-*` valent `none`,
 *   donc les utilitaires `shadow-*` sont eux aussi devenus muets.
 *
 * Ce qui détache une carte de la page est le FILET de `--border` et l'écart
 * entre `bg-surface` et `bg-background`. Rien d'autre.
 */
export const CARD = "rounded-card border border-border bg-surface";

/**
 * Réaction au survol des cartes cliquables. À combiner avec `CARD`.
 *
 * Elle se lisait à un DÉPLACEMENT : la carte s'écartait de son ombre de 2 px en
 * diagonale pendant que celle-ci doublait. Sans ombre, le glissement n'était
 * plus qu'un sursaut sans cause — il est parti avec elle. Le survol se lit
 * désormais comme partout ailleurs dans l'application : la teinte change, le
 * filet passe au corail et le fond au gris de surface.
 */
export const CARD_INTERACTIVE =
  "transition-[border-color,background-color] duration-150 " +
  "hover:border-primary/50 hover:bg-surface-muted/40";

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  interactive?: boolean;
}

/** La carte en `<div>`, pour les cas où le conteneur n'a pas d'autre rôle. */
export function Card({ interactive = false, className, ...props }: CardProps) {
  return <div className={cn(CARD, interactive && CARD_INTERACTIVE, "p-4", className)} {...props} />;
}

/**
 * En-tête de section : un titre discret en capitales, une action facultative.
 * Sert à séparer les blocs d'une page sans concurrencer le `<h1>`.
 *
 * Le titre passe par `.eyebrow` (globals.css) : capitales à chasse fixe très
 * espacées. Tout ce qui n'est pas du contenu porte cette même signature, ce
 * qui laisse les noms d'élèves seuls en casse normale.
 */
export function SectionHeader({
  title,
  action,
  className,
}: {
  title: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mb-3 flex items-center justify-between gap-3", className)}>
      <h2 className="eyebrow">{title}</h2>
      {action}
    </div>
  );
}
