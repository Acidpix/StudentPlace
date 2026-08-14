import type { AssignmentView, StudentView } from "@/lib/view-models";

/**
 * État d'un plan côté client : quelle place est occupée par quel élève.
 *
 * Ces fonctions sont PURES et renvoient toujours une nouvelle Map. Elles
 * concentrent la logique délicate du placement manuel — l'échange de deux
 * élèves, notamment — hors des composants, où elle serait mêlée aux
 * évènements de glisser-déposer et impossible à vérifier.
 */

export interface SeatOccupant {
  studentId: string;
  pinned: boolean;
}

export type SeatAssignments = Map<string, SeatOccupant>;

export function toSeatAssignments(assignments: AssignmentView[]): SeatAssignments {
  return new Map(
    assignments.map((assignment): [string, SeatOccupant] => [
      assignment.seatId,
      { studentId: assignment.studentId, pinned: assignment.pinned },
    ]),
  );
}

export function toAssignmentList(assignments: SeatAssignments): AssignmentView[] {
  return [...assignments].map(([seatId, occupant]) => ({
    seatId,
    studentId: occupant.studentId,
    pinned: occupant.pinned,
  }));
}

export function seatOfStudent(assignments: SeatAssignments, studentId: string): string | null {
  for (const [seatId, occupant] of assignments) {
    if (occupant.studentId === studentId) return seatId;
  }
  return null;
}

/**
 * Assoit un élève à une place.
 *
 * Si la place est déjà occupée, les deux élèves ÉCHANGENT leurs positions —
 * c'est le geste attendu quand on fait glisser un élève sur un autre. Si
 * l'arrivant venait du bac des non-placés, l'occupant y retourne.
 *
 * Le verrouillage suit l'élève, pas la place : une place épinglée l'est parce
 * que le professeur veut cet élève-là à cet endroit-là.
 */
export function assignToSeat(
  assignments: SeatAssignments,
  studentId: string,
  seatId: string,
): SeatAssignments {
  const next = new Map(assignments);

  const previousSeatId = seatOfStudent(assignments, studentId);
  if (previousSeatId === seatId) return next;

  const movingPinned = previousSeatId ? (assignments.get(previousSeatId)?.pinned ?? false) : false;
  const displaced = assignments.get(seatId);

  if (previousSeatId) next.delete(previousSeatId);

  if (displaced && previousSeatId) {
    next.set(previousSeatId, displaced);
  }

  next.set(seatId, { studentId, pinned: movingPinned });
  return next;
}

/** Renvoie l'élève au bac des non-placés. */
export function unassignStudent(assignments: SeatAssignments, studentId: string): SeatAssignments {
  const seatId = seatOfStudent(assignments, studentId);
  if (!seatId) return assignments;

  const next = new Map(assignments);
  next.delete(seatId);
  return next;
}

export function togglePin(assignments: SeatAssignments, seatId: string): SeatAssignments {
  const occupant = assignments.get(seatId);
  if (!occupant) return assignments;

  const next = new Map(assignments);
  next.set(seatId, { ...occupant, pinned: !occupant.pinned });
  return next;
}

/** Ne conserve que les verrouillages : base d'un nouveau placement automatique. */
export function keepOnlyPinned(assignments: SeatAssignments): SeatAssignments {
  return new Map([...assignments].filter(([, occupant]) => occupant.pinned));
}

export function unassignedStudents(
  students: StudentView[],
  assignments: SeatAssignments,
): StudentView[] {
  const seated = new Set([...assignments.values()].map((occupant) => occupant.studentId));
  return students.filter((student) => !seated.has(student.id));
}

/** Verrouillages au format attendu par le solveur : studentId -> seatId. */
export function pinnedMap(assignments: SeatAssignments): Record<string, string> {
  const pinned: Record<string, string> = {};
  for (const [seatId, occupant] of assignments) {
    if (occupant.pinned) pinned[occupant.studentId] = seatId;
  }
  return pinned;
}
