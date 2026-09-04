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
import { useCallback, useEffect, useMemo, useState } from "react";

import { saveAssignments, updatePlanSettings } from "@/actions/plans";
import { StudentDialog, type StudentDialogRelation } from "@/components/class/student-dialog";
import { ExportPdfPanel } from "@/components/plan/export-pdf-panel";
import {
  SeatSpot,
  StudentLabel,
  TRAY_DROPPABLE_ID,
  TrayColumn,
  TrayStudent,
  parseDraggableId,
  parseSeatDroppableId,
} from "@/components/plan/plan-pieces";
import { StudentCard, type StudentCardRelation } from "@/components/plan/student-card";
import { Furniture, RoomGrid } from "@/components/room/furniture";
import { BehaviorLegend } from "@/components/ui/behavior-badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { FieldError, Input } from "@/components/ui/field";
import {
  ArrowLeftIcon,
  FitIcon,
  LockIcon,
  RocketIcon,
  ShuffleIcon,
  UnlockIcon,
  WarningIcon,
  ZoomInIcon,
  ZoomOutIcon,
} from "@/components/ui/icons";
import { Segment, Track } from "@/components/ui/segmented";
import { cn } from "@/lib/cn";
import { conflictingSeatIds, findProximityConflicts } from "@/lib/placement/conflicts";
import { seatFootprintCm } from "@/lib/placement/geometry";
import { planLabelStyle, seatMetrics } from "@/lib/plan-labels";
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

/** Une entrée du sélecteur de plans de la barre supérieure. */
export interface PlanOption {
  id: string;
  name: string;
  classGroupName: string;
  roomName: string;
}

/**
 * Délai d'inactivité avant enregistrement automatique.
 *
 * Assez long pour qu'un glisser-déposer suivi d'un autre ne déclenche qu'un
 * seul aller-retour, assez court pour que la fenêtre de perte reste courte si
 * l'onglet est fermé brutalement — un `beforeunload` couvre le reste.
 */
const AUTOSAVE_DELAY_MS = 800;

type SaveState = "clean" | "pending" | "saving" | "saved" | "error";

/** Poids d'inertie d'« Améliorer » : retoucher, et non tout rebrasser. */
const IMPROVE_STABILITY = 250;

const ZOOM_MIN = 60;
const ZOOM_MAX = 250;
const ZOOM_STEP = 10;

type PlaceMode = "fresh" | "variant" | "improve";

