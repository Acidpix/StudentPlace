import { describe, expect, it } from "vitest";

import { centerOf, distanceCm, generateSeatPositions, localToAbsolute, snapToGrid } from "./geometry";

const table = { x: 0, y: 0, widthCm: 120, heightCm: 40, rotation: 0 };

describe("géométrie", () => {
  it("situe le centre d'un meuble", () => {
    expect(centerOf({ ...table, x: 100, y: 50 })).toEqual({ x: 160, y: 70 });
  });

  it("laisse les coordonnées inchangées sans rotation", () => {
    const point = localToAbsolute({ ...table, x: 10, y: 20 }, { x: 30, y: 20 });
    expect(point.x).toBeCloseTo(40);
    expect(point.y).toBeCloseTo(40);
  });

  it("fait pivoter autour du centre du meuble", () => {
    const rotated = localToAbsolute({ ...table, rotation: 90 }, { x: 30, y: 20 });
    // Centre (60, 20) ; le point est 30 cm à sa gauche, il passe 30 cm au-dessus.
    expect(rotated.x).toBeCloseTo(60);
    expect(rotated.y).toBeCloseTo(-10);
  });

  it("revient au point de départ après quatre quarts de tour", () => {
    // La table est à l'origine : repère local et repère absolu coïncident,
    // on peut donc réappliquer la rotation sur son propre résultat.
    const original = { x: 30, y: 20 };
    let point = original;
    for (let quarter = 0; quarter < 4; quarter++) {
      point = localToAbsolute({ ...table, rotation: 90 }, point);
    }
    expect(point.x).toBeCloseTo(original.x, 5);
    expect(point.y).toBeCloseTo(original.y, 5);
  });

  it("répartit régulièrement les places sur une table", () => {
    const seats = generateSeatPositions(table, 2);

    expect(seats).toHaveLength(2);
    expect(seats[0]).toMatchObject({ x: 30, y: 20, isEndSeat: true });
    expect(seats[1]).toMatchObject({ x: 90, y: 20, isEndSeat: true });
  });

  it("ne compte comme extrémités que la première et la dernière place", () => {
    const seats = generateSeatPositions(table, 3);

    expect(seats.map((s) => s.isEndSeat)).toEqual([true, false, true]);
  });

  it("place correctement les places d'une table pivotée", () => {
    const seats = generateSeatPositions({ ...table, rotation: 90 }, 2);

    expect(seats[0]).toMatchObject({ x: 60, y: -10 });
    expect(seats[1]).toMatchObject({ x: 60, y: 50 });
  });

  it("ne renvoie aucune place pour une table sans siège", () => {
    expect(generateSeatPositions(table, 0)).toEqual([]);
  });

  it("mesure les distances", () => {
    expect(distanceCm({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(5);
  });

  it("aimante sur la grille", () => {
    expect(snapToGrid(47, 10)).toBe(50);
    expect(snapToGrid(44, 10)).toBe(40);
  });
});
