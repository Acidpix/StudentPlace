import { describe, expect, it } from "vitest";

import { OBJECT_DEFAULT_SIZE, TABLE_WIDTH_PER_SEAT_CM, tableWidthForSeats } from "@/lib/domain";
import { seatFootprintCm } from "./geometry";
import {
  generatePresetLayout,
  LAYOUT_PRESET_IDS,
  type LayoutPresetId,
  type PresetObject,
} from "./layout-presets";

/** Salle par défaut du formulaire de création : 9 m sur 7 m. */
const ROOM = { widthCm: 900, heightCm: 700 };

/**
 * Une salle assez grande pour loger une classe entière AU BARÈME.
 *
 * Les dispositions types ne rétrécissent plus les tables : une table de deux
 * places fait `tableWidthForSeats(2)`, point. La salle par défaut n'en aligne
 * donc que deux ou trois de front — tout ce qui vérifie une CAPACITÉ se mesure
 * ici, ce qui vérifie un PLACEMENT reste sur la salle par défaut.
 */
const BIG_ROOM = { widthCm: 1400, heightCm: 1000 };

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

/** Ce que `seatFootprintCm` attend d'une table : sa taille et son occupation. */
function tableSpansOf(tables: PresetObject[]) {
  return tables
    .filter((table) => table.seatCount > 0)
    .map((table) => ({ widthCm: table.widthCm, heightCm: table.heightCm, seatCount: table.seatCount }));
}

describe("dispositions types", () => {
  it.each(LAYOUT_PRESET_IDS)("garde tout le mobilier dans la salle (%s)", (preset) => {
    for (const room of [ROOM, BIG_ROOM]) {
      const { tables, fixtures } = generatePresetLayout(preset, room, 30);

      for (const object of [...tables, ...fixtures]) {
        const bounds = boundsOf(object);
        expect(bounds.left).toBeGreaterThanOrEqual(0);
        expect(bounds.top).toBeGreaterThanOrEqual(0);
        expect(bounds.right).toBeLessThanOrEqual(room.widthCm);
        expect(bounds.bottom).toBeLessThanOrEqual(room.heightCm);
      }
    }
  });

  it.each(LAYOUT_PRESET_IDS)("ne superpose jamais deux tables (%s)", (preset) => {
    for (const room of [ROOM, BIG_ROOM]) {
      const { tables } = generatePresetLayout(preset, room, 30);

      for (let i = 0; i < tables.length; i++) {
        for (let j = i + 1; j < tables.length; j++) {
          const a = boundsOf(tables[i]);
          const b = boundsOf(tables[j]);
          const overlaps = a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
          expect(overlaps).toBe(false);
        }
      }
    }
  });

  it.each(LAYOUT_PRESET_IDS)("donne aux étiquettes l'emprise du barème (%s)", (preset) => {
    // L'étiquette a toujours la largeur d'une place — largeur de la table ÷
    // nombre de places — et la hauteur de sa table. Comme les dispositions
    // types posent des tables AU BARÈME, l'emprise vaut exactement le barème,
    // quelle que soit l'étroitesse de la salle.
    for (const room of [ROOM, BIG_ROOM]) {
      const footprint = seatFootprintCm(tableSpansOf(generatePresetLayout(preset, room, 30).tables));

      expect(footprint.widthCm).toBe(TABLE_WIDTH_PER_SEAT_CM);
      expect(footprint.heightCm).toBe(OBJECT_DEFAULT_SIZE.TABLE.heightCm);
    }
  });

  it.each(LAYOUT_PRESET_IDS)("pose toujours des tables au barème (%s)", (preset) => {
    // Aucun rétrécissement, dans aucune salle : une table de disposition type
    // a les cotes par défaut d'une table de deux places. La salle trop petite
    // se paie en places manquantes, pas en noms illisibles.
    for (const room of [ROOM, BIG_ROOM, { widthCm: 400, heightCm: 400 }]) {
      for (const table of generatePresetLayout(preset, room, 30).tables) {
        expect(table.widthCm).toBe(tableWidthForSeats(2));
        expect(table.heightCm).toBe(OBJECT_DEFAULT_SIZE.TABLE.heightCm);
      }
    }
  });

  it("remplit les rangées jusqu'au nombre de places demandé", () => {
    const result = generatePresetLayout("ROWS", BIG_ROOM, 30);

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

  it("pose un îlot distinct de la base, au centre du U", () => {
    const { tables } = generatePresetLayout("U_SHAPE_ISLAND", ROOM, 12);

    // Les tables droites (non pivotées) sont soit la base du U, soit l'îlot :
    // deux rangs distincts signalent que l'îlot a bien été posé à part.
    const straightRows = new Set(tables.filter((table) => table.rotation === 0).map((table) => table.y));
    expect(straightRows.size).toBeGreaterThanOrEqual(2);

    // Toujours joint quand il compte deux tables.
    const island = tables.filter(
      (table) => table.rotation === 0 && table.y !== Math.max(...[...straightRows]),
    );
    if (island.length === 2) {
      expect(island[0].x).toBe(island[1].x);
      expect(Math.abs(island[1].y - island[0].y)).toBe(island[0].heightCm);
    }
  });

  it("emboîte un second U quand la classe déborde du premier", () => {
    // Au barème, un fer à cheval unique plafonne vite : il faut une grande
    // salle pour qu'un second anneau ait la place de s'emboîter.
    const single = generatePresetLayout("U_SHAPE", BIG_ROOM, 12);
    const nested = generatePresetLayout("U_SHAPE", BIG_ROOM, 28);

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
