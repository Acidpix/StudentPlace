import { describe, expect, it } from "vitest";

import { OBJECT_DEFAULT_SIZE, TABLE_WIDTH_PER_SEAT_CM, tableWidthForSeats } from "@/lib/domain";
import { seatFootprintCm } from "./geometry";
import {
  generatePresetLayout,
  LAYOUT_PRESET_IDS,
  PRESET_SEAT_COUNTS,
  type LayoutPresetId,
  type PresetObject,
  type PresetSeatCount,
} from "./layout-presets";

/** Salle par défaut du formulaire de création : 9 m sur 7 m. */
const ROOM = { widthCm: 900, heightCm: 700 };

/**
 * Une salle assez grande pour loger une classe entière AU BARÈME.
 *
 * Les dispositions types ne rétrécissent plus les tables : une table de deux
 * places fait `tableWidthForSeats(2)`, point. Tout ce qui vérifie une CAPACITÉ
 * se mesure ici, ce qui vérifie un PLACEMENT reste sur la salle par défaut.
 */
const BIG_ROOM = { widthCm: 1400, heightCm: 1000 };

/** Trop petite pour la moindre disposition : sert à vérifier les replis. */
const TINY_ROOM = { widthCm: 400, heightCm: 400 };

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

function overlaps(a: PresetObject, b: PresetObject): boolean {
  const first = boundsOf(a);
  const second = boundsOf(b);
  return (
    first.left < second.right &&
    second.left < first.right &&
    first.top < second.bottom &&
    second.top < first.bottom
  );
}

/** Ce que `seatFootprintCm` attend d'une table : sa taille et son occupation. */
function tableSpansOf(tables: PresetObject[]) {
  return tables
    .filter((table) => table.seatCount > 0)
    .map((table) => ({ widthCm: table.widthCm, heightCm: table.heightCm, seatCount: table.seatCount }));
}

/**
 * Les tables d'îlot d'un « U avec îlot ».
 *
 * Les tables droites — non pivotées — sont soit la base du U, soit un îlot. La
 * base est toujours la plus PROFONDE : tout ce qui est droit et plus haut
 * qu'elle appartient à un îlot.
 */
function islandTablesOf(tables: PresetObject[]): PresetObject[] {
  const straight = tables.filter((table) => table.rotation === 0);
  if (straight.length === 0) return [];

  const baseY = Math.max(...straight.map((table) => table.y));
  return straight.filter((table) => table.y !== baseY);
}

/** Chaque disposition, avec chaque type de table. */
const CASES: Array<[LayoutPresetId, PresetSeatCount]> = LAYOUT_PRESET_IDS.flatMap((preset) =>
  PRESET_SEAT_COUNTS.map((seats): [LayoutPresetId, PresetSeatCount] => [preset, seats]),
);

