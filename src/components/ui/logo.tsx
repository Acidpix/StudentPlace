import { cn } from "@/lib/cn";

/**
 * Le mot-symbole de Sisit.
 *
 * **C'EST LE SEUL ENDROIT DU PROJET QUI SAIT À QUOI RESSEMBLE LA MARQUE.** La
 * barre de navigation de l'application, celle des pages publiques, le pied de
 * page et la page de connexion passent tous par ici : changer le logo, c'est
 * changer ce fichier et le fichier SVG, rien d'autre. Auparavant la pastille
 * ronde « SP » était recopiée à deux endroits, avec un commentaire demandant
 * qu'ils ne divergent pas — ce qu'un composant partagé garantit mieux qu'une
 * consigne.
 *
 * Le dessin vit dans `public/logo-sisit.svg` : le mot « Sisit » en bleu marine,
 * un pictogramme bleu à sa droite, un accent rouge au-dessus. Il est PAYSAGE,
 * d'un rapport d'environ 2,3 pour 1 — d'où des tailles exprimées en HAUTEUR,
 * la largeur suivant d'elle-même (`w-auto`).
 *
 * Deux points à connaître avant d'y toucher :
 *
 * - **Le `viewBox` du fichier a été recadré** sur le dessin (`88 140 1268 557`).
 *   L'export d'origine déclarait une planche de 1749 × 2481 dont l'encre
 *   n'occupait qu'un cinquième : le logo se serait affiché minuscule et
 *   décentré dans un grand cadre vide. Réexporter le logo demande de refaire ce
 *   recadrage.
 * - **Le thème sombre passe par un filtre**, faute d'une variante sombre du
 *   dessin. `invert` + `hue-rotate-180` est le couple habituel : il inverse la
 *   CLARTÉ en rendant les teintes à peu près à leur place, là où un simple
 *   `invert` virerait le bleu marine à l'orange. Le jour où une version claire
 *   du logo existera, c'est cette ligne qu'il faudra remplacer par un second
 *   fichier et un `hidden dark:block`.
 *
 * Un `<img>` ordinaire, et non `next/image` : le SVG ne gagne rien à
 * l'optimisation d'images, qui voudrait en plus des dimensions explicites et
 * une entrée de configuration.
 */

const SIZES = {
  sm: "h-6",
  md: "h-7",
  lg: "h-10",
} as const;

export interface LogoProps {
  size?: keyof typeof SIZES;
  className?: string;
}

export function Logo({ size = "md", className }: LogoProps) {
  return (
    /* eslint-disable-next-line @next/next/no-img-element */
    <img
      src="/logo-sisit.svg"
      alt="Sisit"
      className={cn(
        SIZES[size],
        "w-auto select-none dark:invert dark:hue-rotate-180",
        className,
      )}
    />
  );
}
