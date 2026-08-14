"use client";

import { useDraggable, useDroppable } from "@dnd-kit/core";

import { DifficultyBadge } from "@/components/ui/difficulty-badge";
import { LockIcon, UnlockIcon } from "@/components/ui/icons";
import { cn } from "@/lib/cn";
import { studentShortName, type SeatView, type StudentView } from "@/lib/view-models";

/**
 * Briques de l'éditeur de placement.
 *
 * Les places sont des éléments HTML positionnés en pourcentage au-dessus du
 * plan SVG, et non des formes SVG : dnd-kit mesure des rectangles du DOM, et
 * une div se stylise bien plus librement qu'un <circle>.
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
        "flex w-full cursor-grab items-center justify-between gap-2 rounded-lg border border-border bg-surface px-2 py-1.5 text-left text-sm",
        "hover:border-primary active:cursor-grabbing",
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
        "rounded-xl border p-3 transition-colors",
        isOver ? "border-primary bg-primary-soft" : "border-border bg-surface",
      )}
    >
      <h2 className="mb-2 text-sm font-medium">
        Élèves à placer <span className="text-muted">({count})</span>
      </h2>
      {count === 0 ? (
        <p className="py-3 text-center text-sm text-muted">
          Tous les élèves sont placés. Déposez ici pour retirer quelqu&apos;un du plan.
        </p>
      ) : (
        <div className="max-h-[55vh] space-y-1.5 overflow-y-auto pr-1">{children}</div>
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
  onTogglePin,
  onSelect,
}: {
  seat: SeatView;
  student: StudentView | null;
  pinned: boolean;
  conflicted: boolean;
  selected: boolean;
  leftPercent: number;
  topPercent: number;
  onTogglePin: () => void;
  onSelect: () => void;
}) {
  const { setNodeRef: setDropRef, isOver } = useDroppable({ id: seatDroppableId(seat.id) });

  return (
    <div
      ref={setDropRef}
      style={{ left: `${leftPercent}%`, top: `${topPercent}%` }}
      className="absolute -translate-x-1/2 -translate-y-1/2"
    >
      {student ? (
        <SeatedStudent
          student={student}
          pinned={pinned}
          conflicted={conflicted}
          selected={selected}
          highlighted={isOver}
          onTogglePin={onTogglePin}
          onSelect={onSelect}
        />
      ) : (
        <div
          className={cn(
            "flex h-11 w-24 items-center justify-center rounded-lg border-2 border-dashed text-[11px]",
            seat.disabled
              ? "border-border text-muted opacity-50"
              : isOver
                ? "border-primary bg-primary-soft text-primary"
                : "border-border text-muted",
          )}
        >
          {seat.disabled ? "Condamnée" : "Libre"}
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
  onTogglePin,
  onSelect,
}: {
  student: StudentView;
  pinned: boolean;
  conflicted: boolean;
  selected: boolean;
  highlighted: boolean;
  onTogglePin: () => void;
  onSelect: () => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: studentDraggableId(student.id),
  });

  return (
    <div
      className={cn(
        "relative flex h-11 w-24 flex-col justify-center rounded-lg border-2 px-1.5 shadow-sm",
        conflicted
          ? "border-danger bg-danger-soft"
          : selected
            ? "border-primary bg-primary-soft"
            : highlighted
              ? "border-primary bg-surface"
              : "border-border bg-surface",
        isDragging && "opacity-40",
      )}
    >
      <button
        ref={setNodeRef}
        type="button"
        {...listeners}
        {...attributes}
        onClick={onSelect}
        title={`${student.lastName} ${student.firstName}${student.comment ? ` — ${student.comment}` : ""}`}
        className="flex cursor-grab items-center gap-1 text-left text-[11px] leading-tight active:cursor-grabbing"
      >
        <StudentLabel student={student} />
      </button>

      <button
        type="button"
        onClick={onTogglePin}
        aria-label={pinned ? "Déverrouiller cette place" : "Verrouiller cette place"}
        title={
          pinned
            ? "Place verrouillée : le placement automatique ne la modifiera pas"
            : "Verrouiller cette place"
        }
        className={cn(
          "absolute -right-1.5 -top-1.5 rounded-full border border-border bg-surface p-0.5",
          pinned ? "text-primary" : "text-muted opacity-0 hover:opacity-100 focus:opacity-100",
        )}
      >
        {pinned ? <LockIcon width={11} height={11} /> : <UnlockIcon width={11} height={11} />}
      </button>
    </div>
  );
}
