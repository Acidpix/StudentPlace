import { describe, expect, it } from "vitest";

import { solveSeating } from "./solver";
import type { SolverInput, SolverSeat, SolverStudent } from "./types";

/**
 * Salle de test : quatre tables de deux places.
 *
 *   Table 0        Table 1
 *   [A][B]         [C][D]        y = 100
 *
 *   Table 2        Table 3
 *   [E][F]         [G][H]        y = 300
 *
 * Deux places d'une même table sont à 65 cm : sous le seuil de proximité de
 * 120 cm, elles déclenchent donc un conflit entre incompatibles. Deux places
 * de tables voisines sont à 235 cm au minimum : toujours acceptables.
 */
function buildSeats(): SolverSeat[] {
  const seats: SolverSeat[] = [];
  const tables = [
    { x: 100, y: 100 },
    { x: 400, y: 100 },
    { x: 100, y: 300 },
    { x: 400, y: 300 },
  ];

  tables.forEach((table, tableIndex) => {
    for (let seat = 0; seat < 2; seat++) {
      seats.push({
        id: `s${tableIndex}-${seat}`,
        x: table.x + seat * 65,
        y: table.y,
        isEndSeat: true,
      });
    }
  });

  return seats;
}

function buildStudents(count: number, difficulty = 1): SolverStudent[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `e${index}`,
    difficulty,
    needsFront: false,
    leftHanded: false,
  }));
}

function baseInput(overrides: Partial<SolverInput> = {}): SolverInput {
  return {
    seats: buildSeats(),
    students: buildStudents(8),
    incompatibles: [],
    affinities: [],
    pinned: {},
    teacherDesk: { x: 315, y: 0 },
    proximityCm: 120,
    seed: 42,
    ...overrides,
  };
}

/** Distance entre les places de deux élèves dans un résultat. */
function distanceBetween(
  result: ReturnType<typeof solveSeating>,
  seats: SolverSeat[],
  studentA: string,
  studentB: string,
): number {
  const seatOf = (id: string) => {
    const assignment = result.assignments.find((a) => a.studentId === id);
    return seats.find((s) => s.id === assignment?.seatId);
  };
  const a = seatOf(studentA);
  const b = seatOf(studentB);
  if (!a || !b) return Number.POSITIVE_INFINITY;
  return Math.hypot(a.x - b.x, a.y - b.y);
}

