import { cn } from "@/lib/cn";
import { DIFFICULTY_COLORS, DIFFICULTY_LABELS, type Difficulty } from "@/lib/domain";

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
  size?: "sm" | "md";
  className?: string;
}) {
  const dimension = size === "sm" ? "h-4 w-4 text-[10px]" : "h-5 w-5 text-[11px]";

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

/** Légende de la palette, à placer sous un plan ou une liste d'élèves. */
export function DifficultyLegend({ className }: { className?: string }) {
  return (
    <div className={cn("flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted", className)}>
      <span className="font-medium text-foreground">Difficulté :</span>
      {([1, 2, 3, 4, 5] as const).map((level) => (
        <span key={level} className="inline-flex items-center gap-1.5">
          <DifficultyBadge difficulty={level} size="sm" />
          {DIFFICULTY_LABELS[level]}
        </span>
      ))}
    </div>
  );
}
