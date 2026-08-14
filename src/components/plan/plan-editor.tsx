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
import { useCallback, useEffect, useMemo, useState, useTransition } from "react";

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
  DeskViewIcon,
  FitIcon,
  LockIcon,
  ShuffleIcon,
  SparkIcon,
  UnlockIcon,
  WarningIcon,
  XIcon,
  ZoomInIcon,
  ZoomOutIcon,
} from "@/components/ui/icons";
import { SEAT_CARD_MAX_HEIGHT_CM, SEAT_CARD_MAX_WIDTH_CM } from "@/lib/domain";
import { conflictingSeatIds, findProximityConflicts } from "@/lib/placement/conflicts";
import { seatFootprintCm } from "@/lib/placement/geometry";
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
import { defaultPlanHeight, usePlanScale } from "@/lib/use-plan-scale";
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
  // 0 = pas encore connue ; la hauteur de la fenêtre de plan se déduit de
  // l'écran, qui n'existe pas au rendu serveur.
  const [planHeight, setPlanHeight] = useState(0);
  const [pending, startTransition] = useTransition();

  /**
   * La fenêtre de plan n'est plus redimensionnable à la main : sa hauteur suit
   * l'écran et se recalcule au redimensionnement de la fenêtre. La poignée
   * apportait un réglage de plus à comprendre pour un gain nul — passé un
   * certain point c'est la LARGEUR qui contraint, et tirer plus bas
   * n'agrandissait plus rien.
   */
  useEffect(() => {
    const measure = () => setPlanHeight(defaultPlanHeight());
    measure();

    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  const resetView = useCallback(() => setZoom(100), []);

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

  // L'emprise d'une étiquette dépend de l'écartement réel des places de CETTE
  // salle : des tables larges autorisent des noms complets, des tables serrées
  // imposent des étiquettes plus petites. Mesuré une fois par agencement.
  const footprint = useMemo(
    () => seatFootprintCm(seats, SEAT_CARD_MAX_WIDTH_CM, SEAT_CARD_MAX_HEIGHT_CM),
    [seats],
  );
  const metrics = useMemo(() => seatMetrics(footprint, pxPerCm), [footprint, pxPerCm]);

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

  // La colonne de droite se gouverne seule : elle ne porte plus que le bac, et
  // n'existe donc que s'il reste quelqu'un à placer. Le plan reprend sinon
  // toute la largeur — sans bouton à actionner.
  const panelVisible = unplaced.length > 0;

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

        {/* Le plan et, à sa droite, la seule colonne dont on se sert en
            composant : les élèves à placer et celui qu'on vient de cliquer.
            Les réglages et l'export, qu'on ouvre une fois par séance, passent
            sous le plan — ils n'ont pas à lui prendre de la largeur en
            permanence.

            Cette colonne n'a plus de bouton d'affichage : elle apparaît quand
            elle a quelque chose à montrer — des élèves à placer — et rend sinon
            toute la largeur au plan. */}
        <div
          className={
            panelVisible
              ? "grid gap-4 lg:grid-cols-[minmax(0,1fr)_15rem]"
              : "grid gap-4 lg:grid-cols-1"
          }
        >
          {/* ----------------------------------------------------- plan */}
          <div className="material min-w-0 rounded-card border border-border bg-surface p-2 shadow-soft">
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
              selection={selection}
              onToggleSelectionPin={() =>
                selection && mutate(togglePin(assignments, selection.seatId))
              }
              onRemoveSelection={() => {
                if (!selection) return;
                mutate(unassignStudent(assignments, selection.student.id));
                setSelectedStudentId(null);
              }}
            />

            {/* `planRef` mesure CE conteneur, qui ne défile jamais : la zone de
                défilement est son enfant. Mesurer celle-ci ferait osciller la
                largeur dès qu'une barre apparaît. */}
            <div ref={planRef}>
              {/* `maxHeight` seul, jamais `height` : une hauteur fixe forçait
                  ce conteneur à occuper `planHeight` même quand la salle,
                  contrainte par la largeur, y tenait dans moins d'espace — un
                  vide se creusait alors avant la légende. En laissant le
                  conteneur se réduire à son contenu, il ne défile que si la
                  salle dépasse réellement le budget de hauteur. */}
              <div className="overflow-auto" style={{ maxHeight: planHeight || "68vh" }}>
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

            <div className="print-hidden mt-2 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-2">
              <DifficultyLegend />
              <p className="text-xs text-muted">
                La difficulté se lit au cerclage intérieur de l&apos;étiquette.
              </p>
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

          {/* -------------------------------- colonne de composition */}
          {panelVisible && (
            <aside className="print-hidden">
              <TrayZone count={unplaced.length}>
                {unplaced.map((student) => (
                  <TrayStudent key={student.id} student={student} />
                ))}
              </TrayZone>
            </aside>
          )}
        </div>

        {/* --------------------------- réglages, sous le plan de classe */}
        <div className="print-hidden grid gap-4 md:grid-cols-2">
          <div className="material flex flex-col rounded-card border border-border bg-surface p-3 shadow-soft">
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

            {/* `mt-auto` cale le bouton en bas de la carte, pour qu'il s'aligne
                avec celui de la carte voisine quelle que soit la hauteur du
                contenu. */}
            <div className="mt-auto pt-4">
              <Button variant="secondary" size="sm" className="w-full" onClick={handleClear}>
                Vider le plan de classe
              </Button>
            </div>
          </div>

          <ExportPdfPanel planId={plan.id} mirrored={mirrored} />
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

/**
 * Barre d'outils du plan : orientation, verrouillages, zoom — et, quand un
 * élève est sélectionné, sa fiche.
 *
 * La fiche vivait sous forme de bande séparée au-dessus du plan ; elle est
 * intégrée à cette même barre, poussée à droite par `ml-auto`, pour que tout
 * ce qui agit sur le plan reste à un seul endroit. Sur une largeur étroite,
 * `flex-wrap` la fait simplement retomber sur sa propre ligne, toujours dans
 * le même bloc.
 *
 * Plus de bouton de panneau : la colonne de droite apparaît et disparaît d'elle
 * même selon qu'elle a quelque chose à montrer.
 */
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
  selection,
  onToggleSelectionPin,
  onRemoveSelection,
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
  selection: { student: StudentView; pinned: boolean } | null;
  onToggleSelectionPin: () => void;
  onRemoveSelection: () => void;
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
          title="Revenir au zoom par défaut"
        >
          <FitIcon />
          Ajuster
        </Button>
      </div>

      {/* Fiche de l'élève cliqué, poussée à droite : nom, difficulté,
          commentaire, puis les deux commandes qui agissent sur sa place. */}
      {selection && (
        <span className="ml-auto flex min-w-0 max-w-full flex-wrap items-center gap-x-2.5 gap-y-1.5">
          <span className="mx-1 hidden h-5 w-px bg-border sm:block" aria-hidden="true" />

          <span className="flex min-w-0 items-center gap-1.5 text-sm">
            <DifficultyBadge difficulty={selection.student.difficulty} size="sm" />
            <span className="max-w-40 truncate font-medium">
              {studentFullName(selection.student)}
            </span>
          </span>

          {selection.student.comment && (
            <span className="hidden max-w-56 truncate text-xs text-muted lg:inline">
              {selection.student.comment}
            </span>
          )}

          {/* Seule commande de verrouillage à la place : l'étiquette du plan
              ne porte plus de cadenas, elle se contente d'être cerclée de
              rouge. */}
          <Button
            size="sm"
            variant={selection.pinned ? "secondary" : "primary"}
            onClick={onToggleSelectionPin}
          >
            {selection.pinned ? <UnlockIcon /> : <LockIcon />}
            {selection.pinned ? "Déverrouiller" : "Verrouiller ici"}
          </Button>
          {/* Retirer du plan sans glisser-déposer : le bac disparaît quand
              tout le monde est placé, et c'est justement là qu'on a besoin de
              sortir quelqu'un. */}
          <Button size="sm" variant="secondary" onClick={onRemoveSelection}>
            <XIcon />
            Retirer du plan
          </Button>
        </span>
      )}
    </div>
  );
}
