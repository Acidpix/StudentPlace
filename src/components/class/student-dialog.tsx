"use client";

import { useRouter } from "next/navigation";
import { useId, useMemo, useState, useTransition, type FormEvent } from "react";

import { createRelation, deleteRelation } from "@/actions/relations";
import { createStudent, updateStudent } from "@/actions/students";
import { Button } from "@/components/ui/button";
import { FieldError, Select } from "@/components/ui/field";
import { PlusIcon, XIcon } from "@/components/ui/icons";
import { Modal } from "@/components/ui/modal";
import { cn } from "@/lib/cn";
import {
  BEHAVIOR_COLORS,
  BEHAVIOR_LABELS,
  BEHAVIOR_SHORT_LABELS,
  BEHAVIOR_VALUES,
  type Behavior,
  type RelationType,
} from "@/lib/domain";
import { studentFullName, type StudentView } from "@/lib/view-models";

/**
 * Fiche élève, en POPUP — la maquette 2c, rendue modifiable.
 *
 * La maquette montre une fiche en lecture ; ici c'est le formulaire d'édition,
 * et sa structure est reprise section pour section : en-tête à médaillon sur
 * trame de points, BESOINS PARTICULIERS en pastilles, COMPORTEMENT en jauge à
 * cinq segments, RELATIONS, NOTE PRIVÉE, puis « Enregistrer » à l'encre.
 *
 * Trois partis pris pour que l'édition n'abîme pas la maquette :
 *
 *  - le NOM S'ÉDITE DANS L'EN-TÊTE. Deux champs transparents posés là où la
 *    maquette écrit le nom, plutôt qu'une section « identité » de plus : la
 *    fiche garde ses quatre sections et son en-tête intact.
 *  - le médaillon et le nom affiché SUIVENT LA SAISIE, d'où deux états
 *    contrôlés. C'est ce qui fait de l'en-tête un aperçu, et pas un décor.
 *  - les RELATIONS SE MODIFIENT ICI, alors qu'elles se lisaient seulement.
 *    Elles se déclarent toujours à deux élèves, mais le premier est celui de
 *    la fiche : il ne reste qu'un choix à faire, d'où un seul sélecteur. Il
 *    fallait sinon fermer la boîte et descendre sur la page de classe — ou,
 *    depuis l'éditeur de plan, quitter le plan.
 *
 * Les relations, elles, s'enregistrent IMMÉDIATEMENT : ce sont des actions
 * serveur à part entière, pas des champs du formulaire. Le texte de la section
 * le dit, sans quoi on croirait qu'« Annuler » les défait.
 */

export interface StudentDialogRelation {
  id: string;
  type: RelationType;
  /** L'AUTRE élève de la paire. Le nom se résout depuis `classmates`. */
  otherId: string;
}

