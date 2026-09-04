"use client";

import { useEffect, useRef, useState } from "react";

import { buttonClasses } from "@/components/ui/button";
import { cn } from "@/lib/cn";

/**
 * Menu déroulant.
 *
 * Né du besoin de replier la palette de l'éditeur de salle : neuf boutons
 * « + Table 1 place », « + Tableau », « + Porte »… occupaient deux lignes
 * entières au-dessus du plan, pour des gestes qu'on ne fait qu'une fois par
 * salle.
 *
 * PAS de `<dialog>` ici, contrairement au popup de fiche élève (`ui/modal.tsx`).
 * Le natif y avait été choisi pour le piège à focus, l'inertie de la page et la
 * couche supérieure — trois choses dont un menu n'a aucun besoin. Il ne reste
 * que la fermeture au clic extérieur et à Échap, écrites ici parce qu'aucun
 * autre composant du projet n'en avait encore eu l'usage.
 */
export function Menu({
  label,
  icon,
  align = "right",
  children,
}: {
  label: string;
  icon?: React.ReactNode;
  /** Bord du déclencheur sur lequel le panneau s'aligne. */
  align?: "left" | "right";
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;

    function handlePointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      setOpen(false);
      // Le focus repart sur le déclencheur : sans cela il retomberait sur le
      // corps de page, et la tabulation suivante recommencerait tout en haut.
      triggerRef.current?.focus();
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-haspopup="menu"
        aria-expanded={open}
        className={buttonClasses(open ? "primary" : "secondary", "sm")}
      >
        {icon}
        {label}
      </button>

      {open && (
        // Un seul `onClick` sur le panneau ferme le menu quel que soit l'élément
        // cliqué : cela évite un contexte React ou une prop de rappel à répéter
        // dans chaque `MenuItem`.
        <div
          role="menu"
          onClick={() => setOpen(false)}
          className={cn(
            "absolute top-full z-30 mt-1 min-w-max rounded-card border border-border bg-surface p-1 shadow-float",
            align === "right" ? "right-0" : "left-0",
          )}
        >
          {children}
        </div>
      )}
    </div>
  );
}

/** Une entrée de menu. Pleine largeur, alignée à gauche comme un vrai menu. */
export function MenuItem({
  onClick,
  children,
}: {
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className="block w-full rounded-[0.5rem] px-3 py-1.5 text-left text-sm text-foreground transition-colors hover:bg-surface-muted focus-visible:bg-surface-muted focus-visible:outline-none"
    >
      {children}
    </button>
  );
}

/** Un filet de séparation entre deux groupes d'entrées. */
export function MenuSeparator() {
  return <div role="separator" className="my-1 h-px bg-border" />;
}
