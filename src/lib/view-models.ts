import type { Difficulty, ObjectKind, RelationType } from "@/lib/domain";

/**
 * Formes de données transmises du serveur vers les composants clients.
 *
 * Elles ne reprennent jamais les modèles Prisma tels quels : les commentaires
 * y sont déjà déchiffrés, les champs inutiles à l'affichage sont écartés, et
 * les chaînes libres du schéma (kind, type) sont ici correctement typées.
 */

export interface StudentView {
  id: string;
  firstName: string;
  lastName: string;
  comment: string;
  difficulty: Difficulty;
  needsFront: boolean;
  leftHanded: boolean;
}

export interface RelationView {
  id: string;
  studentAId: string;
  studentBId: string;
  type: RelationType;
}

export interface SeatView {
  id: string;
  x: number;
  y: number;
  label: string | null;
  disabled: boolean;
  isEndSeat: boolean;
}

export interface RoomObjectView {
  id: string;
  kind: ObjectKind;
  x: number;
  y: number;
  widthCm: number;
  heightCm: number;
  rotation: number;
  label: string | null;
  seats: SeatView[];
}

export interface RoomView {
  id: string;
  name: string;
  widthCm: number;
  heightCm: number;
  objects: RoomObjectView[];
}

export interface AssignmentView {
  seatId: string;
  studentId: string;
  pinned: boolean;
}

export function studentFullName(student: Pick<StudentView, "firstName" | "lastName">): string {
  return `${student.firstName} ${student.lastName}`;
}

/** Étiquette courte pour une place : prénom, et initiale du nom si besoin. */
export function studentShortName(student: Pick<StudentView, "firstName" | "lastName">): string {
  return `${student.firstName} ${student.lastName.charAt(0).toUpperCase()}.`;
}
