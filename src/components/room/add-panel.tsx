"use client";

import type { PointerEvent as ReactPointerEvent } from "react";

import { Hint } from "@/components/ui/field";
import { OBJECT_DEFAULT_SIZE, tableWidthForSeats, type ObjectKind } from "@/lib/domain";

/**
 * Le bac des meubles à poser, en cartes que l'on GLISSE dans la salle.
 *
 * Remplace la rangée de boutons — puis le menu déroulant — qui déposaient le
 * meuble à un emplacement choisi par le programme : on finissait toujours par
 * le déplacer juste après, si bien que l'ajout coûtait deux gestes au lieu
 * d'un. Une carte glissée tombe là où on la lâche.
 *
 * La carte reste un `<button>` : un simple CLIC pose quand même le meuble, à la
 * position en cascade. C'est ce qui garde l'ajout accessible au clavier et au
 * tactile maladroit, le glisser n'étant qu'un raccourci.
 */

export interface PaletteItem {
  kind: ObjectKind;
  label: string;
  seatCount: number;
}

/** Cotes du meuble tel qu'il sera posé. Une table suit le barème par place. */
export function itemSizeCm(item: PaletteItem): { widthCm: number; heightCm: number } {
  const defaults = OBJECT_DEFAULT_SIZE[item.kind];
  return item.kind === "TABLE"
    ? { ...defaults, widthCm: tableWidthForSeats(item.seatCount) }
    : defaults;
}

/**
 * L'aperçu d'une carte est un simple rectangle au RAPPORT du meuble.
 *
 * On ne réutilise pas `Furniture` : les hachures du tableau viennent d'un motif
 * SVG défini dans le `<defs>` de `RoomGrid`, et un `Furniture` rendu hors de ce
 * `<svg>`-là perdrait ses rayures. L'aperçu dit la PROPORTION — c'est ce qu'on
 * regarde pour choisir entre une table de deux et une de trois — et le dessin
 * exact se voit une fraction de seconde plus tard, dans la salle.
 */
function ItemPreview({ item }: { item: PaletteItem }) {
  const { widthCm, heightCm } = itemSizeCm(item);

  return (
    <svg
      viewBox={`0 0 ${widthCm} ${heightCm}`}
      preserveAspectRatio="xMidYMid meet"
      className="h-6 w-full text-muted"
      aria-hidden="true"
    >
      <rect
        x={1}
        y={1}
        width={widthCm - 2}
        height={heightCm - 2}
        rx={4}
        fill="none"
        stroke="currentColor"
        strokeWidth={3}
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

function ItemCard({
  item,
  onPointerDown,
  onClick,
}: {
  item: PaletteItem;
  onPointerDown: (event: ReactPointerEvent<HTMLButtonElement>, item: PaletteItem) => void;
  onClick: (item: PaletteItem) => void;
}) {
  const { widthCm, heightCm } = itemSizeCm(item);

  return (
    <button
      type="button"
      onPointerDown={(event) => onPointerDown(event, item)}
      onClick={() => onClick(item)}
      // `touch-none` sans quoi le navigateur interprète le glisser comme un
      // défilement de page et vole les événements de pointeur au bout de
      // quelques pixels.
      className="no-select cursor-grab touch-none rounded-card border border-border bg-surface p-2 text-left transition-[border-color,background-color] duration-150 hover:border-primary/50 hover:bg-surface-muted focus-visible:border-primary focus-visible:outline-none active:cursor-grabbing"
    >
      <ItemPreview item={item} />
      <p className="mt-1.5 text-xs font-medium leading-tight text-foreground">{item.label}</p>
      <p className="text-[0.65rem] text-muted">
        {widthCm} × {heightCm}
      </p>
    </button>
  );
}

export function AddPanel({
  tables,
  furniture,
  onPointerDown,
  onClick,
}: {
  /** Les tables, séparées du reste : c'est la seule frontière de la palette. */
  tables: PaletteItem[];
  furniture: PaletteItem[];
  onPointerDown: (event: ReactPointerEvent<HTMLButtonElement>, item: PaletteItem) => void;
  onClick: (item: PaletteItem) => void;
}) {
  return (
    <div className="space-y-3">
      <div>
        <h2 className="eyebrow">Tables</h2>
        <div className="mt-1.5 grid grid-cols-2 gap-2">
          {tables.map((item) => (
            <ItemCard key={item.label} item={item} onPointerDown={onPointerDown} onClick={onClick} />
          ))}
        </div>
      </div>

      <div>
        <h2 className="eyebrow">Mobilier</h2>
        <div className="mt-1.5 grid grid-cols-2 gap-2">
          {furniture.map((item) => (
            <ItemCard key={item.label} item={item} onPointerDown={onPointerDown} onClick={onClick} />
          ))}
        </div>
      </div>

      <Hint>Glissez une carte dans la salle, ou cliquez-la pour la poser.</Hint>
    </div>
  );
}
