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
 * La table fait 340 cm et non les 130 d'origine : l'écartement des places en
 * découle directement (largeur ÷ nombre de places), et c'est lui qui plafonne
 * la taille des étiquettes du plan de classe. À 130 cm, deux places d'une même
 * table n'étaient distantes que de 65 cm et les noms devenaient illisibles.
 * Les salles déjà dessinées gardent leurs tables : le bouton « Élargir les
 * tables » de l'éditeur de salle est ce qui leur rendra de la place.
 *
 * La cote n'est plus celle d'une vraie table d'écolier — 340 cm pour deux, cela
 * n'existe pas dans le commerce. C'est ASSUMÉ : le plan de classe est un outil
 * de lecture, pas un plan d'architecte, et un nom lisible vaut mieux qu'une
 * échelle exacte. Seule la LARGEUR grandit : la profondeur (55 cm) ne bouge
 * pas, donc les cartes s'élargissent sans jamais s'alourdir en hauteur, et une
 * rangée de tables n'empiète pas sur la suivante.
 *
 * La largeur d'une table dépend en réalité de son nombre de places : voir
 * `TABLE_WIDTH_BY_SEATS`. La valeur ci-dessous est celle de la table à deux
 * places, le cas courant, et sert de repli.
 */
export const OBJECT_DEFAULT_SIZE: Record<ObjectKind, { widthCm: number; heightCm: number }> = {
  TABLE: { widthCm: 340, heightCm: 55 },
  TEACHER_DESK: { widthCm: 140, heightCm: 70 },
  BOARD: { widthCm: 300, heightCm: 35 },
  DOOR: { widthCm: 90, heightCm: 35 },
  WINDOW: { widthCm: 200, heightCm: 35 },
  OBSTACLE: { widthCm: 80, heightCm: 80 },
};

/**
 * Largeur d'une table selon son nombre de places, en centimètres.
 *
 * L'écartement des places vaut largeur ÷ nombre de places : on vise donc un pas
 * d'environ 170 cm par élève. C'est la SEULE façon d'agrandir vraiment les
 * cartes du plan de classe — une étiquette ne peut jamais dépasser l'écartement
 * des places, sous peine de recouvrir sa voisine. Le pas est passé de 80 à 95,
 * puis 115, puis 170 cm : à chaque palier précédent, il restait encore de la
 * marge avant que le plafond de carte (`SEAT_CARD_MAX_WIDTH_CM`) ne devienne
 * lui-même la contrainte.
 *
 * 340 cm pour deux élèves, c'est une table qui n'existe pas. C'est ASSUMÉ : le
 * plan de classe est un outil de lecture, pas un plan d'architecte, et la carte
 * prime sur la vraisemblance du mobilier. La borne haute n'est pas le réalisme
 * mais la CAPACITÉ de la salle — au-delà de 340, une salle de 9 m ne loge plus
 * que deux colonnes de tables ; le repli vers des tables plus fines
 * (`generatePresetLayout`, `TABLE_WIDTH_CHOICES`) reste nécessaire pour les
 * classes nombreuses.
 *
 * La table à une place est volontairement plus large que le pas : c'est une
 * table d'écolier, pas une demi-table.
 */
export const TABLE_WIDTH_BY_SEATS: Record<number, number> = {
  1: 220,
  2: 340,
  3: 480,
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

/**
 * Emprise MAXIMALE d'une étiquette d'élève sur le plan, en centimètres.
 *
 * L'emprise réelle est plus petite si les places de la salle sont serrées :
 * `seatFootprintCm()` (voir `placement/geometry.ts`) la déduit de l'écartement
 * effectivement mesuré entre places. C'est la clé du non-chevauchement — les
 * cartes étaient auparavant dimensionnées en pixels fixes, donc bien plus
 * larges que l'écartement réel dès que la salle était grande.
 *
 * La LARGEUR est TRÈS généreuse à dessein — l'étiquette porte « Camille M. » en
 * un seul mot d'un bout à l'autre, et c'est elle qui décide de la taille du
 * texte. Elle est relevée à chaque fois que les tables s'élargissent, faute de
 * quoi le plafond rognerait le gain et l'élargissement n'aurait servi à rien :
 * une table de 340 cm à deux places rend des cartes de 163 cm.
 *
 * La HAUTEUR, elle, NE BOUGE PAS avec la largeur — c'est délibéré. L'étiquette
 * ne tient que sur une ligne, et une carte plus haute n'y ajouterait que du
 * vide tout en rapprochant deux rangs voisins ; c'est la profondeur de table
 * (`OBJECT_DEFAULT_SIZE.TABLE.heightCm`, 55 cm, inchangée) qui la borne de
 * toute façon. Élargir les tables agrandit donc les cartes SANS jamais les
 * épaissir : c'est la seule dimension qui compte pour un prénom.
 */
export const SEAT_CARD_MAX_WIDTH_CM = 220;
export const SEAT_CARD_MAX_HEIGHT_CM = 62;
