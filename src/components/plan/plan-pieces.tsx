"use client";

import { useDraggable, useDroppable } from "@dnd-kit/core";

import { DifficultyBadge } from "@/components/ui/difficulty-badge";
import { cn } from "@/lib/cn";
import { DIFFICULTY_COLORS } from "@/lib/domain";
import { studentFullName, studentShortName, type SeatView, type StudentView } from "@/lib/view-models";

/**
 * Briques de l'éditeur de placement.
 *
 * Les places sont des éléments HTML positionnés en pourcentage au-dessus du
 * plan SVG, et non des formes SVG : dnd-kit mesure des rectangles du DOM, et
 * une div se stylise bien plus librement qu'un <circle>.
 *
 * Leur TAILLE, elle, est exprimée en centimètres de salle convertis en pixels
 * (`pxPerCm`, mesuré par usePlanScale). C'est ce qui garantit qu'une étiquette
 * n'en recouvre jamais une autre : son emprise est plus petite que l'écartement
 * réel de deux places. La contrepartie est qu'une grande salle affichée en
 * petit donne de petites étiquettes — d'où les trois densités ci-dessous et le
 * zoom de l'éditeur.
 */

export const TRAY_DROPPABLE_ID = "tray";
export const seatDroppableId = (seatId: string) => `seat:${seatId}`;
export const studentDraggableId = (studentId: string) => `student:${studentId}`;

export function parseDraggableId(id: string): string | null {
  return id.startsWith("student:") ? id.slice("student:".length) : null;
}

export function parseSeatDroppableId(id: string): string | null {
  return id.startsWith("seat:") ? id.slice("seat:".length) : null;
}

// ------------------------------------------------------------------ échelle

export interface SeatMetrics {
  width: number;
  height: number;
  /** Taille du prénom, ligne principale. */
  font: number;
  /** Taille du nom de famille, ligne secondaire. */
  fontSmall: number;
  /** Épaisseur du cerclage intérieur qui porte la difficulté. */
  ring: number;
  radius: number;
  /** Assez haute pour deux lignes : prénom au-dessus, nom en dessous. */
  twoLines: boolean;
  /** Trop étroite pour le moindre mot : « Libre » et consorts sont masqués. */
  tiny: boolean;
}

/**
 * Traduit l'emprise disponible en dimensions d'étiquette.
 *
 * L'étiquette est sur DEUX LIGNES — prénom, puis nom de famille — et non plus
 * sur une seule : c'est ce qui rend les deux lisibles. Sur une ligne unique, la
 * pastille de difficulté et l'espace séparateur mangeaient un tiers de la
 * largeur, et il ne restait la place que pour « Prénom N. ». Empilées, les deux
 * lignes disposent chacune de presque toute la largeur.
 *
 * La difficulté ne se lit plus à une pastille posée dans l'étiquette mais à un
 * CERCLAGE INTÉRIEUR de la carte : le nom récupère toute la largeur et se
 * centre, et la couleur reste visible même sur une étiquette minuscule où la
 * pastille devenait un point indéchiffrable.
 */
export function seatMetrics(footprint: { widthCm: number; heightCm: number }, pxPerCm: number): SeatMetrics {
  const width = footprint.widthCm * pxPerCm;
  const height = footprint.heightCm * pxPerCm;

  // Deux lignes de texte plus le rembourrage demandent une trentaine de
  // pixels ; en dessous, mieux vaut une seule ligne bien lisible que deux
  // illisibles.
  const twoLines = height >= 30 && width >= 46;
  const font = twoLines
    ? Math.max(7, Math.min(13, height * 0.3))
    : Math.max(6, Math.min(13, height * 0.42));

  return {
    width,
    height,
    font,
    fontSmall: Math.max(6, font * 0.85),
    // Un filet, pas un cadre : le cerclage de difficulté doit se lire sans
    // manger la place du nom.
    ring: Math.max(1, Math.min(2, height * 0.03)),
    radius: Math.max(4, Math.min(10, height * 0.18)),
    twoLines,
    tiny: width < 44,
  };
}

