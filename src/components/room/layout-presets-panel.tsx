"use client";

import { useMemo, useState, type ComponentType } from "react";

import { Button } from "@/components/ui/button";
import { CARD } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/field";
import {
  IslandsLayoutArt,
  RowsLayoutArt,
  UShapeIslandLayoutArt,
  UShapeLayoutArt,
  WarningIcon,
  XIcon,
} from "@/components/ui/icons";
import { Segment, Track } from "@/components/ui/segmented";
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
 * LE PANNEAU TIENT EN TROIS LIGNES. La première version étalait quatre cartes
 * — vignette, titre, phrase de description, compte de places — sur une grille,
 * puis les réglages, puis un pavé d'avertissement : près de 380 px au-dessus du
 * plan de la salle, dans un éditeur où c'est justement la place qui manque. Les
 * quatre cartes sont devenues quatre segments d'une piste (`ui/segmented.tsx`,
 * le vocabulaire commun aux deux éditeurs), et la description ne s'affiche plus
 * que pour la disposition SÉLECTIONNÉE — les trois autres n'ont pas besoin de
 * se raconter tant qu'on ne les a pas choisies.
 *
 * Les intitulés des réglages sont posés en `<label className="eyebrow">` et
 * NON avec le composant `Label` : celui-ci porte `mb-1.5 block`, qu'il aurait
 * fallu défaire pour une ligne, et `cn()` est une simple concaténation sans
 * `tailwind-merge` — `mb-1.5` et `mb-0` auraient cohabité à spécificité égale,
 * l'ordre de la feuille générée tranchant. Même piège que `bg-foreground`
 * contre `bg-primary` sur les boutons.
 */
export function LayoutPresetsPanel({
  roomWidthCm,
  roomHeightCm,
  tableCount,
  onApply,
  onClose,
}: {
  roomWidthCm: number;
  roomHeightCm: number;
  /** Nombre de tables déjà posées, pour avertir de ce que l'on va remplacer. */
  tableCount: number;
  onApply: (preset: LayoutPresetId, seatTarget: number, options: PresetOptions) => void;
  onClose: () => void;
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
    <section className={`${CARD} p-3`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Track className="flex-wrap">
          {LAYOUT_PRESET_IDS.map((id) => {
            const Thumbnail = THUMBNAILS[id];

            return (
              <Segment key={id} active={id === preset} onClick={() => setPreset(id)}>
                <Thumbnail className="h-4 w-6 shrink-0" />
                {LAYOUT_PRESETS[id].label}
                <span className="text-muted">{previews[id].seatCount}</span>
              </Segment>
            );
          })}
        </Track>

        <div className="flex items-center gap-2">
          <p className="hidden text-xs text-muted sm:block">{LAYOUT_PRESETS[preset].description}</p>
          <Button variant="ghost" size="sm" onClick={onClose} aria-label="Fermer les dispositions types">
            <XIcon />
          </Button>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
        <div className="flex items-center gap-2">
          <label htmlFor="preset-seats" className="eyebrow">
            Places
          </label>
          <Input
            id="preset-seats"
            type="number"
            min={PRESET_SEAT_MIN}
            max={PRESET_SEAT_MAX}
            value={seatTarget}
            onChange={(event) => setSeatTarget(Number(event.target.value))}
            className="w-20"
          />
        </div>

        <div className="flex items-center gap-2">
          <label htmlFor="preset-table" className="eyebrow">
            Table
          </label>
          <Select
            id="preset-table"
            value={seatsPerTable}
            onChange={(event) => setSeatsPerTable(Number(event.target.value) as PresetSeatCount)}
            className="w-32"
          >
            {PRESET_SEAT_COUNTS.map((count) => (
              <option key={count} value={count}>
                {count} place{count > 1 ? "s" : ""}
              </option>
            ))}
          </Select>
        </div>

        {/* Le nombre d'îlots n'a de sens que pour le U qui en porte : ailleurs,
            un sélecteur inerte laisserait croire à un réglage sans effet. */}
        {preset === "U_SHAPE_ISLAND" && (
          <div className="flex items-center gap-2">
            <label htmlFor="preset-islands" className="eyebrow">
              Îlots
            </label>
            <Select
              id="preset-islands"
              value={islandCount}
              onChange={(event) => setIslandCount(Number(event.target.value))}
              className="w-20"
            >
              {Array.from({ length: PRESET_ISLAND_MAX + 1 }, (_, count) => (
                <option key={count} value={count}>
                  {count}
                </option>
              ))}
            </Select>
          </div>
        )}

        <Button size="sm" className="ml-auto" onClick={() => onApply(preset, seatTarget, options)}>
          Appliquer
        </Button>
      </div>

      {selected.shortfall > 0 && (
        <p className="mt-2 flex items-start gap-2 text-xs text-danger">
          <WarningIcon className="mt-px shrink-0" />
          <span>
            La salle ne tient que {selected.seatCount} place
            {selected.seatCount > 1 ? "s" : ""} ainsi. Agrandissez-la, ou prenez des tables de plus
            de places.
          </span>
        </p>
      )}

      <p className="mt-2 text-xs text-muted">
        {tableCount > 0
          ? `Remplace les ${tableCount} tables actuelles — et les élèves déjà placés. Ctrl+Z annule.`
          : "Tout reste modifiable ensuite, table par table."}
      </p>
    </section>
  );
}
