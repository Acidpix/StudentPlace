"use client";

import { useDraggable, useDroppable } from "@dnd-kit/core";

import { DifficultyBadge } from "@/components/ui/difficulty-badge";
import { cn } from "@/lib/cn";
import { SEAT_CARD_HEIGHT_CM, SEAT_CARD_WIDTH_CM } from "@/lib/domain";
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

type Density = "full" | "compact" | "dot";

export interface SeatMetrics {
  width: number;
  height: number;
  font: number;
  badge: number;
  density: Density;
  radius: number;
}

/**
 * Traduit l'échelle du plan en dimensions d'étiquette.
 *
 * Sous 44 px de large, plus aucun texte n'est lisible : on n'affiche alors que
 * la pastille de difficulté, qui reste porteuse de sens et tient dans la place.
 * Le nom complet demeure accessible par l'infobulle et par le panneau latéral.
 */
export function seatMetrics(pxPerCm: number): SeatMetrics {
  const width = SEAT_CARD_WIDTH_CM * pxPerCm;
  const height = SEAT_CARD_HEIGHT_CM * pxPerCm;

  const density: Density = width >= 74 ? "full" : width >= 44 ? "compact" : "dot";

  return {
    width,
    height,
    font: Math.max(6, Math.min(13, height * 0.34)),
    badge: Math.max(9, Math.min(20, height * 0.46)),
    density,
    radius: Math.max(4, Math.min(10, height * 0.2)),
  };
}

/** Initiales de repli lorsque l'étiquette est trop étroite pour un prénom. */
function studentInitials(student: StudentView): string {
  return `${student.firstName.charAt(0)}${student.lastName.charAt(0)}`.toUpperCase();
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
      className={cn(
        "flex w-full cursor-grab items-center justify-between gap-2 rounded-control border border-border bg-surface px-2 py-1.5 text-left text-sm",
        "transition-colors hover:border-primary hover:bg-primary-soft/40 active:cursor-grabbing",
        isDragging && "opacity-40",
      )}
    >
      <StudentLabel student={student} full />
      <span className="flex shrink-0 gap-1 text-[10px] text-muted">
        {student.needsFront && <span title="Doit être au premier rang">1er</span>}
        {student.leftHanded && <span title="Gaucher">G</span>}
      </span>
    </button>
  );
}

export function TrayZone({ children, count }: { children: React.ReactNode; count: number }) {
  const { setNodeRef, isOver } = useDroppable({ id: TRAY_DROPPABLE_ID });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "rounded-card border p-3 shadow-soft transition-colors",
        isOver ? "border-primary bg-primary-soft" : "border-border bg-surface",
      )}
    >
      <h2 className="mb-2 text-sm font-medium">
        Élèves à placer <span className="text-muted">({count})</span>
      </h2>
      {count === 0 ? (
        <p className="py-3 text-center text-sm text-muted">
          Tous les élèves sont placés. Déposez ici pour retirer quelqu&apos;un du plan de classe.
        </p>
      ) : (
        <div className="max-h-[45vh] space-y-1.5 overflow-y-auto pr-1">{children}</div>
      )}
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
          {metrics.density === "dot" ? "" : seat.disabled ? "Condamnée" : "Libre"}
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

  const title = [
    studentFullName(student),
    pinned ? "place verrouillée" : null,
    student.comment || null,
  ]
    .filter(Boolean)
    .join(" — ");

  /**
   * Le verrouillage se lit à l'ENCADREMENT, pas à une pastille.
   *
   * Un cadenas en coin d'étiquette débordait à moitié et devenait illisible dès
   * que la salle était grande — l'échelle des étiquettes suit celle du plan.
   * Un contour rouge épais reste visible à toutes les tailles. Il se bascule
   * depuis la fiche du panneau latéral, ou en bloc depuis la barre d'outils.
   *
   * Le rouge sert aussi aux incompatibilités : les deux se distinguent au
   * TRAIT. Un conflit est POINTILLÉ sur fond teinté — comme le trait qui relie
   * les deux élèves — là où un verrouillage est un cadre PLEIN et épais sur
   * fond normal.
   */
  const outline = conflicted
    ? "border-dashed border-danger bg-danger-soft"
    : pinned
      ? "border-solid border-danger bg-surface"
      : selected
        ? "border-solid border-primary bg-primary-soft"
        : highlighted
          ? "border-solid border-primary bg-surface"
          : "border-solid border-border bg-surface";

  return (
    <div
      style={{ borderRadius: metrics.radius, borderWidth: pinned ? 3 : 2 }}
      className={cn(
        "relative flex h-full w-full items-center overflow-hidden shadow-soft transition-colors",
        outline,
        selected && pinned && "ring-2 ring-primary/40",
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
        style={{ fontSize: metrics.font, paddingInline: metrics.density === "dot" ? 0 : 3 }}
        className={cn(
          "flex h-full w-full cursor-grab items-center gap-1 overflow-hidden text-left leading-tight active:cursor-grabbing",
          metrics.density === "dot" && "justify-center",
        )}
      >
        <DifficultyBadge difficulty={student.difficulty} size={metrics.badge} />
        {metrics.density !== "dot" && (
          <span className="truncate">
            {metrics.density === "full" ? studentShortName(student) : studentInitials(student)}
          </span>
        )}
        <span className="sr-only">
          {studentFullName(student)}
          {pinned ? " — place verrouillée" : ""}
        </span>
      </button>
    </div>
  );
}