/** Initiales de repli lorsque l'étiquette est trop étroite pour un prénom. */
function studentInitials(student: StudentView): string {
  return `${student.firstName.charAt(0)}${student.lastName.charAt(0)}`.toUpperCase();
}

/**
 * Largeur moyenne d'un caractère, en fraction de la taille de police.
 *
 * Approximation assumée : mesurer chaque nom au `canvas` donnerait la valeur
 * exacte mais coûterait une mesure par élève à chaque redimensionnement. 0,55
 * majore légèrement une sans-serif en casse mixte, donc l'étiquette choisie est
 * au pire un cran trop courte — jamais tronquée.
 */
const AVG_CHAR_RATIO = 0.55;

export interface SeatLabel {
  /** Ligne principale : prénom, ou repli plus court. */
  primary: string | null;
  /** Ligne secondaire : nom de famille. Absente sur une étiquette basse. */
  secondary: string | null;
}

/**
 * Choisit ce qu'affiche l'étiquette, selon la place dont elle dispose.
 *
 * Par ordre de préférence : prénom sur une ligne et nom sur la suivante, puis
 * le prénom seul, puis les initiales, puis rien — le cerclage de difficulté
 * reste alors la seule information, et le nom complet demeure dans l'infobulle
 * et dans le panneau latéral. Le calcul est fait PAR ÉLÈVE : « Léa Roy » tient
 * là où « Maximilien Descheveaux » ne tient pas.
 *
 * Les deux lignes disposent maintenant de TOUTE la largeur : la pastille de
 * difficulté ne mange plus la première.
 */
export function fitStudentLabel(student: StudentView, metrics: SeatMetrics): SeatLabel {
  // Rembourrage (2 × 3 px), bordures (2 × 2 px) et cerclage intérieur.
  const inner = metrics.width - 10 - metrics.ring * 2;
  const fits = (text: string, size: number, room: number) =>
    text.length * size * AVG_CHAR_RATIO <= room;

  if (metrics.twoLines && fits(student.firstName, metrics.font, inner)) {
    return {
      primary: student.firstName,
      secondary: fits(student.lastName, metrics.fontSmall, inner) ? student.lastName : null,
    };
  }

  const primary =
    [student.firstName, studentInitials(student)].find((text) =>
      fits(text, metrics.font, inner),
    ) ?? null;

  return { primary, secondary: null };
}

// ------------------------------------------------------------------ étiquette

export function StudentLabel({
  student,
  full = false,
}: {
  student: StudentView;
  full?: boolean;
}) {
  return (
    <span className="flex min-w-0 items-center gap-1.5">
      <DifficultyBadge difficulty={student.difficulty} size="sm" />
      <span className="truncate">
        {full ? `${student.lastName} ${student.firstName}` : studentShortName(student)}
      </span>
    </span>
  );
}

// ------------------------------------------------------------------- bac

/**
 * Une ligne du bac, volontairement DENSE : la colonne est étroite et l'on veut
 * voir une classe entière sans la faire défiler. D'où une seule ligne de texte,
 * le nom de famille d'abord — c'est par lui qu'on cherche quelqu'un — et les
 * besoins particuliers réduits à deux lettres.
 */
export function TrayStudent({ student }: { student: StudentView }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: studentDraggableId(student.id),
  });

  return (
    <button
      ref={setNodeRef}
      type="button"
      {...listeners}
      {...attributes}
      title={`${student.lastName} ${student.firstName}${student.comment ? ` — ${student.comment}` : ""}`}
      className={cn(
        "flex w-full cursor-grab items-center gap-1.5 rounded-control border border-border bg-surface px-1.5 py-1 text-left text-xs",
        "transition-colors hover:border-primary hover:bg-primary-soft/40 active:cursor-grabbing",
        isDragging && "opacity-40",
      )}
    >
      <DifficultyBadge difficulty={student.difficulty} size="sm" />
      <span className="min-w-0 flex-1 truncate">
        <span className="font-medium">{student.lastName}</span> {student.firstName}
      </span>
      {(student.needsFront || student.leftHanded) && (
        <span className="shrink-0 text-[9px] text-muted">
          {student.needsFront && <span title="Doit être au premier rang">1er</span>}
          {student.needsFront && student.leftHanded && " "}
          {student.leftHanded && <span title="Gaucher">G</span>}
        </span>
      )}
    </button>
  );
}

