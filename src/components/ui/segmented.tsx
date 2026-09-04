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
 * Le segment allumé est une pastille de SURFACE posée sur le creux, à filet
 * fin — pas d'ombre, pas de liseré de tranche. C'est un contrôle, et un
 * contrôle est un aplat, exactement comme les boutons (`button.tsx`) : le
 * contraste entre le creux et la pastille suffit à dire lequel est allumé.
 * Les autres segments restent transparents et se contentent d'un survol.
 */
export function Segment({
  active,
  disabled = false,
  title,
  className,
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
  /**
   * Ajouts de mise en page seulement — `flex-1`, `justify-center` pour une
   * piste d'ONGLETS qui occupe toute la largeur de sa colonne. Ni l'un ni
   * l'autre n'entre en conflit avec les classes de base : `cn()` étant une
   * simple concaténation sans `tailwind-merge`, une classe qui en doublerait
   * une d'ici serait départagée par l'ordre de la feuille générée.
   */
  className?: string;
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
        // Le segment éteint porte une bordure TRANSPARENTE : sans elle, il
        // serait deux pixels plus petit que le segment allumé, et la piste
        // sauterait à chaque bascule.
        active
          ? "border border-border bg-surface text-foreground"
          : "border border-transparent text-muted hover:bg-surface/70 hover:text-foreground",
        className,
      )}
    >
      {children}
    </button>
  );
}
