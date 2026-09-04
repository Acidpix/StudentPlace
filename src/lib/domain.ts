/**
 * Types et constantes du domaine.
 *
 * SQLite ne supporte pas les enum Prisma : les champs correspondants sont
 * stockés en String et contraints ici, côté TypeScript.
 */

// --------------------------------- Relations --------------------------------

export const RELATION_TYPES = ["INCOMPATIBLE", "AFFINITY"] as const;
export type RelationType = (typeof RELATION_TYPES)[number];

export const RELATION_LABELS: Record<RelationType, string> = {
  INCOMPATIBLE: "Ne doivent pas être voisins",
  AFFINITY: "À rapprocher si possible",
};

/**
 * Ordonne une paire d'identifiants de façon stable.
 *
 * INVARIANT du modèle StudentRelation : studentAId < studentBId. Sans cette
 * normalisation, la paire (Léa, Tom) et la paire (Tom, Léa) seraient deux
 * lignes distinctes et la contrainte d'unicité ne servirait à rien.
 */
export function normalizePair(a: string, b: string): [string, string] {
  return a < b ? [a, b] : [b, a];
}

// --------------------------------- Mobilier ---------------------------------

export const OBJECT_KINDS = [
  "TABLE",
  "TEACHER_DESK",
  "BOARD",
  "DOOR",
  "WINDOW",
  "OBSTACLE",
] as const;
export type ObjectKind = (typeof OBJECT_KINDS)[number];

export const OBJECT_LABELS: Record<ObjectKind, string> = {
  TABLE: "Table",
  TEACHER_DESK: "Bureau du professeur",
  BOARD: "Tableau",
  DOOR: "Porte",
  WINDOW: "Fenêtre",
  OBSTACLE: "Obstacle",
};

/**
 * Largeur d'une table par place, en centimètres. Une table à `count` places
 * fait `count * TABLE_WIDTH_PER_SEAT_CM` de large : une place, 150 cm ; deux,
 * 300 ; trois, 450.
 *
 * Ce n'est pas la cote d'une vraie table d'écolier, et c'est ASSUMÉ : le plan
 * de classe est un outil de lecture, pas un plan d'architecte, et l'écartement
 * qui en résulte est ce qui fixe la largeur — donc la lisibilité — de
 * l'étiquette d'un élève (`seatFootprintCm()`).
 *
 * Ce barème est la SEULE source de la largeur d'une table : les dispositions
 * types (`placement/layout-presets.ts`) le suivent aussi, sans le rétrécir.
 */
export const TABLE_WIDTH_PER_SEAT_CM = 150;

/** Largeur d'une table à `count` places. */
export function tableWidthForSeats(count: number): number {
  return count * TABLE_WIDTH_PER_SEAT_CM;
}

/**
 * Profondeur d'une table, en centimètres. Fixe, quel que soit le nombre de
 * places, et c'est délibérément aussi la hauteur de l'étiquette d'élève sur le
 * plan de classe : voir `seatFootprintCm()` (`placement/geometry.ts`).
 */
export const TABLE_DEPTH_CM = 45;

/**
 * Dimensions par défaut du mobilier, en centimètres.
 *
 * La table n'a pas de largeur propre : elle DÉRIVE du barème ci-dessus, pour
 * une table de deux places. Écrire ici un nombre en dur laisserait la valeur
 * dériver du barème à la première retouche — c'est exactement ce qui était
 * arrivé aux dispositions types.
 */
export const OBJECT_DEFAULT_SIZE: Record<ObjectKind, { widthCm: number; heightCm: number }> = {
  TABLE: { widthCm: tableWidthForSeats(2), heightCm: TABLE_DEPTH_CM },
  TEACHER_DESK: { widthCm: 140, heightCm: 70 },
  BOARD: { widthCm: 300, heightCm: 35 },
  DOOR: { widthCm: 90, heightCm: 35 },
  WINDOW: { widthCm: 200, heightCm: 35 },
  OBSTACLE: { widthCm: 80, heightCm: 80 },
};

// -------------------------------- Difficulté --------------------------------

export type Difficulty = 1 | 2 | 3 | 4 | 5;
export const DIFFICULTY_VALUES: readonly Difficulty[] = [1, 2, 3, 4, 5];

/**
 * Palette des pastilles de difficulté.
 *
 * Les teintes sont volontairement claires et saturées : associées au texte
 * sombre `--pastille-ink`, elles gardent un contraste suffisant en thème clair
 * comme en thème sombre. La pastille affiche TOUJOURS le chiffre en plus de la
 * couleur — environ 8 % des hommes ne distinguent pas le rouge du vert.
 */
export const DIFFICULTY_COLORS: Record<Difficulty, string> = {
  1: "#34d399",
  2: "#a3e635",
  3: "#fbbf24",
  4: "#fb923c",
  5: "#f87171",
};

export const DIFFICULTY_LABELS: Record<Difficulty, string> = {
  1: "Aucune difficulté",
  2: "Difficulté légère",
  3: "Difficulté moyenne",
  4: "Difficulté marquée",
  5: "Très perturbateur",
};

/**
 * Les mêmes niveaux en UN MOT.
 *
 * La jauge à cinq segments met le libellé en gros, à gauche des segments : un
 * « Difficulté marquée » sur deux lignes y écraserait les segments. Ce sont
 * bien les mêmes cinq niveaux, seulement abrégés — la forme longue reste celle
 * des listes, des infobulles et des lecteurs d'écran.
 */
export const DIFFICULTY_SHORT_LABELS: Record<Difficulty, string> = {
  1: "Aucune",
  2: "Légère",
  3: "Moyenne",
  4: "Marquée",
  5: "Très forte",
};

export function toDifficulty(value: number): Difficulty {
  const clamped = Math.min(5, Math.max(1, Math.round(value)));
  return clamped as Difficulty;
}

// -------------------------------- Géométrie ---------------------------------

/** Pas d'aimantation de l'éditeur de salle, en centimètres. */
export const GRID_CM = 10;

/**
 * Distance en deçà de laquelle deux élèves incompatibles déclenchent une
 * alerte. Réglable par plan (SeatingPlan.proximityCm).
 */
export const DEFAULT_PROXIMITY_CM = 120;

/**
 * Distance en deçà de laquelle deux places sont considérées « voisines »
 * pour le calcul d'isolement et des affinités.
 */
export const ADJACENCY_CM = 90;

/** Bornes de taille d'une salle, en centimètres. */
export const ROOM_MIN_CM = 300;
export const ROOM_MAX_CM = 3000;