export function PlanEditor({
  plan,
  plans,
  room,
  students,
  relations,
  initialAssignments,
}: {
  plan: PlanMeta;
  /** Tous les plans du compte, pour le sélecteur de la barre supérieure. */
  plans: PlanOption[];
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
  /** Élève ouvert dans le popup de fiche, ou `null` si le popup est fermé. */
  const [editingStudentId, setEditingStudentId] = useState<string | null>(null);
  const [draggingStudentId, setDraggingStudentId] = useState<string | null>(null);
  const [violations, setViolations] = useState<Violation[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<SaveState>("clean");
  /** « Vider le plan de classe » attend confirmation. */
  const [clearing, setClearing] = useState(false);
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

  // `sideways` : la table de cette place est pivotée d'un quart de tour (le
  // bras d'un U, par exemple) — son pas de places, donc l'étiquette, suit
  // alors l'axe vertical de la salle et non l'horizontal.
  const seats = useMemo(
    () =>
      room.objects.flatMap((object) =>
        object.seats.map((seat) => ({ ...seat, sideways: object.rotation % 180 !== 0 })),
      ),
    [room.objects],
  );
  const studentById = useMemo(
    () => new Map(students.map((s): [string, StudentView] => [s.id, s])),
    [students],
  );

  const {
    ref: planRef,
    widthPx,
    pxPerCm,
  } = usePlanScale(room.widthCm, room.heightCm, zoom, planHeight);

  // L'emprise d'une étiquette est celle de sa table : le pas de ses places en
  // largeur, sa profondeur en hauteur (`seatFootprintCm`). Commune à tout le
  // plan, donc la plus petite parmi les tables occupées de la salle.
  const tableSpans = useMemo(
    () =>
      room.objects
        .filter((object) => object.kind === "TABLE")
        .map((object) => ({ widthCm: object.widthCm, heightCm: object.heightCm, seatCount: object.seats.length })),
    [room.objects],
  );
  const footprint = useMemo(() => seatFootprintCm(tableSpans), [tableSpans]);
  const metrics = useMemo(() => seatMetrics(footprint, pxPerCm), [footprint, pxPerCm]);

  // Forme et corps de texte COMMUNS à toute la classe : c'est le nom le plus
  // long qui les fixe, pour qu'aucun ne soit coupé et qu'aucun ne s'affiche
  // plus gros qu'un autre. Se recalcule quand la fenêtre change d'échelle.
  const labels = useMemo(() => planLabelStyle(students, metrics), [students, metrics]);

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

  /** Toute modification du placement passe par ici, et arme l'enregistrement. */
  const mutate = useCallback((next: SeatAssignments) => {
    setAssignments(next);
    setSaveState("pending");
  }, []);

  // Place et état de l'élève sélectionné, pour la fiche du panneau latéral.
  const selection = useMemo(() => {
    if (!selectedStudentId) return null;
    const student = studentById.get(selectedStudentId);
    const seatId = seatOfStudent(assignments, selectedStudentId);
    if (!student || !seatId) return null;
    return { student, seatId, pinned: assignments.get(seatId)?.pinned ?? false };
  }, [selectedStudentId, studentById, assignments]);

  /**
   * Relations d'un élève, l'AUTRE élève déjà résolu.
   *
   * `StudentRelation` est normalisée (`studentAId < studentBId`), donc l'élève
   * courant peut se trouver d'un côté comme de l'autre : c'est ici qu'on tranche,
   * la fiche n'a pas à connaître cette convention.
   */
  const relationsOf = useCallback(
    (studentId: string): StudentCardRelation[] =>
      relations
        .filter(
          (relation) => relation.studentAId === studentId || relation.studentBId === studentId,
        )
        .map((relation) => {
          const otherId =
            relation.studentAId === studentId ? relation.studentBId : relation.studentAId;
          const other = studentById.get(otherId);
          return other ? { id: relation.id, type: relation.type, other } : null;
        })
        .filter((entry): entry is StudentCardRelation => entry !== null),
    [relations, studentById],
  );

  const selectionRelations = useMemo(
    () => (selection ? relationsOf(selection.student.id) : []),
    [selection, relationsOf],
  );

  /**
   * L'élève ouvert dans le popup.
   *
   * Tiré de son PROPRE identifiant et non de la sélection : sans cela, cliquer
   * une autre place pendant que le popup est ouvert le ferait changer d'élève
   * sous les doigts, et fermer la fiche du panneau laisserait le popup armé
   * pour la sélection suivante.
   */
  const editingStudent = editingStudentId ? (studentById.get(editingStudentId) ?? null) : null;

  /** Les mêmes relations, dans la forme attendue par le popup. */
  const dialogRelations = useMemo<StudentDialogRelation[]>(
    () =>
      editingStudent
        ? relationsOf(editingStudent.id).map((relation) => ({
            id: relation.id,
            type: relation.type,
            otherId: relation.other.id,
          }))
        : [],
    [editingStudent, relationsOf],
  );

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
          behavior: student.behavior,
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
    mutate(keepOnlyPinned(assignments));
    setViolations([]);
    setLastRun(null);
    setClearing(false);
  }

  /**
   * Enregistre le plan de classe. Appelée par l'anti-rebond, jamais à la main.
   *
   * Volontairement HORS de `startTransition` : une transition sert à ne pas
   * bloquer l'interface pendant un rendu coûteux, alors qu'ici on ne veut que
   * connaître l'issue d'un aller-retour serveur. L'état `saveState` suffit à
   * l'annoncer.
   */
  const save = useCallback(async () => {
    setSaveState("saving");
    setError(null);

    const [assignmentsResult, settingsResult] = await Promise.all([
      saveAssignments({ planId: plan.id, assignments: toAssignmentList(assignments) }),
      updatePlanSettings(plan.id, { name, mirrored, proximityCm }),
    ]);

    const failure = !assignmentsResult.ok
      ? assignmentsResult.error
      : !settingsResult.ok
        ? settingsResult.error
        : null;

    if (failure) {
      setError(failure);
      setSaveState("error");
      return;
    }

    setSaveState("saved");
  }, [plan.id, assignments, name, mirrored, proximityCm]);

  /**
   * ENREGISTREMENT AUTOMATIQUE.
   *
   * Le bouton « Enregistrer » a disparu : composer un plan de classe est une
   * suite de petits gestes, et devoir penser à les valider était le seul moment
   * où l'on pouvait tout perdre.
   *
   * `saveState` gouverne le cycle. Seul `"pending"` déclenche : les mutations
   * le posent, ce qui évite d'enregistrer au montage — un effet dépendant des
   * données seules serait parti dès le premier rendu — et évite aussi de
   * réenregistrer en boucle après un succès.
   *
   * Le minuteur est reposé à chaque frappe : un renommage lettre à lettre ne
   * donne qu'un seul aller-retour.
   *
   * Pas de `router.refresh()` : il rerendrait la page serveur à chaque
   * enregistrement, donc à chaque déplacement d'élève. Les actions revalident
   * déjà les pages CONCERNÉES côté serveur ; la page courante, elle, affiche
   * l'état local, qui est par construction le plus à jour.
   */
  useEffect(() => {
    if (saveState !== "pending") return;

    const timer = setTimeout(() => void save(), AUTOSAVE_DELAY_MS);
    return () => clearTimeout(timer);
  }, [saveState, save]);

  /**
   * Garde-fou de fermeture.
   *
   * L'anti-rebond ouvre une fenêtre courte mais réelle pendant laquelle une
   * modification n'est pas encore partie. Fermer l'onglet à cet instant la
   * perdrait sans un mot.
   */
  useEffect(() => {
    if (saveState !== "pending" && saveState !== "saving") return;

    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [saveState]);

  /**
   * Paires de relations, prêtes à l'affichage en pastilles.
   *
   * La maquette montre « À séparer » et « À rapprocher » comme deux nuages de
   * pastilles dans la colonne de droite. Ce sont exactement les deux types de
   * `StudentRelation` : rien à inventer, juste à résoudre les identifiants.
   */
  const relationPairs = useMemo(() => {
    const label = (pair: { a: string; b: string }) => {
      const a = studentById.get(pair.a);
      const b = studentById.get(pair.b);
      if (!a || !b) return null;
      return { key: `${pair.a}-${pair.b}`, text: `${a.firstName} · ${b.firstName}` };
    };

    return {
      separate: incompatibles.map(label).filter((entry) => entry !== null),
      together: affinities.map(label).filter((entry) => entry !== null),
    };
  }, [incompatibles, affinities, studentById]);

  const placedRatio =
    students.length === 0 ? 0 : Math.round((assignments.size / students.length) * 100);

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
        {/* La fiche élève MODIFIABLE est un popup, la même que sur la page de
            classe. La carte du panneau de droite en reste la forme en
            lecture. Après enregistrement, `router.refresh()` renvoie les
            élèves à jour SANS remonter cet éditeur : le placement en cours,
            qui vit dans l'état local, survit à la modification. */}
        <ConfirmDialog
          open={clearing}
          onClose={() => setClearing(false)}
          onConfirm={handleClear}
          title="Vider le plan de classe ?"
          description="Tous les élèves sont retirés du plan. Les places verrouillées, elles, sont conservées."
          confirmLabel="Vider le plan"
        />

        {editingStudent && (
          <StudentDialog
            open
            onClose={() => setEditingStudentId(null)}
            classGroupId={plan.classGroupId}
            student={editingStudent}
            contextLabel={`${plan.classGroupName} · ${room.name}`}
            relations={dialogRelations}
            classmates={students}
          />
        )}

        <div className="print-hidden">
          <Link
            href="/tableau-de-bord"
            className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-foreground"
          >
            <ArrowLeftIcon />
            Retour
          </Link>
        </div>

        <FieldError message={error} />

        {/* ================================================================
            L'ÉDITEUR EST UN SEUL CADRE, sur l'architecture de la maquette :
            une barre supérieure, puis trois colonnes — les élèves à placer à
            gauche, le plan au centre sur sa trame de points, la fiche et les
            réglages à droite.

            C'est un renversement par rapport à la version précédente, où le
            bac occupait la droite et où les réglages vivaient sous le plan.
            La composition se fait maintenant de gauche à droite : on prend un
            élève dans la colonne de gauche, on le pose au centre, on ajuste à
            droite.
            ================================================================ */}
        <div className="overflow-hidden rounded-card border border-border bg-surface shadow-lift">
          {/* ------------------------------------------ barre supérieure */}
          <div className="print-hidden flex flex-wrap items-center gap-2 border-b border-border px-3 py-2.5">
            {/* Le renommage est une mutation comme une autre : il DOIT poser
                `pending` lui-même. `setName` seul ne déclenchait rien —
                l'anti-rebond ne part que sur cet état — et le nouveau nom
                restait dans l'état local jusqu'au prochain geste enregistré,
                voire se perdait au rechargement. */}
            <InlinePlanName
              name={name}
              onRename={(next) => {
                setName(next);
                setSaveState("pending");
              }}
            />

            <PlanSwitcher
              currentId={plan.id}
              plans={plans}
              onSelect={(id) => router.push(`/plans/${id}`)}
            />

            <span className="eyebrow rounded-control bg-accent-soft px-2 py-1.5 text-accent">
              {assignments.size}/{students.length} placés
            </span>

            {pinnedCount > 0 && (
              <span className="eyebrow rounded-control bg-danger-soft px-2 py-1.5 text-danger">
                {pinnedCount} verrouillée{pinnedCount > 1 ? "s" : ""}
              </span>
            )}

            <span className="flex-1" />

            <SaveIndicator state={saveState} onRetry={() => void save()} />

            {/* Les trois boutons de la maquette : deux discrets à filet fin,
                puis l'action pleine. Plus de bouton « Enregistrer » — voir
                l'enregistrement automatique plus haut. */}
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
            <Button
              size="sm"
              onClick={() => handleAutoPlace("fresh")}
              loading={solving}
              title="Toujours la même proposition pour ce plan de classe"
            >
              <RocketIcon />
              Placer automatiquement
            </Button>
          </div>

          {/* ------------------------------------------- les trois colonnes */}
          <div className="grid lg:grid-cols-[13rem_minmax(0,1fr)_16rem]">
            {/* --------------------------------- gauche : les élèves à placer */}
            <aside className="print-hidden flex max-h-72 flex-col overflow-hidden border-b border-border lg:max-h-none lg:border-b-0 lg:border-r">
              <TrayColumn
                count={unplaced.length}
                footer={
                  <>
                    <h3 className="eyebrow mb-2">Comportement</h3>
                    <BehaviorLegend vertical />
                  </>
                }
              >
                {unplaced.map((student) => (
                  <TrayStudent key={student.id} student={student} />
                ))}
              </TrayColumn>
            </aside>

            {/* ------------------------------------------- centre : le plan */}
            <div className="halftone flex min-w-0 flex-col gap-3 bg-surface p-3">
              <CanvasToolbar
                mirrored={mirrored}
                onSetMirrored={(value) => {
                  setMirrored(value);
                  setSaveState("pending");
                }}
                zoom={zoom}
                onZoom={setZoom}
                onReset={resetView}
                pinnedCount={pinnedCount}
                placedCount={assignments.size}
                seatCount={seats.length}
                onPinAll={() => mutate(setAllPinned(assignments, true))}
                onUnpinAll={() => mutate(setAllPinned(assignments, false))}
              />

              {/* `planRef` mesure CE conteneur, qui ne défile jamais : la zone de
                  défilement est son enfant. Mesurer celle-ci ferait osciller la
                  largeur dès qu'une barre apparaît.

                  Il n'a AUCUN REMBOURRAGE : `usePlanScale` le mesure avec
                  `clientWidth`, qui exclut la bordure mais INCLUT le
                  rembourrage. Une bordure ne coûte donc rien à la largeur
                  disponible, là où un `p-3` ferait dépasser la salle de quelques
                  pixels et déclencherait une barre de défilement horizontale à
                  100 % — précisément ce que la double contrainte de
                  `usePlanScale` existe pour éviter. Le dégagement autour du plan
                  est porté par la COLONNE, qui a le `p-3` et la trame de points.
                  */}
              <div
                ref={planRef}
                className="overflow-hidden rounded-control border border-border shadow-soft"
              >
                {/* `maxHeight` seul, jamais `height` : une hauteur fixe forçait
                    ce conteneur à occuper `planHeight` même quand la salle,
                    contrainte par la largeur, y tenait dans moins d'espace — un
                    vide se creusait alors avant la légende. En laissant le
                    conteneur se réduire à son contenu, il ne défile que si la
                    salle dépasse réellement le budget de hauteur. */}
                <div className="overflow-auto" style={{ maxHeight: planHeight || "88vh" }}>
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
                            sideways={seat.sideways}
                            metrics={metrics}
                            labels={labels}
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

              {/* ------------------- bandeau de contraintes, sous le plan
                  C'est la « barre de contraintes » de la maquette : un
                  bandeau bas, sur une ligne, avec l'action de correction à
                  droite. Elle remplace la liste à puces qui poussait le plan
                  vers le bas. Le rouge est ici légitime — ce sont des
                  incompatibilités non respectées, l'un des deux seuls sens
                  autorisés pour cette couleur. */}
              {conflicts.length > 0 && (
                <div
                  role="alert"
                  className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-control border border-danger-border bg-danger-soft px-3 py-2"
                >
                  <span className="eyebrow flex items-center gap-1.5 text-danger">
                    <WarningIcon />
                    {conflicts.length} incompatibilité{conflicts.length > 1 ? "s" : ""}
                  </span>
                  <span className="min-w-0 flex-1 text-xs leading-snug text-danger">
                    {conflicts
                      .map((conflict) => {
                        const a = studentById.get(conflict.studentAId);
                        const b = studentById.get(conflict.studentBId);
                        return `${a ? studentFullName(a) : "?"} et ${b ? studentFullName(b) : "?"} à ${conflict.distanceCm} cm`;
                      })
                      .join(" · ")}
                    {" — seuil "}
                    {proximityCm} cm.
                  </span>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => handleAutoPlace("improve")}
                    disabled={solving}
                    title="Retoucher le plan sans le rebrasser"
                  >
                    Corriger
                  </Button>
                </div>
              )}

              {violations.filter((v) => v.kind !== "INCOMPATIBLE_TOO_CLOSE").length > 0 && (
                <div className="rounded-control border border-border bg-surface p-3 text-xs">
                  <p className="font-medium">
                    Le placement automatique n&apos;a pas pu tout satisfaire :
                  </p>
                  <ul className="mt-1.5 list-inside list-disc text-muted">
                    {violations
                      .filter((violation) => violation.kind !== "INCOMPATIBLE_TOO_CLOSE")
                      .map((violation, index) => (
                        <li key={`${violation.kind}-${index}`}>{violation.message}</li>
                      ))}
                  </ul>
                </div>
              )}

              <p className="print-hidden text-xs leading-snug text-muted">
                {mirrored
                  ? "Vue depuis le bureau : les élèves vous font face, le tableau est en bas."
                  : "Vue du dessus : le tableau est en haut, comme sur le plan de la salle."}{" "}
                Cerclage intérieur : comportement. Cadre rouge plein : place verrouillée. Pointillé
                rouge : incompatibilité non respectée.
              </p>
            </div>

            {/* ------------------------- droite : fiche, relations, réglages */}
            <aside className="print-hidden flex flex-col gap-3 border-t border-border p-3 lg:border-l lg:border-t-0">
              {selection ? (
                <StudentCard
                  student={selection.student}
                  contextLabel={`${plan.classGroupName} · ${room.name}`}
                  pinned={selection.pinned}
                  relations={selectionRelations}
                  onTogglePin={() => mutate(togglePin(assignments, selection.seatId))}
                  onEdit={() => setEditingStudentId(selection.student.id)}
                  onRemove={() => {
                    mutate(unassignStudent(assignments, selection.student.id));
                    setSelectedStudentId(null);
                  }}
                  onClose={() => setSelectedStudentId(null)}
                />
              ) : (
                <p className="rounded-control border border-dashed border-border p-3 text-xs leading-snug text-muted">
                  Cliquez un élève du plan pour ouvrir sa fiche.
                </p>
              )}

              <RelationPills title="À séparer" tone="danger" items={relationPairs.separate} />
              <RelationPills title="À rapprocher" tone="accent" items={relationPairs.together} />

              <div>
                {/* `<label>` brut et non le `Label` partagé : celui-ci impose
                    `text-sm text-foreground`, et ces utilitaires l'emportent
                    sur `.eyebrow`, qui vit dans la couche `components`. */}
                <label htmlFor="proximity" className="eyebrow mb-2 block">
                  Seuil de proximité (cm)
                </label>
                <Input
                  id="proximity"
                  type="number"
                  min={0}
                  max={1000}
                  step={10}
                  value={proximityCm}
                  onChange={(event) => {
                    setProximityCm(Math.max(0, Number(event.target.value)));
                    setSaveState("pending");
                  }}
                />
                <p className="mt-1.5 text-xs leading-snug text-muted">
                  En dessous de cette distance, deux élèves incompatibles déclenchent une alerte.
                </p>
              </div>

              {/* Le pavé bas de la maquette : un grand chiffre et une jauge.
                  Elle y logeait un « score du plan » que rien ne calcule ici ;
                  on y met la seule mesure dont on dispose vraiment, le nombre
                  d'élèves placés. */}
              <div className="mt-auto rounded-control border border-border bg-surface-muted/60 p-3">
                <h3 className="eyebrow mb-2">Placement</h3>
                <p className="flex items-baseline gap-1.5">
                  <span className="text-2xl font-bold leading-none tabular-nums">
                    {assignments.size}
                  </span>
                  <span className="eyebrow">
                    / {students.length} élève{students.length > 1 ? "s" : ""}
                  </span>
                </p>
                <div
                  className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-surface-muted"
                  role="img"
                  aria-label={`${assignments.size} élève${assignments.size > 1 ? "s" : ""} placé${assignments.size > 1 ? "s" : ""} sur ${students.length}`}
                >
                  <div
                    className="h-full rounded-full bg-accent"
                    style={{ width: `${placedRatio}%` }}
                  />
                </div>

                {lastRun && (
                  <p className="eyebrow mt-2.5 leading-snug">
                    Proposition n° {variant + 1} · coût {lastRun.cost.toLocaleString("fr-FR")} ·{" "}
                    {lastRun.durationMs} ms
                    {lastRun.moved !== null && ` · ${lastRun.moved} déplacé`}
                  </p>
                )}
              </div>
            </aside>
          </div>
        </div>

        {/* ------------------- hors du cadre : ce qui sort du plan de classe */}
        <div className="print-hidden grid gap-4 md:grid-cols-2">
          <ExportPdfPanel planId={plan.id} mirrored={mirrored} />

          <div className="flex flex-col rounded-card border border-border bg-surface p-3 shadow-soft">
            <h2 className="eyebrow">Repartir de zéro</h2>
            <p className="mt-2 text-sm text-muted">
              Retire tous les élèves du plan de classe. Les places verrouillées sont conservées.
            </p>
            <div className="mt-auto pt-4">
              <Button
                variant="secondary"
                size="sm"
                className="w-full"
                onClick={() => setClearing(true)}
              >
                Vider le plan de classe
              </Button>
            </div>
          </div>
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
  /**
   * Pose simplement le nouveau nom. Le renommage n'appelle plus l'action
   * lui-même : l'enregistrement automatique de l'éditeur s'en charge, comme de
   * toute autre modification.
   */
  onRename: (name: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(name);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!editing) setDraft(name);
  }, [name, editing]);

  function commit() {
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

    onRename(next);
    setError(null);
    setEditing(false);
  }

  if (editing) {
    return (
      <div className="min-w-0">
        <input
          autoFocus
          value={draft}
          maxLength={80}
          aria-label="Nouveau nom du plan de classe"
          onChange={(event) => setDraft(event.target.value)}
          onBlur={commit}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              commit();
            } else if (event.key === "Escape") {
              event.preventDefault();
              setDraft(name);
              setError(null);
              setEditing(false);
            }
          }}
          className="w-80 max-w-full rounded-control border border-primary bg-surface px-2 py-1 text-base font-bold tracking-tight outline-none ring-2 ring-primary/25"
        />
        <FieldError message={error} />
      </div>
    );
  }

  return (
    <div className="min-w-0">
      {/* Le titre a QUITTÉ le haut de page pour la barre de l'éditeur : il y
          est donc dimensionné comme un libellé de barre — `text-base` — et non
          plus comme un titre de page. Il reste le `<h1>`.

          Il se dimensionne sur son TEXTE et n'est plus PLAFONNÉ à 16 rem : ce
          plafond coupait des noms de plan parfaitement ordinaires. La barre
          étant en `flex-wrap`, un nom long repousse les actions à la ligne
          suivante plutôt que de se faire tronquer — la troncature ne reste
          qu'en dernier recours, quand le nom dépasse la barre entière, et le
          nom entier est alors dans l'infobulle.

          Il ne prend toujours PAS `flex-1` : la largeur restante de la barre
          irait au titre au lieu de rester au ressort qui pousse les actions à
          droite. */}
      <h1 className="truncate text-base font-bold tracking-tight">
        <button
          type="button"
          onClick={() => setEditing(true)}
          title={`Renommer « ${name} »`}
          className="-mx-1 max-w-full truncate rounded-control px-1 text-left hover:bg-surface-muted"
        >
          {name}
        </button>
      </h1>
      <FieldError message={error} />
    </div>
  );
}


