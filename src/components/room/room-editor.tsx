"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useTransition, type PointerEvent as ReactPointerEvent } from "react";

import { saveRoomLayout } from "@/actions/rooms";
import { AddPanel, itemSizeCm, type PaletteItem } from "@/components/room/add-panel";
import { Furniture, RoomGrid } from "@/components/room/furniture";
import { LayoutPresetsPanel } from "@/components/room/layout-presets-panel";
import { Button } from "@/components/ui/button";
import { CARD } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { FieldError, Hint, Input, Label, Select } from "@/components/ui/field";
import {
  ArrowLeftIcon,
  LayoutIcon,
  PlusIcon,
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
  tableWidthForSeats,
  type ObjectKind,
} from "@/lib/domain";
import { clamp, generateSeatPositions, snapToGrid } from "@/lib/placement/geometry";
import {
  generatePresetLayout,
  type LayoutPresetId,
  type PresetOptions,
} from "@/lib/placement/layout-presets";
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
  if (seatCount <= 0) return patch;

  return { ...patch, widthCm: tableWidthForSeats(seatCount) };
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

const PALETTE: PaletteItem[] = [
  { kind: "TABLE", label: "Table 1 place", seatCount: 1 },
  { kind: "TABLE", label: "Table 2 places", seatCount: 2 },
  { kind: "TABLE", label: "Table 3 places", seatCount: 3 },
  { kind: "TEACHER_DESK", label: OBJECT_LABELS.TEACHER_DESK, seatCount: 0 },
  { kind: "BOARD", label: OBJECT_LABELS.BOARD, seatCount: 0 },
  { kind: "DOOR", label: OBJECT_LABELS.DOOR, seatCount: 0 },
  { kind: "WINDOW", label: OBJECT_LABELS.WINDOW, seatCount: 0 },
  { kind: "OBSTACLE", label: OBJECT_LABELS.OBSTACLE, seatCount: 0 },
];

/**
 * Les deux groupes de cartes du bac. La frontière se lit sur la palette
 * elle-même plutôt qu'à un indice écrit en dur : ajouter un type de table ne
 * doit pas obliger à corriger un nombre ailleurs.
 */
const TABLE_ITEMS = PALETTE.filter((item) => item.kind === "TABLE");
const FURNITURE_ITEMS = PALETTE.filter((item) => item.kind !== "TABLE");

/**
 * Course minimale, en pixels d'écran, avant qu'un appui sur une carte compte
 * comme un GLISSER. En deçà, c'est un clic, et le meuble se pose à la position
 * en cascade — sans ce seuil, le moindre tremblement de souris déciderait à la
 * place du professeur.
 */
const DRAG_THRESHOLD_PX = 4;

/** Les deux onglets de la colonne de droite. */
type PanelTab = "add" | "presets";

// ---------------------------------------------------------------- composant

