"use client";

import { Button } from "@/components/ui/button";
import { DifficultyMeter } from "@/components/ui/difficulty-badge";
import { LockIcon, UnlockIcon, XIcon } from "@/components/ui/icons";
import { cn } from "@/lib/cn";
import type { RelationType } from "@/lib/domain";
import { studentFullName, type StudentView } from "@/lib/view-models";

/**
 * Fiche de l'élève sélectionné, d'après la maquette 2c.
 *
 * Elle a quitté la barre d'outils du plan, où elle était comprimée sur une
 * ligne, pour la colonne de droite. La maquette lui donne une structure fixe,
 * reprise ici section par section : en-tête à médaillon, BESOINS PARTICULIERS,
 * NIVEAU, RELATIONS, NOTE PRIVÉE, puis les deux commandes.
 *
 * Chaque section est adossée à une donnée qui existe réellement — rien n'a été
 * inventé pour remplir la maquette. Les sections vides ne s'affichent pas :
 * un élève sans besoin particulier, sans relation et sans commentaire montre
 * juste son médaillon et son niveau.
 */

/** Deux lettres pour le médaillon : initiale du prénom, initiale du nom. */
function initials(student: StudentView): string {
  return `${student.firstName.charAt(0)}${student.lastName.charAt(0)}`.toUpperCase();
}

/**
 * Une relation telle que la fiche l'affiche : le type, et l'autre élève.
 *
 * La fiche ne connaît pas `StudentRelation` : elle reçoit déjà les paires
 * résolues. C'est l'éditeur qui sait quel élève est « l'autre », puisque lui
 * seul connaît l'ordre normalisé (`studentAId < studentBId`) et l'élève courant.
 */
export interface StudentCardRelation {
  id: string;
  type: RelationType;
  other: StudentView;
}

export function StudentCard({
  student,
  contextLabel,
  pinned,
  relations,
  onTogglePin,
  onEdit,
  onRemove,
  onClose,
}: {
  student: StudentView;
  /** Ligne de contexte sous le nom : classe et salle. */
  contextLabel: string;
  pinned: boolean;
  relations: StudentCardRelation[];
  onTogglePin: () => void;
  /** Ouvre la fiche en popup, la seule forme MODIFIABLE de cette fiche. */
  onEdit: () => void;
  onRemove: () => void;
  onClose: () => void;
}) {
  const needs = [
    student.needsFront ? "Doit être devant" : null,
    student.leftHanded ? "Gaucher" : null,
  ].filter((label): label is string => label !== null);

  return (
    <section className="overflow-hidden rounded-card border border-border bg-surface">
      {/* En-tête sur trame de points, comme dans la maquette : c'est ce qui le
          détache du corps de la fiche sans y poser une couleur de plus. */}
      <header className="halftone flex items-center gap-3 border-b border-border p-3">
        <span
          aria-hidden="true"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-border bg-surface text-sm font-bold"
        >
          {initials(student)}
        </span>

        <div className="min-w-0 flex-1">
          <p className="truncate text-base font-bold leading-tight">
            {studentFullName(student)}
          </p>
          <p className="eyebrow mt-1 truncate">{contextLabel}</p>
        </div>

        <button
          type="button"
          onClick={onClose}
          aria-label="Fermer la fiche"
          className="shrink-0 rounded-control p-1.5 text-muted transition-colors hover:bg-surface-muted hover:text-foreground"
        >
          <XIcon />
        </button>
      </header>

      <div className="flex flex-col gap-4 p-3">
        {needs.length > 0 && (
          <Section title="Besoins particuliers">
            <div className="flex flex-wrap gap-1.5">
              {needs.map((need) => (
                <span
                  key={need}
                  className="rounded-full bg-primary-soft px-2.5 py-1 text-xs font-medium text-primary"
                >
                  {need}
                </span>
              ))}
            </div>
          </Section>
        )}

        {/* La jauge à cinq segments de la maquette, partagée avec la liste
            d'élèves de la page de classe (`DifficultyMeter`). */}
        <Section title="Difficulté">
          <DifficultyMeter
            difficulty={student.difficulty}
            className="rounded-control border border-border bg-surface-muted/60 p-2.5"
          />
        </Section>

        {relations.length > 0 && (
          <Section title="Relations">
            <ul className="flex flex-col gap-1.5">
              {relations.map((relation) => {
                const separate = relation.type === "INCOMPATIBLE";
                return (
                  <li
                    key={relation.id}
                    className={cn(
                      "flex items-center gap-2 rounded-control px-2.5 py-2",
                      separate ? "bg-danger-soft" : "bg-accent-soft",
                    )}
                  >
                    <span
                      className={cn("eyebrow shrink-0", separate ? "text-danger" : "text-accent")}
                    >
                      {separate ? "Séparer" : "Rapprocher"}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-xs font-medium">
                      {studentFullName(relation.other)}
                    </span>
                  </li>
                );
              })}
            </ul>
          </Section>
        )}

        {student.comment && (
          <Section title="Note privée">
            <p className="rounded-control border border-border bg-surface-muted/60 p-2.5 text-xs leading-relaxed text-muted">
              {student.comment}
            </p>
          </Section>
        )}

        <div className="flex flex-col gap-1.5">
          <Button
            size="sm"
            variant={pinned ? "secondary" : "primary"}
            onClick={onTogglePin}
            className="w-full"
          >
            {pinned ? <UnlockIcon /> : <LockIcon />}
            {pinned ? "Déverrouiller" : "Verrouiller ici"}
          </Button>

          {/* La ligne finale de la maquette : un bouton plein à l'encre, un
              bouton bordé à côté. « Modifier » ouvre la fiche en popup — la
              même que celle de la page de classe. */}
          <div className="flex gap-1.5">
            <Button size="sm" variant="ink" onClick={onEdit} className="flex-1">
              Modifier
            </Button>
            <Button size="sm" variant="secondary" onClick={onRemove}>
              Retirer
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}

/** Intitulé de section : la signature typographique de `.eyebrow`. */
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="eyebrow mb-2">{title}</h3>
      {children}
    </div>
  );
}
