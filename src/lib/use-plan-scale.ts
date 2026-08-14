"use client";

import { useEffect, useRef, useState } from "react";

/** Part de la hauteur de fenêtre que le plan peut occuper à 100 %. */
const VIEWPORT_SHARE = 0.68;

/**
 * Dimensionne le plan de classe et mesure son échelle.
 *
 * Le plan est ajusté pour tenir ENTIÈREMENT dans la fenêtre à 100 % : sa
 * largeur est le minimum entre la place disponible et ce que la hauteur permet,
 * à proportions conservées. Sans cette double contrainte, une salle large
 * s'étalait sur toute la page et sa hauteur débordait de l'écran — il fallait
 * faire défiler pour voir le fond de la salle, ce qui rendait le plan
 * inexploitable. Au-delà de 100 %, le zoom déborde volontairement et l'on
 * défile pour parcourir le détail.
 *
 * Renvoie aussi `pxPerCm` : combien de pixels vaut un centimètre de salle. Les
 * étiquettes d'élèves s'en servent pour se dimensionner en unités du domaine
 * plutôt qu'en pixels figés, ce qui les empêche de se chevaucher.
 *
 * La mesure porte sur un conteneur qui NE DÉFILE PAS : mesurer la zone de
 * défilement elle-même ferait osciller la valeur à l'apparition d'une barre.
 */
export function usePlanScale(roomWidthCm: number, roomHeightCm: number, zoom: number) {
  const ref = useRef<HTMLDivElement>(null);
  const [widthPx, setWidthPx] = useState(0);

  useEffect(() => {
    const element = ref.current;
    if (!element || roomWidthCm <= 0 || roomHeightCm <= 0) return;

    const measure = () => {
      const available = element.clientWidth;
      const heightBudget = window.innerHeight * VIEWPORT_SHARE;
      const fitted = Math.min(available, (heightBudget * roomWidthCm) / roomHeightCm);
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
  }, [roomWidthCm, roomHeightCm, zoom]);

  return { ref, widthPx, pxPerCm: roomWidthCm > 0 ? widthPx / roomWidthCm : 0 };
}
