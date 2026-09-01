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

/** Mêmes teintes que `Furniture`, en aplats : le tableau en vert, le bureau en violet. */
const TONES: Partial<Record<ObjectKind, { fill: string; stroke: string }>> = {
  TABLE: { fill: "var(--surface-muted)", stroke: "var(--border)" },
  TEACHER_DESK: { fill: "var(--primary-soft)", stroke: "var(--primary)" },
  BOARD: { fill: "var(--accent)", stroke: "var(--accent)" },
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
  className = "h-24 w-full border-b border-border bg-surface-muted/40",
}: {
  widthCm: number;
  heightCm: number;
  objects: ThumbnailObject[];
  /** Cadre et hauteur. Par défaut : la bande pleine largeur en tête de carte. */
  className?: string;
}) {
  return (
    <svg
      viewBox={`0 0 ${widthCm} ${heightCm}`}
      preserveAspectRatio="xMidYMid slice"
      className={className}
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
