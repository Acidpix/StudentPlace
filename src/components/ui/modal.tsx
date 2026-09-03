"use client";

import { useEffect, useRef, type MouseEvent } from "react";

import { cn } from "@/lib/cn";

/**
 * Modale, bâtie sur le `<dialog>` NATIF.
 *
 * On ne réimplémente ni le piège à focus, ni la fermeture par Échap, ni
 * l'inertie de la page derrière : `showModal()` les apporte, et il place la
 * boîte dans la calque supérieure, donc aucun `z-index` de la page ne peut
 * passer devant.
 *
 * La mise en forme fragile — `display`, centrage, voile — vit dans la classe
 * `.modal` de globals.css, avec l'explication de chaque précaution. Poser
 * `display: flex` par un utilitaire Tailwind rendrait la boîte visible même
 * fermée.
 *
 * Le contenu n'est monté QUE lorsque la modale est ouverte : les champs d'un
 * formulaire non contrôlé repartent donc de leurs `defaultValue` à chaque
 * ouverture, au lieu de garder la saisie abandonnée la fois précédente.
 */
export function Modal({
  open,
  onClose,
  labelledBy,
  className,
  children,
}: {
  open: boolean;
  onClose: () => void;
  /** `id` du titre du panneau, pour nommer la boîte aux lecteurs d'écran. */
  labelledBy?: string;
  /** Classes du PANNEAU, pas de la boîte : largeur, cadre, fond. */
  className?: string;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;

    // On compare à l'état réel du DOM : `showModal()` sur une boîte déjà
    // ouverte lève, et `close()` sur une boîte fermée déclencherait un
    // évènement `close` parasite, donc une boucle avec `onClose`.
    if (open && !dialog.open) dialog.showModal();
    else if (!open && dialog.open) dialog.close();
  }, [open]);

  /**
   * Clic hors du panneau.
   *
   * La boîte occupe toute la fenêtre et le panneau est son unique enfant : un
   * clic dont la cible est la boîte elle-même est donc un clic à côté. Un clic
   * dans le panneau a pour cible un descendant, et ne ferme pas.
   */
  function handleClick(event: MouseEvent<HTMLDialogElement>) {
    if (event.target === ref.current) onClose();
  }

  return (
    <dialog
      ref={ref}
      className="modal"
      aria-labelledby={labelledBy}
      // Échap passe par `cancel` puis `close` : écouter `close` couvre les deux
      // chemins, celui du clavier et celui de l'appel à `close()`.
      onClose={onClose}
      onClick={handleClick}
    >
      <div
        className={cn(
          "w-full max-w-md overflow-hidden rounded-card border border-border bg-surface shadow-float",
          className,
        )}
      >
        {open && children}
      </div>
    </dialog>
  );
}
