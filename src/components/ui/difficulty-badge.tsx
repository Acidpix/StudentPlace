import { cn } from "@/lib/cn";
import {
  DIFFICULTY_COLORS,
  DIFFICULTY_LABELS,
  DIFFICULTY_SHORT_LABELS,
  DIFFICULTY_VALUES,
  type Difficulty,
} from "@/lib/domain";

/**
 * Pastille de difficulté.
 *
 * La couleur ne porte JAMAIS l'information seule : le chiffre est toujours
 * affiché, et le libellé complet est accessible aux lecteurs d'écran.
 */
export function DifficultyBadge({
  difficulty,
  size = "md",
  className,
}: {
  difficulty: Difficulty;
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
        backgroundColor: DIFFICULTY_COLORS[difficulty],
        color: "var(--pastille-ink)",
        ...(numeric
          ? { width: size, height: size, fontSize: Math.max(6, size * 0.66), lineHeight: 1 }
          : null),
      }}
      title={`${difficulty}/5 — ${DIFFICULTY_LABELS[difficulty]}`}
    >
      <span aria-hidden="true">{difficulty}</span>
      <span className="sr-only">
        Difficulté {difficulty} sur 5, {DIFFICULTY_LABELS[difficulty]}
      </span>
    </span>
  );
}

/**
 * Jauge de difficulté en CINQ SEGMENTS, d'après la maquette 2c.
 *
 * La maquette dessine exactement cinq blocs, dont les premiers sont allumés :
 * c'est la taille de l'échelle du domaine, il n'y a rien eu à adapter. La
 * jauge dit la même chose que la pastille, en plus lisible de loin — on
 * compare deux élèves d'un coup d'œil sans lire deux chiffres.
 *
 * Le libellé accompagne toujours la jauge : la couleur ne porte jamais
 * l'information seule.
 */
export function DifficultyMeter({
  difficulty,
  className,
}: {
  difficulty: Difficulty;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center gap-3", className)}>
      {/* Le mot en gros à gauche, comme dans la maquette. C'est lui qui porte
          l'information ; les segments ne font que la rendre comparable d'un
          coup d'œil entre deux élèves. */}
      <span
        className="shrink-0 text-sm font-bold"
        style={{ color: DIFFICULTY_COLORS[difficulty] }}
      >
        {DIFFICULTY_SHORT_LABELS[difficulty]}
      </span>

      <span className="flex flex-1 gap-1" aria-hidden="true">
        {DIFFICULTY_VALUES.map((level) => (
          <span
            key={level}
            className="h-4 flex-1 rounded-[4px]"
            style={{
              backgroundColor:
                level <= difficulty ? DIFFICULTY_COLORS[difficulty] : "var(--surface-muted)",
            }}
          />
        ))}
      </span>

      <span className="sr-only">
        Difficulté {difficulty} sur 5, {DIFFICULTY_LABELS[difficulty]}
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
export function DifficultyLegend({
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
      {!vertical && <span className="eyebrow">Difficulté</span>}
      {([1, 2, 3, 4, 5] as const).map((level) => (
        <span key={level} className="inline-flex items-center gap-1.5">
          <DifficultyBadge difficulty={level} size="sm" />
          {DIFFICULTY_LABELS[level]}
        </span>
      ))}
    </div>
  );
}
