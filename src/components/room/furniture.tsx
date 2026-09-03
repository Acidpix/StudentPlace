import { centerOf } from "@/lib/placement/geometry";
import type { ObjectKind } from "@/lib/domain";

/**
 * Rendu du mobilier, partagé par l'éditeur de salle et l'éditeur de placement.
 *
 * Les couleurs passent par les variables CSS du thème : le même tracé SVG
 * fonctionne donc en clair comme en sombre, sans duplication.
 */

interface FurnitureStyle {
  fill: string;
  stroke: string;
  textFill: string;
  dashed?: boolean;
  /** Épaisseur du contour, en centimètres de salle. 2 par défaut. */
  strokeWidth?: number;
  /** Tirets du contour, en centimètres. Ignoré si `dashed` est faux. */
  dash?: string;
  /** Rayures diagonales par-dessus l'aplat. Réservé au tableau. */
  hatched?: boolean;
}

/**
 * Le TABLEAU n'est plus un aplat violet plein.
 *
 * Il porte désormais le traitement du modèle : un aplat vert PÂLE, rayé en
 * diagonale, bordé et titré dans le vert soutenu. Deux raisons —
 *
 *  - le violet est la couleur de l'ACTION ; l'étaler sur le plus grand meuble
 *    de la salle en faisait la tache dominante d'un écran où il ne se passe
 *    rien, et rendait les boutons moins visibles par contraste ;
 *  - les rayures distinguent le tableau au premier coup d'œil sans recourir à
 *    une couleur saturée. C'est le repère d'orientation du plan de classe : il
 *    doit se lire avant tout le reste, y compris en vue pivotée.
 *
 * Le bureau garde le violet : c'est un meuble petit, et une touche de la
 * couleur de marque au bon endroit vaut mieux qu'un aplat.
 *
 * La TABLE, elle, n'est plus qu'un LISERÉ POINTILLÉ — plus d'aplat, plus de
 * trait plein. C'est le meuble le plus nombreux de la salle, et sur le plan de
 * classe il est entièrement recouvert par les étiquettes d'élèves : son cadre
 * plein doublait celui des cartes, et l'œil voyait deux rectangles imbriqués
 * là où il n'y a qu'une information, le nom. Réduit à un pointillé clair, il
 * dit toujours quelles places vont ensemble sans se disputer la lecture. C'est
 * aussi ce qui distingue une table VIDE — un pointillé seul — d'une table
 * occupée.
 */
const STYLES: Record<ObjectKind, FurnitureStyle> = {
  TABLE: {
    fill: "transparent",
    stroke: "var(--border)",
    textFill: "var(--muted)",
    dashed: true,
    dash: "8 7",
    strokeWidth: 1.5,
  },
  TEACHER_DESK: {
    fill: "var(--primary-soft)",
    stroke: "var(--primary)",
    textFill: "var(--primary)",
  },
  BOARD: {
    fill: "var(--accent-soft)",
    stroke: "var(--accent)",
    textFill: "var(--accent)",
    hatched: true,
  },
  DOOR: { fill: "transparent", stroke: "var(--muted)", textFill: "var(--muted)", dashed: true },
  WINDOW: { fill: "transparent", stroke: "var(--muted)", textFill: "var(--muted)", dashed: true },
  OBSTACLE: { fill: "var(--surface-muted)", stroke: "var(--muted)", textFill: "var(--muted)", dashed: true },
};

/**
 * Identifiants des motifs SVG.
 *
 * Fixes et non dérivés de `useId()` : `RoomGrid` n'est rendu qu'une fois par
 * page — l'éditeur de salle OU l'éditeur de placement — et les hachures ne sont
 * définies qu'à l'intérieur d'elle. Deux définitions identiques ne poseraient
 * de toute façon pas de problème de rendu, `url(#…)` retenant la première.
 */
const HALFTONE_PATTERN_ID = "sp-halftone";
const HATCH_PATTERN_ID = "sp-hatch";

