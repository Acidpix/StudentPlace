"use client";

import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useMemo, useState, useTransition } from "react";

import { saveAssignments, updatePlanSettings } from "@/actions/plans";
import { ExportPdfPanel } from "@/components/plan/export-pdf-panel";
import {
  SeatSpot,
  StudentLabel,
  TRAY_DROPPABLE_ID,
  TrayStudent,
  TrayZone,
  parseDraggableId,
  parseSeatDroppableId,
} from "@/components/plan/plan-pieces";
import { Furniture, RoomGrid } from "@/components/room/furniture";
import { Button } from "@/components/ui/button";
import { DifficultyLegend } from "@/components/ui/difficulty-badge";
import { FieldError, Input, Label } from "@/components/ui/field";
import { ArrowLeftIcon, FlipIcon, SparkIcon, WarningIcon } from "@/components/ui/icons";
import { conflictingSeatIds, findProximityConflicts } from "@/lib/placement/conflicts";
import { runSolver } from "@/lib/placement/run-solver";
import type { Violation } from "@/lib/placement/types";
import {
  assignToSeat,
  keepOnlyPinned,
  pinnedMap,
  toAssignmentList,
  toSeatAssignments,
  togglePin,
  unassignStudent,
  unassignedStudents,
  type SeatAssignments,
  type SeatOccupant,
} from "@/lib/plan-state";
import {
  studentFullName,
  type AssignmentView,
  type RelationView,
  type RoomView,
  type StudentView,
} from "@/lib/view-models";

interface PlanMeta {
  id: string;
  name: string;
  mirrored: boolean;
  proximityCm: number;
  classGroupId: string;
  classGroupName: string;
}

