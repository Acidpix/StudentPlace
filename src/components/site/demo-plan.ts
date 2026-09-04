import type { FurnitureRect } from "@/components/room/furniture";
import { OBJECT_DEFAULT_SIZE, TABLE_DEPTH_CM, tableWidthForSeats } from "@/lib/domain";
import { generateSeatPositions } from "@/lib/placement/geometry";
import type { StudentView } from "@/lib/view-models";

/**
 * La classe de démonstration des pages publiques.
 *
 * ÉCRITE EN DUR, et non produite par `generatePresetLayout()`. Le générateur de
 * dispositions types cherche à loger un effectif dans une salle et peut rendre
 * un `shortfall` — moins de places que demandé — si son réglage évolue : une
 * page d'accueil qui perdrait la moitié de ses élèves au fil d'un ajustement du
 * solveur serait un défaut invisible en test et bien visible en production. Ici
 * la salle ne change jamais, donc rien ne peut se dérégler.
 *
 * Les COTES DES TABLES, elles, restent dérivées du barème du domaine
 * (`tableWidthForSeats`, `TABLE_DEPTH_CM`) : l'aperçu doit montrer des tables de
 * la taille exacte de celles que l'application pose, sinon les étiquettes de la
 * vitrine n'auraient pas les proportions de celles du produit. C'est le seul
 * point où ce fichier a le droit de dépendre d'ailleurs.
 *
 * Aucune donnée réelle : les dix-huit élèves sont inventés, et leurs
 * comportements couvrent les cinq niveaux pour que le cerclage des étiquettes
 * montre toute l'échelle.
 */

export const DEMO_ROOM = { widthCm: 800, heightCm: 480 } as const;

const TABLE_WIDTH_CM = tableWidthForSeats(2); // 230 cm
const SEATS_PER_TABLE = 2;

/**
 * Abscisses des trois colonnes de tables, et ordonnées des trois rangées.
 *
 * La largeur de la salle en découle : 25 cm de marge, trois tables de 230
 * séparées par des couloirs de 30, et 25 de marge — soit exactement les 800 cm
 * de `DEMO_ROOM`. Changer le barème des tables demande donc de reprendre ces
 * trois nombres, sans quoi la dernière colonne sortirait du mur.
 */
const COLUMN_X = [25, 285, 545];
const ROW_Y = [180, 290, 400];

function table(index: number, x: number, y: number): FurnitureRect {
  return {
    id: `demo-table-${index}`,
    kind: "TABLE",
    x,
    y,
    widthCm: TABLE_WIDTH_CM,
    heightCm: TABLE_DEPTH_CM,
    rotation: 0,
    label: null,
  };
}

const TABLES: FurnitureRect[] = ROW_Y.flatMap((y, row) =>
  COLUMN_X.map((x, column) => table(row * COLUMN_X.length + column, x, y)),
);

/**
 * Le tableau est EN HAUT par convention (voir l'invariant des coordonnées) :
 * c'est l'ordonnée qui définit le premier rang, et le solveur comme le PDF s'y
 * fient. Le bureau lui fait pendant, à droite.
 */
const FIXTURES: FurnitureRect[] = [
  {
    id: "demo-board",
    kind: "BOARD",
    x: 150,
    y: 30,
    widthCm: OBJECT_DEFAULT_SIZE.BOARD.widthCm,
    heightCm: OBJECT_DEFAULT_SIZE.BOARD.heightCm,
    rotation: 0,
    label: null,
  },
  {
    id: "demo-desk",
    kind: "TEACHER_DESK",
    x: 600,
    y: 55,
    widthCm: OBJECT_DEFAULT_SIZE.TEACHER_DESK.widthCm,
    heightCm: OBJECT_DEFAULT_SIZE.TEACHER_DESK.heightCm,
    rotation: 0,
    label: null,
  },
];

export const DEMO_OBJECTS: FurnitureRect[] = [...FIXTURES, ...TABLES];

/** Ce qu'il faut de chaque table pour en déduire l'emprise des étiquettes. */
export const DEMO_TABLES = TABLES.map((t) => ({
  widthCm: t.widthCm,
  heightCm: t.heightCm,
  seatCount: SEATS_PER_TABLE,
}));

export interface DemoSeat {
  id: string;
  /** Coordonnées ABSOLUES, rotation comprise — comme les vraies `Seat`. */
  x: number;
  y: number;
}

/**
 * Les places, calculées par la fonction du domaine plutôt qu'écrites à la
 * main : c'est elle qui décide de l'écart entre deux places d'une même table,
 * et cet écart est ce qui donne sa largeur à l'étiquette.
 */
export const DEMO_SEATS: DemoSeat[] = TABLES.flatMap((t) =>
  generateSeatPositions(t, SEATS_PER_TABLE).map((position, index) => ({
    id: `${t.id}-seat-${index}`,
    x: position.x,
    y: position.y,
  })),
);

function student(
  id: number,
  firstName: string,
  lastName: string,
  behavior: StudentView["behavior"],
): StudentView {
  return {
    id: `demo-student-${id}`,
    firstName,
    lastName,
    comment: "",
    behavior,
    needsFront: false,
    leftHanded: false,
  };
}

/**
 * Dix-huit élèves pour dix-huit places. Des prénoms de longueurs variées, y
 * compris un « Jean-Baptiste » : c'est le nom le plus long qui fixe le corps du
 * texte pour TOUTE la classe (voir `planLabelStyle`), et la vitrine doit
 * montrer ce que le produit fait vraiment, pas un cas favorable.
 */
export const DEMO_STUDENTS: StudentView[] = [
  student(1, "Camille", "Martin", 1),
  student(2, "Théo", "Bernard", 4),
  student(3, "Léa", "Dubois", 1),
  student(4, "Lucas", "Thomas", 5),
  student(5, "Manon", "Robert", 2),
  student(6, "Hugo", "Richard", 3),
  student(7, "Chloé", "Petit", 1),
  student(8, "Jean-Baptiste", "Durand", 2),
  student(9, "Sarah", "Leroy", 1),
  student(10, "Nathan", "Moreau", 4),
  student(11, "Inès", "Simon", 2),
  student(12, "Enzo", "Laurent", 3),
  student(13, "Jade", "Michel", 1),
  student(14, "Louis", "Garcia", 2),
  student(15, "Emma", "David", 1),
  student(16, "Gabriel", "Bertrand", 3),
  student(17, "Alice", "Roux", 1),
  student(18, "Raphaël", "Vincent", 2),
];
