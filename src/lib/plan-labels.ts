import { studentShortName, type StudentView } from "@/lib/view-models";

/**
 * Typographie des étiquettes d'élèves du plan de classe.
 *
 * Ce module ne dépend ni de React ni du DOM : il est LE calcul commun à
 * l'écran (`plan/plan-pieces.tsx`) et au PDF (`pdf/plan-document.tsx`). Les
 * deux rendus doivent produire la même image ; les avoir écrits deux fois est
 * précisément ce qui les avait fait diverger — le PDF posait des étiquettes de
 * 62 × 26 points, taille fixe, là où l'écran les dimensionne en centimètres de
 * salle.
 *
 * ---
 *
 * L'UNITÉ n'est pas la même de part et d'autre : l'écran compte en pixels CSS,
 * le PDF en points typographiques. Tous les seuils de ce fichier sont écrits
 * en PIXELS et multipliés par `metrics.unit`, que l'appelant fixe une fois —
 * 1 à l'écran, `PT_PER_PX` pour le PDF. C'est ce qui fait qu'une étiquette
 * imprimée à 100 % a exactement la taille de celle affichée à l'écran, plutôt
 * que les quatre tiers.
 */

/**
 * Corps de texte le plus grand qu'on s'autorise sur une place, en pixels.
 * Au-delà, une salle affichée en grand donnerait des étiquettes criardes.
 * 22 px, soit un cran au-dessus du texte courant de l'interface : sur le plan
 * de classe, le nom d'un élève EST le contenu.
 */
export const SEAT_FONT_MAX_PX = 22;

/**
 * Rembourrage horizontal de l'étiquette, de part et d'autre du texte.
 *
 * Réduit au strict nécessaire : sur une carte de cent pixels, chaque pixel rendu
 * au texte est un pixel de corps de police en plus. Le cerclage de difficulté
 * s'y ajoute, lui, parce qu'il est peint À L'INTÉRIEUR du cadre.
 */
export const LABEL_PADDING_PX = 1;

/** Épaisseur de la bordure d'une carte, en pixels. Deux côtés à déduire. */
export const LABEL_BORDER_PX = 2;

/**
 * Planchers de lisibilité, en pixels — un par forme, du plus exigeant au plus
 * tolérant.
 *
 * Un nom écrit à 8 px n'est pas lu, il est deviné : plutôt que de rétrécir
 * indéfiniment « Camille M. », on abrège. Mais chaque abrègement coûte plus
 * cher que le précédent, d'où des seuils DÉCROISSANTS : perdre l'initiale du
 * nom est bénin, perdre le prénom pour deux lettres ne l'est pas. Sans cela,
 * un seul « Jean-Baptiste » dans la classe faisait basculer TOUT LE MONDE aux
 * initiales, alors que des prénoms à 9 px restaient lisibles.
 */
const MIN_SHORT_PX = 10;
const MIN_FIRST_PX = 8.5;
const MIN_INITIALS_PX = 7.5;

/**
 * Un point typographique vaut quatre tiers de pixel CSS (72 pt/pouce contre
 * 96 px/pouce). C'est le facteur à passer en `unit` pour le PDF.
 */
export const PT_PER_PX = 0.75;

export interface SeatMetrics {
  width: number;
  height: number;
  /** Corps MAXIMAL de l'étiquette. Un nom long en recevra moins. */
  font: number;
  /** Épaisseur du cerclage intérieur qui porte la difficulté. */
  ring: number;
  radius: number;
  /** Trop étroite pour le moindre mot : « Libre » et consorts sont masqués. */
  tiny: boolean;
  /** Taille d'un pixel CSS dans l'unité de rendu. 1 à l'écran, 0,75 en PDF. */
  unit: number;
}

export interface SeatMetricsOptions {
  /** Taille d'un pixel CSS dans l'unité de l'appelant. */
  unit?: number;
  /**
   * Part de la HAUTEUR de carte offerte à la ligne de nom.
   *
   * 0,46 par défaut : une ligne unique peut prendre près de la moitié de la
   * carte. Le PDF la réduit quand il pose une rangée de cases à cocher sous le
   * nom — c'est de cette part-là qu'elles se servent, jamais du corps du texte
   * décidé ailleurs.
   */
  heightShare?: number;
}

