"use client";

import { useMemo, useState, type ComponentType } from "react";

import { Button } from "@/components/ui/button";
import { Hint, Input, Label } from "@/components/ui/field";
import {
  IslandsLayoutArt,
  RowsLayoutArt,
  UShapeLayoutArt,
  WarningIcon,
  XIcon,
} from "@/components/ui/icons";
import { cn } from "@/lib/cn";
import {
  generatePresetLayout,
  LAYOUT_PRESET_IDS,
  LAYOUT_PRESETS,
  PRESET_SEAT_MAX,
  PRESET_SEAT_MIN,
  type LayoutPresetId,
} from "@/lib/placement/layout-presets";

const THUMBNAILS: Record<LayoutPresetId, ComponentType<{ className?: string }>> = {
  ROWS: RowsLayoutArt,
  U_SHAPE: UShapeLayoutArt,
  ISLANDS: IslandsLayoutArt,
};

/**
 * Choix d'une disposition type.
 *
 * Chaque vignette annonce le nombre de places que la disposition tiendrait
 * VRAIMENT dans cette salle-ci, recalculé à chaque frappe. C'est l'essentiel :
 * « en U » n'a pas la même capacité que « en rangées », et le professeur doit
 * pouvoir arbitrer avant d'effacer son travail, pas après.
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
  onApply: (preset: LayoutPresetId, seatTarget: number) => void;
  onClose: () => void;
}) {
  const [preset, setPreset] = useState<LayoutPresetId>("ROWS");
  const [seatTarget, setSeatTarget] = useState(30);

  const previews = useMemo(
    () =>
      Object.fromEntries(
        LAYOUT_PRESET_IDS.map((id) => [
          id,
          generatePresetLayout(id, { widthCm: roomWidthCm, heightCm: roomHeightCm }, seatTarget),
        ]),
      ) as Record<LayoutPresetId, ReturnType<typeof generatePresetLayout>>,
    [roomWidthCm, roomHeightCm, seatTarget],
  );

  const selected = previews[preset];

  return (
    <section className="rounded-card border border-border bg-surface p-4 shadow-soft material">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-medium">Dispositions types</h2>
          <p className="mt-0.5 text-sm text-muted">
            Remplace les tables de la salle. Le tableau, la porte et les fenêtres restent en place.
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={onClose} aria-label="Fermer les dispositions types">
          <XIcon />
        </Button>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        {LAYOUT_PRESET_IDS.map((id) => {
          const Thumbnail = THUMBNAILS[id];
          const preview = previews[id];
          const active = id === preset;

          return (
            <button
              key={id}
              type="button"
              onClick={() => setPreset(id)}
              aria-pressed={active}
              className={cn(
                "rounded-card border p-3 text-left transition-[border-color,background-color] duration-150",
                active
                  ? "border-primary bg-primary-soft"
                  : "border-border bg-surface hover:border-primary/40 hover:bg-surface-muted",
              )}
            >
              <Thumbnail className="h-16 w-full text-muted" />
              <p className="mt-2 text-sm font-medium">{LAYOUT_PRESETS[id].label}</p>
              <p className="mt-0.5 text-xs text-muted">{LAYOUT_PRESETS[id].description}</p>
              <p className="mt-1.5 text-xs font-medium text-foreground">
                {preview.seatCount} place{preview.seatCount > 1 ? "s" : ""}
              </p>
            </button>
          );
        })}
      </div>

      <div className="mt-4 flex flex-wrap items-end gap-3">
        <div>
          <Label htmlFor="preset-seats">Places souhaitées</Label>
          <Input
            id="preset-seats"
            type="number"
            min={PRESET_SEAT_MIN}
            max={PRESET_SEAT_MAX}
            value={seatTarget}
            onChange={(event) => setSeatTarget(Number(event.target.value))}
            className="w-28"
          />
        </div>

        <Button onClick={() => onApply(preset, seatTarget)}>
          Appliquer « {LAYOUT_PRESETS[preset].label} »
        </Button>
      </div>

      {selected.shortfall > 0 && (
        <p className="mt-3 flex items-start gap-2 text-sm text-danger">
          <WarningIcon className="mt-0.5 shrink-0" />
          <span>
            La salle ne tient que {selected.seatCount} place{selected.seatCount > 1 ? "s" : ""} dans
            cette disposition. Agrandissez-la, ou choisissez une disposition plus compacte.
          </span>
        </p>
      )}

      <Hint>
        {tableCount > 0
          ? `Les ${tableCount} tables actuelles seront supprimées — et avec elles les élèves déjà placés dans les plans qui utilisent cette salle. Ctrl+Z annule tant que vous n'avez pas enregistré.`
          : "Tout reste modifiable ensuite : chaque table se déplace, se pivote et se redimensionne."}
      </Hint>
    </section>
  );
}
