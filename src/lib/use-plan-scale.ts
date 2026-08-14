"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Mesure l'échelle d'affichage du plan : combien de pixels vaut un centimètre
 * de salle.
 *
 * Les étiquettes d'élèves ont besoin de cette valeur pour se dimensionner en
 * unités du domaine plutôt qu'en pixels figés. Un `ResizeObserver` plutôt que
 * les unités de conteneur CSS (`cqw`) : la même mesure sert aussi à décider si
 * un prénom tient encore, ce qui est une décision JavaScript.
 *
 * Renvoie `0` avant la première mesure — les appelants doivent traiter ce cas,
 * qui correspond au premier rendu serveur.
 */
export function usePlanScale(roomWidthCm: number) {
  const ref = useRef<HTMLDivElement>(null);
  const [pxPerCm, setPxPerCm] = useState(0);

  useEffect(() => {
    const element = ref.current;
    if (!element || roomWidthCm <= 0) return;

    const measure = () => setPxPerCm(element.clientWidth / roomWidthCm);
    measure();

    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [roomWidthCm]);

  return { ref, pxPerCm };
}