export function PlanEditor({
  plan,
  room,
  students,
  relations,
  initialAssignments,
}: {
  plan: PlanMeta;
  room: RoomView;
  students: StudentView[];
  relations: RelationView[];
  initialAssignments: AssignmentView[];
}) {
  const router = useRouter();

  const [assignments, setAssignments] = useState<SeatAssignments>(() =>
    toSeatAssignments(initialAssignments),
  );
  const [mirrored, setMirrored] = useState(plan.mirrored);
  const [proximityCm, setProximityCm] = useState(plan.proximityCm);
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [draggingStudentId, setDraggingStudentId] = useState<string | null>(null);
  const [violations, setViolations] = useState<Violation[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [solving, setSolving] = useState(false);
  const [pending, startTransition] = useTransition();

  // Un léger seuil de déplacement évite qu'un simple clic sur une place ne
  // déclenche un glisser involontaire.
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const seats = useMemo(() => room.objects.flatMap((object) => object.seats), [room.objects]);
  const studentById = useMemo(
    () => new Map(students.map((s): [string, StudentView] => [s.id, s])),
    [students],
  );

  const incompatibles = useMemo(
    () =>
      relations
        .filter((relation) => relation.type === "INCOMPATIBLE")
        .map((relation) => ({ a: relation.studentAId, b: relation.studentBId })),
    [relations],
  );
  const affinities = useMemo(
    () =>
      relations
        .filter((relation) => relation.type === "AFFINITY")
        .map((relation) => ({ a: relation.studentAId, b: relation.studentBId })),
    [relations],
  );

  const conflicts = useMemo(
    () =>
      findProximityConflicts({
        seats,
        assignments: new Map(
          [...assignments].map(([seatId, occupant]): [string, string] => [seatId, occupant.studentId]),
        ),
        incompatibles,
        proximityCm,
      }),
    [seats, assignments, incompatibles, proximityCm],
  );
  const conflictedSeats = useMemo(() => conflictingSeatIds(conflicts), [conflicts]);

  const unplaced = useMemo(() => unassignedStudents(students, assignments), [students, assignments]);

  const teacherDesk = useMemo(() => {
    const desk = room.objects.find((object) => object.kind === "TEACHER_DESK");
    return desk ? { x: desk.x + desk.widthCm / 2, y: desk.y + desk.heightCm / 2 } : null;
  }, [room.objects]);

  const mutate = useCallback((next: SeatAssignments) => {
    setAssignments(next);
    setDirty(true);
  }, []);

  // ------------------------------------------------------- glisser-déposer

  function handleDragStart(event: DragStartEvent) {
    setDraggingStudentId(parseDraggableId(String(event.active.id)));
  }

  function handleDragEnd(event: DragEndEvent) {
    setDraggingStudentId(null);

    const studentId = parseDraggableId(String(event.active.id));
    if (!studentId || !event.over) return;

    const overId = String(event.over.id);

    if (overId === TRAY_DROPPABLE_ID) {
      mutate(unassignStudent(assignments, studentId));
      return;
    }

    const seatId = parseSeatDroppableId(overId);
    if (!seatId) return;

    const seat = seats.find((candidate) => candidate.id === seatId);
    if (!seat || seat.disabled) return;

    mutate(assignToSeat(assignments, studentId, seatId));
  }

  // ------------------------------------------------------------- actions

  async function handleAutoPlace(fresh: boolean) {
    setError(null);
    setSolving(true);

    // « Repartir de zéro » ne conserve que les places verrouillées :
    // le professeur les a fixées volontairement.
    const base = fresh ? keepOnlyPinned(assignments) : assignments;

    try {
      const result = await runSolver({
        seats: seats
          .filter((seat) => !seat.disabled)
          .map((seat) => ({ id: seat.id, x: seat.x, y: seat.y, isEndSeat: seat.isEndSeat })),
        students: students.map((student) => ({
          id: student.id,
          difficulty: student.difficulty,
          needsFront: student.needsFront,
          leftHanded: student.leftHanded,
        })),
        incompatibles,
        affinities,
        pinned: pinnedMap(base),
        teacherDesk,
        proximityCm,
        seed: Math.floor(Math.random() * 2_147_483_647),
      });

      const next: SeatAssignments = new Map(
        result.assignments.map((assignment): [string, SeatOccupant] => [
          assignment.seatId,
          { studentId: assignment.studentId, pinned: assignment.pinned },
        ]),
      );

      mutate(next);
      setViolations(result.violations);
    } catch (solverError) {
      setError(
        solverError instanceof Error ? solverError.message : "Le placement automatique a échoué.",
      );
    } finally {
      setSolving(false);
    }
  }

  function handleClear() {
    if (!window.confirm("Retirer tous les élèves du plan ? Les places verrouillées sont conservées.")) {
      return;
    }
    mutate(keepOnlyPinned(assignments));
    setViolations([]);
  }

  function handleSave() {
    setError(null);

    startTransition(async () => {
      const [assignmentsResult, settingsResult] = await Promise.all([
        saveAssignments({ planId: plan.id, assignments: toAssignmentList(assignments) }),
        updatePlanSettings(plan.id, { name: plan.name, mirrored, proximityCm }),
      ]);

      if (!assignmentsResult.ok) {
        setError(assignmentsResult.error);
        return;
      }
      if (!settingsResult.ok) {
        setError(settingsResult.error);
        return;
      }

      setDirty(false);
      router.refresh();
    });
  }

  // --------------------------------------------------------------- rendu

  // La vue miroir renverse l'axe horizontal en déplaçant les COORDONNÉES,
  // sans transformation CSS : les noms et les étiquettes restent lisibles.
  const flipX = (x: number, width = 0) => (mirrored ? room.widthCm - x - width : x);

  const draggedStudent = draggingStudentId ? studentById.get(draggingStudentId) : null;

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="space-y-4">
        <div className="print-hidden">
          <Link
            href={`/classes/${plan.classGroupId}`}
            className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-foreground"
          >
            <ArrowLeftIcon />
            {plan.classGroupName}
          </Link>
        </div>

        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{plan.name}</h1>
            <p className="mt-1 text-sm text-muted">
              {plan.classGroupName} · {room.name} · {assignments.size}/{students.length} élève
              {students.length > 1 ? "s" : ""} placé{assignments.size > 1 ? "s" : ""}
            </p>
          </div>

          <div className="print-hidden flex flex-wrap items-center gap-2">
            <Button variant="secondary" size="sm" onClick={() => setMirrored((value) => !value)}>
              <FlipIcon />
              {mirrored ? "Vue depuis le fond" : "Vue depuis le bureau"}
            </Button>
            <Button size="sm" onClick={() => handleAutoPlace(true)} disabled={solving}>
              <SparkIcon />
              {solving ? "Calcul…" : "Placer automatiquement"}
            </Button>
            <Button size="sm" variant="secondary" onClick={() => handleAutoPlace(false)} disabled={solving}>
              Améliorer
            </Button>
            <Button onClick={handleSave} disabled={pending || !dirty}>
              {pending ? "Enregistrement…" : dirty ? "Enregistrer" : "Enregistré"}
            </Button>
          </div>
        </div>

        <FieldError message={error} />

        {conflicts.length > 0 && (
          <div
            role="alert"
            className="rounded-xl border border-danger-border bg-danger-soft p-3 text-sm text-danger"
          >
            <p className="flex items-center gap-2 font-medium">
              <WarningIcon />
              {conflicts.length} incompatibilité{conflicts.length > 1 ? "s" : ""} non respectée
              {conflicts.length > 1 ? "s" : ""}
            </p>
            <ul className="mt-1.5 list-inside list-disc">
              {conflicts.map((conflict) => {
                const a = studentById.get(conflict.studentAId);
                const b = studentById.get(conflict.studentBId);
                return (
                  <li key={`${conflict.seatAId}-${conflict.seatBId}`}>
                    {a ? studentFullName(a) : "?"} et {b ? studentFullName(b) : "?"} sont à{" "}
                    {conflict.distanceCm} cm l&apos;un de l&apos;autre (seuil : {proximityCm} cm).
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        {violations.filter((v) => v.kind !== "INCOMPATIBLE_TOO_CLOSE").length > 0 && (
          <div className="rounded-xl border border-border bg-surface-muted p-3 text-sm">
            <p className="font-medium">Le placement automatique n&apos;a pas pu tout satisfaire :</p>
            <ul className="mt-1.5 list-inside list-disc text-muted">
              {violations
                .filter((violation) => violation.kind !== "INCOMPATIBLE_TOO_CLOSE")
                .map((violation, index) => (
                  <li key={`${violation.kind}-${index}`}>{violation.message}</li>
                ))}
            </ul>
          </div>
        )}

        <div className="grid gap-4 lg:grid-cols-[1fr_17rem]">
          {/* ----------------------------------------------------- plan */}
          <div className="rounded-xl border border-border bg-surface p-2">
            <div
              className="relative w-full"
              style={{ aspectRatio: `${room.widthCm} / ${room.heightCm}` }}
            >
              <svg
                viewBox={`0 0 ${room.widthCm} ${room.heightCm}`}
                preserveAspectRatio="none"
                className="absolute inset-0 h-full w-full"
                aria-hidden="true"
              >
                <RoomGrid widthCm={room.widthCm} heightCm={room.heightCm} />

                {room.objects.map((object) => (
                  <Furniture
                    key={object.id}
                    object={{
                      ...object,
                      x: flipX(object.x, object.widthCm),
                      rotation: mirrored ? (360 - object.rotation) % 360 : object.rotation,
                    }}
                  />
                ))}

                {/* Trait rouge entre deux élèves incompatibles trop proches. */}
                {conflicts.map((conflict) => {
                  const a = seats.find((seat) => seat.id === conflict.seatAId);
                  const b = seats.find((seat) => seat.id === conflict.seatBId);
                  if (!a || !b) return null;
                  return (
                    <line
                      key={`link-${conflict.seatAId}-${conflict.seatBId}`}
                      x1={flipX(a.x)}
                      y1={a.y}
                      x2={flipX(b.x)}
                      y2={b.y}
                      stroke="var(--danger)"
                      strokeWidth={5}
                      strokeDasharray="14 8"
                    />
                  );
                })}
              </svg>

              {seats.map((seat) => {
                const occupant = assignments.get(seat.id);
                const student = occupant ? (studentById.get(occupant.studentId) ?? null) : null;

                return (
                  <SeatSpot
                    key={seat.id}
                    seat={seat}
                    student={student}
                    pinned={occupant?.pinned ?? false}
                    conflicted={conflictedSeats.has(seat.id)}
                    selected={selectedStudentId === student?.id}
                    leftPercent={(flipX(seat.x) / room.widthCm) * 100}
                    topPercent={(seat.y / room.heightCm) * 100}
                    onTogglePin={() => mutate(togglePin(assignments, seat.id))}
                    onSelect={() => setSelectedStudentId(student?.id ?? null)}
                  />
                );
              })}

              {seats.length === 0 && (
                <p className="absolute inset-0 flex items-center justify-center p-6 text-center text-sm text-muted">
                  Cette salle ne contient aucune place.{" "}
                  <Link href={`/salles/${room.id}`} className="ml-1 text-primary hover:underline">
                    Ajoutez-y des tables.
                  </Link>
                </p>
              )}
            </div>

            <div className="print-hidden mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3">
              <DifficultyLegend />
              <p className="text-xs text-muted">
                {mirrored
                  ? "Salle vue depuis le fond, comme les élèves la voient."
                  : "Salle vue depuis le bureau : la gauche de l'écran est votre gauche."}
              </p>
            </div>
          </div>

          {/* ------------------------------------------------- panneau */}
          <aside className="print-hidden space-y-4">
            <TrayZone count={unplaced.length}>
              {unplaced.map((student) => (
                <TrayStudent key={student.id} student={student} />
              ))}
            </TrayZone>

            <div className="rounded-xl border border-border bg-surface p-3">
              <Label htmlFor="proximity">Seuil de proximité (cm)</Label>
              <Input
                id="proximity"
                type="number"
                min={0}
                max={1000}
                step={10}
                value={proximityCm}
                onChange={(event) => {
                  setProximityCm(Math.max(0, Number(event.target.value)));
                  setDirty(true);
                }}
              />
              <p className="mt-1.5 text-xs text-muted">
                En dessous de cette distance, deux élèves incompatibles déclenchent une alerte.
              </p>
            </div>

            <ExportPdfPanel planId={plan.id} mirrored={mirrored} />

            <Button variant="secondary" size="sm" className="w-full" onClick={handleClear}>
              Vider le plan
            </Button>
          </aside>
        </div>
      </div>

      {/* L'aperçu qui suit le pointeur pendant le déplacement. */}
      <DragOverlay dropAnimation={null}>
        {draggedStudent && (
          <div className="flex h-11 w-24 items-center rounded-lg border-2 border-primary bg-surface px-1.5 text-[11px] shadow-lg">
            <StudentLabel student={draggedStudent} />
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}
