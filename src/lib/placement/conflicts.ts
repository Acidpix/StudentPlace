import { distanceCm } from "./geometry";

/**
 * Détection des conflits de proximité, utilisée en direct par l'éditeur de
 * placement : à chaque déplacement d'élève, on recalcule quelles paires
 * incompatibles se retrouvent trop près l'une de l'autre.
 *
 * Séparé du solveur pour rester très léger : ce module est importé par le
 * navigateur à chaque rendu, le solveur seulement à la demande.
 */

export interface ProximityConflict {
  studentAId: string;
  studentBId: string;
  seatAId: string;
  seatBId: string;
  distanceCm: number;
}

export function findProximityConflicts(params: {
  seats: Array<{ id: string; x: number; y: number }>;
  /** seatId -> studentId */
  assignments: Map<string, string>;
  incompatibles: Array<{ a: string; b: string }>;
  proximityCm: number;
}): ProximityConflict[] {
  const { seats, assignments, incompatibles, proximityCm } = params;

  type Seat = (typeof seats)[number];
  const seatById = new Map(seats.map((seat): [string, Seat] => [seat.id, seat]));

  // studentId -> seatId
  const seatOfStudent = new Map<string, string>();
  for (const [seatId, studentId] of assignments) {
    seatOfStudent.set(studentId, seatId);
  }

  const conflicts: ProximityConflict[] = [];

  for (const { a, b } of incompatibles) {
    const seatAId = seatOfStudent.get(a);
    const seatBId = seatOfStudent.get(b);
    if (!seatAId || !seatBId) continue;

    const seatA = seatById.get(seatAId);
    const seatB = seatById.get(seatBId);
    if (!seatA || !seatB) continue;

    const distance = distanceCm(seatA, seatB);
    if (distance < proximityCm) {
      conflicts.push({
        studentAId: a,
        studentBId: b,
        seatAId,
        seatBId,
        distanceCm: Math.round(distance),
      });
    }
  }

  return conflicts;
}

/** Identifiants des places impliquées dans au moins un conflit. */
export function conflictingSeatIds(conflicts: ProximityConflict[]): Set<string> {
  const ids = new Set<string>();
  for (const conflict of conflicts) {
    ids.add(conflict.seatAId);
    ids.add(conflict.seatBId);
  }
  return ids;
}
