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
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";

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
  seatMetrics,
} from "@/components/plan/plan-pieces";
import { Furniture, RoomGrid } from "@/components/room/furniture";
import { Button } from "@/components/ui/button";
import { DifficultyBadge, DifficultyLegend } from "@/components/ui/difficulty-badge";
import { FieldError, Input, Label } from "@/components/ui/field";
import {
  ArrowLeftIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  DeskViewIcon,
  FitIcon,
  LockIcon,
  ShuffleIcon,
  SparkIcon,
  UnlockIcon,
  WarningIcon,
  ZoomInIcon,
  ZoomOutIcon,
} from "@/components/ui/icons";
import { conflictingSeatIds, findProximityConflicts } from "@/lib/placement/conflicts";
import { runSolver } from "@/lib/placement/run-solver";
import { seedFromId } from "@/lib/placement/seed";
import type { Violation } from "@/lib/placement/types";
import {
  assignToSeat,
  keepOnlyPinned,
  movedCount,
  pinnedMap,
  placementMap,
  seatOfStudent,
  setAllPinned,
  toAssignmentList,
  toSeatAssignments,
  togglePin,
  unassignStudent,
  unassignedStudents,
  type SeatAssignments,
  type SeatOccupant,
} from "@/lib/plan-state";
import {
  PLAN_MAX_HEIGHT_SHARE,
  PLAN_MIN_HEIGHT,
  defaultPlanHeight,
  usePlanScale,
} from "@/lib/use-plan-scale";
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

/** Poids d'inertie d'« Améliorer » : retoucher, et non tout rebrasser. */
const IMPROVE_STABILITY = 250;

const PANEL_STORAGE_KEY = "studentplace:plan-panel";
const HEIGHT_STORAGE_KEY = "studentplace:plan-height";
const ZOOM_MIN = 60;
const ZOOM_MAX = 250;
const ZOOM_STEP = 10;

