/**
 * Types du moteur de placement.
 *
 * Volontairement découplés de Prisma et composés uniquement de valeurs
 * simples : ces objets traversent la frontière du Web Worker, qui les copie
 * par sérialisation structurée.
 */

export interface SolverSeat {
  id: string;
  x: number;
  y: number;
  /** Place en extrémité de table (confort des gauchers). */
  isEndSeat: boolean;
}

export interface SolverStudent {
  id: string;
  /** 1 (aucune difficulté) à 5 (très perturbateur). */
  difficulty: number;
  needsFront: boolean;
  leftHanded: boolean;
}

export interface SolverPair {
  a: string;
  b: string;
}

export interface SolverWeights {
  /** Contrainte dure : deux incompatibles trop proches. */
  incompatible: number;
  /** Contrainte dure : élève devant être au premier rang. */
  needsFront: number;
  /** Rapprocher du bureau à mesure que la difficulté augmente. */
  proximityToDesk: number;
  /** Éviter que deux élèves difficiles soient voisins. */
  isolation: number;
  /** Éviter qu'un élève difficile ait beaucoup de voisins. */
  isolationNeighbours: number;
  /** Rapprocher les élèves ayant une affinité. */
  affinity: number;
  /** Placer les gauchers en bout de table. */
  leftHanded: number;
}

export const DEFAULT_WEIGHTS: SolverWeights = {
  incompatible: 12000,
  needsFront: 5000,
  proximityToDesk: 150,
  isolation: 300,
  isolationNeighbours: 60,
  affinity: 100,
  leftHanded: 20,
};

export interface SolverInput {
  seats: SolverSeat[];
  students: SolverStudent[];
  incompatibles: SolverPair[];
  affinities: SolverPair[];
  /** Affectations verrouillées, sous la forme studentId -> seatId. */
  pinned: Record<string, string>;
  /** Position du bureau du professeur ; absent, la salle n'a pas de bureau. */
  teacherDesk: { x: number; y: number } | null;
  /** Seuil d'alerte de proximité entre incompatibles, en centimètres. */
  proximityCm: number;
  /** Distance en deçà de laquelle deux places sont voisines. */
  adjacencyCm?: number;
  weights?: Partial<SolverWeights>;
  /** Graine du générateur aléatoire : une même graine donne un même plan. */
  seed?: number;
  iterations?: number;
  restarts?: number;
}

export type ViolationKind =
  | "INCOMPATIBLE_TOO_CLOSE"
  | "NEEDS_FRONT_NOT_SATISFIED"
  | "NOT_ENOUGH_SEATS";

export interface Violation {
  kind: ViolationKind;
  message: string;
  studentIds: string[];
  seatIds: string[];
}

export interface SolverAssignment {
  seatId: string;
  studentId: string;
  pinned: boolean;
}

export interface SolverResult {
  assignments: SolverAssignment[];
  /** Élèves qu'aucune place n'a pu accueillir (salle trop petite). */
  unplacedStudentIds: string[];
  /** Contraintes dures que la disposition n'a pas permis de satisfaire. */
  violations: Violation[];
  cost: number;
  seed: number;
  durationMs: number;
}
