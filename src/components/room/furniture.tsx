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
}

const STYLES: Record<ObjectKind, FurnitureStyle> = {
  TABLE: { fill: "var(--surface-muted)", stroke: "var(--border)", textFill: "var(--muted)" },
  TEACHER_DESK: {
    fill: "var(--primary-soft)",
    stroke: "var(--primary)",
    textFill: "var(--primary)",
  },
  BOARD: { fill: "var(--primary)", stroke: "var(--primary)", textFill: "var(--primary)" },
  DOOR: { fill: "transparent", stroke: "var(--muted)", textFill: "var(--muted)", dashed: true },
  WINDOW: { fill: "transparent", stroke: "var(--muted)", textFill: "var(--muted)", dashed: true },
  OBSTACLE: { fill: "var(--surface-muted)", stroke: "var(--muted)", textFill: "var(--muted)", dashed: true },
};

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

/** Quadrillage de fond, un trait tous les 50 cm. */
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
      <rect x={0} y={0} width={widthCm} height={heightCm} fill="var(--surface)" />
      {verticals.map((x) => (
        <line key={`v${x}`} x1={x} y1={0} x2={x} y2={heightCm} stroke="var(--border)" strokeWidth={1} opacity={0.5} />
      ))}
      {horizontals.map((y) => (
        <line key={`h${y}`} x1={0} y1={y} x2={widthCm} y2={y} stroke="var(--border)" strokeWidth={1} opacity={0.5} />
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

  return (
    <g transform={`rotate(${object.rotation}, ${center.x}, ${center.y})`}>
      <rect
        x={object.x}
        y={object.y}
        width={object.widthCm}
        height={object.heightCm}
        rx={object.kind === "BOARD" ? 2 : 6}
        fill={style.fill}
        stroke={selected ? "var(--primary)" : style.stroke}
        strokeWidth={selected ? 4 : 2}
        strokeDasharray={style.dashed ? "10 6" : undefined}
        style={interactive ? { cursor: "move" } : undefined}
      />

      {showLabel && (
        <text
          x={center.x}
          y={center.y}
          transform={uprightLabel ? `rotate(180, ${center.x}, ${center.y})` : undefined}
          textAnchor="middle"
          dominantBaseline="central"
          fontSize={Math.min(20, object.heightCm * 0.5)}
          fill={object.kind === "BOARD" ? "var(--primary-foreground)" : style.textFill}
          style={{ pointerEvents: "none", userSelect: "none" }}
        >
          {label}
        </text>
      )}
    </g>
  );
}
