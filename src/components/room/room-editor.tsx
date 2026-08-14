"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useTransition, type PointerEvent as ReactPointerEvent } from "react";

import { saveRoomLayout } from "@/actions/rooms";
import { Furniture, RoomGrid } from "@/components/room/furniture";
import { Button } from "@/components/ui/button";
import { FieldError, Input, Label, Select } from "@/components/ui/field";
import { ArrowLeftIcon, RedoIcon, RotateIcon, TrashIcon, UndoIcon } from "@/components/ui/icons";
import {
  GRID_CM,
  OBJECT_DEFAULT_SIZE,
  OBJECT_LABELS,
  ROOM_MAX_CM,
  ROOM_MIN_CM,
  type ObjectKind,
} from "@/lib/domain";
import { clamp, generateSeatPositions, snapToGrid } from "@/lib/placement/geometry";
import { useHistory } from "@/lib/use-history";
import type { RoomView } from "@/lib/view-models";

// ----------------------------------------------------------------- modèle

interface EditorSeat {
  key: string;
  id?: string;
  x: number;
  y: number;
  label: string | null;
  disabled: boolean;
  isEndSeat: boolean;
}

interface EditorObject {
  key: string;
  id?: string;
  kind: ObjectKind;
  x: number;
  y: number;
  widthCm: number;
  heightCm: number;
  rotation: number;
  label: string | null;
  seats: EditorSeat[];
}

interface Layout {
  name: string;
  widthCm: number;
  heightCm: number;
  objects: EditorObject[];
}

let keyCounter = 0;

/**
 * Clé locale d'un élément non encore enregistré.
 * `crypto.randomUUID` n'existe pas hors contexte sécurisé : sur un serveur
 * accessible en HTTP simple, il serait indéfini.
 */
