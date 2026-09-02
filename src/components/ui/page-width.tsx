import { cn } from "@/lib/cn";

/**
 * Conteneur de largeur d'une page.
 *
 * La largeur était jusqu'ici imposée par le layout `(app)`, d'un seul
 * `max-w-6xl` valable pour tout. C'était intenable dès qu'UNE page a besoin
 * d'autre chose : un layout parent ne peut pas être élargi par la page qu'il
 * contient. La contrainte est donc descendue d'un cran — le layout ne fait plus
 * que le rembourrage, et chaque page déclare la largeur qui lui convient.
 *
 * Deux largeurs seulement, et pas un réglage libre : au-delà de deux, personne
 * ne sait plus laquelle choisir.
 *
 * - par défaut, 72 rem (1152 px) — la mesure de lecture confortable, celle de
 *   toutes les pages de gestion ;
 * - `wide`, 100 rem (1600 px) — pour l'éditeur de plan de classe, dont les deux
 *   colonnes latérales mangeaient la moitié de la largeur utile.
 *
 * La barre de navigation, elle, garde la largeur par défaut : c'est le contenu
 * qui s'élargit, pas le chrome.
 */
export function PageWidth({
  wide = false,
  className,
  children,
}: {
  wide?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("mx-auto w-full", wide ? "max-w-[100rem]" : "max-w-6xl", className)}>
      {children}
    </div>
  );
}
