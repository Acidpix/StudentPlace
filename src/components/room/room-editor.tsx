"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useTransition, type PointerEvent as ReactPointerEvent } from "react";

import { saveRoomLayout } from "@/actions/rooms";
import { Furniture, RoomGrid } from "@/components/room/furniture";
import { LayoutPresetsPanel } from "@/components/room/layout-presets-panel";
import { Button } from "@/components/ui/button";
import { CARD } from "@/components/ui/card";
import { FieldError, Input, Label, Select } from "@/components/ui/field";
import {
  ArrowLeftIcon,
  LayoutIcon,
  RedoIcon,
  RotateIcon,
  TrashIcon,
  UndoIcon,
} from "@/components/ui/icons";
import { InlineRename } from "@/components/ui/inline-rename";
import { Segment, Track } from "@/components/ui/segmented";
import {
  GRID_CM,
  OBJECT_DEFAULT_SIZE,
  OBJECT_LABELS,
  ROOM_MAX_CM,
  ROOM_MIN_CM,
  TABLE_WIDTH_BY_SEATS,
  tableWidthForSeats,
  type ObjectKind,
} from "@/lib/domain";
import { centerOf, clamp, generateSeatPositions, snapToGrid } from "@/lib/placement/geometry";
import { generatePresetLayout, type LayoutPresetId } from "@/lib/placement/layout-presets";
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

/**
 * Ajuste la largeur d'une table quand son nombre de places change.
 *
 * On ne touche à rien si la largeur a été réglée à la main : seule une table
 * restée à la largeur type de son nombre de places actuel suit le barème. Une
 * largeur passée dans le correctif l'emporte toujours — c'est le champ
 * « Largeur » de la fiche.
 */
function resizeForSeats(
  object: EditorObject,
  patch: Partial<EditorObject>,
  seatCount?: number,
): Partial<EditorObject> {
  if (object.kind !== "TABLE") return patch;
  if (seatCount === undefined || seatCount === object.seats.length) return patch;
  if (patch.widthCm !== undefined) return patch;
  if (object.widthCm !== tableWidthForSeats(object.seats.length)) return patch;

  const widthCm = TABLE_WIDTH_BY_SEATS[seatCount];
  return widthCm === undefined ? patch : { ...patch, widthCm };
}

// -------------------------------- élargissement ------------------------------

/** Écart laissé entre deux tables reflow, en centimètres — un simple souffle. */
const WIDEN_CLEARANCE_CM = 20;

/** Dégagement visé de part et d'autre d'une rangée. Souple : voir plus bas. */
const WIDEN_ROW_MARGIN_CM = 10;

/** Au-delà, deux tables ne sont plus considérées sur le même rang. */
const WIDEN_ROW_TOLERANCE_CM = 40;

/**
 * Rapport largeur / hauteur au-delà duquel élargir la salle COÛTE de la
 * hauteur aux cartes — et donc ce que ce bouton s'interdit.
 *
 * Le plan de classe affiche la salle à une échelle UNIQUE (`pxPerCm`), commune
 * aux deux axes : la salle ne doit jamais s'afficher déformée. Tant qu'elle
 * est plus proche du carré que de ce rapport, l'élargir ne coûte rien — c'est
 * la HAUTEUR qui borne l'échelle, la largeur a du mou. Au-delà, c'est la
 * LARGEUR qui borne à son tour : chaque centimètre ajouté RÉDUIT l'échelle et
 * donc RÉTRÉCIT LA HAUTEUR des cartes en pixels — l'inverse de ce qui est
 * demandé. 1,35 est une hypothèse prudente sur la fenêtre de plan la plus
 * étroite qu'un usage de bureau raisonnable présente ; se tromper vers le bas
 * ne coûte qu'un peu de largeur gagnée en moins, jamais un pixel de hauteur.
 */
const SAFE_ROOM_ASPECT_RATIO = 1.35;

function isUprightRotation(rotation: number): boolean {
  return ((rotation % 180) + 180) % 180 === 0;
}

