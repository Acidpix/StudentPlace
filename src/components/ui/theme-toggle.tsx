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
      // Taille CARRÉE en propre : un `px-0` posé par-dessus `md` ne prend pas,
      // `cn()` ne fusionne pas les utilitaires (voir `SIZES`, button.tsx).
      size="icon"
    >
      {/* 22 px et non les 16 par défaut : seule icône de la barre à être seule
          dans son bouton, sans libellé à côté pour la porter. */}
      {mounted ? (
        isDark ? (
          <SunIcon width="22" height="22" />
        ) : (
          <MoonIcon width="22" height="22" />
        )
      ) : (
        <span className="h-[22px] w-[22px] shrink-0" />
      )}
    </Button>
  );
}
