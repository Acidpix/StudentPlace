import { OBJECT_DEFAULT_SIZE, tableWidthForSeats, type ObjectKind } from "@/lib/domain";
import { snapToGrid } from "./geometry";

/**
 * Dispositions types de salle.
 *
 * Dessiner une salle table par table est le geste le plus long de
 * l'application, alors que quatre agencements couvrent l'essentiel des salles
 * réelles : rangées face au tableau, U ouvert vers le tableau, U avec un îlot
 * central, îlots de quatre. Ce module produit le mobilier correspondant à
 * partir des SEULES dimensions de la salle et d'un nombre de places souhaité.
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
 * Des tables serrées donnent des noms illisibles — d'où la troisième règle :
 * une disposition type pose TOUJOURS des tables au barème par place
 * (`tableWidthForSeats()`), jamais rétrécies pour faire tenir un élève de plus.
 */

export const LAYOUT_PRESET_IDS = ["ROWS", "U_SHAPE", "U_SHAPE_ISLAND", "ISLANDS"] as const;
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
  U_SHAPE_ISLAND: {
    label: "En U avec îlot",
    description: "Un U le long des murs, un îlot de quatre au centre.",
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
 * LA SEULE TABLE QU'UNE DISPOSITION TYPE POSE : celle du barème, pour deux
 * places. Passer par `tableWidthForSeats()` et `OBJECT_DEFAULT_SIZE` plutôt
 * que par des constantes propres garantit qu'une table posée par une
 * disposition type et une table ajoutée à la main depuis la palette ont
 * EXACTEMENT les mêmes cotes — donc le même écartement de places, donc des
 * étiquettes de même taille sur le plan de classe.
 *
 * Il n'existe PLUS de largeur de repli. Une première version essayait les
 * largeurs de la plus généreuse à la plus serrée et gardait la première qui
 * logeait la classe entière ; son plancher était un nombre en dur, écrit avant
 * le barème par place, si bien qu'une salle de 9 m rendait des tables à 80 cm
 * par place là où le barème en promettait le double. Asseoir tout le monde ne
 * vaut pas des noms illisibles : quand la salle ne suit pas, on pose moins de
 * tables et on annonce le manque (`shortfall`).
 */
const TABLE_SIZE: TableSize = {
  widthCm: tableWidthForSeats(SEATS_PER_TABLE),
  heightCm: OBJECT_DEFAULT_SIZE.TABLE.heightCm,
};

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
 * Un seul U plafonne vite — les tables du barème sont larges, et une salle de
 * 9 m n'en aligne que deux sur sa base. Au-delà, on emboîte un second U à
 * l'intérieur du premier, à un couloir de distance. C'est le double fer à
 * cheval, et c'est bien plus fidèle à ce qu'un professeur ferait que d'aller
 * entasser des tables au milieu.
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

// ------------------------------ U avec îlot ---------------------------------

/**
 * Le même U que `uShapeTables`, mais à un SEUL rang — jamais emboîté, faute de
 * quoi il n'y aurait plus d'ouverture pour l'îlot — et un îlot de quatre posé
 * au centre, dans l'ouverture. `wanted` compte des TABLES, comme dans
 * `uShapeTables` : chacune porte `SEATS_PER_TABLE` places.
 *
 * L'îlot — deux tables jointes — est réservé sur ce budget AVANT de
 * dimensionner le U, base et bras cédant leurs dernières tables à l'îlot
 * plutôt que l'inverse : c'est lui qui distingue cette disposition d'un U
 * simple.
 *
 * Si le rectangle central n'est pas assez large ET assez profond pour deux
 * tables jointes, l'îlot disparaît plutôt que de chevaucher un bras — un U
 * simple vaut mieux qu'un meuble mal posé.
 */
function uShapeIslandTables(
  widthCm: number,
  heightCm: number,
  wanted: number,
  size: TableSize,
): PresetObject[] {
  const front = frontClearanceCm(heightCm);
  const side = sideClearanceCm(heightCm);

  const inset = WALL_MARGIN_CM;
  const armX = inset + size.heightCm / 2;
  const baseY = heightCm - inset - size.heightCm / 2;
  const baseCapacity = countAlong(widthCm - 2 * inset, size.widthCm, 0);
  const armTop = Math.max(front, side);
  const armBottom = baseY - size.heightCm / 2 - CORNER_GAP_CM;
  const armCapacity = countAlong(armBottom - armTop, size.widthCm, 0);

  // Une base et deux bras sont le minimum d'un U ; sans eux, pas d'ouverture
  // où loger un îlot.
  if (baseCapacity < 2 || armCapacity < 1) return [];

  const ISLAND_TABLES = 2;
  const islandTablesWanted = Math.min(ISLAND_TABLES, wanted);
  const uWanted = wanted - islandTablesWanted;

  const ringCapacity = baseCapacity + 2 * armCapacity;
  let base = baseCapacity;
  let arm = armCapacity;
  let placed = ringCapacity;
  while (placed > uWanted) {
    if (base > 2) {
      base -= 1;
      placed -= 1;
    } else if (arm > 1 && placed - 2 >= uWanted) {
      arm -= 1;
      placed -= 2;
    } else break;
  }

  const tables: PresetObject[] = [];

  const baseWidth = base * size.widthCm;
  const baseStartX = (widthCm - baseWidth) / 2 + size.widthCm / 2;
  for (let index = 0; index < base; index++) {
    tables.push(tableAt(size, baseStartX + index * size.widthCm, baseY, 0));
  }

  for (let index = 0; index < arm; index++) {
    const cy = armBottom - size.widthCm / 2 - index * size.widthCm;
    tables.push(tableAt(size, armX, cy, 90));
    tables.push(tableAt(size, widthCm - armX, cy, 90));
  }

  // L'îlot tient dans le rectangle bordé par les deux bras et par la base,
  // avec le même jeu qu'aux coins du U.
  const centerLeft = armX + size.heightCm / 2 + CORNER_GAP_CM;
  const centerRight = widthCm - armX - size.heightCm / 2 - CORNER_GAP_CM;
  const centerTop = armTop;
  const centerBottom = armBottom;
  const islandHeight = size.heightCm * 2;

  if (
    islandTablesWanted > 0 &&
    centerRight - centerLeft >= size.widthCm &&
    centerBottom - centerTop >= islandHeight
  ) {
    const cx = (centerLeft + centerRight) / 2;
    const blockTop = centerTop + (centerBottom - centerTop - islandHeight) / 2;

    // Même geste que dans `islandTables` : la table du bas se pose à partir
    // de celle du haut, déjà aimantée, pour que les deux SE TOUCHENT.
    const top = tableAt(size, cx, blockTop + size.heightCm / 2, 0);
    tables.push(top);
    if (islandTablesWanted > 1) tables.push({ ...top, y: top.y + size.heightCm });
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
      // et non calculée puis aimantée à son tour : une profondeur de 45 cm
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
 * Les tables sont posées AU BARÈME, et rien d'autre n'est essayé : une table
 * de disposition type a exactement les cotes par défaut d'une table de deux
 * places (`TABLE_SIZE`). Quand la salle n'en loge pas assez, on rend moins de
 * places et on l'annonce — jamais des tables rétrécies, dont les étiquettes
 * deviendraient illisibles sur le plan de classe.
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

  const tables =
    preset === "ROWS"
      ? rowsTables(room.widthCm, room.heightCm, wantedTables, TABLE_SIZE)
      : preset === "U_SHAPE"
        ? uShapeTables(room.widthCm, room.heightCm, wantedTables, TABLE_SIZE)
        : preset === "U_SHAPE_ISLAND"
          ? uShapeIslandTables(room.widthCm, room.heightCm, wantedTables, TABLE_SIZE)
          : islandTables(room.widthCm, room.heightCm, wantedTables, TABLE_SIZE);

  const seatCount = tables.reduce((total, table) => total + table.seatCount, 0);

  return {
    tables,
    fixtures: defaultFixtures(room.widthCm),
    seatCount,
    shortfall: Math.max(0, target - seatCount),
  };
}
