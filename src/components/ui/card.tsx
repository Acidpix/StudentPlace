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
export const CARD = "rounded-card border border-border bg-surface shadow-soft";

/** Réaction au survol des cartes cliquables. À combiner avec `CARD`. */
export const CARD_INTERACTIVE =
  "transition-[border-color,box-shadow,transform] duration-150 " +
  "hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-lift";

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
      <h2 className="text-xs font-semibold uppercase tracking-[0.08em] text-muted">{title}</h2>
      {action}
    </div>
  );
}