/**
 * Pas de la trame de points, EN CENTIMÈTRES de salle.
 *
 * C'est volontaire : la trame appartient au sol de la salle, donc elle grandit
 * avec le zoom au lieu de rester collée à l'écran. Une salle typique s'affiche
 * autour de 1 px/cm, ce qui donne des points de 2 px espacés de 11 px — les
 * valeurs du modèle. L'équivalent en pixels fixes, pour les surfaces qui ne
 * sont pas un plan de salle, est la classe `.halftone` de globals.css.
 */
const HALFTONE_STEP_CM = 11;
const HALFTONE_DOT_CM = 1.1;

const DEFAULT_LABELS: Partial<Record<ObjectKind, string>> = {
  TEACHER_DESK: "Bureau",
  BOARD: "Tableau",
  DOOR: "Porte",
  WINDOW: "Fenêtre",
};

export interface FurnitureRect {
  id: string;
  kind: ObjectKind;
  x: number;
  y: number;
  widthCm: number;
  heightCm: number;
  rotation: number;
  label: string | null;
}

/**
 * Sol de la salle : trame de points, quadrillage de 50 cm, cadre.
 *
 * Les deux trames se superposent et ne disent pas la même chose. La TRAME DE
 * POINTS est décorative — c'est la matière du sol, elle donne au plan son
 * grain d'atelier. Le QUADRILLAGE de 50 cm est un outil de mesure : c'est lui
 * qu'on suit pour aligner deux tables dans l'éditeur de salle. Il est donc
 * resté, mais très dilué, pour que les points restent la texture dominante.
 *
 * Les motifs sont définis en unités utilisateur, donc en centimètres de salle.
 * Les deux éditeurs les rendent sans déformation : celui de la salle emploie
 * `preserveAspectRatio="xMidYMid meet"`, et celui du plan de classe emploie
 * `none` mais dans un conteneur dont le rapport largeur/hauteur est
 * exactement celui de la salle. Dans les deux cas l'échelle reste isotrope, et
 * les points restent des disques.
 */
export function RoomGrid({
  widthCm,
  heightCm,
  step = 50,
}: {
  widthCm: number;
  heightCm: number;
  step?: number;
}) {
  const verticals = Array.from({ length: Math.floor(widthCm / step) }, (_, i) => (i + 1) * step);
  const horizontals = Array.from({ length: Math.floor(heightCm / step) }, (_, i) => (i + 1) * step);

  return (
    <g aria-hidden="true">
      <defs>
        <pattern
          id={HALFTONE_PATTERN_ID}
          width={HALFTONE_STEP_CM}
          height={HALFTONE_STEP_CM}
          patternUnits="userSpaceOnUse"
        >
          <circle
            cx={HALFTONE_STEP_CM / 2}
            cy={HALFTONE_STEP_CM / 2}
            r={HALFTONE_DOT_CM}
            fill="var(--halftone)"
          />
        </pattern>

        {/* Hachures du tableau : des traits à 45°, dans une tuile de 10 cm.
            La diagonale principale, plus deux bouts de diagonale AUX DEUX COINS
            opposés : sans eux, le trait s'arrêterait net au bord de la tuile et
            l'on verrait la couture d'une tuile à l'autre. Les deux bouts
            débordent volontairement de la tuile — le motif les rogne. */}
        <pattern id={HATCH_PATTERN_ID} width={10} height={10} patternUnits="userSpaceOnUse">
          {/* `fill="none"` est OBLIGATOIRE : le remplissage par défaut d'un
              `<path>` est noir, et ces trois sous-tracés ouverts seraient
              refermés puis peints en aplat — le tableau virerait au noir au
              lieu de se rayer. */}
          <path
            d="M -2 2 L 2 -2 M 0 10 L 10 0 M 8 12 L 12 8"
            fill="none"
            stroke="var(--hatch)"
            strokeWidth={3}
          />
        </pattern>
      </defs>

      <rect x={0} y={0} width={widthCm} height={heightCm} fill="var(--room-floor)" />
      <rect x={0} y={0} width={widthCm} height={heightCm} fill={`url(#${HALFTONE_PATTERN_ID})`} />

      {verticals.map((x) => (
        <line key={`v${x}`} x1={x} y1={0} x2={x} y2={heightCm} stroke="var(--border)" strokeWidth={1} opacity={0.35} />
      ))}
      {horizontals.map((y) => (
        <line key={`h${y}`} x1={0} y1={y} x2={widthCm} y2={y} stroke="var(--border)" strokeWidth={1} opacity={0.35} />
      ))}
      <rect
        x={0}
        y={0}
        width={widthCm}
        height={heightCm}
        fill="none"
        stroke="var(--border)"
        strokeWidth={3}
      />
    </g>
  );
}

