import type { ObjectKind } from "@/lib/domain";

/**
 * Aperçu miniature d'une salle, en tête des cartes du tableau de bord.
 *
 * Volontairement plus fruste que `Furniture` : ni étiquettes, ni rotation, ni
 * places. À cette taille, seule la silhouette de la salle est lisible, et c'est
 * elle qui permet de reconnaître un plan de classe d'un coup d'œil. Les élèves
 * n'y figurent jamais — une vignette de tableau de bord n'a pas à afficher de
 * noms.
 */

const TONES: Partial<Record<ObjectKind, { fill: string; stroke: string }>> = {
  TABLE: { fill: "var(--surface-muted)", stroke: "var(--border)" },
  TEACHER_DESK: { fill: "var(--primary-soft)", stroke: "var(--primary)" },
  BOARD: { fill: "var(--primary)", stroke: "var(--primary)" },
};

const FALLBACK = { fill: "transparent", stroke: "var(--border)" };

export interface ThumbnailObject {
  id: string;
  kind: ObjectKind;
  x: number;
  y: number;
  widthCm: number;
  heightCm: number;
}

export function PlanThumbnail({
  widthCm,
  heightCm,
  objects,
}: {
  widthCm: number;
  heightCm: number;
  objects: ThumbnailObject[];
}) {
  return (
    <svg
      viewBox={`0 0 ${widthCm} ${heightCm}`}
      preserveAspectRatio="xMidYMid slice"
      className="h-24 w-full border-b border-border bg-surface-muted/40"
      aria-hidden="true"
    >
      {objects.map((object) => {
        const tone = TONES[object.kind] ?? FALLBACK;
        return (
          <rect
            key={object.id}
            x={object.x}
            y={object.y}
            width={object.widthCm}
            height={object.heightCm}
            rx={6}
            fill={tone.fill}
            stroke={tone.stroke}
            strokeWidth={4}
          />
        );
      })}
    </svg>
  );
}
