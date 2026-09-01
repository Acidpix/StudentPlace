import { describe, expect, it } from "vitest";

import { distanceCm, generateSeatPositions } from "./geometry";
import {
  generatePresetLayout,
  LAYOUT_PRESET_IDS,
  type LayoutPresetId,
  type PresetObject,
} from "./layout-presets";

/** Salle par défaut du formulaire de création : 9 m sur 7 m. */
const ROOM = { widthCm: 900, heightCm: 700 };

/**
 * Emprise visuelle d'un meuble, rotation comprise. Un quart de tour échange
 * largeur et profondeur autour du centre, qui lui ne bouge pas.
 */
function boundsOf(object: PresetObject) {
  const cx = object.x + object.widthCm / 2;
  const cy = object.y + object.heightCm / 2;
  const halfWidth = (object.rotation % 180 === 0 ? object.widthCm : object.heightCm) / 2;
  const halfHeight = (object.rotation % 180 === 0 ? object.heightCm : object.widthCm) / 2;

  return { left: cx - halfWidth, right: cx + halfWidth, top: cy - halfHeight, bottom: cy + halfHeight };
}

function seatsOf(tables: PresetObject[]) {
  return tables.flatMap((table) => generateSeatPositions(table, table.seatCount));
}

describe("dispositions types", () => {
  it.each(LAYOUT_PRESET_IDS)("garde tout le mobilier dans la salle (%s)", (preset) => {
    const { tables, fixtures } = generatePresetLayout(preset, ROOM, 30);

    for (const object of [...tables, ...fixtures]) {
      const bounds = boundsOf(object);
      expect(bounds.left).toBeGreaterThanOrEqual(0);
      expect(bounds.top).toBeGreaterThanOrEqual(0);
      expect(bounds.right).toBeLessThanOrEqual(ROOM.widthCm);
      expect(bounds.bottom).toBeLessThanOrEqual(ROOM.heightCm);
    }
  });

  it.each(LAYOUT_PRESET_IDS)("ne superpose jamais deux tables (%s)", (preset) => {
    const { tables } = generatePresetLayout(preset, ROOM, 30);

    for (let i = 0; i < tables.length; i++) {
      for (let j = i + 1; j < tables.length; j++) {
        const a = boundsOf(tables[i]);
        const b = boundsOf(tables[j]);
        const overlaps = a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
        expect(overlaps).toBe(false);
      }
    }
  });

  it.each(LAYOUT_PRESET_IDS)("laisse aux étiquettes de quoi rester lisibles (%s)", (preset) => {
    // L'écartement des places décide de la taille des noms sur le plan de
    // classe : deux places à moins de 70 cm rendraient les cartes illisibles.
    const seats = seatsOf(generatePresetLayout(preset, ROOM, 30).tables);

    for (let i = 0; i < seats.length; i++) {
      for (let j = i + 1; j < seats.length; j++) {
        expect(distanceCm(seats[i], seats[j])).toBeGreaterThanOrEqual(70);
      }
    }
  });

  it("remplit les rangées jusqu'au nombre de places demandé", () => {
    const result = generatePresetLayout("ROWS", ROOM, 30);

    expect(result.seatCount).toBe(30);
    expect(result.shortfall).toBe(0);
    // Le premier rang est complet, le dernier peut ne pas l'être.
    expect(result.tables).toHaveLength(15);
  });

  it("centre le dernier rang incomplet", () => {
    const { tables } = generatePresetLayout("ROWS", ROOM, 10);
    const lastRowY = Math.max(...tables.map((table) => table.y));
    const lastRow = tables.filter((table) => table.y === lastRowY);

    const left = Math.min(...lastRow.map((table) => table.x));
    const right = Math.max(...lastRow.map((table) => table.x + table.widthCm));
    expect(left - 0).toBeCloseTo(ROOM.widthCm - right, 0);
  });

  it("dessine un U symétrique, ouvert vers le tableau", () => {
    const { tables } = generatePresetLayout("U_SHAPE", ROOM, 18);

    const arms = tables.filter((table) => table.rotation === 90);
    expect(arms.length).toBeGreaterThan(0);
    expect(arms.length % 2).toBe(0);

    // Chaque bras gauche a son symétrique à droite, à la même hauteur.
    const left = arms.filter((table) => boundsOf(table).left < ROOM.widthCm / 2);
    const right = arms.filter((table) => boundsOf(table).left >= ROOM.widthCm / 2);
    expect(left).toHaveLength(right.length);
    expect(left.map((table) => table.y).sort()).toEqual(right.map((table) => table.y).sort());

    // La base est au fond ; l'ouverture, donc, du côté du tableau.
    const base = tables.filter((table) => table.rotation === 0);
    const deepestArm = Math.max(...arms.map((table) => boundsOf(table).bottom));
    expect(Math.min(...base.map((table) => boundsOf(table).top))).toBeGreaterThan(deepestArm);
  });

  it("emboîte un second U quand la classe déborde du premier", () => {
    const single = generatePresetLayout("U_SHAPE", ROOM, 12);
    const nested = generatePresetLayout("U_SHAPE", ROOM, 28);

    expect(nested.seatCount).toBeGreaterThan(single.seatCount);
    // Le U intérieur ne longe pas les murs : il commence plus loin du bord.
    const insets = nested.tables.map((table) => boundsOf(table).left);
    expect(new Set(insets).size).toBeGreaterThan(new Set(single.tables.map((t) => boundsOf(t).left)).size);
  });

  it("compose les îlots par paires de tables", () => {
    const { tables, seatCount } = generatePresetLayout("ISLANDS", ROOM, 24);

    expect(tables.length % 2).toBe(0);
    expect(seatCount).toBe(24);

    // Les deux tables d'un îlot sont jointes par leur grand côté.
    for (let index = 0; index < tables.length; index += 2) {
      expect(tables[index].x).toBe(tables[index + 1].x);
      expect(tables[index + 1].y - tables[index].y).toBe(tables[index].heightCm);
    }
  });

  it("annonce ce qui ne tient pas plutôt que d'entasser", () => {
    const tiny = { widthCm: 400, heightCm: 400 };

    for (const preset of LAYOUT_PRESET_IDS) {
      const result = generatePresetLayout(preset as LayoutPresetId, tiny, 60);
      expect(result.shortfall).toBe(60 - result.seatCount);
      expect(result.seatCount).toBeLessThan(60);
    }
  });

  it("borne le nombre de places demandé", () => {
    expect(generatePresetLayout("ROWS", ROOM, 0).seatCount).toBeGreaterThan(0);
    expect(generatePresetLayout("ROWS", ROOM, Number.NaN).seatCount).toBeGreaterThan(0);
  });
});
