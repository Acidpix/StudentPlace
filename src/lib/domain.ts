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
 * Dimensions par défaut du mobilier, en centimètres.
 *
 * La table fait 160 cm et non les 130 d'origine : l'écartement des places en
 * découle directement (largeur ÷ nombre de places), et c'est lui qui plafonne
 * la taille des étiquettes du plan de classe. À 130 cm, deux places d'une même
 * table n'étaient distantes que de 65 cm et les noms devenaient illisibles.
 * Les salles déjà dessinées gardent leurs tables : les élargir dans l'éditeur
 * de salle est ce qui leur rendra de la place.
 *
 * La largeur d'une table dépend en réalité de son nombre de places : voir
 * `TABLE_WIDTH_BY_SEATS`. La valeur ci-dessous est celle de la table à deux
 * places, le cas courant, et sert de repli.
 */
export const OBJECT_DEFAULT_SIZE: Record<ObjectKind, { widthCm: number; heightCm: number }> = {
  TABLE: { widthCm: 160, heightCm: 55 },
  TEACHER_DESK: { widthCm: 140, heightCm: 70 },
  BOARD: { widthCm: 300, heightCm: 12 },
  DOOR: { widthCm: 90, heightCm: 12 },
  WINDOW: { widthCm: 200, heightCm: 12 },
  OBSTACLE: { widthCm: 80, heightCm: 80 },
};

/**
 * Largeur d'une table selon son nombre de places, en centimètres.
 *
 * L'écartement des places vaut largeur ÷ nombre de places : on garde donc un
 * pas d'environ 80 cm par élève, ce qui laisse aux étiquettes du plan de quoi
 * afficher un prénom et un nom sans se recouvrir. La table à une place est
 * volontairement plus large que 80 cm — c'est une table d'écolier, pas une
 * demi-table.
 */
export const TABLE_WIDTH_BY_SEATS: Record<number, number> = {
  1: 110,
  2: 160,
  3: 240,
};

/** Largeur d'une table à `count` places ; repli sur la table à deux places. */
export function tableWidthForSeats(count: number): number {
  return TABLE_WIDTH_BY_SEATS[count] ?? OBJECT_DEFAULT_SIZE.TABLE.widthCm;
}

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

/**
 * Emprise MAXIMALE d'une étiquette d'élève sur le plan, en centimètres.
 *
 * L'emprise réelle est plus petite si les places de la salle sont serrées :
 * `seatFootprintCm()` (voir `placement/geometry.ts`) la déduit de l'écartement
 * effectivement mesuré entre places. C'est la clé du non-chevauchement — les
 * cartes étaient auparavant dimensionnées en pixels fixes, donc bien plus
 * larges que l'écartement réel dès que la salle était grande.
 *
 * Ces plafonds sont généreux à dessein : c'est une étiquette sur DEUX LIGNES,
 * prénom puis nom, et elle doit rester lisible. Une salle aux tables trop
 * étroites bridera d'elle-même.
 */
export const SEAT_CARD_MAX_WIDTH_CM = 86;
export const SEAT_CARD_MAX_HEIGHT_CM = 52;