/**
 * Traduit l'emprise disponible en dimensions d'étiquette.
 *
 * L'étiquette tient sur UNE SEULE LIGNE : « Camille M. », le prénom suivi de
 * l'initiale du nom. C'est la forme de la maquette, et c'est aussi la seule
 * qui garde un texte GRAND — deux lignes empilées obligeaient à diviser la
 * hauteur par deux, donc à écrire deux fois plus petit, pour un nom de famille
 * que le professeur connaît déjà. L'initiale suffit à départager deux
 * prénoms identiques, seul cas où le nom entier servait vraiment ; il reste
 * dans l'infobulle, dans le panneau latéral, dans la liste alphabétique du PDF
 * et pour les lecteurs d'écran.
 *
 * Le corps rendu ici est un PLAFOND : `planLabelStyle()` le réduit une fois
 * pour toute la classe, d'après le nom le plus long. C'est ce qui rend
 * l'affichage stable quand la fenêtre rétrécit ou que la salle est grande — le
 * texte se resserre au lieu de disparaître d'un coup.
 *
 * La difficulté ne se lit pas dans l'étiquette mais à un CERCLAGE INTÉRIEUR de
 * la carte : le nom dispose de toute la largeur et se centre, et la couleur
 * reste visible même sur une étiquette minuscule où une pastille deviendrait
 * un point indéchiffrable.
 */
export function seatMetrics(
  footprint: { widthCm: number; heightCm: number },
  perCm: number,
  { unit = 1, heightShare = 0.46 }: SeatMetricsOptions = {},
): SeatMetrics {
  const width = footprint.widthCm * perCm;
  const height = footprint.heightCm * perCm;

  return {
    width,
    height,
    // Le texte suit les DEUX dimensions. La hauteur d'abord — une ligne unique
    // peut prendre près de la moitié de la carte —, la largeur ensuite, pour
    // qu'une carte basse et large ne reçoive pas un corps que ses noms ne
    // pourraient jamais employer.
    font: Math.max(6 * unit, Math.min(SEAT_FONT_MAX_PX * unit, height * heightShare, width * 0.3)),
    // Un filet, pas un cadre : le cerclage de difficulté doit se lire sans
    // manger la place du nom.
    ring: Math.max(1 * unit, Math.min(2 * unit, height * 0.03)),
    radius: Math.max(4 * unit, Math.min(10 * unit, height * 0.18)),
    tiny: width < 44 * unit,
    unit,
  };
}

/** Initiales de repli lorsque l'étiquette est trop étroite pour un prénom. */
function studentInitials(student: StudentView): string {
  return `${student.firstName.charAt(0)}${student.lastName.charAt(0)}`.toUpperCase();
}

/**
 * Largeur estimée d'un texte, en multiples de la taille de police.
 *
 * Approximation assumée : mesurer chaque nom au `canvas` donnerait la valeur
 * exacte mais coûterait une mesure par élève à chaque redimensionnement — et
 * côté PDF il n'y a tout simplement pas de `canvas`.
 *
 * La moyenne unique de 0,55 qui tenait ce rôle était trop pessimiste d'un bon
 * cinquième — « Camille M. » vaut en réalité 4,4 fois sa taille de police, pas
 * 5,5 — et ce cinquième était perdu en corps de texte, sur toutes les cartes.
 * Distinguer quatre familles de caractères suffit à récupérer l'essentiel :
 * les capitales sont larges, les jambages fins ne valent qu'un tiers, et « m »
 * et « w » sont des cas à part. Le compte reste LÉGÈREMENT MAJORÉ, pour que
 * l'étiquette soit au pire un cran trop petite — jamais tronquée.
 */