/**
 * Colonne « À placer » — la colonne de GAUCHE de l'éditeur, d'après la maquette.
 *
 * Elle ne se replie plus quand tout le monde est placé : elle porte aussi la
 * légende de difficulté, calée en bas, donc elle a toujours quelque chose à
 * montrer. Une fois la classe placée, elle affiche simplement « Tout le monde
 * est placé » et reste la ZONE DE DÉPOSE qui sort un élève du plan — c'est la
 * colonne entière qui est droppable, pas seulement la liste, pour qu'on puisse
 * viser large en glissant.
 *
 * `footer` reçoit la légende plutôt que de l'inclure d'office : la colonne ne
 * connaît ainsi rien du vocabulaire de difficulté.
 */
export function TrayColumn({
  children,
  count,
  footer,
}: {
  children: React.ReactNode;
  count: number;
  footer?: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: TRAY_DROPPABLE_ID });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        // `flex-1` et non `h-full` : le parent est un conteneur flex en
        // colonne, tantôt étiré par la grille (grand écran), tantôt plafonné
        // par une hauteur maximale (petit écran). Une hauteur en POURCENTAGE
        // ne se résoudrait dans aucun des deux cas — le parent n'a jamais de
        // hauteur explicite — et la liste déborderait au lieu de défiler.
        "flex min-h-0 flex-1 flex-col transition-colors",
        isOver ? "bg-primary-soft" : "bg-surface",
      )}
    >
      <div className="px-3 pb-2 pt-3">
        <h2 className="text-sm font-bold leading-none">À placer</h2>
        <p className="mt-1.5 text-xs leading-snug text-muted">
          {count === 0 ? (
            "Tout le monde est placé. Déposez ici pour retirer."
          ) : (
            <>
              <span className="tabular-nums">{count}</span> élève{count > 1 ? "s" : ""} · glissez
              sur une place
            </>
          )}
        </p>
      </div>

      {/* `min-h-0` autorise ce bloc à se comprimer dans la colonne en flex :
          sans lui, un contenu long pousserait la légende hors de la carte au
          lieu de faire défiler la liste. */}
      <div className="min-h-0 flex-1 space-y-1 overflow-y-auto px-2 pb-2">{children}</div>

      {footer && <div className="mt-auto border-t border-border px-3 py-3">{footer}</div>}
    </div>
  );
}

// ----------------------------------------------------------------- place

export function SeatSpot({
  seat,
  student,
  pinned,
  conflicted,
  selected,
  leftPercent,
  topPercent,
  metrics,
  onSelect,
}: {
  seat: SeatView;
  student: StudentView | null;
  pinned: boolean;
  conflicted: boolean;
  selected: boolean;
  leftPercent: number;
  topPercent: number;
  metrics: SeatMetrics;
  onSelect: () => void;
}) {
  const { setNodeRef: setDropRef, isOver } = useDroppable({ id: seatDroppableId(seat.id) });

  return (
    <div
      ref={setDropRef}
      style={{
        left: `${leftPercent}%`,
        top: `${topPercent}%`,
        width: metrics.width,
        height: metrics.height,
      }}
      className="absolute -translate-x-1/2 -translate-y-1/2"
    >
      {student ? (
        <SeatedStudent
          student={student}
          pinned={pinned}
          conflicted={conflicted}
          selected={selected}
          highlighted={isOver}
          metrics={metrics}
          onSelect={onSelect}
        />
      ) : (
        <div
          style={{ borderRadius: metrics.radius, fontSize: metrics.font }}
          className={cn(
            "flex h-full w-full items-center justify-center overflow-hidden border-2 border-dashed",
            seat.disabled
              ? "border-border text-muted opacity-50"
              : isOver
                ? "border-primary bg-primary-soft text-primary"
                : "border-border text-muted",
          )}
          title={seat.disabled ? "Place condamnée" : "Place libre"}
        >
          {metrics.tiny ? "" : seat.disabled ? "Condamnée" : "Libre"}
        </div>
      )}
    </div>
  );
}

