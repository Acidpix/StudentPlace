import { OBJECT_DEFAULT_SIZE, tableWidthForSeats, type ObjectKind } from "@/lib/domain";
import { snapToGrid } from "./geometry";

/**
 * Dispositions types de salle.
 *
 * Dessiner une salle table par table est le geste le plus long de
 * l'application, alors que trois agencements couvrent l'essentiel des salles
 * réelles : rangées face au tableau, U ouvert vers le tableau, îlots de quatre.
 * Ce module produit le mobilier correspondant à partir des SEULES dimensions de
 * la salle et d'un nombre de places souhaité.
 *
 * Deux règles gouvernent tout ce qui suit :
 *
 *  - **Les places ne sont pas générées ici.** On ne produit que des tables,
 *    avec le nombre de places qu'elles portent ; c'est `generateSeatPositions()`
 *    qui les posera, comme pour une table ajoutée à la main. Les places restent
 *    donc stockées déjà pivotées, sans exception à l'invariant.
 *
 *  - **Rien ne déborde.** Le nombre de tables est déduit de la place réellement
 *    disponible ; si la salle est trop petite pour la demande, on rend moins de
 *    places et on l'annonce (`shortfall`) plutôt que d'empiler des tables les
 *    unes sur les autres.
 *
 * L'écartement des tables n'est pas décoratif : c'est lui qui fixe la taille
 * des étiquettes d'élèves sur le plan de classe (voir `seatFootprintCm()`).
 * Des tables serrées donnent des noms illisibles.
 */

export const LAYOUT_PRESET_IDS = ["ROWS", "U_SHAPE", "ISLANDS"] as const;
export type LayoutPresetId = (typeof LAYOUT_PRESET_IDS)[number];

export const LAYOUT_PRESETS: Record<LayoutPresetId, { label: string; description: string }> = {
  ROWS: {
    label: "En rangées",
    description: "Tables de deux face au tableau, séparées par des couloirs.",
  },
  U_SHAPE: {
    label: "En U",
    description: "Tables accolées le long des murs, le U ouvert vers le tableau.",
  },
  ISLANDS: {
    label: "En îlots",
    description: "Groupes de quatre autour de deux tables jointes.",
  },
};

/** Un meuble tel que produit par une disposition type, avant passage à l'éditeur. */
export interface PresetObject {
  kind: ObjectKind;
  x: number;
  y: number;
  widthCm: number;
  heightCm: number;
  rotation: 0 | 90 | 180 | 270;
  label: string | null;
  seatCount: number;
}

export interface PresetLayout {
  /** Les tables, dans l'ordre de remplissage : du premier rang vers le fond. */
  tables: PresetObject[];
  /** Tableau et bureau — à n'ajouter que si la salle n'en possède pas déjà. */
  fixtures: PresetObject[];
  /** Nombre de places effectivement produites. */
  seatCount: number;
  /** Places demandées que la salle n'a pas pu accueillir. */
  shortfall: number;
}

// ------------------------------- Constantes ---------------------------------

/** Dégagement laissé le long des murs, pour circuler. */
const WALL_MARGIN_CM = 40;

/** Couloir entre deux tables d'un même rang. */
const AISLE_X_CM = 60;

/** Recul entre deux rangs : la chaise de l'élève, puis le passage. */
const ROW_GAP_CM = 80;

/** Jeu laissé aux angles du U, pour que l'on puisse y passer. */
const CORNER_GAP_CM = 60;

/** Écart entre deux U emboîtés. */
const RING_GAP_CM = 90;

const ISLAND_GAP_X_CM = 80;
const ISLAND_GAP_Y_CM = 70;

/** Une table porte deux élèves dans toutes les dispositions types. */
const SEATS_PER_TABLE = 2;

interface TableSize {
  widthCm: number;
  heightCm: number;
}

/**
 * La table de référence : celle du barème pour deux places. Passer par
 * `tableWidthForSeats()` plutôt que par une constante propre garantit que les
 * tables posées par une disposition type et celles ajoutées à la main depuis la
 * palette ont exactement le même écartement de places.
 */
const TABLE_SIZE: TableSize = {
  widthCm: tableWidthForSeats(SEATS_PER_TABLE),
  heightCm: OBJECT_DEFAULT_SIZE.TABLE.heightCm,
};

/**
 * En deçà, l'écartement des places repasse sous les 75 cm et les noms du plan
 * de classe redeviennent illisibles. On préfère alors annoncer un `shortfall`.
 */
const TABLE_MIN_WIDTH_CM = 150;

