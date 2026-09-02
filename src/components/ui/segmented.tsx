"use client";

import { cn } from "@/lib/cn";

/**
 * Pistes segmentées — la barre d'outils de la maquette.
 *
 * Un fond creux, et dedans des segments dont un seul est allumé. C'est ce qui
 * remplace les rangées de boutons à bascule dont le libellé changeait : un
 * bouton « Vue du dessus » ne dit pas s'il décrit l'état courant ou ce qu'on
 * obtiendra en cliquant, alors que deux segments dont l'un est enfoncé lèvent
 * l'ambiguïté sans un mot de plus.
 *
 * Extrait de l'éditeur de plan de classe, où il est né, pour que l'éditeur de
 * salle emploie le même vocabulaire — les deux se ressemblaient de moins en
 * moins.
 */

/** Le fond creux d'une piste. */
export function Track({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-0.5 rounded-control bg-surface-muted/70 p-0.5",
        className,
      )}
    >
      {children}
    </div>
  );
}

/**
 * Un segment de piste.
 *
 * Le segment allumé est une pastille de surface posée sur le creux, avec
 * l'ombre nette du thème : c'est le même geste que les cartes, à l'échelle
 * d'un contrôle. Les autres restent plats et se contentent d'un survol.
 */
export function Segment({
  active,
  disabled = false,
  title,
  onClick,
  children,
}: {
  /**
   * Non renseigné pour un segment qui DÉCLENCHE (verrouiller, zoomer) ; un
   * booléen pour un segment qui représente un ÉTAT (l'orientation de la vue).
   * `aria-pressed` n'est posé que dans le second cas : sur un simple bouton
   * d'action, il annoncerait à tort un interrupteur toujours relâché.
   */
  active?: boolean;
  disabled?: boolean;
  title?: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-pressed={active}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-[0.5rem] px-2.5 py-1.5 text-xs font-medium transition-colors",
        "disabled:pointer-events-none disabled:opacity-40",
        active
          ? "bg-surface text-foreground shadow-soft"
          : "text-muted hover:bg-surface/70 hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}
