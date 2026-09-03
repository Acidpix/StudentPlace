"use client";

import { useRouter } from "next/navigation";
import { useId, useState, useTransition, type FormEvent } from "react";

import { createStudent, updateStudent } from "@/actions/students";
import { Button } from "@/components/ui/button";
import { FieldError } from "@/components/ui/field";
import { XIcon } from "@/components/ui/icons";
import { Modal } from "@/components/ui/modal";
import { cn } from "@/lib/cn";
import {
  DIFFICULTY_COLORS,
  DIFFICULTY_LABELS,
  DIFFICULTY_SHORT_LABELS,
  DIFFICULTY_VALUES,
  type Difficulty,
  type RelationType,
} from "@/lib/domain";
import { studentFullName, type StudentView } from "@/lib/view-models";

/**
 * Fiche élève, en POPUP — la maquette 2c, rendue modifiable.
 *
 * La maquette montre une fiche en lecture ; ici c'est le formulaire d'édition,
 * et sa structure est reprise section pour section : en-tête à médaillon sur
 * trame de points, BESOINS PARTICULIERS en pastilles, DIFFICULTÉ en jauge à
 * cinq segments, RELATIONS, NOTE PRIVÉE, puis « Enregistrer » à l'encre.
 *
 * Trois partis pris pour que l'édition n'abîme pas la maquette :
 *
 *  - le NOM S'ÉDITE DANS L'EN-TÊTE. Deux champs transparents posés là où la
 *    maquette écrit le nom, plutôt qu'une section « identité » de plus : la
 *    fiche garde ses quatre sections et son en-tête intact.
 *  - le médaillon et le nom affiché SUIVENT LA SAISIE, d'où deux états
 *    contrôlés. C'est ce qui fait de l'en-tête un aperçu, et pas un décor.
 *  - les RELATIONS restent en LECTURE. Elles se gèrent sur la page de la
 *    classe, où l'on choisit deux élèves ; reproduire ce choix ici demanderait
 *    un second sélecteur d'élève dans une boîte qui parle déjà d'un seul.
 */

export interface StudentDialogRelation {
  id: string;
  type: RelationType;
  otherName: string;
}

export function StudentDialog({
  open,
  onClose,
  classGroupId,
  student,
  contextLabel,
  relations = [],
}: {
  open: boolean;
  onClose: () => void;
  classGroupId: string;
  /** Absent : la boîte crée un élève au lieu d'en modifier un. */
  student?: StudentView;
  /** Ligne sous le nom : la classe, et la salle quand on vient d'un plan. */
  contextLabel: string;
  relations?: StudentDialogRelation[];
}) {
  const titleId = useId();

  return (
    <Modal open={open} onClose={onClose} labelledBy={titleId}>
      <StudentDialogForm
        key={student?.id ?? "new"}
        titleId={titleId}
        classGroupId={classGroupId}
        student={student}
        contextLabel={contextLabel}
        relations={relations}
        onClose={onClose}
      />
    </Modal>
  );
}