describe("dispositions types", () => {
  it.each(CASES)("garde tout le mobilier dans la salle (%s, %i place(s))", (preset, seatsPerTable) => {
    for (const room of [ROOM, BIG_ROOM]) {
      const { tables, fixtures } = generatePresetLayout(preset, room, 30, {
        seatsPerTable,
        islandCount: 2,
      });

      for (const object of [...tables, ...fixtures]) {
        const bounds = boundsOf(object);
        expect(bounds.left).toBeGreaterThanOrEqual(0);
        expect(bounds.top).toBeGreaterThanOrEqual(0);
        expect(bounds.right).toBeLessThanOrEqual(room.widthCm);
        expect(bounds.bottom).toBeLessThanOrEqual(room.heightCm);
      }
    }
  });

  it.each(CASES)("ne superpose jamais deux tables (%s, %i place(s))", (preset, seatsPerTable) => {
    // Le pas d'aimantation vaut 10 cm, mais une table de une ou trois places en
    // mesure 115 ou 345 : aimanter deux voisines séparément les rapprochait de
    // 5 cm, donc les faisait se chevaucher là où elles devaient se TOUCHER.
    // C'est ce cas que ce test attrape (`tableRun`).
    for (const room of [ROOM, BIG_ROOM]) {
      const { tables } = generatePresetLayout(preset, room, 30, { seatsPerTable, islandCount: 3 });

      for (let i = 0; i < tables.length; i++) {
        for (let j = i + 1; j < tables.length; j++) {
          expect(overlaps(tables[i], tables[j])).toBe(false);
        }
      }
    }
  });

  it.each(CASES)("pose toujours des tables au barème (%s, %i place(s))", (preset, seatsPerTable) => {
    // Aucun rétrécissement, dans aucune salle : une table de disposition type a
    // les cotes par défaut d'une table du type choisi. La salle trop petite se
    // paie en places manquantes, pas en noms illisibles.
    for (const room of [ROOM, BIG_ROOM, TINY_ROOM]) {
      const layout = generatePresetLayout(preset, room, 30, { seatsPerTable, islandCount: 1 });

      for (const table of layout.tables) {
        expect(table.widthCm).toBe(tableWidthForSeats(seatsPerTable));
        expect(table.heightCm).toBe(OBJECT_DEFAULT_SIZE.TABLE.heightCm);
        expect(table.seatCount).toBe(seatsPerTable);
      }
    }
  });

  it.each(CASES)("donne aux étiquettes l'emprise du barème (%s, %i place(s))", (preset, seatsPerTable) => {
    // L'étiquette a toujours la largeur d'une place — largeur de la table ÷
    // nombre de places — et la hauteur de sa table. Le type de table ne change
    // donc RIEN à la taille des noms : c'est tout l'intérêt d'un barème par
    // place, et c'est ce qui permet d'offrir le choix sans piéger le professeur.
    for (const room of [ROOM, BIG_ROOM]) {
      const { tables } = generatePresetLayout(preset, room, 30, { seatsPerTable, islandCount: 1 });
      const footprint = seatFootprintCm(tableSpansOf(tables));

      expect(footprint.widthCm).toBe(TABLE_WIDTH_PER_SEAT_CM);
      expect(footprint.heightCm).toBe(OBJECT_DEFAULT_SIZE.TABLE.heightCm);
    }
  });

  it("remplit les rangées jusqu'au nombre de places demandé", () => {
    const result = generatePresetLayout("ROWS", BIG_ROOM, 30);

    expect(result.seatCount).toBe(30);
    expect(result.shortfall).toBe(0);
    // Le premier rang est complet, le dernier peut ne pas l'être.
    expect(result.tables).toHaveLength(15);
  });

  it("compte les places selon le type de table", () => {
    // Trente places demandées, c'est trente tables d'une place ou dix de trois.
    const single = generatePresetLayout("ROWS", BIG_ROOM, 30, { seatsPerTable: 1, islandCount: 0 });
    const triple = generatePresetLayout("ROWS", BIG_ROOM, 30, { seatsPerTable: 3, islandCount: 0 });

    expect(single.tables).toHaveLength(30);
    expect(triple.tables).toHaveLength(10);
    expect(single.seatCount).toBe(30);
    expect(triple.seatCount).toBe(30);
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
    // Une petite classe, pour n'obtenir qu'UN SEUL fer à cheval : « la base au
    // fond, l'ouverture vers le tableau » ne se vérifie que par anneau — la
    // base d'un U emboîté est forcément plus haute que les bras de celui qui
    // l'entoure.
    const { tables } = generatePresetLayout("U_SHAPE", ROOM, 10);

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
    const single = generatePresetLayout("U_SHAPE", BIG_ROOM, 12);
    const nested = generatePresetLayout("U_SHAPE", BIG_ROOM, 28);

    expect(nested.seatCount).toBeGreaterThan(single.seatCount);
    // Le U intérieur ne longe pas les murs : il commence plus loin du bord.
    const insets = nested.tables.map((table) => boundsOf(table).left);
    expect(new Set(insets).size).toBeGreaterThan(new Set(single.tables.map((t) => boundsOf(t).left)).size);
  });

  it("pose autant d'îlots que demandé quand le centre le permet", () => {
    const { tables } = generatePresetLayout("U_SHAPE_ISLAND", BIG_ROOM, 40, {
      seatsPerTable: 2,
      islandCount: 3,
    });
    const islands = islandTablesOf(tables);

    // Deux tables par îlot, jointes par leur grand côté.
    expect(islands).toHaveLength(6);
    for (let index = 0; index < islands.length; index += 2) {
      expect(islands[index].x).toBe(islands[index + 1].x);
      expect(islands[index + 1].y - islands[index].y).toBe(islands[index].heightCm);
    }
  });

  it("plafonne le nombre d'îlots à ce que l'ouverture du U peut loger", () => {
    // Des tables de trois places dans la salle par défaut : l'ouverture n'en
    // aligne qu'une de front, sur trois rangs. Six îlots demandés, trois posés.
    const { tables } = generatePresetLayout("U_SHAPE_ISLAND", ROOM, 30, {
      seatsPerTable: 3,
      islandCount: 6,
    });

    expect(islandTablesOf(tables)).toHaveLength(6);
  });

  it("rend un U simple quand on ne demande aucun îlot", () => {
    const { tables } = generatePresetLayout("U_SHAPE_ISLAND", ROOM, 20, {
      seatsPerTable: 2,
      islandCount: 0,
    });

    expect(islandTablesOf(tables)).toHaveLength(0);
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
    for (const preset of LAYOUT_PRESET_IDS) {
      const result = generatePresetLayout(preset as LayoutPresetId, TINY_ROOM, 60);
      expect(result.shortfall).toBe(60 - result.seatCount);
      expect(result.seatCount).toBeLessThan(60);
    }
  });

  it("borne le nombre de places demandé", () => {
    expect(generatePresetLayout("ROWS", ROOM, 0).seatCount).toBeGreaterThan(0);
    expect(generatePresetLayout("ROWS", ROOM, Number.NaN).seatCount).toBeGreaterThan(0);
  });
});
