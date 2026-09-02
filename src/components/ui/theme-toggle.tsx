"use client";

import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { MoonIcon, SunIcon } from "@/components/ui/icons";

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  // Le thème résolu n'est connu qu'après hydratation : afficher l'icône trop
  // tôt provoquerait un clignotement puis une erreur d'hydratation.
  useEffect(() => setMounted(true), []);

  const isDark = resolvedTheme === "dark";

  return (
    <Button
      variant="secondary"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      aria-label={isDark ? "Passer en thème clair" : "Passer en thème sombre"}
      title={isDark ? "Thème clair" : "Thème sombre"}
      // Carré : la taille `md` donne la hauteur, la largeur la rattrape.
      className="w-10 px-0"
    >
      {/* 20 px et non les 16 par défaut : seule icône de la barre à être seule
          dans son bouton, sans libellé à côté pour la porter. */}
      {mounted ? (
        isDark ? (
          <SunIcon width="20" height="20" />
        ) : (
          <MoonIcon width="20" height="20" />
        )
      ) : (
        <span className="h-5 w-5" />
      )}
    </Button>
  );
}
