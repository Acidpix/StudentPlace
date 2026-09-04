"use client";

import { useMemo, useState, type ComponentType } from "react";

import { Button } from "@/components/ui/button";
import { Hint, Input, Label, Select } from "@/components/ui/field";
import {
  IslandsLayoutArt,
  RowsLayoutArt,
  UShapeIslandLayoutArt,
  UShapeLayoutArt,
  WarningIcon,
} from "@/components/ui/icons";
import { cn } from "@/lib/cn";
import {
  DEFAULT_PRESET_OPTIONS,
  generatePresetLayout,
  LAYOUT_PRESET_IDS,
  LAYOUT_PRESETS,
  PRESET_ISLAND_MAX,
  PRESET_SEAT_COUNTS,
  PRESET_SEAT_MAX,
  PRESET_SEAT_MIN,
  type LayoutPresetId,
  type PresetOptions,
  type PresetSeatCount,
} from "@/lib/placement/layout-presets";

const THUMBNAILS: Record<LayoutPresetId, ComponentType<{ className?: string }>> = {
  ROWS: RowsLayoutArt,
  U_SHAPE: UShapeLayoutArt,
  U_SHAPE_ISLAND: UShapeIslandLayoutArt,
  ISLANDS: IslandsLayoutArt,
};

/**
 * Choix d'une disposition type.
 *
 * Chaque disposition annonce le nombre de places qu'elle tiendrait VRAIMENT
 * dans cette salle-ci, recalculé à chaque frappe. C'est l'essentiel : « en U »
 * n'a pas la même capacité que « en rangées », et le professeur doit pouvoir
 * arbitrer avant d'effacer son travail, pas après.
 *
 * ---
 *
 * LE PANNEAU EST LE CONTENU D'UN ONGLET, dans la colonne de droite de
 * l'éditeur : il se range donc en COLONNE, dans quelque 300 px, et il n'est
 * PLUS une `CARD` — une carte dans une carte doublerait bordure et ombre. Il
 * n'a pas non plus de bouton de fermeture : on en sort en prenant l'autre
 * onglet.
 *
 * Il s'ouvrait auparavant en pleine largeur sous la barre d'outils, où il
 * poussait le plan de la salle vers le bas ; ses quatre dispositions ont donc
 * été tour à tour de grandes cartes, puis des segments d'une piste horizontale,
 * avant de trouver ici leur forme : une grille 2 × 2 de vignettes. C'est la
 * VIGNETTE qui compte — elle dit la forme d'un coup d'œil, ce qu'aucun libellé
 * ne fait — et une colonne étroite lui rend la place qu'une ligne lui refusait.
 *
 * La description ne s'affiche que pour la disposition SÉLECTIONNÉE : les trois
 * autres n'ont pas besoin de se raconter tant qu'on ne les a pas choisies.
 */
export function LayoutPresetsPanel({
  roomWidthCm,
  roomHeightCm,
  tableCount,
  onApply,
}: {
  roomWidthCm: number;
  roomHeightCm: number;
  /** Nombre de tables déjà posées, pour avertir de ce que l'on va remplacer. */
  tableCount: number;
  onApply: (preset: LayoutPresetId, seatTarget: number, options: PresetOptions) => void;
}) {
  const [preset, setPreset] = useState<LayoutPresetId>("ROWS");
  const [seatTarget, setSeatTarget] = useState(30);
  const [seatsPerTable, setSeatsPerTable] = useState<PresetSeatCount>(
    DEFAULT_PRESET_OPTIONS.seatsPerTable,
  );
  const [islandCount, setIslandCount] = useState(DEFAULT_PRESET_OPTIONS.islandCount);

  const options: PresetOptions = { seatsPerTable, islandCount };

  const previews = useMemo(
    () =>
      Object.fromEntries(
        LAYOUT_PRESET_IDS.map((id) => [
          id,
          generatePresetLayout(id, { widthCm: roomWidthCm, heightCm: roomHeightCm }, seatTarget, {
            seatsPerTable,
            islandCount,
          }),
        ]),
      ) as Record<LayoutPresetId, ReturnType<typeof generatePresetLayout>>,
    [roomWidthCm, roomHeightCm, seatTarget, seatsPerTable, islandCount],
  );

  const selected = previews[preset];

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        {LAYOUT_PRESET_IDS.map((id) => {
          const Thumbnail = THUMBNAILS[id];
          const active = id === preset;

          return (
            <button
              key={id}
              type="button"
              onClick={() => setPreset(id)}
              aria-pressed={active}
              className={cn(
                "rounded-card border p-2 text-left transition-[border-color,background-color] duration-150",
                active
                  ? "border-primary bg-primary-soft"
                  : "border-border bg-surface hover:border-primary/40 hover:bg-surface-muted",
              )}
            >
              <Thumbnail className="h-8 w-full text-muted" />
              <p className="mt-1 text-xs font-medium leading-tight">{LAYOUT_PRESETS[id].label}</p>
              <p className="text-[0.65rem] text-muted">
                {previews[id].seatCount} place{previews[id].seatCount > 1 ? "s" : ""}
              </p>
            </button>
          );
        })}
      </div>

      <p className="text-xs text-muted">{LAYOUT_PRESETS[preset].description}</p>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label htmlFor="preset-seats">Places</Label>
          <Input
            id="preset-seats"
            type="number"
            min={PRESET_SEAT_MIN}
            max={PRESET_SEAT_MAX}
            value={seatTarget}
            onChange={(event) => setSeatTarget(Number(event.target.value))}
          />
        </div>

        <div>
          <Label htmlFor="preset-table">Table</Label>
          <Select
            id="preset-table"
            value={seatsPerTable}
            onChange={(event) => setSeatsPerTable(Number(event.target.value) as PresetSeatCount)}
          >
            {PRESET_SEAT_COUNTS.map((count) => (
              <option key={count} value={count}>
                {count} place{count > 1 ? "s" : ""}
              </option>
            ))}
          </Select>
        </div>
      </div>

      {/* Le nombre d'îlots n'a de sens que pour le U qui en porte : ailleurs,
          un sélecteur inerte laisserait croire à un réglage sans effet. */}
      {preset === "U_SHAPE_ISLAND" && (
        <div>
          <Label htmlFor="preset-islands">Îlots au centre</Label>
          <Select
            id="preset-islands"
            value={islandCount}
            onChange={(event) => setIslandCount(Number(event.target.value))}
          >
            {Array.from({ length: PRESET_ISLAND_MAX + 1 }, (_, count) => (
              <option key={count} value={count}>
                {count}
              </option>
            ))}
          </Select>
        </div>
      )}

      <Button className="w-full" onClick={() => onApply(preset, seatTarget, options)}>
        Appliquer
      </Button>

      {selected.shortfall > 0 && (
        <p className="flex items-start gap-2 text-xs text-danger">
          <WarningIcon className="mt-px shrink-0" />
          <span>
            La salle ne tient que {selected.seatCount} place
            {selected.seatCount > 1 ? "s" : ""} ainsi. Agrandissez-la, ou prenez des tables de plus
            de places.
          </span>
        </p>
      )}

      <Hint>
        {tableCount > 0
          ? `Remplace les ${tableCount} tables actuelles — et les élèves déjà placés. Ctrl+Z annule.`
          : "Tout reste modifiable ensuite, table par table."}
      </Hint>
    </div>
  );
}
