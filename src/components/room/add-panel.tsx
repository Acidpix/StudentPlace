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
 * Une carte ne porte QUE son libellé.
 *
 * Elle a montré un temps un aperçu du meuble — un rectangle à sa proportion —
 * et ses cotes en centimètres. Les deux ont été retirés : l'aperçu d'une table
 * de deux places et celui d'une table de trois sont deux rectangles plats qu'on
 * ne distingue qu'en les comparant, et le vrai meuble apparaît de toute façon
 * dans la salle dès qu'on commence à tirer la carte. Quant aux cotes, elles
 * découlent du barème et ne se règlent pas ici : les afficher ajoutait un
 * chiffre par carte sans jamais servir à choisir.
 */
function ItemCard({
  item,
  onPointerDown,
  onClick,
}: {
  item: PaletteItem;
  onPointerDown: (event: ReactPointerEvent<HTMLButtonElement>, item: PaletteItem) => void;
  onClick: (item: PaletteItem) => void;
}) {
  return (
    <button
      type="button"
      onPointerDown={(event) => onPointerDown(event, item)}
      onClick={() => onClick(item)}
      // `touch-none` sans quoi le navigateur interprète le glisser comme un
      // défilement de page et vole les événements de pointeur au bout de
      // quelques pixels.
      //
      // La carte s'ENFONCE à l'appui — `active:scale-95` — plutôt que de
      // descendre d'un pixel comme les boutons du site : ce n'est pas un bouton
      // qu'on presse mais un objet qu'on saisit, et le geste suivant est un
      // glisser. Le meuble posé, lui, gonfle une fois dans la salle (`.drop-in`,
      // `globals.css`), ce qui indique où il est tombé.
      className="no-select cursor-grab touch-none rounded-card border border-border bg-surface px-2.5 py-2 text-left text-xs font-medium leading-tight text-foreground transition-[border-color,background-color,transform] duration-150 hover:border-primary/50 hover:bg-surface-muted focus-visible:border-primary focus-visible:outline-none active:scale-95 active:cursor-grabbing"
    >
      {item.label}
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
