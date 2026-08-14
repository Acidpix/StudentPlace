import { describe, expect, it } from "vitest";

import {
  assignToSeat,
  keepOnlyPinned,
  pinnedMap,
  seatOfStudent,
  toSeatAssignments,
  togglePin,
  unassignStudent,
  unassignedStudents,
  type SeatAssignments,
  type SeatOccupant,
} from "./plan-state";
import type { StudentView } from "./view-models";

function build(entries: Array<[string, string, boolean?]>): SeatAssignments {
  return new Map(
    entries.map(([seatId, studentId, pinned]): [string, SeatOccupant] => [
      seatId,
      { studentId, pinned: pinned ?? false },
    ]),
  );
}

const students: StudentView[] = ["a", "b", "c"].map((id) => ({
  id,
  firstName: id.toUpperCase(),
  lastName: "Test",
  comment: "",
  difficulty: 1,
  needsFront: false,
  leftHanded: false,
}));

describe("état d'un plan", () => {
  it("assoit un élève sur une place libre", () => {
    const result = assignToSeat(build([]), "a", "s1");

    expect(result.get("s1")).toEqual({ studentId: "a", pinned: false });
  });

  it("échange deux élèves déjà assis", () => {
    const result = assignToSeat(build([["s1", "a"], ["s2", "b"]]), "a", "s2");

    expect(result.get("s2")?.studentId).toBe("a");
    expect(result.get("s1")?.studentId).toBe("b");
    expect(result.size).toBe(2);
  });

  it("renvoie au bac l'élève délogé par quelqu'un venu du bac", () => {
    const result = assignToSeat(build([["s1", "a"]]), "b", "s1");

    expect(result.get("s1")?.studentId).toBe("b");
    expect(seatOfStudent(result, "a")).toBeNull();
    expect(result.size).toBe(1);
  });

  it("ne change rien si l'élève est déjà à cette place", () => {
    const before = build([["s1", "a"], ["s2", "b"]]);
    const result = assignToSeat(before, "a", "s1");

    expect([...result]).toEqual([...before]);
  });

  it("déplace un élève sans laisser de trace à son ancienne place", () => {
    const result = assignToSeat(build([["s1", "a"]]), "a", "s2");

    expect(result.has("s1")).toBe(false);
    expect(result.get("s2")?.studentId).toBe("a");
  });

  it("conserve le verrouillage lorsqu'un élève verrouillé est déplacé", () => {
    const result = assignToSeat(build([["s1", "a", true]]), "a", "s2");

    expect(result.get("s2")).toEqual({ studentId: "a", pinned: true });
  });

  it("ne modifie jamais la Map d'origine", () => {
    const before = build([["s1", "a"]]);
    assignToSeat(before, "b", "s2");

    expect(before.size).toBe(1);
  });

  it("retire un élève du plan", () => {
    const result = unassignStudent(build([["s1", "a"], ["s2", "b"]]), "a");

    expect(result.size).toBe(1);
    expect(seatOfStudent(result, "a")).toBeNull();
  });

  it("bascule le verrouillage d'une place", () => {
    const locked = togglePin(build([["s1", "a"]]), "s1");
    expect(locked.get("s1")?.pinned).toBe(true);

    expect(togglePin(locked, "s1").get("s1")?.pinned).toBe(false);
  });

  it("ne garde que les places verrouillées", () => {
    const result = keepOnlyPinned(build([["s1", "a", true], ["s2", "b"], ["s3", "c", true]]));

    expect([...result.keys()].sort()).toEqual(["s1", "s3"]);
  });

  it("liste les élèves non placés", () => {
    const result = unassignedStudents(students, build([["s1", "b"]]));

    expect(result.map((student) => student.id)).toEqual(["a", "c"]);
  });

  it("exporte les verrouillages pour le solveur", () => {
    expect(pinnedMap(build([["s1", "a", true], ["s2", "b"]]))).toEqual({ a: "s1" });
  });

  it("convertit une liste d'affectations en Map", () => {
    const result = toSeatAssignments([{ seatId: "s1", studentId: "a", pinned: true }]);

    expect(result.get("s1")).toEqual({ studentId: "a", pinned: true });
  });
});