function SeatedStudent({
  student,
  pinned,
  conflicted,
  selected,
  highlighted,
  metrics,
  onSelect,
}: {
  student: StudentView;
  pinned: boolean;
  conflicted: boolean;
  selected: boolean;
  highlighted: boolean;
  metrics: SeatMetrics;
  onSelect: () => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: studentDraggableId(student.id),
  });

  // La difficulté n'est plus chiffrée sur l'étiquette : elle doit donc être
  // dite ailleurs. La couleur du cerclage ne porte jamais l'information seule.
  const title = [
    studentFullName(student),
    `difficulté ${student.difficulty}/5`,
    pinned ? "place verrouillée" : null,
    student.comment || null,
  ]
    .filter(Boolean)
    .join(" — ");

  const { primary, secondary } = fitStudentLabel(student, metrics);

  /**
   * Le verrouillage se lit à un CERCLAGE ROUGE PERMANENT.
   *
   * Un cadenas en coin d'étiquette débordait à moitié et devenait illisible dès
   * que la salle était grande — l'échelle des étiquettes suit celle du plan.
   *
   * Le cerclage est posé en `outline` et non en `border` : la bordure porte
   * déjà l'état courant — sélection, survol de dépose, conflit — et le rouge
   * disparaîtrait dès qu'on toucherait l'élève. L'`outline` se dessine en
   * dehors du cadre et ne dépend d'aucun de ces états, donc il ne s'éteint
   * jamais. `overflow-hidden` ne le rogne pas : le débordement ne s'applique
   * qu'aux descendants.
   *
   * Le rouge sert aussi aux incompatibilités : les deux se distinguent au
   * TRAIT. Un conflit est POINTILLÉ sur fond teinté — comme la ligne qui relie
   * les deux élèves — là où un verrouillage est un cercle PLEIN.
   */
  const pinRing = Math.max(2, Math.min(3, metrics.height * 0.09));

  return (
    <div
      style={{
        borderRadius: metrics.radius,
        outline: pinned ? `${pinRing}px solid var(--danger)` : undefined,
        outlineOffset: pinned ? 1 : undefined,
        // Le cerclage de difficulté est posé en ombre INTÉRIEURE : il se
        // dessine à l'intérieur du cadre, donc il ne se dispute ni la bordure
        // (sélection, survol, conflit) ni l'`outline` (verrouillage), et les
        // trois restent lisibles ensemble.
        boxShadow: `inset 0 0 0 ${metrics.ring}px ${DIFFICULTY_COLORS[student.difficulty]}, var(--elev-1)`,
      }}
      className={cn(
        "material relative flex h-full w-full items-center overflow-hidden border-2 transition-colors",
        conflicted
          ? "border-dashed border-danger bg-danger-soft"
          : selected
            ? "border-solid border-primary bg-primary-soft"
            : highlighted
              ? "border-solid border-primary bg-surface"
              : "border-solid border-border bg-surface",
        isDragging && "opacity-40",
      )}
    >
      <button
        ref={setNodeRef}
        type="button"
        {...listeners}
        {...attributes}
        onClick={onSelect}
        title={title}
        style={{ paddingInline: metrics.ring + 3 }}
        className="flex h-full w-full cursor-grab flex-col items-center justify-center overflow-hidden text-center leading-tight active:cursor-grabbing"
      >
        {/* Ligne 1 : prénom, sur toute la largeur. */}
        {primary && (
          <span className="w-full truncate font-medium" style={{ fontSize: metrics.font }}>
            {primary}
          </span>
        )}

        {/* Ligne 2 : nom de famille. */}
        {secondary && (
          <span
            className="w-full truncate uppercase tracking-wide text-muted"
            style={{ fontSize: metrics.fontSmall }}
          >
            {secondary}
          </span>
        )}

        <span className="sr-only">
          {studentFullName(student)} — difficulté {student.difficulty} sur 5
          {pinned ? " — place verrouillée" : ""}
        </span>
      </button>
    </div>
  );
}