/**
 * Barre d'outils du CENTRE, au-dessus du plan.
 *
 * Elle reprend la forme de la maquette : des pistes segmentées à gauche —
 * un fond creux, des segments dont un seul est allumé — et le compteur de
 * places à droite, en petites capitales (`.eyebrow`).
 *
 * L'orientation était un bouton à bascule dont le libellé changeait ; elle est
 * maintenant un choix à DEUX SEGMENTS. Un bouton qui dit « Vue du dessus » ne
 * dit pas s'il décrit l'état courant ou ce qu'on obtiendra en cliquant : deux
 * segments dont un est enfoncé lèvent l'ambiguïté sans un mot de plus.
 *
 * La fiche de l'élève sélectionné n'est plus ici : elle a sa place, entière,
 * dans la colonne de droite.
 */
function CanvasToolbar({
  mirrored,
  onSetMirrored,
  zoom,
  onZoom,
  onReset,
  pinnedCount,
  placedCount,
  seatCount,
  onPinAll,
  onUnpinAll,
}: {
  mirrored: boolean;
  onSetMirrored: (value: boolean) => void;
  zoom: number;
  onZoom: (value: number) => void;
  onReset: () => void;
  pinnedCount: number;
  placedCount: number;
  seatCount: number;
  onPinAll: () => void;
  onUnpinAll: () => void;
}) {
  return (
    <div className="print-hidden flex flex-wrap items-center gap-2">
      <Track>
        <Segment active={!mirrored} onClick={() => onSetMirrored(false)}>
          Vue du dessus
        </Segment>
        <Segment active={mirrored} onClick={() => onSetMirrored(true)}>
          Depuis le bureau
        </Segment>
      </Track>

      <Track>
        <Segment
          onClick={onPinAll}
          disabled={placedCount === 0 || pinnedCount === placedCount}
          title="Verrouiller toutes les places occupées"
        >
          <LockIcon />
          Tout verrouiller
        </Segment>
        <Segment onClick={onUnpinAll} disabled={pinnedCount === 0} title="Tout déverrouiller">
          <UnlockIcon />
        </Segment>
      </Track>

      <Track>
        <Segment
          onClick={() => onZoom(Math.max(ZOOM_MIN, zoom - ZOOM_STEP))}
          disabled={zoom <= ZOOM_MIN}
          title="Réduire le plan de classe"
        >
          <ZoomOutIcon />
        </Segment>
        <span className="w-11 text-center text-xs tabular-nums text-muted">{zoom} %</span>
        <Segment
          onClick={() => onZoom(Math.min(ZOOM_MAX, zoom + ZOOM_STEP))}
          disabled={zoom >= ZOOM_MAX}
          title="Agrandir le plan de classe"
        >
          <ZoomInIcon />
        </Segment>
        <Segment onClick={onReset} title="Revenir au zoom par défaut">
          <FitIcon />
        </Segment>
      </Track>

      <span className="flex-1" />

      <span className="eyebrow whitespace-nowrap">
        {seatCount} place{seatCount > 1 ? "s" : ""} · {placedCount} occupée
        {placedCount > 1 ? "s" : ""}
      </span>
    </div>
  );
}

