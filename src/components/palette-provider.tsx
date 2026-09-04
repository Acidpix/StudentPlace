"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";

import {
  DEFAULT_PALETTE,
  PALETTE_STORAGE_KEY,
  normalizePalette,
  type PaletteId,
} from "@/lib/palettes";

/**
 * Choix de la PALETTE, à côté du choix du mode clair/sombre de next-themes.
 *
 * Volontairement pas branché sur next-themes : son `themes` ne sait pas croiser
 * deux dimensions, et `enableSystem` ne fonctionne que pour clair/sombre. Six
 * palettes × deux modes donneraient douze thèmes à énumérer, et la préférence
 * système du visiteur ne s'y appliquerait plus.
 *
 * Le réglage vit dans `localStorage`, comme celui de next-themes : c'est une
 * préférence d'affichage propre au navigateur, pas une donnée de compte à
 * synchroniser — un aller-retour serveur à chaque changement, et une colonne de
 * plus dans le schéma, pour un réglage qu'on touche trois fois.
 */

interface PaletteContextValue {
  palette: PaletteId;
  setPalette: (palette: PaletteId) => void;
  /**
   * Faux jusqu'à l'hydratation. Un sélecteur qui afficherait la palette
   * courante trop tôt annoncerait « Atelier » puis changerait sous les yeux.
   */
  mounted: boolean;
}

const PaletteContext = createContext<PaletteContextValue>({
  palette: DEFAULT_PALETTE,
  setPalette: () => undefined,
  mounted: false,
});

/**
 * Pose la palette sur `<html>`.
 *
 * La palette par défaut RETIRE l'attribut au lieu de l'écrire : `globals.css`
 * la définit dans `:root` / `.dark`, et un `data-palette` explicite portant son
 * nom l'emporterait en spécificité sur le `.dark` de base — le thème sombre
 * repasserait au clair. Voir la note en tête des blocs de palette.
 *
 * La comparaison porte sur `DEFAULT_PALETTE` et jamais sur un nom écrit en
 * clair : c'est ce qui a permis de faire passer le défaut d'« Atelier » à
 * « Cahier » en ne touchant qu'à `palettes.ts` et à la feuille de style.
 */
function applyPalette(palette: PaletteId) {
  const root = document.documentElement;
  if (palette === DEFAULT_PALETTE) {
    root.removeAttribute("data-palette");
  } else {
    root.setAttribute("data-palette", palette);
  }
}

/**
 * Script exécuté AVANT le premier rendu, dans le `<head>`.
 *
 * Sans lui, la page s'afficherait un instant en « Atelier » avant que React
 * n'hydrate et ne pose la palette enregistrée. C'est la même précaution que
 * celle que next-themes prend pour le mode sombre, et pour la même raison.
 *
 * Écrit en une chaîne et non en TSX : il doit tourner tel quel, sans passer par
 * le pont client, et avant tout script de l'application.
 */
export const PALETTE_INIT_SCRIPT = `(function(){try{var p=localStorage.getItem(${JSON.stringify(
  PALETTE_STORAGE_KEY,
)});if(p&&p!==${JSON.stringify(
  DEFAULT_PALETTE,
)}){document.documentElement.setAttribute("data-palette",p)}}catch(e){}})()`;

export function PaletteProvider({ children }: { children: React.ReactNode }) {
  const [palette, setPaletteState] = useState<PaletteId>(DEFAULT_PALETTE);
  const [mounted, setMounted] = useState(false);

  // Relecture au montage : le script du `<head>` a déjà posé l'attribut, on ne
  // fait ici que remettre l'état React d'accord avec le DOM.
  useEffect(() => {
    let stored: string | null = null;
    try {
      stored = localStorage.getItem(PALETTE_STORAGE_KEY);
    } catch {
      // Stockage indisponible (navigation privée verrouillée) : on reste sur
      // la palette par défaut plutôt que d'échouer.
    }
    setPaletteState(normalizePalette(stored));
    setMounted(true);
  }, []);

  const setPalette = useCallback((next: PaletteId) => {
    setPaletteState(next);
    applyPalette(next);
    try {
      localStorage.setItem(PALETTE_STORAGE_KEY, next);
    } catch {
      // Le choix vaut alors pour l'onglet courant seulement.
    }
  }, []);

  return (
    <PaletteContext.Provider value={{ palette, setPalette, mounted }}>
      {children}
    </PaletteContext.Provider>
  );
}

export function usePalette() {
  return useContext(PaletteContext);
}
