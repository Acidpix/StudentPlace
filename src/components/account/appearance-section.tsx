"use client";

import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

import { usePalette } from "@/components/palette-provider";
import { CARD } from "@/components/ui/card";
import { CheckIcon, MonitorIcon, MoonIcon, SunIcon } from "@/components/ui/icons";
import { Segment, Track } from "@/components/ui/segmented";
import { cn } from "@/lib/cn";
import { PALETTES, type PaletteInfo, type PaletteSwatch } from "@/lib/palettes";

/**
 * Réglages d'apparence, sur la page « Mon compte ».
 *
 * DEUX RÉGLAGES CROISÉS, et c'est là tout l'intérêt : le mode (clair, sombre,
 * ou celui du système) d'un côté, la palette de l'autre. Les six palettes
 * existent dans les deux modes, donc aucune combinaison n'est interdite et il
 * n'y a pas de « thème sombre » séparé à choisir dans la liste.
 *
 * L'aperçu de chaque palette suit le mode courant : en thème sombre, les
 * vignettes montrent les valeurs sombres. Montrer des vignettes claires sur une
 * page sombre ferait choisir à l'aveugle.
 */

const MODES = [
  { value: "light", label: "Clair", Icon: SunIcon },
  { value: "dark", label: "Sombre", Icon: MoonIcon },
  { value: "system", label: "Système", Icon: MonitorIcon },
] as const;

export function AppearanceSection() {
  const { theme, resolvedTheme, setTheme } = useTheme();
  const { palette, setPalette, mounted: paletteMounted } = usePalette();
  const [themeMounted, setThemeMounted] = useState(false);

  // Ni le thème ni la palette ne sont connus avant l'hydratation : le rendu
  // serveur ne sait pas ce qu'il y a dans le `localStorage` du visiteur.
  // Cocher une case trop tôt afficherait le mauvais réglage puis le corrigerait
  // sous les yeux.
  useEffect(() => setThemeMounted(true), []);

  const ready = themeMounted && paletteMounted;
  const dark = resolvedTheme === "dark";

  return (
    <section className={`${CARD} p-4`}>
      <h2 className="eyebrow">Apparence</h2>
      <p className="mt-2 text-sm text-muted">
        Ces réglages sont propres à ce navigateur : ils ne suivent pas votre compte d&apos;un
        appareil à l&apos;autre.
      </p>

      <div className="mt-4">
        <h3 className="eyebrow">Mode</h3>
        <Track className="mt-2 w-fit">
          {MODES.map(({ value, label, Icon }) => (
            <Segment
              key={value}
              active={ready && theme === value}
              onClick={() => setTheme(value)}
            >
              <Icon />
              {label}
            </Segment>
          ))}
        </Track>
      </div>

      <div className="mt-5">
        <h3 className="eyebrow">Palette</h3>
        {/* Un groupe de boutons à bascule, et NON un `role="radiogroup"` : ce
            dernier attend une navigation au `tabindex` glissant, où les flèches
            déplacent la sélection et où un seul bouton du groupe est
            atteignable par tabulation. L'annoncer sans l'implémenter donnerait
            au clavier un comportement qui ne suit pas ce qui est promis. Le
            `aria-pressed` de chaque vignette dit déjà laquelle est active —
            c'est le vocabulaire de `Segment`, ailleurs dans l'application. */}
        <div
          role="group"
          aria-label="Palette de couleurs"
          // Deux colonnes et pas trois : la page « Mon compte » est bornée à
          // `max-w-2xl`, et six vignettes y tiennent en trois rangs sans que
          // les aplats deviennent des traits.
          className="mt-2 grid gap-2 sm:grid-cols-2"
        >
          {PALETTES.map((info) => (
            <PaletteChoice
              key={info.id}
              info={info}
              dark={dark}
              selected={ready && palette === info.id}
              onSelect={() => setPalette(info.id)}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

function PaletteChoice({
  info,
  dark,
  selected,
  onSelect,
}: {
  info: PaletteInfo;
  dark: boolean;
  selected: boolean;
  onSelect: () => void;
}) {
  const swatch = dark ? info.dark : info.light;

  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onSelect}
      className={cn(
        "w-full rounded-card border bg-surface p-3 text-left",
        "transition-[border-color,background-color] duration-150",
        selected
          ? "border-primary"
          : "border-border hover:border-primary/50 hover:bg-surface-muted/40",
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-semibold">{info.label}</span>
        {/* La coche est le seul marqueur de sélection qui ne repose pas sur la
            couleur : la bordure — corail, violette ou grise selon la palette —
            ne peut pas porter le sens toute seule. */}
        {selected ? <CheckIcon className="text-primary" /> : null}
      </div>
      <SwatchStrip swatch={swatch} />
      <p className="mt-2 text-xs text-muted">{info.description}</p>
    </button>
  );
}

/**
 * Les quatre teintes de la palette, en aplats.
 *
 * Écrites en `style` et non en classes : ce sont précisément les couleurs que
 * les variables du thème n'ont PAS — celles d'une palette qu'on ne porte pas
 * encore. Elles viennent de `palettes.ts`, seul endroit du projet où une
 * couleur est recopiée hors de `globals.css`.
 */
function SwatchStrip({ swatch }: { swatch: PaletteSwatch }) {
  const swatches: [string, string][] = [
    ["Fond", swatch.background],
    ["Surface", swatch.surface],
    ["Action", swatch.primary],
    ["Accent", swatch.accent],
  ];

  return (
    <div className="mt-2 flex overflow-hidden rounded-control border border-border" aria-hidden="true">
      {swatches.map(([label, color]) => (
        <span key={label} className="h-6 flex-1" style={{ backgroundColor: color }} title={label} />
      ))}
    </div>
  );
}
