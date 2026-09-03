import { describe, expect, it } from "vitest";

import { OBJECT_DEFAULT_SIZE, TABLE_WIDTH_PER_SEAT_CM } from "@/lib/domain";
import { centerOf, distanceCm, generateSeatPositions, localToAbsolute, seatFootprintCm, snapToGrid } from "./geometry";

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

  it("donne à l'étiquette le pas d'une place et la hauteur de la table", () => {
    const footprint = seatFootprintCm([{ widthCm: 340, heightCm: 45, seatCount: 2 }]);
    expect(footprint.widthCm).toBe(170);
    expect(footprint.heightCm).toBe(45);
  });

  it("retient le pas et la hauteur les plus petits parmi les tables occupées", () => {
    const footprint = seatFootprintCm([
      { widthCm: 340, heightCm: 45, seatCount: 2 },
      { widthCm: 220, heightCm: 40, seatCount: 2 },
    ]);
    expect(footprint.widthCm).toBe(110);
    expect(footprint.heightCm).toBe(40);
  });

  it("ignore les tables sans place", () => {
    const footprint = seatFootprintCm([{ widthCm: 100, heightCm: 20, seatCount: 0 }]);
    expect(footprint.widthCm).toBe(TABLE_WIDTH_PER_SEAT_CM);
    expect(footprint.heightCm).toBe(OBJECT_DEFAULT_SIZE.TABLE.heightCm);
  });

  it("retombe sur le pas et la hauteur par défaut en l'absence de table", () => {
    const footprint = seatFootprintCm([]);
    expect(footprint.widthCm).toBe(TABLE_WIDTH_PER_SEAT_CM);
    expect(footprint.heightCm).toBe(OBJECT_DEFAULT_SIZE.TABLE.heightCm);
  });
});
