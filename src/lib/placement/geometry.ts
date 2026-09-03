import { ADJACENCY_CM, GRID_CM } from "@/lib/domain";

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

/**
 * Emprise que peut prendre l'étiquette d'un élève sans jamais en recouvrir une
 * autre, déduite de l'écartement RÉEL des places de la salle.
 *
 * Un plafond fixe ne peut pas convenir : deux places d'une table de 130 cm sont
 * à 65 cm l'une de l'autre, celles d'une table de 190 cm à 95 cm. Mesurer
 * plutôt que supposer permet aux étiquettes d'être aussi grandes — donc aussi
 * lisibles — que la salle le permet, et pas davantage.
 *
 * Le calcul se fait EN DEUX TEMPS, la hauteur d'abord, et c'est important. Deux
 * cartes centrées sur leurs places se recouvrent si et seulement si leurs
 * écarts sont INFÉRIEURS aux deux dimensions À LA FOIS : une place située
 * au-dessus d'une autre ne limite donc en rien la LARGEUR, dès lors que les
 * hauteurs, elles, ne se rejoignent pas.
 *
 *  1. La hauteur suit le plus petit écart VERTICAL entre deux places d'une même
 *     colonne, avec 25 % de jeu — un rang de plus loin se lit mal quand les
 *     cartes s'empilent bord à bord.
 *  2. La largeur suit alors le plus petit écart HORIZONTAL parmi les SEULES
 *     paires de places dont les bandes verticales se chevauchent, avec 6 % de
 *     jeu pour que deux étiquettes voisines ne se touchent pas tout à fait.
 *
 * La version précédente prenait en plus la plus petite distance tous azimuts,
 * ce qui bridait toute la salle au voisin le plus proche quelle que soit sa
 * direction : dans une disposition en ÎLOTS, deux tables face à face à 60 cm
 * ramenaient les étiquettes à 56 cm de large alors qu'elles disposaient de
 * 95 cm à l'horizontale. Le quinconce que cette distance servait à rattraper
 * est mieux traité par la règle ci-dessus, qui est exacte.
 *
 * En l'absence de repère — une place unique, par exemple — on rend les
 * plafonds tels quels.
 */
export function seatFootprintCm(
  seats: Point[],
  maxWidthCm: number,
  maxHeightCm: number,
): { widthCm: number; heightCm: number } {
  /** Au-delà, deux places ne sont plus considérées sur la même colonne. */
  const ALIGNMENT_TOLERANCE_CM = 45;

  let minColumnGap = Number.POSITIVE_INFINITY;

  for (let i = 0; i < seats.length; i++) {
    for (let j = i + 1; j < seats.length; j++) {
      const dx = Math.abs(seats[i].x - seats[j].x);
      const dy = Math.abs(seats[i].y - seats[j].y);
      if (dy > 0 && dx <= ALIGNMENT_TOLERANCE_CM) minColumnGap = Math.min(minColumnGap, dy);
    }
  }

  const heightCm = Math.min(
    maxHeightCm,
    Number.isFinite(minColumnGap) ? minColumnGap * 0.75 : maxHeightCm,
  );

  let minRowGap = Number.POSITIVE_INFINITY;

  for (let i = 0; i < seats.length; i++) {
    for (let j = i + 1; j < seats.length; j++) {
      const dx = Math.abs(seats[i].x - seats[j].x);
      const dy = Math.abs(seats[i].y - seats[j].y);
      // Deux places à la même abscisse ne peuvent pas gêner : leur écart
      // vertical vaut au moins `minColumnGap`, donc plus que la hauteur
      // retenue. La largeur ne peut donc pas tomber à zéro.
      if (dx > 0 && dy < heightCm) minRowGap = Math.min(minRowGap, dx);
    }
  }

  const widthCm = Math.min(
    maxWidthCm,
    Number.isFinite(minRowGap) ? minRowGap * 0.94 : maxWidthCm,
  );

  return { widthCm, heightCm };
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