export function Furniture({
  object,
  selected = false,
  interactive = false,
}: {
  object: FurnitureRect;
  selected?: boolean;
  interactive?: boolean;
}) {
  const style = STYLES[object.kind];
  const center = centerOf(object);
  const label = object.label ?? DEFAULT_LABELS[object.kind] ?? null;

  // Une étiquette n'est lisible que si le meuble est assez grand pour elle.
  const showLabel = label !== null && object.widthCm >= 60 && object.heightCm >= 24;

  // Au-delà d'un quart de tour, le libellé se retrouverait à l'envers : on le
  // repasse de 180° pour qu'il reste lisible sans quitter l'axe du meuble.
  // C'est ce qui rend supportable la vue depuis le bureau, qui ajoute 180° à
  // toutes les rotations de la salle.
  const angle = ((object.rotation % 360) + 360) % 360;
  const uprightLabel = angle > 90 && angle < 270;

  // Quand le tableau est assez haut pour porter un libellé, celui-ci reprend la
  // signature des étiquettes de section — capitales très espacées. À sa taille
  // par défaut (300 × 12 cm) il est trop plat pour cela, et ce sont les
  // hachures seules qui l'identifient ; le seuil de `showLabel` reste donc
  // inchangé, un libellé de 6 px ne serait pas lisible.
  const isBoard = object.kind === "BOARD";

  return (
    <g transform={`rotate(${object.rotation}, ${center.x}, ${center.y})`}>
      <rect
        x={object.x}
        y={object.y}
        width={object.widthCm}
        height={object.heightCm}
        rx={isBoard ? 4 : 6}
        // `transparent` et non `none` : un remplissage transparent est PEINT,
        // donc il reçoit le clic. Avec `fill="none"`, une table pointillée ne
        // se saisirait plus que par son liseré dans l'éditeur de salle.
        fill={style.fill}
        stroke={selected ? "var(--primary)" : style.stroke}
        strokeWidth={selected ? 4 : (style.strokeWidth ?? 2)}
        strokeDasharray={style.dashed && !selected ? (style.dash ?? "10 6") : undefined}
        style={interactive ? { cursor: "move" } : undefined}
      />

      {/* Les hachures se posent en second rectangle, sans contour : peintes
          dans le `fill` du premier, elles auraient remplacé l'aplat au lieu de
          s'y superposer. `pointerEvents: none` laisse le clic au rectangle du
          dessous, qui porte le glisser. */}
      {style.hatched && (
        <rect
          x={object.x}
          y={object.y}
          width={object.widthCm}
          height={object.heightCm}
          rx={isBoard ? 4 : 6}
          fill={`url(#${HATCH_PATTERN_ID})`}
          style={{ pointerEvents: "none" }}
        />
      )}

      {showLabel && (
        <text
          x={center.x}
          y={center.y}
          transform={uprightLabel ? `rotate(180, ${center.x}, ${center.y})` : undefined}
          textAnchor="middle"
          dominantBaseline="central"
          fontSize={Math.min(20, object.heightCm * 0.5)}
          fill={style.textFill}
          style={{
            pointerEvents: "none",
            userSelect: "none",
            ...(isBoard
              ? { letterSpacing: "0.16em", fontWeight: 700, textTransform: "uppercase" as const }
              : null),
          }}
        >
          {label}
        </text>
      )}
    </g>
  );
}
