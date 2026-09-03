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
 * `shadow-soft` pose l'ombre nette décalée définie par `--elev-1` dans
 * globals.css. Pas de dégradé de surface (`material`) : le modèle 2a reste sur
 * des aplats francs, l'ombre suffit à décoller la carte du papier.
 */
export const CARD = "rounded-card border border-border bg-surface shadow-soft";

/**
 * Réaction au survol des cartes cliquables. À combiner avec `CARD`.
 *
 * La carte S'ÉCARTE DE SON OMBRE plutôt que de simplement monter : elle glisse
 * de 2 px vers le haut ET vers la gauche, pendant que l'ombre nette passe de
 * 2 px (`shadow-soft`) à 4 px (`shadow-lift`). Le décalage double donc dans
 * l'axe de l'ombre — c'est le geste du modèle, et il rend le survol lisible
 * sans changer de couleur de fond.
 */
export const CARD_INTERACTIVE =
  "transition-[border-color,box-shadow,transform] duration-150 " +
  "hover:-translate-x-0.5 hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-lift";

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
 * Le titre passe par `.eyebrow` (globals.css) : petites capitales de la police
 * du site. Tout ce qui n'est pas du contenu porte cette même signature, ce
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
