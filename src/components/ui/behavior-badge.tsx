import { cn } from "@/lib/cn";
import {
  BEHAVIOR_COLORS,
  BEHAVIOR_LABELS,
  BEHAVIOR_SHORT_LABELS,
  BEHAVIOR_VALUES,
  type Behavior,
} from "@/lib/domain";

/**
 * Pastille de comportement.
 *
 * La couleur ne porte JAMAIS l'information seule : le chiffre est toujours
 * affiché, et le libellé complet est accessible aux lecteurs d'écran.
 */
export function BehaviorBadge({
  behavior,
  size = "md",
  className,
}: {
  behavior: Behavior;
  /**
   * `"sm"` / `"md"` pour les listes ; un nombre de pixels pour le plan de
   * classe, dont les étiquettes sont mises à l'échelle de la salle.
   */
  size?: "sm" | "md" | number;
  className?: string;
}) {
  const numeric = typeof size === "number";
  const dimension = numeric ? "" : size === "sm" ? "h-4 w-4 text-[10px]" : "h-5 w-5 text-[11px]";

  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full font-bold tabular-nums",
        dimension,
        className,
      )}
      style={{
        backgroundColor: BEHAVIOR_COLORS[behavior],
        color: "var(--pastille-ink)",
        ...(numeric
          ? { width: size, height: size, fontSize: Math.max(6, size * 0.66), lineHeight: 1 }
          : null),
      }}
      title={`${behavior}/5 — ${BEHAVIOR_LABELS[behavior]}`}
    >
      <span aria-hidden="true">{behavior}</span>
      <span className="sr-only">
        Comportement {behavior} sur 5, {BEHAVIOR_LABELS[behavior]}
      </span>
    </span>
  );
}

/**
 * Jauge de comportement en CINQ SEGMENTS, d'après la maquette 2c.
 *
 * La maquette dessine exactement cinq blocs, dont les premiers sont allumés :
 * c'est la taille de l'échelle du domaine, il n'y a rien eu à adapter. La
 * jauge dit la même chose que la pastille, en plus lisible de loin — on
 * compare deux élèves d'un coup d'œil sans lire deux chiffres.
 *
 * Le libellé accompagne toujours la jauge : la couleur ne porte jamais
 * l'information seule.
 */
export function BehaviorMeter({
  behavior,
  compact = false,
  className,
}: {
  behavior: Behavior;
  /** Version resserrée, pour les vignettes de la liste d'élèves. */
  compact?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center", compact ? "gap-2" : "gap-3", className)}>
      {/* Le mot à gauche, comme dans la maquette. C'est lui qui porte
          l'information ; les segments ne font que la rendre comparable d'un
          coup d'œil entre deux élèves. Il reste `shrink-0` et non tronqué :
          « Perturbateur » est le plus long des cinq, et un « Perturbat… »
          coûterait plus que les quelques pixels qu'il rendrait aux segments. */}
      <span
        className={cn("shrink-0 font-bold", compact ? "text-[11px]" : "text-sm")}
        style={{ color: BEHAVIOR_COLORS[behavior] }}
      >
        {BEHAVIOR_SHORT_LABELS[behavior]}
      </span>

      <span className="flex flex-1 gap-1" aria-hidden="true">
        {BEHAVIOR_VALUES.map((level) => (
          <span
            key={level}
            className={cn("flex-1 rounded-[3px]", compact ? "h-1.5" : "h-4")}
            style={{
              backgroundColor:
                level <= behavior ? BEHAVIOR_COLORS[behavior] : "var(--surface-muted)",
            }}
          />
        ))}
      </span>

      <span className="sr-only">
        Comportement {behavior} sur 5, {BEHAVIOR_LABELS[behavior]}
      </span>
    </div>
  );
}

/**
 * Légende de la palette.
 *
 * `vertical` la donne empilée, pour le pied de la colonne « À placer » — c'est
 * la forme de la maquette, une ligne par niveau. Horizontale, elle se met sous
 * un plan ou une liste.
 */
export function BehaviorLegend({
  className,
  vertical = false,
}: {
  className?: string;
  vertical?: boolean;
}) {
  return (
    <div
      className={cn(
        "text-xs text-muted",
        vertical
          ? "flex flex-col gap-1.5"
          : "flex flex-wrap items-center gap-x-4 gap-y-2",
        className,
      )}
    >
      {!vertical && <span className="eyebrow">Comportement</span>}
      {([1, 2, 3, 4, 5] as const).map((level) => (
        <span key={level} className="inline-flex items-center gap-1.5">
          <BehaviorBadge behavior={level} size="sm" />
          {BEHAVIOR_LABELS[level]}
        </span>
      ))}
    </div>
  );
}
