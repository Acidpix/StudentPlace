"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";

import { DEFAULT_FONT, FONT_STORAGE_KEY, normalizeFont, type FontId } from "@/lib/fonts";

/**
 * Choix de la POLICE, à côté du choix de la palette (`palette-provider.tsx`) —
 * le même mécanisme, un axe indépendant. Voir ce fichier pour le détail des
 * décisions ; elles s'appliquent ici telles quelles.
 */

interface FontContextValue {
  font: FontId;
  setFont: (font: FontId) => void;
  /**
   * Faux jusqu'à l'hydratation. Un sélecteur qui afficherait la police
   * courante trop tôt annoncerait « Système » puis changerait sous les yeux.
   */
  mounted: boolean;
}

const FontContext = createContext<FontContextValue>({
  font: DEFAULT_FONT,
  setFont: () => undefined,
  mounted: false,
});

/**
 * Pose la police sur `<html>`.
 *
 * La police par défaut RETIRE l'attribut au lieu de l'écrire : `globals.css`
 * lui donne sa valeur dans `--font-body` (`:root`), et un `data-font="system"`
 * explicite n'apporterait rien qu'une redéfinition identique — mais suivre
 * exactement le mécanisme de `applyPalette` évite qu'un des deux se mette à
 * diverger en silence si l'un des deux fichiers est retouché seul.
 */
function applyFont(font: FontId) {
  const root = document.documentElement;
  if (font === DEFAULT_FONT) {
    root.removeAttribute("data-font");
  } else {
    root.setAttribute("data-font", font);
  }
}

/**
 * Script exécuté AVANT le premier rendu, dans le `<head>`.
 *
 * Sans lui, la page s'afficherait un instant dans la police système avant que
 * React n'hydrate et ne pose la police enregistrée — le même clignotement que
 * celui que `PALETTE_INIT_SCRIPT` évite pour la palette.
 */
export const FONT_INIT_SCRIPT = `(function(){try{var f=localStorage.getItem(${JSON.stringify(
  FONT_STORAGE_KEY,
)});if(f&&f!==${JSON.stringify(
  DEFAULT_FONT,
)}){document.documentElement.setAttribute("data-font",f)}}catch(e){}})()`;

export function FontProvider({ children }: { children: React.ReactNode }) {
  const [font, setFontState] = useState<FontId>(DEFAULT_FONT);
  const [mounted, setMounted] = useState(false);

  // Relecture au montage : le script du `<head>` a déjà posé l'attribut, on ne
  // fait ici que remettre l'état React d'accord avec le DOM.
  useEffect(() => {
    let stored: string | null = null;
    try {
      stored = localStorage.getItem(FONT_STORAGE_KEY);
    } catch {
      // Stockage indisponible (navigation privée verrouillée) : on reste sur
      // la police par défaut plutôt que d'échouer.
    }
    setFontState(normalizeFont(stored));
    setMounted(true);
  }, []);

  const setFont = useCallback((next: FontId) => {
    setFontState(next);
    applyFont(next);
    try {
      localStorage.setItem(FONT_STORAGE_KEY, next);
    } catch {
      // Le choix vaut alors pour l'onglet courant seulement.
    }
  }, []);

  return <FontContext.Provider value={{ font, setFont, mounted }}>{children}</FontContext.Provider>;
}

export function useFont() {
  return useContext(FontContext);
}