/**
 * Nuage de pastilles « À séparer » / « À rapprocher ».
 *
 * Les deux listes de la maquette, adossées aux deux types de
 * `StudentRelation`. Elles ne sont PAS modifiables ici : les relations se
 * gèrent sur la page de la classe, qui a la place de le faire correctement.
 * Le lien y renvoie plutôt que de dupliquer le formulaire.
 */
function RelationPills({
  title,
  tone,
  items,
}: {
  title: string;
  tone: "danger" | "accent";
  items: Array<{ key: string; text: string }>;
}) {
  return (
    <div>
      <h3 className="eyebrow mb-2">{title}</h3>
      {items.length === 0 ? (
        <p className="text-xs text-muted">Aucune.</p>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {items.map((item) => (
            <span
              key={item.key}
              className={cn(
                "rounded-full px-2.5 py-1 text-xs font-medium",
                tone === "danger" ? "bg-danger-soft text-danger" : "bg-accent-soft text-accent",
              )}
            >
              {item.text}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Sélecteur de plan de classe, dans la barre supérieure.
 *
 * C'est la pastille « classe · salle » de la maquette, qui y porte un chevron
 * sans rien faire : elle devient ici un vrai menu vers les autres plans du
 * compte. Passer d'un plan à l'autre était jusqu'ici un aller-retour par le
 * tableau de bord.
 *
 * Un `<select>` NATIF, habillé : le clavier, le tactile et les lecteurs
 * d'écran sont acquis, là où un menu maison demanderait de tout réimplémenter.
 * `appearance-none` retire le chevron du système, redessiné à côté pour suivre
 * le thème ; le `<select>` reste posé PAR-DESSUS en transparence, si bien que
 * c'est bien lui qu'on clique.
 *
 * Les options sont groupées par classe : un professeur a plusieurs plans par
 * classe — « Groupe A », « Éval » — et c'est la classe qu'il cherche d'abord.
 */
function PlanSwitcher({
  currentId,
  plans,
  onSelect,
}: {
  currentId: string;
  plans: PlanOption[];
  onSelect: (id: string) => void;
}) {
  const groups = useMemo(() => {
    const byClass = new Map<string, PlanOption[]>();
    for (const entry of plans) {
      const list = byClass.get(entry.classGroupName);
      if (list) list.push(entry);
      else byClass.set(entry.classGroupName, [entry]);
    }
    return [...byClass];
  }, [plans]);

  const current = plans.find((entry) => entry.id === currentId);

  return (
    <div className="relative">
      <div className="flex items-center gap-2 rounded-control border border-border bg-surface-muted/60 px-2.5 py-1.5">
        <span className="text-xs font-semibold">{current?.classGroupName}</span>
        <span className="eyebrow">{current?.roomName}</span>
        <span aria-hidden="true" className="text-[0.6rem] text-muted">
          ▾
        </span>
      </div>

      <select
        value={currentId}
        onChange={(event) => {
          if (event.target.value !== currentId) onSelect(event.target.value);
        }}
        aria-label="Changer de plan de classe"
        className="absolute inset-0 w-full cursor-pointer appearance-none rounded-control opacity-0"
      >
        {groups.map(([classGroupName, entries]) => (
          <optgroup key={classGroupName} label={classGroupName}>
            {entries.map((entry) => (
              <option key={entry.id} value={entry.id}>
                {entry.name} — {entry.roomName}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
    </div>
  );
}

/**
 * État de l'enregistrement automatique, à la place du bouton « Enregistrer ».
 *
 * Il ne dit rien tant que rien n'a changé : un « Enregistré » permanent sur un
 * plan qu'on vient d'ouvrir est du bruit. Il n'apparaît qu'une fois qu'il a
 * quelque chose à annoncer, et l'échec est le seul état qui rende la main —
 * un bouton pour retenter.
 */
function SaveIndicator({ state, onRetry }: { state: SaveState; onRetry: () => void }) {
  if (state === "clean") return null;

  if (state === "error") {
    return (
      <Button size="sm" variant="danger" onClick={onRetry}>
        <WarningIcon />
        Échec — réessayer
      </Button>
    );
  }

  return (
    <span className="eyebrow whitespace-nowrap" role="status">
      {state === "saved" ? "Enregistré" : "Enregistrement…"}
    </span>
  );
}