/**
 * Largeurs essayées, de la plus généreuse à la plus serrée.
 *
 * LA TABLE EST AUSSI LARGE QUE LA SALLE LE PERMET. Le barème vise la
 * lisibilité des étiquettes, pas le réalisme : à 190 cm, une salle de 9 m ne
 * loge plus que trois colonnes de tables au lieu de quatre, et une classe de
 * trente s'y retrouverait à l'étroit. Plutôt que de trancher une fois pour
 * toutes entre « lisible » et « tout le monde assis », on essaie les largeurs
 * dans l'ordre et l'on s'arrête à la première qui loge la classe entière —
 * c'est donc la CLASSE, et non une constante, qui décide de la finesse des
 * tables.
 */
const TABLE_WIDTH_CHOICES: number[] = (() => {
  const widths: number[] = [];
  for (let width = TABLE_SIZE.widthCm; width >= TABLE_MIN_WIDTH_CM; width -= 10) widths.push(width);
  return widths.length > 0 ? widths : [TABLE_MIN_WIDTH_CM];
})();

/** Bornes du nombre de places demandé. */
export const PRESET_SEAT_MIN = 2;
export const PRESET_SEAT_MAX = 60;

/**
 * Bande haute réservée au tableau et au bureau, devant laquelle aucun rang ne
 * commence. Proportionnelle dans les petites salles : 180 cm sur une salle de
 * 3 m de profondeur ne laisserait pas un seul rang.
 */
function frontClearanceCm(heightCm: number): number {
  return Math.min(180, Math.round(heightCm * 0.3));
}

/**
 * Le long des murs, on peut remonter plus haut : le tableau et le bureau sont
 * centrés, les bras du U passent à côté.
 */
function sideClearanceCm(heightCm: number): number {
  return Math.min(100, Math.round(heightCm * 0.2));
}

/** Combien d'éléments de `itemCm` tiennent dans `availableCm`, séparés de `gapCm`. */
function countAlong(availableCm: number, itemCm: number, gapCm: number): number {
  if (availableCm < itemCm) return 0;
  return Math.floor((availableCm + gapCm) / (itemCm + gapCm));
}

/**
 * Une table posée par son CENTRE.
 *
 * La rotation d'un meuble s'applique autour de son centre : positionner par le
 * centre est donc la seule façon de raisonner identiquement sur une table à
 * plat et sur une table pivotée d'un quart de tour.
 */
function tableAt(
  size: TableSize,
  cx: number,
  cy: number,
  rotation: 0 | 90,
  seatCount = SEATS_PER_TABLE,
): PresetObject {
  return {
    kind: "TABLE",
    x: snapToGrid(cx - size.widthCm / 2),
    y: snapToGrid(cy - size.heightCm / 2),
    widthCm: size.widthCm,
    heightCm: size.heightCm,
    rotation,
    label: null,
    seatCount,
  };
}

/**
 * Tableau et bureau, à la place que le professeur attend : le tableau au fond
 * visuel de la salle — en haut, c'est lui qui définit le « premier rang » —, le
 * bureau juste devant.
 */
function defaultFixtures(widthCm: number): PresetObject[] {
  const board = OBJECT_DEFAULT_SIZE.BOARD;
  const desk = OBJECT_DEFAULT_SIZE.TEACHER_DESK;
  const boardWidth = Math.max(60, Math.min(board.widthCm, widthCm - 2 * WALL_MARGIN_CM));

  return [
    {
      kind: "BOARD",
      x: snapToGrid((widthCm - boardWidth) / 2),
      y: 10,
      widthCm: boardWidth,
      heightCm: board.heightCm,
      rotation: 0,
      label: null,
      seatCount: 0,
    },
    {
      kind: "TEACHER_DESK",
      x: snapToGrid((widthCm - desk.widthCm) / 2),
      y: 60,
      widthCm: desk.widthCm,
      heightCm: desk.heightCm,
      rotation: 0,
      label: null,
      seatCount: 0,
    },
  ];
}

// -------------------------------- Rangées -----------------------------------