/** Une table est « à élargir » tant qu'elle n'a pas la largeur de son barème. */
function isNarrow(object: EditorObject): boolean {
  return object.kind === "TABLE" && object.widthCm < tableWidthForSeats(object.seats.length);
}

/**
 * Largeur d'une table à un `level` entre 0 (sa largeur ACTUELLE, jamais moins)
 * et 1 (son barème plein). Un curseur continu plutôt qu'un tout-ou-rien : ce
 * qui coince, c'est toujours UNE rangée précise contre le plafond de sécurité
 * — les autres doivent pouvoir grandir presque jusqu'au barème quand même.
 */
function steppedTableWidth(table: EditorObject, level: number): number {
  const barème = tableWidthForSeats(table.seats.length);
  if (barème <= table.widthCm) return table.widthCm;
  return Math.max(table.widthCm, snapToGrid(table.widthCm + (barème - table.widthCm) * level));
}

/**
 * Regroupe les tables DROITES (non pivotées) en rangées, par proximité
 * verticale, chaque rangée triée de gauche à droite.
 *
 * Seules les tables droites sont concernées : une table pivotée d'un quart de
 * tour grandirait vers le HAUT et le BAS si on la traitait pareil — ce
 * qu'« élargir » exclut désormais, la consigne portant sur la largeur SEULE.
 * Une table pivotée (le bras d'un U, par exemple) garde donc sa largeur.
 */
function groupTableRows(objects: EditorObject[]): EditorObject[][] {
  const upright = objects
    .filter((object) => object.kind === "TABLE" && isUprightRotation(object.rotation))
    .slice()
    .sort((a, b) => centerOf(a).y - centerOf(b).y);

  const rows: EditorObject[][] = [];
  for (const table of upright) {
    const y = centerOf(table).y;
    const row = rows[rows.length - 1];
    if (row && Math.abs(y - centerOf(row[0]).y) <= WIDEN_ROW_TOLERANCE_CM) row.push(table);
    else rows.push([table]);
  }

  for (const row of rows) row.sort((a, b) => a.x - b.x);
  return rows;
}

/** Largeur totale qu'occuperait une rangée à ce `level`. */
function reflowedRowSpan(row: EditorObject[], level: number): number {
  return row.reduce((sum, table) => sum + steppedTableWidth(table, level), 0) + (row.length - 1) * WIDEN_CLEARANCE_CM;
}

/**
 * Le plus grand `level` (0 à 1) auquel TOUTES les rangées tiennent dans
 * `maxWidthCm`. Une recherche linéaire à pas fin suffit : quelques rangées,
 * un calcul de somme immédiat.
 *
 * `level = 0` doit TOUJOURS convenir : c'est la largeur actuelle des tables,
 * qui par définition tenait déjà quelque part. C'est ce filet qui garantit que
 * le bouton ne peut jamais échouer à produire un agencement valide.
 */
function widestFittingLevel(rows: EditorObject[][], maxWidthCm: number): number {
  const STEPS = 40;
  for (let step = STEPS; step >= 0; step--) {
    const level = step / STEPS;
    if (rows.every((row) => reflowedRowSpan(row, level) + 2 * WIDEN_ROW_MARGIN_CM <= maxWidthCm)) return level;
  }
  return 0;
}

interface WidenPlan {
  newWidthCm: number;
  /** Largeur et abscisse cibles, par clé de table. */
  placements: Map<string, { widthCm: number; x: number }>;
}

/**
 * Calcule le plan d'élargissement : le `level` le plus généreux qui tienne
 * dans le plafond SÛR pour la hauteur (`SAFE_ROOM_ASPECT_RATIO`), puis la
 * position de chaque table dans la salle résultante, rangée par rangée,
 * centrée.
 *
 * `maxWidthCm` ne descend JAMAIS sous la largeur actuelle : ce plan n'implique
 * jamais de RÉTRÉCIR la salle. Le dégagement de rangée (`WIDEN_ROW_MARGIN_CM`)
 * n'est volontairement PAS ajouté à `newWidthCm` telle quelle mais inclus dans
 * la recherche elle-même : l'exiger en plus, après coup, avait déjà fait
 * dépasser de 10 cm le plafond sûr sur une salle dont l'agencement existant
 * était plus serré que ce dégagement — un comfort cosmétique qui coûtait un
 * pixel de hauteur, l'inverse du but.
 */
