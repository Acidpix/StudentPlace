import { ADJACENCY_CM, GRID_CM, OBJECT_DEFAULT_SIZE, TABLE_WIDTH_PER_SEAT_CM } from "@/lib/domain";

/**
 * Géométrie de la salle.
 *
 * Toutes les coordonnées sont en centimètres, origine en haut à gauche.
 * Un meuble est décrit par son coin haut-gauche AVANT rotation, sa taille, et
 * un angle appliqué AUTOUR DE SON CENTRE. Le rendu SVG utilise exactement la
 * même convention (`rotate(angle, cx, cy)`), pour que ce que calcule le
 * solveur corresponde à ce que voit le professeur.
 */

export interface Point {
  x: number;
  y: number;
}

export interface RectLike {
  x: number;
  y: number;
  widthCm: number;
  heightCm: number;
  rotation: number;
}

/** Centre d'un meuble, invariant par rotation. */
export function centerOf(rect: RectLike): Point {
  return {
    x: rect.x + rect.widthCm / 2,
    y: rect.y + rect.heightCm / 2,
  };
}

/**
 * Convertit un point exprimé dans le repère local d'un meuble (0,0 = son coin
 * haut-gauche) en coordonnées absolues, rotation comprise.
 */
export function localToAbsolute(rect: RectLike, local: Point): Point {
  const center = centerOf(rect);
  const radians = (rect.rotation * Math.PI) / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);

  const dx = local.x - rect.widthCm / 2;
  const dy = local.y - rect.heightCm / 2;

  return {
    x: center.x + dx * cos - dy * sin,
    y: center.y + dx * sin + dy * cos,
  };
}

export function distanceCm(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/** Deux places sont « voisines » si elles sont assez proches pour bavarder. */
export function areAdjacent(a: Point, b: Point, thresholdCm: number = ADJACENCY_CM): boolean {
  return distanceCm(a, b) <= thresholdCm;
}

export function snapToGrid(value: number, gridCm: number = GRID_CM): number {
  return Math.round(value / gridCm) * gridCm;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * Répartit `count` places le long d'une table, régulièrement espacées sur sa
 * largeur et centrées sur sa profondeur.
 *
 * Renvoie des positions ABSOLUES : les places sont stockées déjà pivotées, si
 * bien que le solveur et l'export PDF n'ont jamais à refaire ce calcul.
 */
export function generateSeatPositions(
  table: RectLike,
  count: number,
): Array<Point & { isEndSeat: boolean }> {
  if (count <= 0) return [];

  return Array.from({ length: count }, (_, index) => {
    const local: Point = {
      x: (table.widthCm * (index + 0.5)) / count,
      y: table.heightCm / 2,
    };
    const absolute = localToAbsolute(table, local);

    return {
      x: Math.round(absolute.x),
      y: Math.round(absolute.y),
      // Une place en extrémité est plus confortable pour un gaucher.
      // Une table d'une seule place compte comme une extrémité.
      isEndSeat: index === 0 || index === count - 1,
    };
  });
}

/** Ce qu'il faut d'une table pour en déduire l'emprise de ses étiquettes. */
export interface SeatedTable {
  widthCm: number;
  heightCm: number;
  seatCount: number;
}

/**
 * Emprise de l'étiquette d'un élève sur le plan, en centimètres.
 *
 * Elle ne se mesure plus : elle se DÉDUIT directement de la table, sans marge
 * ni plafond. La LARGEUR est le pas des places — largeur de la table ÷ nombre
 * de places, exactement l'écart que pose `generateSeatPositions()` entre deux
 * places voisines — et la HAUTEUR est la profondeur de la table. Une étiquette
 * a donc TOUJOURS la largeur d'une place et la hauteur de sa table, jamais
 * moins, jamais plus.
 *
 * Toutes les étiquettes du plan partagent une seule emprise (voir
 * `planLabelStyle()`) : on retient donc le plus petit pas et la plus petite
 * profondeur parmi les tables occupées, pour qu'aucune étiquette n'en
 * recouvre jamais une autre, même si les tables de la salle diffèrent.
 *
 * Une table sans place n'y contribue pas. En l'absence de toute table
 * occupée, on rend le pas et la profondeur par défaut d'une table neuve.
 */
export function seatFootprintCm(tables: SeatedTable[]): { widthCm: number; heightCm: number } {
  let widthCm = Number.POSITIVE_INFINITY;
  let heightCm = Number.POSITIVE_INFINITY;

  for (const table of tables) {
    if (table.seatCount <= 0) continue;
    widthCm = Math.min(widthCm, table.widthCm / table.seatCount);
    heightCm = Math.min(heightCm, table.heightCm);
  }

  return {
    widthCm: Number.isFinite(widthCm) ? widthCm : TABLE_WIDTH_PER_SEAT_CM,
    heightCm: Number.isFinite(heightCm) ? heightCm : OBJECT_DEFAULT_SIZE.TABLE.heightCm,
  };
}

/**
 * Classe les places de la plus proche à la plus éloignée du tableau.
 *
 * Le tableau est par convention en haut de la salle : le rang « avant » se
 * déduit donc de l'ordonnée. On travaille en rangs plutôt qu'en centimètres
 * pour rester juste quelle que soit la profondeur réelle de la salle.
 */
export function rankSeatsByFrontness<T extends Point & { id: string }>(seats: T[]): Map<string, number> {
  const sorted = [...seats].sort((a, b) => a.y - b.y || a.x - b.x);
  return new Map(sorted.map((seat, index): [string, number] => [seat.id, index]));
}