function localKey(prefix: string): string {
  keyCounter += 1;
  return `${prefix}-${keyCounter}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Recalcule les places d'une table après un déplacement, une rotation ou un
 * changement de taille. Les identifiants déjà enregistrés sont conservés par
 * position, afin de ne pas détruire les affectations des plans existants.
 */
function withSeats(object: EditorObject, count?: number): EditorObject {
  if (object.kind !== "TABLE") return { ...object, seats: [] };

  const target = count ?? object.seats.length;
  const positions = generateSeatPositions(object, target);

  return {
    ...object,
    seats: positions.map((position, index) => {
      const existing = object.seats[index];
      return {
        key: existing?.key ?? localKey("seat"),
        id: existing?.id,
        x: position.x,
        y: position.y,
        label: existing?.label ?? null,
        disabled: existing?.disabled ?? false,
        isEndSeat: position.isEndSeat,
      };
    }),
  };
}

function toLayout(room: RoomView): Layout {
  return {
    name: room.name,
    widthCm: room.widthCm,
    heightCm: room.heightCm,
    objects: room.objects.map((object) => ({
      key: localKey("obj"),
      id: object.id,
      kind: object.kind,
      x: object.x,
      y: object.y,
      widthCm: object.widthCm,
      heightCm: object.heightCm,
      rotation: object.rotation,
      label: object.label,
      seats: object.seats.map((seat) => ({
        key: localKey("seat"),
        id: seat.id,
        x: seat.x,
        y: seat.y,
        label: seat.label,
        disabled: seat.disabled,
        isEndSeat: seat.isEndSeat,
      })),
    })),
  };
}

const PALETTE: Array<{ kind: ObjectKind; label: string; seatCount: number }> = [
  { kind: "TABLE", label: "Table 1 place", seatCount: 1 },
  { kind: "TABLE", label: "Table 2 places", seatCount: 2 },
  { kind: "TABLE", label: "Table 3 places", seatCount: 3 },
  { kind: "TEACHER_DESK", label: OBJECT_LABELS.TEACHER_DESK, seatCount: 0 },
  { kind: "BOARD", label: OBJECT_LABELS.BOARD, seatCount: 0 },
  { kind: "DOOR", label: OBJECT_LABELS.DOOR, seatCount: 0 },
  { kind: "WINDOW", label: OBJECT_LABELS.WINDOW, seatCount: 0 },
  { kind: "OBSTACLE", label: OBJECT_LABELS.OBSTACLE, seatCount: 0 },
];

// ---------------------------------------------------------------- composant

export function RoomEditor({ room }: { room: RoomView }) {
  const router = useRouter();
  const history = useHistory<Layout>(toLayout(room));
  const [preview, setPreview] = useState<Layout | null>(null);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [pending, startTransition] = useTransition();

  const svgRef = useRef<SVGSVGElement>(null);
  const dragRef = useRef<{ key: string; pointerX: number; pointerY: number; originX: number; originY: number } | null>(null);

  // Pendant un glisser, on affiche un état provisoire : sans cela, chaque
  // mouvement de souris empilerait une entrée dans l'historique.
  const layout = preview ?? history.current;
  const selected = layout.objects.find((object) => object.key === selectedKey) ?? null;
  const seatCount = layout.objects.reduce((total, object) => total + object.seats.length, 0);

  const commit = useCallback(
    (next: Layout) => {
      history.commit(next);
      setDirty(true);
    },
    [history],
  );

  // ------------------------------------------------------------- géométrie

  function toSvgPoint(event: ReactPointerEvent): { x: number; y: number } {
    const svg = svgRef.current;
    const matrix = svg?.getScreenCTM();
    if (!svg || !matrix) return { x: 0, y: 0 };
    const point = new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse());
    return { x: point.x, y: point.y };
  }

  function handleObjectPointerDown(event: ReactPointerEvent, object: EditorObject) {
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    setSelectedKey(object.key);

    const point = toSvgPoint(event);
    dragRef.current = {
      key: object.key,
      pointerX: point.x,
      pointerY: point.y,
      originX: object.x,
      originY: object.y,
    };
  }

  function handlePointerMove(event: ReactPointerEvent) {
    const drag = dragRef.current;
    if (!drag) return;

    const point = toSvgPoint(event);
    const deltaX = point.x - drag.pointerX;
    const deltaY = point.y - drag.pointerY;

    const base = preview ?? history.current;
    setPreview({
      ...base,
      objects: base.objects.map((object) => {
        if (object.key !== drag.key) return object;

        // On borne le CENTRE du meuble, pas son coin : la rotation conserve le
        // centre, la contrainte reste donc juste quel que soit l'angle.
        const halfWidth = object.widthCm / 2;
        const halfHeight = object.heightCm / 2;

        return withSeats({
          ...object,
          x: clamp(snapToGrid(drag.originX + deltaX), -halfWidth, base.widthCm - halfWidth),
          y: clamp(snapToGrid(drag.originY + deltaY), -halfHeight, base.heightCm - halfHeight),
        });
      }),
    });
  }

  function handlePointerUp() {
    if (!dragRef.current) return;
    dragRef.current = null;
    if (preview) {
      commit(preview);
      setPreview(null);
    }
  }

  // --------------------------------------------------------------- actions

  function addObject(kind: ObjectKind, count: number) {
    const size = OBJECT_DEFAULT_SIZE[kind];
    const index = layout.objects.length;

    // Le tableau va au fond visuel de la salle (en haut), le bureau juste
    // devant : c'est la disposition que le professeur attend par défaut.
    const position =
      kind === "BOARD"
        ? { x: Math.round((layout.widthCm - size.widthCm) / 2), y: 10 }
        : kind === "TEACHER_DESK"
          ? { x: Math.round((layout.widthCm - size.widthCm) / 2), y: 60 }
          : {
              x: 80 + (index % 5) * 160,
              y: 200 + Math.floor(index / 5) * 130,
            };

    const base: EditorObject = {
      key: localKey("obj"),
      kind,
      x: clamp(snapToGrid(position.x), 0, Math.max(0, layout.widthCm - size.widthCm)),
      y: clamp(snapToGrid(position.y), 0, Math.max(0, layout.heightCm - size.heightCm)),
      widthCm: size.widthCm,
      heightCm: size.heightCm,
      rotation: 0,
      label: null,
      seats: [],
    };

    commit({ ...layout, objects: [...layout.objects, withSeats(base, count)] });
    setSelectedKey(base.key);
  }

  const updateSelected = useCallback(
    (patch: Partial<EditorObject>, seatCountOverride?: number) => {
      if (!selectedKey) return;
      commit({
        ...layout,
        objects: layout.objects.map((object) =>
          object.key === selectedKey ? withSeats({ ...object, ...patch }, seatCountOverride) : object,
        ),
      });
    },
    [commit, layout, selectedKey],
  );

  const deleteSelected = useCallback(() => {
    if (!selectedKey) return;
    commit({ ...layout, objects: layout.objects.filter((object) => object.key !== selectedKey) });
    setSelectedKey(null);
  }, [commit, layout, selectedKey]);

  function updateRoom(patch: Partial<Pick<Layout, "name" | "widthCm" | "heightCm">>) {
    commit({ ...layout, ...patch });
  }

  function handleSave() {
    setError(null);

    startTransition(async () => {
      const result = await saveRoomLayout({
        roomId: room.id,
        name: layout.name,
        widthCm: layout.widthCm,
        heightCm: layout.heightCm,
        objects: layout.objects.map((object) => ({
          id: object.id,
          kind: object.kind,
          x: Math.round(object.x),
          y: Math.round(object.y),
          widthCm: object.widthCm,
          heightCm: object.heightCm,
          rotation: object.rotation as 0 | 90 | 180 | 270,
          label: object.label,
          seats: object.seats.map((seat) => ({
            id: seat.id,
            x: Math.round(seat.x),
            y: Math.round(seat.y),
            label: seat.label,
            disabled: seat.disabled,
            isEndSeat: seat.isEndSeat,
          })),
        })),
      });

      if (!result.ok) {
        setError(result.error);
        return;
      }

      // Récupérer les identifiants attribués est indispensable : sans cela,
      // un second enregistrement recréerait tout le mobilier en double.
      const synced: Layout = {
        ...layout,
        objects: layout.objects.map((object, index) => ({
          ...object,
          id: result.data.objects[index]?.id ?? object.id,
          seats: object.seats.map((seat, seatIndex) => ({
            ...seat,
            id: result.data.objects[index]?.seatIds[seatIndex] ?? seat.id,
          })),
        })),
      };

      history.reset(synced);
      setDirty(false);
      router.refresh();
    });
  }

  // ----------------------------------------------------------- raccourcis

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      // Ne pas détourner les touches pendant une saisie.
      if (target && ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)) return;

      if ((event.key === "Delete" || event.key === "Backspace") && selectedKey) {
        event.preventDefault();
        deleteSelected();
        return;
      }

      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z") {
        event.preventDefault();
        if (event.shiftKey) history.redo();
        else history.undo();
      }

      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "y") {
        event.preventDefault();
        history.redo();
      }

      if (event.key === "Escape") setSelectedKey(null);
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [deleteSelected, history, selectedKey]);

  // Avertir avant de perdre un agencement non enregistré.
  useEffect(() => {
    if (!dirty) return;
    function warn(event: BeforeUnloadEvent) {
      event.preventDefault();
    }
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  // ----------------------------------------------------------------- rendu

  return (
    <div className="space-y-4">
      <div>
        <Link href="/salles" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-foreground">
          <ArrowLeftIcon />
          Toutes les salles
        </Link>
      </div>

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <Label htmlFor="room-name">Nom</Label>
            <Input
              id="room-name"
              value={layout.name}
              onChange={(event) => updateRoom({ name: event.target.value })}
              className="w-44"
            />
          </div>
          <div>
            <Label htmlFor="room-w">Largeur (cm)</Label>
            <Input
              id="room-w"
              type="number"
              step={GRID_CM}
              min={ROOM_MIN_CM}
              max={ROOM_MAX_CM}
              value={layout.widthCm}
              onChange={(event) =>
                updateRoom({ widthCm: clamp(Number(event.target.value), ROOM_MIN_CM, ROOM_MAX_CM) })
              }
              className="w-28"
            />
          </div>
          <div>
            <Label htmlFor="room-h">Profondeur (cm)</Label>
            <Input
              id="room-h"
              type="number"
              step={GRID_CM}
              min={ROOM_MIN_CM}
              max={ROOM_MAX_CM}
              value={layout.heightCm}
              onChange={(event) =>
                updateRoom({ heightCm: clamp(Number(event.target.value), ROOM_MIN_CM, ROOM_MAX_CM) })
              }
              className="w-28"
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" onClick={history.undo} disabled={!history.canUndo} aria-label="Annuler">
            <UndoIcon />
          </Button>
          <Button variant="secondary" size="sm" onClick={history.redo} disabled={!history.canRedo} aria-label="Rétablir">
            <RedoIcon />
          </Button>
          <Button onClick={handleSave} disabled={pending || !dirty}>
            {pending ? "Enregistrement…" : dirty ? "Enregistrer" : "Enregistré"}
          </Button>
        </div>
      </div>

      <FieldError message={error} />

      <div className="flex flex-wrap gap-2">
        {PALETTE.map((item) => (
          <Button
            key={item.label}
            variant="secondary"
            size="sm"
            onClick={() => addObject(item.kind, item.seatCount)}
          >
            + {item.label}
          </Button>
        ))}
        <span className="ml-auto self-center text-sm text-muted">
          {seatCount} place{seatCount > 1 ? "s" : ""}
        </span>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_18rem]">
        <div className="overflow-hidden rounded-xl border border-border bg-surface p-2">
          <svg
            ref={svgRef}
            viewBox={`0 0 ${layout.widthCm} ${layout.heightCm}`}
            preserveAspectRatio="xMidYMid meet"
            className="no-select h-auto max-h-[70vh] w-full touch-none"
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            onPointerDown={() => setSelectedKey(null)}
            role="application"
            aria-label="Plan de la salle. Faites glisser les meubles pour les déplacer."
          >
            <RoomGrid widthCm={layout.widthCm} heightCm={layout.heightCm} />

            {layout.objects.map((object) => (
              <g key={object.key} onPointerDown={(event) => handleObjectPointerDown(event, object)}>
                <Furniture object={{ ...object, id: object.key }} selected={object.key === selectedKey} interactive />
              </g>
            ))}

            {/* Les places sont dessinées hors du groupe pivoté : leurs
                coordonnées tiennent déjà compte de la rotation de la table. */}
            {layout.objects.flatMap((object) =>
              object.seats.map((seat) => (
                <circle
                  key={seat.key}
                  cx={seat.x}
                  cy={seat.y}
                  r={16}
                  fill={seat.disabled ? "transparent" : "var(--surface)"}
                  stroke={seat.disabled ? "var(--muted)" : "var(--primary)"}
                  strokeWidth={3}
                  strokeDasharray={seat.disabled ? "6 4" : undefined}
                  style={{ pointerEvents: "none" }}
                />
              )),
            )}
          </svg>
        </div>

        <aside className="rounded-xl border border-border bg-surface p-4">
          {selected ? (
            <SelectedPanel
              object={selected}
              onChange={updateSelected}
              onDelete={deleteSelected}
              roomWidthCm={layout.widthCm}
            />
          ) : (
            <div className="text-sm text-muted">
              <p className="font-medium text-foreground">Aucun meuble sélectionné</p>
              <ul className="mt-3 space-y-1.5">
                <li>Cliquez un meuble pour le modifier.</li>
                <li>Faites-le glisser pour le déplacer.</li>
                <li>
                  <kbd className="rounded bg-surface-muted px-1">Suppr</kbd> l&apos;efface.
                </li>
                <li>
                  <kbd className="rounded bg-surface-muted px-1">Ctrl</kbd>+
                  <kbd className="rounded bg-surface-muted px-1">Z</kbd> annule.
                </li>
              </ul>
              <p className="mt-4 border-t border-border pt-3">
                Le tableau se place en haut : c&apos;est le repère qui définit le « premier rang ».
              </p>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}

function SelectedPanel({
  object,
  onChange,
  onDelete,
  roomWidthCm,
}: {
  object: EditorObject;
  onChange: (patch: Partial<EditorObject>, seatCount?: number) => void;
  onDelete: () => void;
  roomWidthCm: number;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="font-medium">{OBJECT_LABELS[object.kind]}</h2>
        <Button size="sm" variant="ghost" onClick={onDelete} aria-label="Supprimer le meuble">
          <TrashIcon />
        </Button>
      </div>

      {object.kind === "TABLE" && (
        <div>
          <Label htmlFor="seat-count">Nombre de places</Label>
          <Select
            id="seat-count"
            value={object.seats.length}
            onChange={(event) => onChange({}, Number(event.target.value))}
          >
            {[0, 1, 2, 3, 4].map((count) => (
              <option key={count} value={count}>
                {count}
              </option>
            ))}
          </Select>
        </div>
      )}

      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label htmlFor="obj-w">Largeur (cm)</Label>
          <Input
            id="obj-w"
            type="number"
            step={GRID_CM}
            min={10}
            max={roomWidthCm}
            value={object.widthCm}
            onChange={(event) => onChange({ widthCm: Math.max(10, Number(event.target.value)) })}
          />
        </div>
        <div>
          <Label htmlFor="obj-h">Profondeur (cm)</Label>
          <Input
            id="obj-h"
            type="number"
            step={GRID_CM}
            min={5}
            value={object.heightCm}
            onChange={(event) => onChange({ heightCm: Math.max(5, Number(event.target.value)) })}
          />
        </div>
      </div>

      <div>
        <Label htmlFor="obj-label">Étiquette</Label>
        <Input
          id="obj-label"
          value={object.label ?? ""}
          placeholder={OBJECT_LABELS[object.kind]}
          onChange={(event) => onChange({ label: event.target.value || null })}
        />
      </div>

      <Button
        variant="secondary"
        size="sm"
        className="w-full"
        onClick={() => onChange({ rotation: (object.rotation + 90) % 360 })}
      >
        <RotateIcon />
        Pivoter ({object.rotation}°)
      </Button>

      {object.kind === "TABLE" && object.seats.length > 0 && (
        <p className="border-t border-border pt-3 text-xs text-muted">
          Les places suivent la table lorsqu&apos;elle est déplacée ou pivotée.
        </p>
      )}
    </div>
  );
}