function StudentDialogForm({
  titleId,
  classGroupId,
  student,
  contextLabel,
  relations,
  onClose,
}: {
  titleId: string;
  classGroupId: string;
  student?: StudentView;
  contextLabel: string;
  relations: StudentDialogRelation[];
  onClose: () => void;
}) {
  const router = useRouter();

  const [firstName, setFirstName] = useState(student?.firstName ?? "");
  const [lastName, setLastName] = useState(student?.lastName ?? "");
  const [difficulty, setDifficulty] = useState<Difficulty>(student?.difficulty ?? 1);
  const [needsFront, setNeedsFront] = useState(student?.needsFront ?? false);
  const [leftHanded, setLeftHanded] = useState(student?.leftHanded ?? false);
  const [comment, setComment] = useState(student?.comment ?? "");

  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const initials =
    `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase() || "··";
  const displayName =
    firstName || lastName ? `${firstName} ${lastName}`.trim() : "Nouvel élève";

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const input = { firstName, lastName, comment, difficulty, needsFront, leftHanded };

    startTransition(async () => {
      const result = student
        ? await updateStudent(student.id, input)
        : await createStudent(classGroupId, input);

      if (!result.ok) {
        setError(result.error);
        return;
      }
      onClose();
      router.refresh();
    });
  }

  return (
    <form onSubmit={handleSubmit}>
      {/* -------------------------------------------------------- en-tête */}
      <header className="halftone flex items-center gap-3 border-b border-border p-4">
        <span
          aria-hidden="true"
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-border bg-primary-soft text-sm font-bold text-primary shadow-soft"
        >
          {initials}
        </span>

        <div className="min-w-0 flex-1">
          <h2 id={titleId} className="sr-only">
            {student ? `Modifier ${studentFullName(student)}` : "Nouvel élève"}
          </h2>

          {/* Les deux champs remplacent le titre de la maquette, à sa place et
              à sa taille. Transparents au repos, ils ne se distinguent d'un
              titre qu'au survol et au focus. */}
          <div className="flex min-w-0 items-baseline gap-1.5">
            <input
              autoFocus
              required
              value={firstName}
              onChange={(event) => setFirstName(event.target.value)}
              aria-label="Prénom"
              placeholder="Prénom"
              maxLength={60}
              className="w-full min-w-0 rounded-[0.375rem] bg-transparent text-lg font-bold leading-tight outline-none transition-colors placeholder:font-normal placeholder:text-muted hover:bg-surface/70 focus:bg-surface focus:ring-2 focus:ring-primary/30"
            />
            <input
              required
              value={lastName}
              onChange={(event) => setLastName(event.target.value)}
              aria-label="Nom de famille"
              placeholder="Nom"
              maxLength={60}
              className="w-full min-w-0 rounded-[0.375rem] bg-transparent text-lg font-bold leading-tight outline-none transition-colors placeholder:font-normal placeholder:text-muted hover:bg-surface/70 focus:bg-surface focus:ring-2 focus:ring-primary/30"
            />
          </div>

          <p className="eyebrow mt-1.5 truncate">{contextLabel}</p>
        </div>

        <button
          type="button"
          onClick={onClose}
          aria-label="Fermer"
          className="shrink-0 rounded-control p-1.5 text-muted transition-colors hover:bg-surface-muted hover:text-foreground"
        >
          <XIcon />
        </button>
      </header>

      {/* ---------------------------------------------------------- corps */}
      <div className="flex max-h-[65vh] flex-col gap-4 overflow-y-auto p-4">
        <Section title="Besoins particuliers">
          <div className="flex flex-wrap gap-2">
            <NeedPill
              label="Doit être devant"
              checked={needsFront}
              onChange={setNeedsFront}
              hint="Vue ou audition : l'élève est placé au premier rang."
            />
            <NeedPill
              label="Gaucher"
              checked={leftHanded}
              onChange={setLeftHanded}
              hint="À placer en bout de table."
            />
          </div>
        </Section>

        {/* La jauge de la maquette, rendue cliquable : cinq segments, un par
            niveau de l'échelle du domaine. Un groupe de boutons radio et non
            cinq boutons ordinaires — les flèches du clavier doivent parcourir
            les niveaux, et un seul peut être choisi. */}
        <Section title="Difficulté">
          <DifficultyChoice value={difficulty} onChange={setDifficulty} />
          <p className="mt-2 text-xs leading-snug text-muted">
            Plus la note est élevée, plus l&apos;élève est placé près du bureau et à l&apos;écart
            des autres élèves difficiles.
          </p>
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
                      {relation.otherName}
                    </span>
                  </li>
                );
              })}
            </ul>
            <p className="mt-2 text-xs leading-snug text-muted">
              Les relations se modifient plus bas, dans « Incompatibilités et affinités ».
            </p>
          </Section>
        )}

        <Section title="Note privée">
          <textarea
            value={comment}
            onChange={(event) => setComment(event.target.value)}
            aria-label="Note privée"
            placeholder="Observations utiles au placement…"
            rows={3}
            className="w-full resize-y rounded-control border border-border bg-surface-muted/60 p-2.5 text-xs leading-relaxed text-foreground outline-none transition-[border-color,box-shadow] placeholder:text-muted focus:border-primary focus:ring-2 focus:ring-primary/25"
          />
          <p className="mt-1.5 text-xs leading-snug text-muted">
            Chiffrée dans la base et exclue du PDF par défaut.
          </p>
        </Section>

        <FieldError message={error} />
      </div>

      {/* -------------------------------------------------------- actions */}
      <div className="flex gap-2 border-t border-border p-4">
        {/* Le bouton plein de la maquette est à l'ENCRE et occupe toute la
            largeur restante. */}
        <Button type="submit" variant="ink" loading={pending} className="flex-1">
          {pending ? "Enregistrement…" : student ? "Enregistrer" : "Ajouter l'élève"}
        </Button>
        <Button type="button" variant="secondary" onClick={onClose}>
          Annuler
        </Button>
      </div>
    </form>
  );
}

// ------------------------------------------------------------------ pièces

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="eyebrow mb-2">{title}</h3>
      {children}
    </div>
  );
}

/**
 * Un besoin particulier, en pastille cochable.
 *
 * La case reste un vrai `<input type="checkbox">`, seulement masquée
 * visuellement : le clavier, les lecteurs d'écran et la sémantique du
 * formulaire restent ceux d'une case à cocher. `peer-*` habille le libellé
 * selon son état.
 */
function NeedPill({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label title={hint} className="cursor-pointer">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="peer sr-only"
      />
      <span
        className={cn(
          "inline-block rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
          "peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-primary",
          checked
            ? "bg-primary-soft text-primary"
            : "border border-dashed border-border text-muted hover:text-foreground",
        )}
      >
        {label}
      </span>
    </label>
  );
}

/**
 * La jauge de difficulté, en groupe de boutons radio.
 *
 * Le mot à gauche, cinq segments à droite : la forme de `DifficultyMeter`, en
 * modifiable. Chaque segment allume tous ceux qui le précèdent — on lit un
 * niveau, pas une case isolée.
 */
function DifficultyChoice({
  value,
  onChange,
}: {
  value: Difficulty;
  onChange: (value: Difficulty) => void;
}) {
  const name = useId();

  return (
    <fieldset className="flex items-center gap-3 rounded-control border border-border bg-surface-muted/60 p-2.5">
      <legend className="sr-only">Note de difficulté</legend>

      <span className="shrink-0 text-sm font-bold" style={{ color: DIFFICULTY_COLORS[value] }}>
        {DIFFICULTY_SHORT_LABELS[value]}
      </span>

      <span className="flex flex-1 gap-1">
        {DIFFICULTY_VALUES.map((level) => (
          <label key={level} className="flex-1 cursor-pointer">
            <input
              type="radio"
              name={name}
              value={level}
              checked={value === level}
              onChange={() => onChange(level)}
              className="peer sr-only"
            />
            <span
              title={`${level}/5 — ${DIFFICULTY_LABELS[level]}`}
              className={cn(
                "block h-6 rounded-[4px] transition-colors",
                "peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-primary",
              )}
              style={{
                backgroundColor:
                  level <= value ? DIFFICULTY_COLORS[value] : "var(--surface-muted)",
              }}
            />
            <span className="sr-only">
              {level} sur 5, {DIFFICULTY_LABELS[level]}
            </span>
          </label>
        ))}
      </span>
    </fieldset>
  );
}