describe("solveSeating", () => {
  it("place tous les élèves quand il y a assez de places", () => {
    const result = solveSeating(baseInput());

    expect(result.assignments).toHaveLength(8);
    expect(result.unplacedStudentIds).toHaveLength(0);
    expect(new Set(result.assignments.map((a) => a.seatId)).size).toBe(8);
    expect(new Set(result.assignments.map((a) => a.studentId)).size).toBe(8);
  });

  it("n'assoit jamais deux élèves incompatibles côte à côte quand une solution existe", () => {
    const seats = buildSeats();
    const result = solveSeating(
      baseInput({
        seats,
        incompatibles: [{ a: "e0", b: "e1" }],
      }),
    );

    expect(distanceBetween(result, seats, "e0", "e1")).toBeGreaterThanOrEqual(120);
    expect(result.violations.filter((v) => v.kind === "INCOMPATIBLE_TOO_CLOSE")).toHaveLength(0);
  });

  it("respecte plusieurs incompatibilités simultanées", () => {
    const seats = buildSeats();
    const result = solveSeating(
      baseInput({
        seats,
        incompatibles: [
          { a: "e0", b: "e1" },
          { a: "e2", b: "e3" },
          { a: "e4", b: "e5" },
        ],
      }),
    );

    expect(distanceBetween(result, seats, "e0", "e1")).toBeGreaterThanOrEqual(120);
    expect(distanceBetween(result, seats, "e2", "e3")).toBeGreaterThanOrEqual(120);
    expect(distanceBetween(result, seats, "e4", "e5")).toBeGreaterThanOrEqual(120);
  });

  it("laisse les places verrouillées exactement où elles sont", () => {
    const result = solveSeating(
      baseInput({
        pinned: { e3: "s3-1", e5: "s0-0" },
      }),
    );

    const assignmentOf = (id: string) => result.assignments.find((a) => a.studentId === id);

    expect(assignmentOf("e3")?.seatId).toBe("s3-1");
    expect(assignmentOf("e5")?.seatId).toBe("s0-0");
    expect(assignmentOf("e3")?.pinned).toBe(true);
  });

  it("rapproche du bureau les élèves les plus difficiles", () => {
    const seats = buildSeats();
    const students: SolverStudent[] = [
      ...Array.from({ length: 4 }, (_, i) => ({
        id: `dur${i}`,
        difficulty: 5,
        needsFront: false,
        leftHanded: false,
      })),
      ...Array.from({ length: 4 }, (_, i) => ({
        id: `calme${i}`,
        difficulty: 1,
        needsFront: false,
        leftHanded: false,
      })),
    ];

    const result = solveSeating(baseInput({ seats, students }));

    const desk = { x: 315, y: 0 };
    const meanDistance = (prefix: string) => {
      const distances = result.assignments
        .filter((a) => a.studentId.startsWith(prefix))
        .map((a) => {
          const seat = seats.find((s) => s.id === a.seatId)!;
          return Math.hypot(seat.x - desk.x, seat.y - desk.y);
        });
      return distances.reduce((sum, d) => sum + d, 0) / distances.length;
    };

    expect(meanDistance("dur")).toBeLessThan(meanDistance("calme"));
  });

  it("installe au premier rang les élèves qui en ont besoin", () => {
    const seats = buildSeats();
    const students = buildStudents(8);
    students[7] = { ...students[7], needsFront: true };

    const result = solveSeating(baseInput({ seats, students }));

    const seatId = result.assignments.find((a) => a.studentId === "e7")?.seatId;
    const seat = seats.find((s) => s.id === seatId);

    expect(seat?.y).toBe(100);
    expect(result.violations.filter((v) => v.kind === "NEEDS_FRONT_NOT_SATISFIED")).toHaveLength(0);
  });

  it("signale les élèves restés debout et garde les plus difficiles assis", () => {
    const students: SolverStudent[] = [
      ...buildStudents(8, 5).map((s) => ({ ...s, id: `dur-${s.id}` })),
      ...buildStudents(2, 1).map((s) => ({ ...s, id: `calme-${s.id}` })),
    ];

    const result = solveSeating(baseInput({ students }));

    expect(result.unplacedStudentIds).toHaveLength(2);
    expect(result.unplacedStudentIds.every((id) => id.startsWith("calme-"))).toBe(true);
    expect(result.violations.some((v) => v.kind === "NOT_ENOUGH_SEATS")).toBe(true);
  });

  it("signale une incompatibilité impossible à satisfaire au lieu de la masquer", () => {
    // Une seule table de deux places, deux élèves qui ne peuvent pas se voir :
    // il n'existe aucune solution, le solveur doit le dire.
    const seats: SolverSeat[] = [
      { id: "a", x: 100, y: 100, isEndSeat: true },
      { id: "b", x: 165, y: 100, isEndSeat: true },
    ];

    const result = solveSeating(
      baseInput({
        seats,
        students: buildStudents(2),
        incompatibles: [{ a: "e0", b: "e1" }],
      }),
    );

    expect(result.violations.some((v) => v.kind === "INCOMPATIBLE_TOO_CLOSE")).toBe(true);
  });

  it("produit exactement le même plan pour une même graine", () => {
    const input = baseInput({ seed: 1234, incompatibles: [{ a: "e0", b: "e1" }] });

    const first = solveSeating(input);
    const second = solveSeating(input);

    expect(second.assignments).toEqual(first.assignments);
  });

  it("gère une salle sans aucune place", () => {
    const result = solveSeating(baseInput({ seats: [], students: buildStudents(3) }));

    expect(result.assignments).toHaveLength(0);
    expect(result.unplacedStudentIds).toHaveLength(3);
    expect(result.violations[0].kind).toBe("NOT_ENOUGH_SEATS");
  });

  it("rapproche les élèves ayant une affinité", () => {
    const seats = buildSeats();
    const result = solveSeating(
      baseInput({
        seats,
        affinities: [{ a: "e0", b: "e1" }],
      }),
    );

    // Une affinité satisfaite signifie partager une table (65 cm).
    expect(distanceBetween(result, seats, "e0", "e1")).toBeLessThanOrEqual(90);
  });
});