export function textWidthRatio(text: string): number {
  let total = 0;

  for (const char of text) {
    if (" .,'-".includes(char)) total += 0.28;
    else if ("iIjlt".includes(char)) total += 0.32;
    else if ("mw".includes(char)) total += 0.82;
    else if (char !== char.toLowerCase()) total += 0.68;
    else total += 0.52;
  }

  return total;
}

/** Les formes possibles d'une étiquette, de la plus complète à la plus courte. */
export type SeatLabelForm = "short" | "first" | "initials" | "none";

export interface PlanLabelStyle {
  /** Forme retenue pour TOUTE la classe. */
  form: SeatLabelForm;
  /** Corps retenu pour TOUTE la classe, au plus `metrics.font`. */
  font: number;
}

/** Largeur réellement offerte au texte : la carte, moins bordures et marges. */
export function textRoomPx(metrics: SeatMetrics): number {
  // Bordures (2 × 2 px), rembourrage, puis le cerclage intérieur.
  return (
    metrics.width - 2 * (LABEL_BORDER_PX + LABEL_PADDING_PX) * metrics.unit - 2 * metrics.ring
  );
}

/** Corps auquel `text` remplit exactement `room`, sans dépasser `cap`. */
export function fittedSize(text: string, cap: number, room: number): number {
  const ratio = textWidthRatio(text);
  return ratio <= 0 ? cap : Math.min(cap, room / ratio);
}

/** Ce qu'écrit une étiquette dans la forme retenue pour le plan. */
export function seatLabelText(student: StudentView, form: SeatLabelForm): string | null {
  if (form === "short") return studentShortName(student);
  if (form === "first") return student.firstName;
  if (form === "initials") return studentInitials(student);
  return null;
}

/**
 * Choisit une SEULE forme et un SEUL corps de texte pour toute la classe.
 *
 * Deux règles, et elles se tiennent :
 *
 *  - **Tous les élèves s'écrivent pareil.** Un plan où chaque nom a sa propre
 *    taille se lit comme une liste de tailles, pas comme une classe : l'œil
 *    croit à une hiérarchie qui n'existe pas, et les grands noms tirent
 *    l'attention au détriment des petits. La forme de référence est « Camille
 *    M. » — prénom, puis initiale du nom.
 *  - **Aucun prénom n'est coupé.** Le corps commun est donc celui auquel le
 *    PLUS LONG des noms tient encore dans la carte. Un « Jean-Baptiste V. »
 *    rapetisse toute la classe : c'est le prix de l'uniformité, et il est plus
 *    faible que celui d'un nom illisible ou tronqué.
 *
 * Ce qui reste variable, c'est la FENÊTRE : le corps se recalcule à chaque
 * changement d'échelle du plan, puisqu'il se déduit de la largeur d'une carte.
 * Quand elle ne suffit plus, on abrège — pour tout le monde en même temps —
 * dans cet ordre : « Camille M. », puis le prénom seul (l'initiale coûte trois
 * caractères, et mieux vaut « Camille » en grand que « Camille M. » à la
 * loupe), puis les initiales, puis rien, le cerclage de difficulté restant la
 * seule information. Le nom complet demeure de toute façon dans l'infobulle,
 * dans le panneau latéral, dans la liste alphabétique du PDF et pour les
 * lecteurs d'écran.
 */
export function planLabelStyle(students: StudentView[], metrics: SeatMetrics): PlanLabelStyle {
  const inner = textRoomPx(metrics);
  const forms: Array<[SeatLabelForm, number]> = [
    ["short", MIN_SHORT_PX * metrics.unit],
    ["first", MIN_FIRST_PX * metrics.unit],
    ["initials", MIN_INITIALS_PX * metrics.unit],
  ];

  for (const [form, floor] of forms) {
    // Le nom le plus large de la classe commande : lui seul décide du corps.
    const widest = students.reduce(
      (worst, student) => Math.max(worst, textWidthRatio(seatLabelText(student, form) ?? "")),
      0,
    );
    const font = widest <= 0 ? metrics.font : Math.min(metrics.font, inner / widest);
    if (font >= floor) return { form, font };
  }

  return { form: "none", font: metrics.font };
}
