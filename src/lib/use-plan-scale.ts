"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Hauteur par défaut de la fenêtre de plan, en part de la hauteur d'écran.
 *
 * 80 % et non 68 % : c'est ELLE qui fixe l'échelle du plan, donc la taille des
 * noms. Une salle plus large que profonde — le cas courant — est ajustée sur sa
 * HAUTEUR, si bien qu'à 68 % le plan laissait une bande vide à droite tout en
 * écrivant les noms trop petit. À 80 %, la largeur disponible redevient la
 * contrainte pour une salle de proportions ordinaires : plus rien n'est gâché,
 * et chaque centimètre de salle vaut environ 16 % de pixels de plus.
 */
export const DEFAULT_VIEWPORT_SHARE = 0.8;

/** Hauteur de la fenêtre de plan pour l'écran courant. */
export function defaultPlanHeight(): number {
  return Math.round(window.innerHeight * DEFAULT_VIEWPORT_SHARE);
}

/**
 * Dimensionne le plan de classe et mesure son échelle.
 *
 * Le plan est ajusté pour tenir ENTIÈREMENT dans sa fenêtre à 100 % : sa
 * largeur est le minimum entre la place disponible et ce que `heightBudget`
 * permet, à proportions conservées. Sans cette double contrainte, une salle
 * large s'étalait sur toute la page et sa hauteur débordait de l'écran — il
 * fallait faire défiler pour voir le fond de la salle, ce qui rendait le plan
 * inexploitable. Au-delà de 100 %, le zoom déborde volontairement et l'on
 * défile pour parcourir le détail.
 *
 * `heightBudget` est la hauteur de la fenêtre de plan, déduite de l'écran ; à
 * zéro — avant le montage, quand `window` n'existe pas encore — on retombe sur
 * la hauteur par défaut.
 *
 * Renvoie aussi `pxPerCm` : combien de pixels vaut un centimètre de salle. Les
 * étiquettes d'élèves s'en servent pour se dimensionner en unités du domaine
 * plutôt qu'en pixels figés, ce qui les empêche de se chevaucher.
 *
 * La mesure porte sur un conteneur qui NE DÉFILE PAS : mesurer la zone de
 * défilement elle-même ferait osciller la valeur à l'apparition d'une barre.
 */
export function usePlanScale(
  roomWidthCm: number,
  roomHeightCm: number,
  zoom: number,
  heightBudget: number,
) {
  const ref = useRef<HTMLDivElement>(null);
  const [widthPx, setWidthPx] = useState(0);

  useEffect(() => {
    const element = ref.current;
    if (!element || roomWidthCm <= 0 || roomHeightCm <= 0) return;

    const measure = () => {
      const available = element.clientWidth;
      const height = heightBudget > 0 ? heightBudget : defaultPlanHeight();
      const fitted = Math.min(available, (height * roomWidthCm) / roomHeightCm);
      setWidthPx(Math.max(0, (fitted * zoom) / 100));
    };

    measure();

    const observer = new ResizeObserver(measure);
    observer.observe(element);
    window.addEventListener("resize", measure);

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [roomWidthCm, roomHeightCm, zoom, heightBudget]);

  return { ref, widthPx, pxPerCm: roomWidthCm > 0 ? widthPx / roomWidthCm : 0 };
}