function computeWidenPlan(layout: Layout): WidenPlan | null {
  const rows = groupTableRows(layout.objects);
  if (rows.length === 0) return null;

  const safeWidthCm = Math.round(layout.heightCm * SAFE_ROOM_ASPECT_RATIO);
  const maxWidthCm = Math.min(ROOM_MAX_CM, Math.max(layout.widthCm, safeWidthCm));
  const level = widestFittingLevel(rows, maxWidthCm);

  const newWidthCm = Math.min(
    ROOM_MAX_CM,
    Math.max(layout.widthCm, ...rows.map((row) => reflowedRowSpan(row, level) + 2 * WIDEN_ROW_MARGIN_CM)),
  );

  const placements = new Map<string, { widthCm: number; x: number }>();
  for (const row of rows) {
    let cursor = (newWidthCm - reflowedRowSpan(row, level)) / 2;
    for (const table of row) {
      const widthCm = steppedTableWidth(table, level);
      placements.set(table.key, { widthCm, x: snapToGrid(cursor) });
      cursor += widthCm + WIDEN_CLEARANCE_CM;
    }
  }

  return { newWidthCm, placements };
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
  const [presetsOpen, setPresetsOpen] = useState(false);
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
    const defaults = OBJECT_DEFAULT_SIZE[kind];
    // Une table est large en proportion de son nombre de places : c'est cet
    // écartement qui décide de la lisibilité des noms sur le plan de classe.
    const size =
      kind === "TABLE" ? { ...defaults, widthCm: tableWidthForSeats(count) } : defaults;
    const index = layout.objects.length;

    // Le tableau va au fond visuel de la salle (en haut), le bureau juste
    // devant : c'est la disposition que le professeur attend par défaut.
    const position =
      kind === "BOARD"
        ? { x: Math.round((layout.widthCm - size.widthCm) / 2), y: 10 }
        : kind === "TEACHER_DESK"
          ? { x: Math.round((layout.widthCm - size.widthCm) / 2), y: 60 }
          : (() => {
              // Le pas de dépose suit la TAILLE du meuble : à pas fixe, deux
              // tables du barème (230 cm) se recouvraient à moitié dès la
              // deuxième, et il fallait les séparer à la main avant de pouvoir
              // les saisir.
              const pitchX = size.widthCm + 40;
              const perRow = Math.max(1, Math.floor((layout.widthCm - 80) / pitchX));
              return {
                x: 40 + (index % perRow) * pitchX,
                y: 200 + Math.floor(index / perRow) * (size.heightCm + 75),
              };
            })();

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

  /**
   * Applique une disposition type.
   *
   * Seules les TABLES sont remplacées. Le tableau, la porte, les fenêtres et
   * les obstacles décrivent la salle elle-même, pas la façon de l'agencer : les
   * effacer obligerait à les repositionner après chaque essai de disposition.
   * Tableau et bureau ne sont posés que s'ils manquent.
   *
   * Les places, en revanche, sont bel et bien recréées : leurs identifiants
   * disparaissent, donc les élèves déjà placés dans les plans qui utilisent
   * cette salle aussi. C'est assumé — c'est un redessin volontaire de la salle,
   * annoncé dans le panneau — mais cela reste réversible par Ctrl+Z tant que
   * l'agencement n'est pas enregistré.
   */
  function applyPreset(preset: LayoutPresetId, seatTarget: number) {
    const generated = generatePresetLayout(
      preset,
      { widthCm: layout.widthCm, heightCm: layout.heightCm },
      seatTarget,
    );

    const kept = layout.objects.filter((object) => object.kind !== "TABLE");
    const alreadyThere = new Set(kept.map((object) => object.kind));

    const added = [
      ...generated.fixtures.filter((fixture) => !alreadyThere.has(fixture.kind)),
      ...generated.tables,
    ].map((object) =>
      withSeats(
        {
          key: localKey("obj"),
          kind: object.kind,
          x: object.x,
          y: object.y,
          widthCm: object.widthCm,
          heightCm: object.heightCm,
          rotation: object.rotation,
          label: object.label,
          seats: [],
        },
        object.seatCount,
      ),
    );

    commit({ ...layout, objects: [...kept, ...added] });
    setSelectedKey(null);
    setPresetsOpen(false);
  }

  /**
   * Élargit VRAIMENT les tables : au lieu de les faire grandir SUR PLACE — ce
   * qui plafonnait vite sur une salle dessinée avec un pas serré, une table ne
   * pouvant jamais toucher sa voisine —, ce bouton REPOSITIONNE chaque rangée
   * de tables droites, centrée, et AGRANDIT LA SALLE d'autant si elle n'a pas
   * la place — jusqu'à `SAFE_ROOM_ASPECT_RATIO`, jamais plus (voir
   * `computeWidenPlan`) : au-delà, l'agrandissement se retournerait contre son
   * propre but en rétrécissant la HAUTEUR des cartes à l'écran.
   *
   * Seule la LARGEUR de la salle bouge — jamais sa HAUTEUR, pas plus que
   * l'ordonnée des rangées, qui gardent leur y. La salle s'élargit
   * SYMÉTRIQUEMENT : tout ce qui n'est pas une table droite — tableau, bureau,
   * porte, fenêtres, tables pivotées, obstacles — se décale de la moitié de
   * l'agrandissement, pour garder sa position RELATIVE dans la salle plutôt
   * que de se retrouver plaqué contre un mur qui a reculé.
   *
   * Les tables PIVOTÉES (les bras d'un U, par exemple) ne sont pas reflow :
   * les élargir grandirait la salle en HAUTEUR, ce que ce bouton exclut.
   *
   * Les places sont RECALCULÉES mais leurs identifiants sont conservés par
   * `withSeats()` : les élèves déjà placés dans les plans de cette salle ne
   * bougent pas. C'est toute la différence avec une disposition type, qui les
   * recrée.
   */
  const widenTables = useCallback(() => {
    const plan = computeWidenPlan(layout);
    if (!plan) return;

    const deltaX = plan.newWidthCm - layout.widthCm;

    commit({
      ...layout,
      widthCm: plan.newWidthCm,
      objects: layout.objects.map((object) => {
        const placement = plan.placements.get(object.key);
        if (placement) return withSeats({ ...object, widthCm: placement.widthCm, x: placement.x });
        if (deltaX === 0) return object;

        // Tout le reste garde sa place RELATIVE : la salle a grandi des deux
        // côtés à la fois.
        const half = object.widthCm / 2;
        return { ...object, x: clamp(snapToGrid(object.x + deltaX / 2), -half, plan.newWidthCm - half) };
      }),
    });
  }, [commit, layout]);

  /**
   * Combien de tables droites gagneraient à être élargies. Zéro fait
   * disparaître le bouton : une salle déjà au barème, ou déjà à la largeur
   * sûre, n'a rien à en attendre.
   */
  const narrowTables = layout.objects.filter(
    (object) => object.kind === "TABLE" && isUprightRotation(object.rotation) && isNarrow(object),
  ).length;
  const widenPreviewWidthCm = narrowTables > 0 ? (computeWidenPlan(layout)?.newWidthCm ?? layout.widthCm) : layout.widthCm;

  const updateSelected = useCallback(
    (patch: Partial<EditorObject>, seatCountOverride?: number) => {
      if (!selectedKey) return;
      commit({
        ...layout,
        objects: layout.objects.map((object) =>
          object.key === selectedKey
            ? withSeats({ ...object, ...resizeForSeats(object, patch, seatCountOverride) }, seatCountOverride)
            : object,
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

  /** Nom et dimensions de la salle : mêmes chemins d'annulation que le mobilier. */
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
        <div className="min-w-0">
          {/* Le renommage passe par l'état local et part avec « Enregistrer » :
              la salle n'a qu'un seul chemin de sauvegarde, saveRoomLayout, qui
              écrit le nom et l'agencement d'un bloc. */}
          <InlineRename
            value={layout.name}
            label="cette salle"
            onRename={async (name) => {
              updateRoom({ name });
              return null;
            }}
          />
          <p className="eyebrow mt-1.5">
            {seatCount} place{seatCount > 1 ? "s" : ""} · {layout.widthCm} × {layout.heightCm} cm
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Même vocabulaire que la barre d'outils du plan de classe : une
              piste creuse, des segments dedans. Les deux éditeurs se
              ressemblaient de moins en moins. */}
          <Track>
            <Segment onClick={history.undo} disabled={!history.canUndo} title="Annuler">
              <UndoIcon />
            </Segment>
            <Segment onClick={history.redo} disabled={!history.canRedo} title="Rétablir">
              <RedoIcon />
            </Segment>
          </Track>
          <Button onClick={handleSave} loading={pending} disabled={!dirty}>
            {pending ? "Enregistrement…" : dirty ? "Enregistrer" : "Enregistré"}
          </Button>
        </div>
      </div>

      <FieldError message={error} />

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-wrap items-end gap-3">
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

        <div className="flex flex-wrap gap-2">
          {/* Dessiner une salle table par table est le geste le plus long de
              l'application : la disposition type vient donc AVANT la palette. */}
          <Button
            variant={presetsOpen ? "primary" : "secondary"}
            size="sm"
            onClick={() => setPresetsOpen((open) => !open)}
            aria-expanded={presetsOpen}
          >
            <LayoutIcon />
            Dispositions types
          </Button>

          {/* Voisin des dispositions types, et pour la même raison : c'est un
              geste qui retouche la salle entière, pas un meuble. Il disparaît
              quand toutes les tables droites sont déjà au barème — un bouton
              sans effet n'apprend rien. */}
          {narrowTables > 0 && (
            <Button
              variant="secondary"
              size="sm"
              onClick={widenTables}
              title={`Repositionne les tables à la largeur de leur barème et porte la salle à ${widenPreviewWidthCm} cm de large si besoin — sa hauteur ne change jamais. Les élèves déjà placés ne bougent pas.`}
            >
              Élargir les tables ({narrowTables})
            </Button>
          )}

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
        </div>
      </div>

      {presetsOpen && (
        <LayoutPresetsPanel
          roomWidthCm={layout.widthCm}
          roomHeightCm={layout.heightCm}
          tableCount={layout.objects.filter((object) => object.kind === "TABLE").length}
          onApply={applyPreset}
          onClose={() => setPresetsOpen(false)}
        />
      )}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_18rem]">
        {/* Le cadre est le plan de travail : surface du thème et trame de
            points. La salle, elle, est BLANCHE (`--room-floor`, posé par
            `RoomGrid`), ce qui la détache du cadre même quand elle ne le
            remplit pas entièrement. */}
        <div className="halftone overflow-hidden rounded-card border border-border bg-surface p-2 shadow-soft">
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

        <aside className={`${CARD} p-4`}>
          {selected ? (
            <SelectedPanel
              object={selected}
              onChange={updateSelected}
              onDelete={deleteSelected}
              roomWidthCm={layout.widthCm}
            />
          ) : (
            <div className="text-sm text-muted">
              <p className="font-bold">Aucun meuble sélectionné</p>
              <ul className="mt-3 space-y-1.5">
                <li>Cliquez un meuble pour le modifier.</li>
                <li>Faites-le glisser pour le déplacer.</li>
                <li>
                  <kbd className="rounded-control border border-border bg-surface-muted px-1">Suppr</kbd> l&apos;efface.
                </li>
                <li>
                  <kbd className="rounded-control border border-border bg-surface-muted px-1">Ctrl</kbd>+
                  <kbd className="rounded-control border border-border bg-surface-muted px-1">Z</kbd> annule.
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
        <h2 className="eyebrow">{OBJECT_LABELS[object.kind]}</h2>
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