type PlaceMode = "fresh" | "variant" | "improve";

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
  const [name, setName] = useState(plan.name);
  const [mirrored, setMirrored] = useState(plan.mirrored);
  const [proximityCm, setProximityCm] = useState(plan.proximityCm);
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [draggingStudentId, setDraggingStudentId] = useState<string | null>(null);
  const [violations, setViolations] = useState<Violation[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [solving, setSolving] = useState(false);
  const [variant, setVariant] = useState(0);
  const [lastRun, setLastRun] = useState<{
    cost: number;
    durationMs: number;
    moved: number | null;
  } | null>(null);
  const [zoom, setZoom] = useState(100);
  const [panelOpen, setPanelOpen] = useState(true);
  // 0 = pas encore connue ; la hauteur par défaut dépend de l'écran, qui
  // n'existe pas au rendu serveur.
  const [planHeight, setPlanHeight] = useState(0);
  // Doublon en ref : les écouteurs de glisser sont posés une seule fois et
  // liraient sinon la valeur figée de leur fermeture.
  const planHeightRef = useRef(0);
  const [pending, startTransition] = useTransition();

  // Lu après montage : le rendu serveur ne connaît pas localStorage, l'écrire
  // dans l'état initial provoquerait une erreur d'hydratation.
  useEffect(() => {
    setPanelOpen(window.localStorage.getItem(PANEL_STORAGE_KEY) !== "0");

    const stored = Number(window.localStorage.getItem(HEIGHT_STORAGE_KEY));
    const height =
      Number.isFinite(stored) && stored >= PLAN_MIN_HEIGHT ? stored : defaultPlanHeight();
    planHeightRef.current = height;
    setPlanHeight(height);
  }, []);

  const togglePanel = useCallback(() => {
    setPanelOpen((open) => {
      window.localStorage.setItem(PANEL_STORAGE_KEY, open ? "0" : "1");
      return !open;
    });
  }, []);

  /**
   * Poignée de redimensionnement de la fenêtre de plan.
   *
   * On écoute sur `window` plutôt que sur la poignée : le pointeur sort
   * inévitablement de ces quelques pixels pendant le glisser, et l'on perdrait
   * le suivi. La hauteur retenue est mémorisée d'un plan de classe à l'autre.
   */
  const handleResizeStart = useCallback((event: React.PointerEvent) => {
    event.preventDefault();

    const startY = event.clientY;
    const startHeight = planHeightRef.current;
    const maxHeight = window.innerHeight * PLAN_MAX_HEIGHT_SHARE;

    const onMove = (moveEvent: PointerEvent) => {
      const next = Math.round(
        Math.min(maxHeight, Math.max(PLAN_MIN_HEIGHT, startHeight + moveEvent.clientY - startY)),
      );
      planHeightRef.current = next;
      setPlanHeight(next);
    };

    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.localStorage.setItem(HEIGHT_STORAGE_KEY, String(planHeightRef.current));
      document.body.classList.remove("no-select");
    };

    document.body.classList.add("no-select");
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }, []);

  const resetView = useCallback(() => {
    setZoom(100);
    const height = defaultPlanHeight();
    planHeightRef.current = height;
    setPlanHeight(height);
    window.localStorage.removeItem(HEIGHT_STORAGE_KEY);
  }, []);

  // Un léger seuil de déplacement évite qu'un simple clic sur une place ne
  // déclenche un glisser involontaire.
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const seats = useMemo(() => room.objects.flatMap((object) => object.seats), [room.objects]);
  const studentById = useMemo(
    () => new Map(students.map((s): [string, StudentView] => [s.id, s])),
    [students],
  );

  const {
    ref: planRef,
    widthPx,
    pxPerCm,
  } = usePlanScale(room.widthCm, room.heightCm, zoom, planHeight);
  const metrics = useMemo(() => seatMetrics(pxPerCm), [pxPerCm]);

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
  const pinnedCount = useMemo(
    () => [...assignments.values()].filter((occupant) => occupant.pinned).length,
    [assignments],
  );

  const teacherDesk = useMemo(() => {
    const desk = room.objects.find((object) => object.kind === "TEACHER_DESK");
    return desk ? { x: desk.x + desk.widthCm / 2, y: desk.y + desk.heightCm / 2 } : null;
  }, [room.objects]);

  const mutate = useCallback((next: SeatAssignments) => {
    setAssignments(next);
    setDirty(true);
  }, []);

  // Place et état de l'élève sélectionné, pour la fiche du panneau latéral.
  const selection = useMemo(() => {
    if (!selectedStudentId) return null;
    const student = studentById.get(selectedStudentId);
    const seatId = seatOfStudent(assignments, selectedStudentId);
    if (!student || !seatId) return null;
    return { student, seatId, pinned: assignments.get(seatId)?.pinned ?? false };
  }, [selectedStudentId, studentById, assignments]);

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

  /**
   * Placement automatique.
   *
   * La graine est DÉRIVÉE de l'identifiant du plan de classe : « Placer
   * automatiquement » redonne indéfiniment la même proposition, et il faut
   * demander explicitement « Autre proposition » pour en changer. C'est ce qui
   * manquait — une graine tirée au hasard à chaque clic rendait tout résultat
   * irretrouvable.
   */
  async function handleAutoPlace(mode: PlaceMode) {
    setError(null);
    setSolving(true);

    const nextVariant = mode === "fresh" ? 0 : mode === "variant" ? variant + 1 : variant;
    // « Repartir de zéro » ne conserve que les places verrouillées :
    // le professeur les a fixées volontairement.
    const base = mode === "improve" ? assignments : keepOnlyPinned(assignments);
    const before = assignments;

    try {
      const result = await runSolver({
        // Une place condamnée est écartée du placement — sauf si elle porte une
        // affectation verrouillée : sans cette exception, le verrouillage
        // disparaîtrait sans un mot dès qu'on condamne la table.
        seats: seats
          .filter((seat) => !seat.disabled || base.get(seat.id)?.pinned)
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
        previous: mode === "improve" ? placementMap(assignments) : undefined,
        weights: mode === "improve" ? { stability: IMPROVE_STABILITY } : undefined,
        teacherDesk,
        proximityCm,
        seed: seedFromId(plan.id, nextVariant),
      });

      const next: SeatAssignments = new Map(
        result.assignments.map((assignment): [string, SeatOccupant] => [
          assignment.seatId,
          { studentId: assignment.studentId, pinned: assignment.pinned },
        ]),
      );

      setVariant(nextVariant);
      mutate(next);
      setViolations(result.violations);
      setLastRun({
        cost: Math.round(result.cost),
        durationMs: result.durationMs,
        moved: mode === "improve" ? movedCount(before, next) : null,
      });
    } catch (solverError) {
      setError(
        solverError instanceof Error ? solverError.message : "Le placement automatique a échoué.",
      );
    } finally {
      setSolving(false);
    }
  }

  function handleClear() {
    if (
      !window.confirm(
        "Retirer tous les élèves du plan de classe ? Les places verrouillées sont conservées.",
      )
    ) {
      return;
    }
    mutate(keepOnlyPinned(assignments));
    setViolations([]);
    setLastRun(null);
  }

  function handleSave() {
    setError(null);

    startTransition(async () => {
      const [assignmentsResult, settingsResult] = await Promise.all([
        saveAssignments({ planId: plan.id, assignments: toAssignmentList(assignments) }),
        updatePlanSettings(plan.id, { name, mirrored, proximityCm }),
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

  /** Renommage en ligne : les réglages en cours partent avec le nouveau nom. */
  async function handleRename(nextName: string): Promise<string | null> {
    const result = await updatePlanSettings(plan.id, { name: nextName, mirrored, proximityCm });
    if (!result.ok) return result.error;

    setName(nextName);
    router.refresh();
    return null;
  }

  // --------------------------------------------------------------- rendu

  // La vue depuis le bureau est une ROTATION À 180°, pas un simple miroir : le
  // tableau passe en bas de l'écran et la gauche de l'écran redevient votre
  // gauche. On la calcule sur les COORDONNÉES — un `scaleX(-1)` retournerait
  // aussi les noms et les rendrait illisibles.
  const flipX = (x: number, width = 0) => (mirrored ? room.widthCm - x - width : x);
  const flipY = (y: number, height = 0) => (mirrored ? room.heightCm - y - height : y);

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
          <div className="min-w-0">
            <InlinePlanName name={name} onRename={handleRename} />
            <p className="mt-1 text-sm text-muted">
              {plan.classGroupName} · {room.name} · {assignments.size}/{students.length} élève
              {students.length > 1 ? "s" : ""} placé{assignments.size > 1 ? "s" : ""}
              {pinnedCount > 0 && ` · ${pinnedCount} verrouillée${pinnedCount > 1 ? "s" : ""}`}
            </p>
          </div>

          <div className="print-hidden flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              onClick={() => handleAutoPlace("fresh")}
              loading={solving}
              title="Toujours la même proposition pour ce plan de classe"
            >
              <SparkIcon />
              Placer automatiquement
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => handleAutoPlace("variant")}
              disabled={solving}
              title="Calculer une disposition différente"
            >
              <ShuffleIcon />
              Autre proposition
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => handleAutoPlace("improve")}
              disabled={solving}
              title="Retoucher le plan de classe affiché sans le rebrasser"
            >
              Améliorer
            </Button>
            <Button onClick={handleSave} loading={pending} disabled={!dirty}>
              {pending ? "Enregistrement…" : dirty ? "Enregistrer" : "Enregistré"}
            </Button>
          </div>
        </div>

        <FieldError message={error} />

        {lastRun && (
          <p className="print-hidden text-xs text-muted">
            Proposition n° {variant + 1} · coût {lastRun.cost.toLocaleString("fr-FR")} ·{" "}
            {lastRun.durationMs} ms
            {lastRun.moved !== null &&
              ` · ${lastRun.moved} élève${lastRun.moved > 1 ? "s" : ""} déplacé${lastRun.moved > 1 ? "s" : ""}`}
          </p>
        )}

        {conflicts.length > 0 && (
          <div
            role="alert"
            className="rounded-card border border-danger-border bg-danger-soft p-3 text-sm text-danger"
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
          <div className="rounded-card border border-border bg-surface-muted p-3 text-sm">
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

        {/* Le plan occupe toute la largeur, les outils s'empilent EN DESSOUS :
            le plan de classe est le sujet de la page, rien ne doit lui prendre
            de largeur. */}
        <div className="space-y-4">
          {/* ----------------------------------------------------- plan */}
          <div className="min-w-0 rounded-card border border-border bg-surface p-2 shadow-soft">
            <PlanToolbar
              mirrored={mirrored}
              onToggleMirror={() => {
                setMirrored((value) => !value);
                setDirty(true);
              }}
              zoom={zoom}
              onZoom={setZoom}
              onReset={resetView}
              pinnedCount={pinnedCount}
              placedCount={assignments.size}
              onPinAll={() => mutate(setAllPinned(assignments, true))}
              onUnpinAll={() => mutate(setAllPinned(assignments, false))}
              panelOpen={panelOpen}
              onTogglePanel={togglePanel}
            />

            {/* `planRef` mesure CE conteneur, qui ne défile jamais : la zone de
                défilement est son enfant. Mesurer celle-ci ferait osciller la
                largeur dès qu'une barre apparaît. */}
            <div ref={planRef}>
              <div
                className="overflow-auto"
                style={{ height: planHeight || undefined, maxHeight: planHeight || "68vh" }}
              >
                <div
                  className="relative mx-auto"
                  style={{
                    width: widthPx || "100%",
                    aspectRatio: `${room.widthCm} / ${room.heightCm}`,
                  }}
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
                          y: flipY(object.y, object.heightCm),
                          // Rotation de la vue, donc rotation du meuble : +180°.
                          rotation: mirrored ? (object.rotation + 180) % 360 : object.rotation,
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
                          y1={flipY(a.y)}
                          x2={flipX(b.x)}
                          y2={flipY(b.y)}
                          stroke="var(--danger)"
                          strokeWidth={5}
                          strokeDasharray="14 8"
                        />
                      );
                    })}
                  </svg>

                  {pxPerCm > 0 &&
                    seats.map((seat) => {
                      const occupant = assignments.get(seat.id);
                      const student = occupant
                        ? (studentById.get(occupant.studentId) ?? null)
                        : null;

                      return (
                        <SeatSpot
                          key={seat.id}
                          seat={seat}
                          student={student}
                          pinned={occupant?.pinned ?? false}
                          conflicted={conflictedSeats.has(seat.id)}
                          selected={selectedStudentId === student?.id}
                          leftPercent={(flipX(seat.x) / room.widthCm) * 100}
                          topPercent={(flipY(seat.y) / room.heightCm) * 100}
                          metrics={metrics}
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
              </div>
            </div>

            {/* Poignée de redimensionnement : agrandir la fenêtre agrandit le
                plan, jusqu'à ce que la largeur disponible devienne la
                contrainte — le plan cesse alors de grandir et se centre. */}
            <div
              role="separator"
              aria-orientation="horizontal"
              aria-label="Redimensionner la fenêtre du plan de classe"
              tabIndex={0}
              onPointerDown={handleResizeStart}
              onKeyDown={(event) => {
                const step = event.shiftKey ? 80 : 24;
                if (event.key === "ArrowDown" || event.key === "ArrowUp") {
                  event.preventDefault();
                  const delta = event.key === "ArrowDown" ? step : -step;
                  const next = Math.round(
                    Math.min(
                      window.innerHeight * PLAN_MAX_HEIGHT_SHARE,
                      Math.max(PLAN_MIN_HEIGHT, planHeightRef.current + delta),
                    ),
                  );
                  planHeightRef.current = next;
                  setPlanHeight(next);
                  window.localStorage.setItem(HEIGHT_STORAGE_KEY, String(next));
                }
              }}
              title="Faire glisser pour agrandir ou réduire le plan de classe"
              className="print-hidden group mt-1 flex h-4 cursor-ns-resize items-center justify-center rounded-control hover:bg-surface-muted"
            >
              <span
                aria-hidden="true"
                className="h-1 w-16 rounded-full bg-border transition-colors group-hover:bg-primary"
              />
            </div>

            <div className="print-hidden mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3">
              <DifficultyLegend />
              <p className="flex items-center gap-1.5 text-xs text-muted">
                <span
                  aria-hidden="true"
                  className="inline-block h-3 w-3 rounded-full border-2 border-solid border-danger"
                />
                Cadre rouge plein : place verrouillée, le placement automatique ne la modifie pas.
                Pointillé rouge : incompatibilité non respectée.
              </p>
              <p className="text-xs text-muted">
                {mirrored
                  ? "Vue depuis le bureau : les élèves vous font face, le tableau est en bas."
                  : "Vue du dessus : le tableau est en haut, comme sur le plan de la salle."}
              </p>
            </div>
          </div>

          {/* -------------------------------------- outils, sous le plan */}
          {panelOpen ? (
            <section className="print-hidden grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              <TrayZone count={unplaced.length}>
                {unplaced.map((student) => (
                  <TrayStudent key={student.id} student={student} />
                ))}
              </TrayZone>

              {selection && (
                <div className="rounded-card border border-primary/40 bg-primary-soft/40 p-3 shadow-soft">
                  <h2 className="text-sm font-medium">Élève sélectionné</h2>
                  <p className="mt-2 flex items-center gap-2 text-sm">
                    <DifficultyBadge difficulty={selection.student.difficulty} />
                    <span className="truncate font-medium">
                      {studentFullName(selection.student)}
                    </span>
                  </p>
                  {selection.student.comment && (
                    <p className="mt-1.5 text-xs text-muted">{selection.student.comment}</p>
                  )}
                  {/* Seule commande de verrouillage à la place : l'étiquette du
                      plan ne porte plus de cadenas, elle se contente d'être
                      cerclée de rouge. */}
                  <Button
                    size="sm"
                    variant={selection.pinned ? "secondary" : "primary"}
                    className="mt-3 w-full"
                    onClick={() => mutate(togglePin(assignments, selection.seatId))}
                  >
                    {selection.pinned ? <UnlockIcon /> : <LockIcon />}
                    {selection.pinned ? "Déverrouiller la place" : "Verrouiller sur cette place"}
                  </Button>
                </div>
              )}

              <div className="flex flex-col rounded-card border border-border bg-surface p-3 shadow-soft">
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

                {/* `mt-auto` cale le bouton en bas de la carte, pour qu'il
                    s'aligne avec ceux des cartes voisines quelle que soit la
                    hauteur du contenu. */}
                <div className="mt-auto pt-4">
                  <Button variant="secondary" size="sm" className="w-full" onClick={handleClear}>
                    Vider le plan de classe
                  </Button>
                </div>
              </div>

              <ExportPdfPanel planId={plan.id} mirrored={mirrored} />
            </section>
          ) : (
            <button
              type="button"
              onClick={togglePanel}
              className="print-hidden flex w-full items-center justify-center gap-2 rounded-card border border-dashed border-border py-2 text-sm text-muted hover:border-primary hover:text-foreground"
            >
              <ChevronDownIcon width={14} height={14} />
              Afficher les outils
              {unplaced.length > 0 && ` — ${unplaced.length} élève${unplaced.length > 1 ? "s" : ""} à placer`}
            </button>
          )}
        </div>
      </div>

      {/* L'aperçu qui suit le pointeur pendant le déplacement. */}
      <DragOverlay dropAnimation={null}>
        {draggedStudent && (
          <div className="flex h-11 w-24 items-center rounded-control border-2 border-primary bg-surface px-1.5 text-[11px] shadow-float">
            <StudentLabel student={draggedStudent} />
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}

// ------------------------------------------------------------------- pièces

/**
 * Titre renommable du plan de classe.
 *
 * Composant local plutôt que `InlineRename` partagé : le titre doit rester un
 * `<h1>` et cohabiter avec le sous-titre, et la logique d'édition tient en
 * quelques lignes. Le composant partagé sert aux pages classe et salle.
 */
function InlinePlanName({
  name,
  onRename,
}: {
  name: string;
  onRename: (name: string) => Promise<string | null>;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(name);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!editing) setDraft(name);
  }, [name, editing]);

  async function commit() {
    const next = draft.trim();
    if (next === name) {
      setEditing(false);
      setError(null);
      return;
    }
    if (!next) {
      setError("Le nom ne peut pas être vide.");
      return;
    }

    setSaving(true);
    const message = await onRename(next);
    setSaving(false);

    if (message) {
      setError(message);
      return;
    }
    setError(null);
    setEditing(false);
  }

  if (editing) {
    return (
      <div>
        <input
          autoFocus
          value={draft}
          maxLength={80}
          disabled={saving}
          aria-label="Nouveau nom du plan de classe"
          onChange={(event) => setDraft(event.target.value)}
          onBlur={commit}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              void commit();
            } else if (event.key === "Escape") {
              event.preventDefault();
              setDraft(name);
              setError(null);
              setEditing(false);
            }
          }}
          className="w-full max-w-md rounded-control border border-primary bg-surface px-2 py-1 text-2xl font-semibold tracking-tight outline-none ring-2 ring-primary/25 disabled:opacity-60"
        />
        <FieldError message={error} />
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">
        <button
          type="button"
          onClick={() => setEditing(true)}
          title="Renommer ce plan de classe"
          className="-mx-1 rounded-control px-1 text-left hover:bg-surface-muted"
        >
          {name}
        </button>
      </h1>
      <FieldError message={error} />
    </div>
  );
}

/** Barre d'outils du plan : orientation, verrouillages, zoom, panneau. */
function PlanToolbar({
  mirrored,
  onToggleMirror,
  zoom,
  onZoom,
  onReset,
  pinnedCount,
  placedCount,
  onPinAll,
  onUnpinAll,
  panelOpen,
  onTogglePanel,
}: {
  mirrored: boolean;
  onToggleMirror: () => void;
  zoom: number;
  onZoom: (value: number) => void;
  onReset: () => void;
  pinnedCount: number;
  placedCount: number;
  onPinAll: () => void;
  onUnpinAll: () => void;
  panelOpen: boolean;
  onTogglePanel: () => void;
}) {
  return (
    <div className="print-hidden mb-2 flex flex-wrap items-center gap-1.5 border-b border-border px-1 pb-2">
      <Button
        size="sm"
        variant="secondary"
        onClick={onToggleMirror}
        title="Pivoter la vue à 180°"
      >
        <DeskViewIcon />
        {mirrored ? "Vue depuis le bureau" : "Vue du dessus"}
      </Button>

      <span className="mx-1 h-5 w-px bg-border" aria-hidden="true" />

      <Button
        size="sm"
        variant="ghost"
        onClick={onPinAll}
        disabled={placedCount === 0 || pinnedCount === placedCount}
        title="Verrouiller toutes les places occupées"
      >
        <LockIcon />
        Tout verrouiller
      </Button>
      <Button
        size="sm"
        variant="ghost"
        onClick={onUnpinAll}
        disabled={pinnedCount === 0}
        title="Déverrouiller toutes les places"
      >
        <UnlockIcon />
        Tout déverrouiller
      </Button>

      <span className="mx-1 h-5 w-px bg-border" aria-hidden="true" />

      <div className="flex items-center gap-0.5">
        <Button
          size="sm"
          variant="ghost"
          onClick={() => onZoom(Math.max(ZOOM_MIN, zoom - ZOOM_STEP))}
          disabled={zoom <= ZOOM_MIN}
          aria-label="Réduire le plan de classe"
        >
          <ZoomOutIcon />
        </Button>
        <span className="w-12 text-center text-xs tabular-nums text-muted">{zoom} %</span>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => onZoom(Math.min(ZOOM_MAX, zoom + ZOOM_STEP))}
          disabled={zoom >= ZOOM_MAX}
          aria-label="Agrandir le plan de classe"
        >
          <ZoomInIcon />
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={onReset}
          title="Revenir au zoom et à la hauteur de fenêtre par défaut"
        >
          <FitIcon />
          Ajuster
        </Button>
      </div>

      <Button size="sm" variant="ghost" className="ml-auto" onClick={onTogglePanel}>
        {panelOpen ? <ChevronUpIcon /> : <ChevronDownIcon />}
        {panelOpen ? "Masquer les outils" : "Afficher les outils"}
      </Button>
    </div>
  );
}