function rowsTables(
  widthCm: number,
  heightCm: number,
  wanted: number,
  size: TableSize,
): PresetObject[] {
  const front = frontClearanceCm(heightCm);

  const columns = countAlong(widthCm - 2 * WALL_MARGIN_CM, size.widthCm, AISLE_X_CM);
  const rows = countAlong(heightCm - front - WALL_MARGIN_CM, size.heightCm, ROW_GAP_CM);
  const total = Math.min(wanted, columns * rows);

  const pitchX = size.widthCm + AISLE_X_CM;
  const pitchY = size.heightCm + ROW_GAP_CM;
  const tables: PresetObject[] = [];

  for (let row = 0; row * columns < total; row++) {
    // Le dernier rang est souvent incomplet : on le centre comme les autres,
    // plutôt que de le laisser pendre sur la gauche.
    const inRow = Math.min(columns, total - row * columns);
    const rowWidth = inRow * pitchX - AISLE_X_CM;
    const startX = (widthCm - rowWidth) / 2 + size.widthCm / 2;

    for (let column = 0; column < inRow; column++) {
      tables.push(
        tableAt(size, startX + column * pitchX, front + size.heightCm / 2 + row * pitchY, 0),
      );
    }
  }

  return tables;
}

// ----------------------------------- U --------------------------------------

/**
 * Un U : une base au fond, deux bras le long des murs, l'ouverture vers le
 * tableau. Les tables d'une même branche se TOUCHENT — c'est ce qui fait un U
 * et non trois rangées — d'où l'absence de couloir entre elles.
 *
 * Un seul U plafonne vite : dans une salle de 9 × 7 m il n'accueille que dix-huit
 * élèves. Au-delà, on emboîte un second U à l'intérieur du premier, à un
 * couloir de distance. C'est le double fer à cheval, et c'est bien plus fidèle
 * à ce qu'un professeur ferait que d'aller entasser des tables au milieu.
 */
function uShapeTables(
  widthCm: number,
  heightCm: number,
  wanted: number,
  size: TableSize,
): PresetObject[] {
  const front = frontClearanceCm(heightCm);
  const side = sideClearanceCm(heightCm);
  const tables: PresetObject[] = [];

  let remaining = wanted;

  for (let ring = 0; remaining > 0; ring++) {
    const inset = WALL_MARGIN_CM + ring * (size.heightCm + RING_GAP_CM);

    // Une table pivotée d'un quart de tour occupe sa profondeur en largeur.
    const armX = inset + size.heightCm / 2;
    const baseY = heightCm - inset - size.heightCm / 2;

    const baseCapacity = countAlong(widthCm - 2 * inset, size.widthCm, 0);
    const armTop = Math.max(front, side);
    const armBottom = baseY - size.heightCm / 2 - CORNER_GAP_CM;
    const armCapacity = countAlong(armBottom - armTop, size.widthCm, 0);

    // Un U réclame une base et deux bras. Faute de quoi, arrêter : mieux vaut
    // rendre moins de places qu'une table esseulée au milieu de la salle.
    if (baseCapacity < 2 || armCapacity < 1) break;

    const ringCapacity = baseCapacity + 2 * armCapacity;
    let base = baseCapacity;
    let arm = armCapacity;

    // Sur le dernier U, on retire d'abord de la base puis, par paires, du haut
    // des bras : le U s'ouvre davantage au lieu de se déformer.
    let placed = ringCapacity;
    while (placed > remaining) {
      if (base > 2) {
        base -= 1;
        placed -= 1;
      } else if (arm > 1 && placed - 2 >= remaining) {
        arm -= 1;
        placed -= 2;
      } else break;
    }

    const baseWidth = base * size.widthCm;
    const baseStartX = (widthCm - baseWidth) / 2 + size.widthCm / 2;
    for (let index = 0; index < base; index++) {
      tables.push(tableAt(size, baseStartX + index * size.widthCm, baseY, 0));
    }

    // Les bras se remplissent depuis la base vers le tableau : ce sont les
    // tables du haut qui disparaissent quand la classe est plus petite.
    for (let index = 0; index < arm; index++) {
      const cy = armBottom - size.widthCm / 2 - index * size.widthCm;
      tables.push(tableAt(size, armX, cy, 90));
      tables.push(tableAt(size, widthCm - armX, cy, 90));
    }

    remaining -= placed;
  }

  return tables;
}

// --------------------------------- Îlots ------------------------------------

/**
 * Un îlot est fait de DEUX tables jointes par leur grand côté : quatre élèves,
 * deux face à deux. Les tables restent des tables ordinaires — on ne crée pas
 * de meuble « îlot », qui n'aurait servi qu'ici et qu'il aurait fallu enseigner
 * au solveur comme au PDF.
 */
