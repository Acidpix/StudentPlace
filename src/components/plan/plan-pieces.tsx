"use client";

import { useDraggable, useDroppable } from "@dnd-kit/core";

import { DifficultyBadge } from "@/components/ui/difficulty-badge";
import { cn } from "@/lib/cn";
import { DIFFICULTY_COLORS } from "@/lib/domain";
import {
  LABEL_PADDING_PX,
  fittedSize,
  seatLabelText,
  textRoomPx,
  type PlanLabelStyle,
  type SeatMetrics,
} from "@/lib/plan-labels";
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
 * n'en recouvre jamais une autre : son emprise est celle de sa table. La
 * contrepartie est qu'une grande salle affichée en petit donne de petites
 * étiquettes — d'où les abrègements de `plan-labels.ts` et le zoom de
 * l'éditeur.
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

/**
 * L'ÉCHELLE ET LA TYPOGRAPHIE DES ÉTIQUETTES ONT DÉMÉNAGÉ dans
 * `src/lib/plan-labels.ts` : le PDF doit produire exactement la même image que
 * cet éditeur, et le calcul écrit deux fois avait divergé. Ce fichier ne garde
 * que le RENDU.
 */

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

/** Ce qu'affiche une place sans élève. */
function emptySeatLabel(seat: SeatView): string {
  return seat.disabled ? "Condamnée" : "Libre";
}

export function SeatSpot({
  seat,
  student,
  pinned,
  conflicted,
  selected,
  leftPercent,
  topPercent,
  sideways,
  metrics,
  labels,
  onSelect,
}: {
  seat: SeatView;
  student: StudentView | null;
  pinned: boolean;
  conflicted: boolean;
  selected: boolean;
  leftPercent: number;
  topPercent: number;
  /** La table de cette place est pivotée d'un quart de tour : l'étiquette tourne avec elle. */
  sideways: boolean;
  metrics: SeatMetrics;
  /** Forme et corps communs à toutes les étiquettes du plan. */
  labels: PlanLabelStyle;
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
        transform: `translate(-50%, -50%)${sideways ? " rotate(90deg)" : ""}`,
      }}
      className="absolute"
    >
      {student ? (
        <SeatedStudent
          student={student}
          pinned={pinned}
          conflicted={conflicted}
          selected={selected}
          highlighted={isOver}
          metrics={metrics}
          labels={labels}
          onSelect={onSelect}
        />
      ) : (
        <div
          style={{
            borderRadius: metrics.radius,
            // Jamais plus gros que les noms — une place vide n'a pas à crier
            // plus fort qu'un élève — et rogné si « Condamnée », deux fois plus
            // long que « Libre », ne tenait pas dans la carte.
            fontSize: fittedSize(emptySeatLabel(seat), labels.font, textRoomPx(metrics)),
          }}
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
          {metrics.tiny ? "" : emptySeatLabel(seat)}
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
  labels,
  onSelect,
}: {
  student: StudentView;
  pinned: boolean;
  conflicted: boolean;
  selected: boolean;
  highlighted: boolean;
  metrics: SeatMetrics;
  labels: PlanLabelStyle;
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

  const text = seatLabelText(student, labels.form);

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
        // trois restent lisibles ensemble. `--elev-1` s'ajoute par-dessus pour
        // l'ombre nette décalée, comme sur toutes les autres surfaces.
        boxShadow: `inset 0 0 0 ${metrics.ring}px ${DIFFICULTY_COLORS[student.difficulty]}, var(--elev-1)`,
      }}
      className={cn(
        "relative flex h-full w-full items-center overflow-hidden border-2 transition-colors",
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
        style={{ paddingInline: metrics.ring + LABEL_PADDING_PX * metrics.unit }}
        className="flex h-full w-full cursor-grab flex-col items-center justify-center overflow-hidden text-center leading-tight active:cursor-grabbing"
      >
        {/* « Camille M. », sur toute la largeur. Forme et corps sont ceux du
            PLAN ENTIER, pas de cette carte : tous les élèves s'écrivent de la
            même taille, et c'est le nom le plus long de la classe qui l'a
            fixée. */}
        {text && (
          <span className="w-full truncate font-medium" style={{ fontSize: labels.font }}>
            {text}
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