export function StudentDialog({
  open,
  onClose,
  classGroupId,
  student,
  contextLabel,
  relations = [],
  classmates = [],
}: {
  open: boolean;
  onClose: () => void;
  classGroupId: string;
  /** Absent : la boîte crée un élève au lieu d'en modifier un. */
  student?: StudentView;
  /** Ligne sous le nom : la classe, et la salle quand on vient d'un plan. */
  contextLabel: string;
  relations?: StudentDialogRelation[];
  /** Toute la classe — l'élève courant compris, il est filtré ici. */
  classmates?: StudentView[];
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
        classmates={classmates}
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
  classmates,
  onClose,
}: {
  titleId: string;
  classGroupId: string;
  student?: StudentView;
  contextLabel: string;
  relations: StudentDialogRelation[];
  classmates: StudentView[];
  onClose: () => void;
}) {
  const router = useRouter();

  const [firstName, setFirstName] = useState(student?.firstName ?? "");
  const [lastName, setLastName] = useState(student?.lastName ?? "");
  const [behavior, setBehavior] = useState<Behavior>(student?.behavior ?? 1);
  const [needsFront, setNeedsFront] = useState(student?.needsFront ?? false);
  const [leftHanded, setLeftHanded] = useState(student?.leftHanded ?? false);
  const [comment, setComment] = useState(student?.comment ?? "");

  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const initials =
    `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase() || "··";

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const input = { firstName, lastName, comment, behavior, needsFront, leftHanded };

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
        <Section title="Comportement">
          <BehaviorChoice value={behavior} onChange={setBehavior} />
          <p className="mt-2 text-xs leading-snug text-muted">
            Plus la note est élevée, plus l&apos;élève est placé près du bureau et à l&apos;écart
            des autres élèves agités.
          </p>
        </Section>

        {/* Réservée à la MODIFICATION : une relation a besoin des deux
            identifiants, et celui d'un élève en cours de création n'existe pas
            encore. */}
        {student && (
          <Section title="Relations">
            <RelationEditor
              classGroupId={classGroupId}
              student={student}
              relations={relations}
              classmates={classmates}
            />
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
      {/* `.eyebrow` vit dans `@layer components` précisément pour qu'un
          utilitaire la surcharge : `font-bold` et `text-foreground` passent
          devant sans règle CSS nouvelle. Les intitulés de la fiche se
          détachaient mal en 600 sur `--muted`. */}
      <h3 className="eyebrow mb-2 font-bold text-foreground">{title}</h3>
      {children}
    </div>
  );
}

/**
 * Les relations de l'élève, modifiables sur place.
 *
 * Une croix par relation pour retirer, deux boutons pour ajouter — un par
 * sens. Chaque bouton ouvre un SÉLECTEUR NATIF plutôt qu'un menu maison :
 * c'est déjà le choix fait pour le sélecteur de plans, et le clavier, le
 * tactile et les lecteurs d'écran viennent avec. Un menu positionné en absolu
 * aurait de surcroît été rogné par le défilement du corps de la boîte.
 *
 * Les élèves DÉJÀ reliés ne sont pas proposés : une paire ne porte qu'une
 * relation (`@@unique`), et `createRelation` remplacerait silencieusement le
 * sens de la première. Pour changer « Séparer » en « Rapprocher », on retire
 * puis on rajoute.
 */
function RelationEditor({
  classGroupId,
  student,
  relations,
  classmates,
}: {
  classGroupId: string;
  student: StudentView;
  relations: StudentDialogRelation[];
  classmates: StudentView[];
}) {
  const router = useRouter();
  const [adding, setAdding] = useState<RelationType | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const others = useMemo(
    () => classmates.filter((candidate) => candidate.id !== student.id),
    [classmates, student.id],
  );

  const nameById = useMemo(
    () => new Map(others.map((other): [string, string] => [other.id, studentFullName(other)])),
    [others],
  );

  const candidates = useMemo(() => {
    const taken = new Set(relations.map((relation) => relation.otherId));
    return others.filter((other) => !taken.has(other.id));
  }, [others, relations]);

  function handleAdd(otherId: string) {
    if (!adding || otherId === "") return;
    setError(null);
    const type = adding;

    startTransition(async () => {
      const result = await createRelation(classGroupId, {
        studentAId: student.id,
        studentBId: otherId,
        type,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setAdding(null);
      // La liste vient des props : c'est le rafraîchissement de la page qui la
      // met à jour. La boîte, elle, ne se remonte pas — la saisie en cours
      // dans les autres champs survit.
      router.refresh();
    });
  }

  function handleRemove(id: string) {
    setError(null);
    startTransition(async () => {
      const result = await deleteRelation(id);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <>
      {relations.length > 0 ? (
        <ul className="flex flex-col gap-1.5">
          {relations.map((relation) => {
            const separate = relation.type === "INCOMPATIBLE";
            const otherName = nameById.get(relation.otherId) ?? "Élève inconnu";

            return (
              <li
                key={relation.id}
                className={cn(
                  "flex items-center gap-2 rounded-control py-1.5 pl-2.5 pr-1.5",
                  separate ? "bg-danger-soft" : "bg-accent-soft",
                )}
              >
                <span
                  className={cn("eyebrow shrink-0", separate ? "text-danger" : "text-accent")}
                >
                  {separate ? "Séparer" : "Rapprocher"}
                </span>
                <span className="min-w-0 flex-1 truncate text-xs font-medium">{otherName}</span>

                {/* `type="button"` impératif : nous sommes dans le `<form>` de
                    la fiche, et un bouton sans type l'enverrait. */}
                <button
                  type="button"
                  onClick={() => handleRemove(relation.id)}
                  disabled={pending}
                  title="Supprimer la relation"
                  aria-label={`Supprimer la relation avec ${otherName}`}
                  className={cn(
                    "shrink-0 rounded-full p-1 transition-colors disabled:opacity-40",
                    separate
                      ? "text-danger hover:bg-danger hover:text-white"
                      : "text-accent hover:bg-accent hover:text-accent-foreground",
                  )}
                >
                  <XIcon />
                </button>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="text-xs leading-snug text-muted">Aucune relation déclarée.</p>
      )}

      {adding ? (
        <div className="mt-2 flex items-center gap-2">
          {/* Aucune classe passée au `Select` : `cn()` concatène sans
              `tailwind-merge`, une taille ou une hauteur ajoutée ici
              cohabiterait avec celle de `CONTROL_BASE` à spécificité égale. */}
          <Select
            autoFocus
            defaultValue=""
            disabled={pending}
            aria-label={
              adding === "INCOMPATIBLE" ? "Élève à séparer" : "Élève à rapprocher"
            }
            onChange={(event) => handleAdd(event.target.value)}
          >
            <option value="" disabled>
              Choisir un élève…
            </option>
            {candidates.map((candidate) => (
              <option key={candidate.id} value={candidate.id}>
                {studentFullName(candidate)}
              </option>
            ))}
          </Select>
          <Button
            variant="ghost"
            size="sm"
            className="shrink-0"
            disabled={pending}
            onClick={() => {
              setAdding(null);
              setError(null);
            }}
          >
            Annuler
          </Button>
        </div>
      ) : candidates.length > 0 ? (
        <div className="mt-2 flex gap-2">
          {/* La teinte est portée par l'icône seule : un `text-*` sur le bouton
              se disputerait le `text-foreground` de la variante secondaire, à
              spécificité égale et sans arbitre. */}
          <Button
            variant="secondary"
            size="sm"
            className="flex-1"
            onClick={() => {
              setAdding("AFFINITY");
              setError(null);
            }}
          >
            <span className="text-accent">
              <PlusIcon />
            </span>
            Rapprocher
          </Button>
          <Button
            variant="secondary"
            size="sm"
            className="flex-1"
            onClick={() => {
              setAdding("INCOMPATIBLE");
              setError(null);
            }}
          >
            <span className="text-danger">
              <PlusIcon />
            </span>
            Séparer
          </Button>
        </div>
      ) : (
        <p className="mt-2 text-xs leading-snug text-muted">
          {others.length === 0
            ? "Ajoutez un second élève à la classe pour déclarer une relation."
            : "Tous les autres élèves ont déjà une relation avec celui-ci."}
        </p>
      )}

      <FieldError message={error} />

      <p className="mt-2 text-xs leading-snug text-muted">
        Les relations sont enregistrées immédiatement, sans attendre « Enregistrer ». Pour
        changer le sens de l&apos;une d&apos;elles, retirez-la puis rajoutez-la.
      </p>
    </>
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
 * La jauge de comportement, en groupe de boutons radio.
 *
 * Le mot à gauche, cinq segments à droite : la forme de `BehaviorMeter`, en
 * modifiable. Chaque segment allume tous ceux qui le précèdent — on lit un
 * niveau, pas une case isolée.
 */
function BehaviorChoice({
  value,
  onChange,
}: {
  value: Behavior;
  onChange: (value: Behavior) => void;
}) {
  const name = useId();

  return (
    <fieldset className="flex items-center gap-3 rounded-control border border-border bg-surface-muted/60 p-2.5">
      <legend className="sr-only">Note de comportement</legend>

      <span className="shrink-0 text-sm font-bold" style={{ color: BEHAVIOR_COLORS[value] }}>
        {BEHAVIOR_SHORT_LABELS[value]}
      </span>

      <span className="flex flex-1 gap-1">
        {BEHAVIOR_VALUES.map((level) => (
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
              title={`${level}/5 — ${BEHAVIOR_LABELS[level]}`}
              className={cn(
                "block h-6 rounded-[4px] transition-colors",
                "peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-primary",
              )}
              style={{
                backgroundColor:
                  level <= value ? BEHAVIOR_COLORS[value] : "var(--surface-muted)",
              }}
            />
            <span className="sr-only">
              {level} sur 5, {BEHAVIOR_LABELS[level]}
            </span>
          </label>
        ))}
      </span>
    </fieldset>
  );
}