function islandTables(
  widthCm: number,
  heightCm: number,
  wanted: number,
  size: TableSize,
): PresetObject[] {
  const front = frontClearanceCm(heightCm);
  const islandHeight = size.heightCm * 2;

  const columns = countAlong(widthCm - 2 * WALL_MARGIN_CM, size.widthCm, ISLAND_GAP_X_CM);
  const rows = countAlong(heightCm - front - WALL_MARGIN_CM, islandHeight, ISLAND_GAP_Y_CM);

  // Deux tables par îlot : on arrondit vers le haut, un îlot de deux vaut mieux
  // qu'un élève sans place.
  const islands = Math.min(Math.ceil(wanted / 2), columns * rows);

  const pitchX = size.widthCm + ISLAND_GAP_X_CM;
  const pitchY = islandHeight + ISLAND_GAP_Y_CM;
  const tables: PresetObject[] = [];

  for (let row = 0; row * columns < islands; row++) {
    const inRow = Math.min(columns, islands - row * columns);
    const rowWidth = inRow * pitchX - ISLAND_GAP_X_CM;
    const startX = (widthCm - rowWidth) / 2 + size.widthCm / 2;
    const topY = front + row * pitchY;

    for (let column = 0; column < inRow; column++) {
      const cx = startX + column * pitchX;

      // La table du bas est posée à partir de la table du haut DÉJÀ AIMANTÉE,
      // et non calculée puis aimantée à son tour : une profondeur de 55 cm
      // n'est pas un multiple du pas de 10, si bien que les deux aimantations
      // séparées laissaient entre les deux tables un jour de 5 cm. Un îlot,
      // c'est deux tables qui SE TOUCHENT.
      const top = tableAt(size, cx, topY + size.heightCm / 2, 0);
      tables.push(top, { ...top, y: top.y + size.heightCm });
    }
  }

  return tables;
}

// -------------------------------- Génération ---------------------------------

/**
 * Produit le mobilier d'une disposition type.
 *
 * `seatTarget` est un SOUHAIT, pas une garantie : la salle a le dernier mot.
 * Le `shortfall` renvoyé permet à l'éditeur de le dire plutôt que de laisser
 * croire que tout le monde est assis.
 *
 * Les tables sont posées AUSSI LARGES QUE LA SALLE LE PERMET : on essaie les
 * largeurs de la plus généreuse à la plus serrée et l'on garde la première qui
 * loge la classe entière. Une table large écarte ses places, donc agrandit les
 * étiquettes du plan de classe ; mais asseoir tout le monde passe avant la
 * taille des noms. Faute de largeur suffisante, on retient celle qui offre le
 * plus de places et l'on annonce le manque.
 */
export function generatePresetLayout(
  preset: LayoutPresetId,
  room: { widthCm: number; heightCm: number },
  seatTarget: number,
): PresetLayout {
  const target = Math.max(
    PRESET_SEAT_MIN,
    Math.min(PRESET_SEAT_MAX, Math.round(seatTarget) || PRESET_SEAT_MIN),
  );
  const wantedTables = Math.ceil(target / SEATS_PER_TABLE);

  let tables: PresetObject[] = [];
  let seatCount = 0;
  let chosen = false;

  for (const widthCm of TABLE_WIDTH_CHOICES) {
    const size: TableSize = { widthCm, heightCm: TABLE_SIZE.heightCm };
    const candidate =
      preset === "ROWS"
        ? rowsTables(room.widthCm, room.heightCm, wantedTables, size)
        : preset === "U_SHAPE"
          ? uShapeTables(room.widthCm, room.heightCm, wantedTables, size)
          : islandTables(room.widthCm, room.heightCm, wantedTables, size);

    const candidateSeats = candidate.reduce((total, table) => total + table.seatCount, 0);

    // Les largeurs sont essayées de la plus grande à la plus petite : à égalité,
    // c'est donc la table la plus large qui reste en place. Rétrécir sans rien
    // gagner ne ferait que réduire les étiquettes du plan de classe.
    //
    // Deux critères, dans cet ordre : loger la classe, puis y employer le MOINS
    // DE TABLES possible. Le second n'a d'effet que sur le U, seule disposition
    // qui puisse dépasser la demande — elle emboîte un second fer à cheval dès
    // que le premier ne suffit plus. Des tables plus fines y tiennent parfois
    // en un seul U, ce qui vaut mieux qu'un double U aux tables larges.
    if (
      !chosen ||
      (candidateSeats >= target
        ? seatCount < target || candidate.length < tables.length
        : candidateSeats > seatCount)
    ) {
      tables = candidate;
      seatCount = candidateSeats;
      chosen = true;
    }

    // Impossible de faire mieux qu'une table par paire d'élèves demandée.
    if (seatCount >= target && tables.length <= wantedTables) break;
  }

  return {
    tables,
    fixtures: defaultFixtures(room.widthCm),
    seatCount,
    shortfall: Math.max(0, target - seatCount),
  };
}