export function RoomEditor({ room }: { room: RoomView }) {
  const router = useRouter();
  const history = useHistory<Layout>(toLayout(room));
  const [preview, setPreview] = useState<Layout | null>(null);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [panelTab, setPanelTab] = useState<PanelTab>("add");
  const [dirty, setDirty] = useState(false);
  const [pending, startTransition] = useTransition();

  // Le meuble qu'on est en train de tirer depuis le bac, l'endroit où il
  // tomberait, et où se trouve le curseur. `dropGhost` vaut `null` tant que
  // celui-ci n'est pas entré dans la salle : c'est ce qui permet d'annuler en
  // relâchant à côté. `dragPointer`, lui, existe pendant TOUT le geste — c'est
  // la carte qu'on tient, et elle doit se voir même au-dessus du bac.
  const [adding, setAdding] = useState<PaletteItem | null>(null);
  const [dropGhost, setDropGhost] = useState<{ x: number; y: number } | null>(null);
  const [dragPointer, setDragPointer] = useState<{ x: number; y: number } | null>(null);

  // Le meuble tout juste posé, le temps d'une animation d'apparition. On ne le
  // remet jamais à zéro : la clé est unique, donc le `<g>` ne se remonte plus,
  // et l'animation ne rejoue que si un Ctrl+Z suivi d'un Ctrl+Y le fait
  // réapparaître — ce qui est justement le moment de le signaler.
  const [flashKey, setFlashKey] = useState<string | null>(null);

  // Effacement en bloc, soumis à confirmation. Une seule boîte pour les deux
  // portées : elles ne diffèrent que par leur texte.
  const [clearing, setClearing] = useState<"tables" | "all" | null>(null);

  const svgRef = useRef<SVGSVGElement>(null);
  const dragRef = useRef<{ key: string; pointerX: number; pointerY: number; originX: number; originY: number } | null>(null);
  const addStartRef = useRef<{ x: number; y: number; moved: boolean } | null>(null);

  // Un glisser abouti se termine aussi par un `click` sur la carte, la souris
  // n'ayant ni bougé de cible ni changé de bouton. Sans ce drapeau, le meuble
  // serait posé DEUX fois : une au lâcher, une au clic qui suit.
  const suppressClickRef = useRef(false);

  // Pendant un glisser, on affiche un état provisoire : sans cela, chaque
  // mouvement de souris empilerait une entrée dans l'historique.
  const layout = preview ?? history.current;
  const selected = layout.objects.find((object) => object.key === selectedKey) ?? null;
  const seatCount = layout.objects.reduce((total, object) => total + object.seats.length, 0);
  const tableCount = layout.objects.filter((object) => object.kind === "TABLE").length;

  const commit = useCallback(
    (next: Layout) => {
      history.commit(next);
      setDirty(true);
    },
    [history],
  );

  // ------------------------------------------------------------- géométrie

  /**
   * Coordonnées de salle sous un point de l'ÉCRAN.
   *
   * Prend `clientX`/`clientY` et non un événement : pendant qu'on tire une carte
   * du bac, le pointeur est capturé par la carte et l'événement ne vise jamais
   * le `<svg>`. Seule la matrice de l'écran vers la salle importe.
   */
  function svgPointFrom(clientX: number, clientY: number): { x: number; y: number } | null {
    const svg = svgRef.current;
    const matrix = svg?.getScreenCTM();
    if (!svg || !matrix) return null;
    const point = new DOMPoint(clientX, clientY).matrixTransform(matrix.inverse());
    return { x: point.x, y: point.y };
  }

  function toSvgPoint(event: ReactPointerEvent): { x: number; y: number } {
    return svgPointFrom(event.clientX, event.clientY) ?? { x: 0, y: 0 };
  }

  /**
   * Où tomberait le meuble tiré, si le curseur est dans la salle.
   *
   * Le meuble se CENTRE sur le curseur — c'est ce qu'on attend d'un objet qu'on
   * tient — puis s'aimante au pas de la grille et se borne à la salle. Renvoie
   * `null` hors de la salle : relâcher à côté n'ajoute rien.
   */
  function dropPositionAt(
    clientX: number,
    clientY: number,
    item: PaletteItem,
  ): { x: number; y: number } | null {
    const point = svgPointFrom(clientX, clientY);
    if (!point) return null;
    if (point.x < 0 || point.y < 0 || point.x > layout.widthCm || point.y > layout.heightCm) {
      return null;
    }

    const { widthCm, heightCm } = itemSizeCm(item);
    return {
      x: clamp(snapToGrid(point.x - widthCm / 2), 0, Math.max(0, layout.widthCm - widthCm)),
      y: clamp(snapToGrid(point.y - heightCm / 2), 0, Math.max(0, layout.heightCm - heightCm)),
    };
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

  /**
   * Pose un meuble. `at` est le coin haut-gauche voulu, quand le professeur a
   * TIRÉ la carte jusque-là ; sans lui, on retombe sur la position en cascade,
   * qui est ce que donne un simple clic sur la carte.
   *
   * Ne SÉLECTIONNE pas le meuble ajouté : la fiche du meuble prend la place du
   * bac dans la colonne de droite, et le bac disparaîtrait donc après chaque
   * dépose — alors qu'on en pose plusieurs d'affilée.
   */
  function addObject(kind: ObjectKind, count: number, at?: { x: number; y: number }) {
    const defaults = OBJECT_DEFAULT_SIZE[kind];
    // Une table est large en proportion de son nombre de places : c'est cet
    // écartement qui décide de la lisibilité des noms sur le plan de classe.
    const size =
      kind === "TABLE" ? { ...defaults, widthCm: tableWidthForSeats(count) } : defaults;
    const index = layout.objects.length;

    // Le tableau va au fond visuel de la salle (en haut), le bureau juste
    // devant : c'est la disposition que le professeur attend par défaut.
    const position =
      at ??
      (kind === "BOARD"
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
            })());

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
    setFlashKey(base.key);
  }

  /**
   * Vide la salle, en tout ou en partie.
   *
   * Retirer les TABLES seules laisse ce qui décrit la salle — tableau, bureau,
   * porte, fenêtres, obstacles —, exactement la frontière que trace déjà
   * `applyPreset`. C'est ce qu'on veut avant de repartir d'une disposition
   * type. Le mode `all` ne garde rien.
   *
   * Les deux passent par `commit`, donc restent annulables par Ctrl+Z tant que
   * l'agencement n'est pas enregistré.
   */
  function clearObjects(scope: "tables" | "all") {
    commit({
      ...layout,
      objects: scope === "tables" ? layout.objects.filter((o) => o.kind !== "TABLE") : [],
    });
    setSelectedKey(null);
    setClearing(null);
  }

  /**
   * Montre un onglet, et DÉSÉLECTIONNE le meuble en cours.
   *
   * Sans cela, cliquer « Ajouter » ne ferait rien de visible : la fiche du
   * meuble sélectionné passe avant l'onglet, et l'onglet resterait caché
   * derrière elle.
   */
  function showTab(tab: PanelTab) {
    setPanelTab(tab);
    setSelectedKey(null);
  }

  // ------------------------------------------------- glisser depuis le bac

  function handleAddPointerDown(event: ReactPointerEvent<HTMLButtonElement>, item: PaletteItem) {
    // Un geste qui commence repart d'une ardoise propre. Sans cette remise à
    // zéro, un glisser relâché HORS de la carte laisserait le drapeau levé —
    // aucun `click` ne vient alors le rabaisser, puisqu'il se poserait sur
    // l'ancêtre commun du `pointerdown` et du `pointerup`, pas sur la carte —
    // et c'est le clic suivant, parfaitement légitime, qui serait avalé.
    suppressClickRef.current = false;

    // Bouton principal seulement : un clic droit ouvre le menu contextuel et ne
    // doit rien armer.
    if (event.button !== 0) return;
    addStartRef.current = { x: event.clientX, y: event.clientY, moved: false };
    setAdding(item);
  }

  function handleAddClick(item: PaletteItem) {
    // Le `click` qui suit un glisser abouti ne doit rien poser de plus.
    if (suppressClickRef.current) {
      suppressClickRef.current = false;
      return;
    }
    addObject(item.kind, item.seatCount);
  }

  /**
   * Le glisser se suit sur la FENÊTRE, pas sur la carte.
   *
   * L'abonnement est refait à chaque rendu utile — c'est ce que donne un effet
   * dépendant de `layout` — si bien que `dropPositionAt` et `addObject` voient
   * toujours la salle à jour. Des écouteurs posés une fois pour toutes au
   * `pointerdown` garderaient, eux, les dimensions qu'avait la salle au début
   * du geste.
   */
  useEffect(() => {
    if (!adding) return;

    function move(event: PointerEvent) {
      const start = addStartRef.current;
      if (!start || !adding) return;

      if (!start.moved) {
        const distance = Math.hypot(event.clientX - start.x, event.clientY - start.y);
        if (distance < DRAG_THRESHOLD_PX) return;
        start.moved = true;
      }

      setDragPointer({ x: event.clientX, y: event.clientY });
      setDropGhost(dropPositionAt(event.clientX, event.clientY, adding));
    }

    function up(event: PointerEvent) {
      const start = addStartRef.current;
      addStartRef.current = null;
      setAdding(null);
      setDropGhost(null);
      setDragPointer(null);

      if (!start?.moved || !adding) return;

      // Un vrai glisser : le `click` qui suit doit être ignoré, qu'on ait posé
      // le meuble ou relâché hors de la salle.
      suppressClickRef.current = true;

      const position = dropPositionAt(event.clientX, event.clientY, adding);
      if (position) addObject(adding.kind, adding.seatCount, position);
    }

    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
    };
  });

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
  function applyPreset(preset: LayoutPresetId, seatTarget: number, options: PresetOptions) {
    const generated = generatePresetLayout(
      preset,
      { widthCm: layout.widthCm, heightCm: layout.heightCm },
      seatTarget,
      options,
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
    // On RESTE sur l'onglet des dispositions : le panneau se refermait autrefois
    // après avoir posé, alors qu'on essaie volontiers deux ou trois agencements
    // à la suite avant de garder le bon.
    setSelectedKey(null);
  }

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
          {/* L'effectif et les cotes ne sont plus ici : ils vivent dans la zone
              de la colonne de droite, à côté des champs qui les produisent. */}
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

      {/* TOUTES les commandes tiennent dans la colonne de droite : deux onglets
          en tête, la fiche du meuble qui les remplace quand on en clique un, et
          en bas les cotes de la salle. Elles étaient réparties sur quatre
          étages — bandeau de titre, rangée de dimensions, barre au-dessus du
          canevas, colonne — dont deux ne servaient qu'à quelques champs. */}
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_21rem]">
        <div>
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
                <g
                  key={object.key}
                  onPointerDown={(event) => handleObjectPointerDown(event, object)}
                  className={object.key === flashKey ? "drop-in" : undefined}
                >
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

              {/* Le meuble tiré depuis le bac, à l'endroit où il tomberait. On
                  le dessine POUR DE VRAI plutôt qu'en carte flottante : c'est
                  le seul moyen de juger de sa taille par rapport aux tables
                  déjà posées. `Furniture` est ici dans le même `<svg>` que
                  `RoomGrid`, donc les hachures du tableau tiennent. */}
              {adding && dropGhost && (
                <g opacity={0.5} style={{ pointerEvents: "none" }}>
                  <Furniture
                    object={{
                      id: "ghost",
                      kind: adding.kind,
                      ...dropGhost,
                      ...itemSizeCm(adding),
                      rotation: 0,
                      label: null,
                    }}
                  />
                </g>
              )}
            </svg>
          </div>
        </div>

        <aside className={`${CARD} flex flex-col p-4`}>
          {/* Deux onglets, et une seule règle : un meuble SÉLECTIONNÉ l'emporte
              sur l'onglet actif. Cliquer un onglet désélectionne donc, et
              cliquer le fond du canevas rend l'onglet qu'on avait laissé —
              `panelTab` n'ayant pas bougé entre-temps. */}
          <Track className="w-full">
            <Segment
              active={panelTab === "add"}
              onClick={() => showTab("add")}
              tone="primary"
              className="flex-1 justify-center"
            >
              <PlusIcon />
              Ajouter
            </Segment>
            <Segment
              active={panelTab === "presets"}
              onClick={() => showTab("presets")}
              tone="primary"
              className="flex-1 justify-center"
            >
              <LayoutIcon />
              Dispositions
            </Segment>
          </Track>

          <div className="mt-4">
            {selected ? (
              <SelectedPanel
                object={selected}
                onChange={updateSelected}
                onDelete={deleteSelected}
                roomWidthCm={layout.widthCm}
              />
            ) : panelTab === "add" ? (
              <AddPanel
                tables={TABLE_ITEMS}
                furniture={FURNITURE_ITEMS}
                onPointerDown={handleAddPointerDown}
                onClick={handleAddClick}
              />
            ) : (
              <LayoutPresetsPanel
                roomWidthCm={layout.widthCm}
                roomHeightCm={layout.heightCm}
                tableCount={tableCount}
                onApply={applyPreset}
              />
            )}
          </div>

          {/* La salle elle-même, en bas : ses deux cotes et ce qu'elles
              produisent. Un simple regroupement — filet et fond à peine
              teinté —, pas une carte : une carte dans une carte doublerait
              bordure et ombre. */}
          <div className="mt-auto rounded-card border border-border bg-surface-muted/40 p-3">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label htmlFor="room-w">Largeur</Label>
                <Input
                  id="room-w"
                  type="number"
                  step={GRID_CM}
                  min={ROOM_MIN_CM}
                  max={ROOM_MAX_CM}
                  value={layout.widthCm}
                  onChange={(event) =>
                    updateRoom({
                      widthCm: clamp(Number(event.target.value), ROOM_MIN_CM, ROOM_MAX_CM),
                    })
                  }
                />
              </div>
              <div>
                <Label htmlFor="room-h">Profondeur</Label>
                <Input
                  id="room-h"
                  type="number"
                  step={GRID_CM}
                  min={ROOM_MIN_CM}
                  max={ROOM_MAX_CM}
                  value={layout.heightCm}
                  onChange={(event) =>
                    updateRoom({
                      heightCm: clamp(Number(event.target.value), ROOM_MIN_CM, ROOM_MAX_CM),
                    })
                  }
                />
              </div>
            </div>

            <p className="eyebrow mt-3">
              {tableCount} table{tableCount > 1 ? "s" : ""} · {seatCount} place
              {seatCount > 1 ? "s" : ""}
            </p>
          </div>

          {/* Zone dangereuse, comme en pied de page d'une classe : rouge, dans
              un encadré rouge, tout en bas. Ces deux boutons emportent d'un
              coup un travail de plusieurs minutes — et, une fois enregistrés,
              les élèves déjà placés dans les plans qui utilisent cette salle.
              Le rouge est ici pleinement légitime. */}
          <div className="mt-3 rounded-card border border-danger-border bg-danger-soft p-3">
            {/* La boîte est déclarée ICI, dans un bloc ordinaire, et non parmi
                les enfants du conteneur en `space-y-4` : celui-ci poserait une
                marge sur le `<dialog>`, dont le positionnement en `inset: 0`
                est déjà sur-contraint. Même emplacement que dans la zone
                dangereuse d'une classe. */}
            <ConfirmDialog
              open={clearing !== null}
              onClose={() => setClearing(null)}
              onConfirm={() => clearObjects(clearing ?? "tables")}
              title={clearing === "all" ? "Vider la salle ?" : "Retirer toutes les tables ?"}
              description={
                clearing === "all"
                  ? "Tout le mobilier sera effacé, tableau et bureau compris, avec les places qu'il portait. Ctrl+Z annule tant que vous n'avez pas enregistré."
                  : `Les ${tableCount} tables et leurs places seront effacées — et avec elles les élèves déjà placés dans les plans qui utilisent cette salle. Le tableau, le bureau, la porte et les fenêtres restent. Ctrl+Z annule tant que vous n'avez pas enregistré.`
              }
              confirmLabel={clearing === "all" ? "Vider la salle" : "Retirer les tables"}
            />

            <h2 className="eyebrow text-danger">Zone dangereuse</h2>
            <div className="mt-2 grid gap-2">
              <Button
                variant="danger"
                size="sm"
                onClick={() => setClearing("tables")}
                disabled={tableCount === 0}
              >
                Retirer les tables
              </Button>
              <Button
                variant="danger"
                size="sm"
                onClick={() => setClearing("all")}
                disabled={layout.objects.length === 0}
              >
                Vider la salle
              </Button>
            </div>
          </div>

          <Hint>
            <kbd className="rounded-control border border-border bg-surface-muted px-1">Suppr</kbd>{" "}
            efface le meuble sélectionné,{" "}
            <kbd className="rounded-control border border-border bg-surface-muted px-1">Ctrl</kbd>+
            <kbd className="rounded-control border border-border bg-surface-muted px-1">Z</kbd>{" "}
            annule.
          </Hint>
        </aside>
      </div>

      {/* La carte qu'on TIENT, accrochée au curseur pendant tout le geste.
          Sans elle, un glisser commencé hors de la salle ne se voyait nulle
          part : le fantôme du meuble n'apparaît qu'une fois le curseur entré
          dans le plan, et l'on croyait le glisser cassé. Elle suit avec un
          décalage pour ne pas recouvrir ce fantôme quand les deux coexistent.

          `margin: 0` est explicite : le `space-y-4` du conteneur pousserait
          sinon l'élément de 16 px sous la position calculée, les marges
          s'ajoutant aux décalages d'un élément positionné. */}
      {adding && dragPointer && (
        <div
          aria-hidden="true"
          className="pointer-events-none fixed z-50 rounded-card border border-primary bg-surface px-2.5 py-2 text-xs font-medium text-foreground shadow-float"
          style={{ left: dragPointer.x + 14, top: dragPointer.y + 14, margin: 0 }}
        >
          {adding.label}
        </div>
      )}
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
          <Label htmlFor="obj-w">Largeur</Label>
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
          <Label htmlFor="obj-h">Profondeur</Label>
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
