"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";

import { createStudent, deleteStudent, updateStudent } from "@/actions/students";
import { Button } from "@/components/ui/button";
import { DifficultyLegend, DifficultyMeter } from "@/components/ui/difficulty-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { FieldError, Input, Label, Select, Textarea } from "@/components/ui/field";
import { EmptyClassArt, PlusIcon, SearchIcon, TrashIcon } from "@/components/ui/icons";
import { DIFFICULTY_LABELS, DIFFICULTY_VALUES } from "@/lib/domain";
import type { StudentView } from "@/lib/view-models";

/**
 * Liste des élèves d'une classe.
 *
 * Disposée en GRILLE et non en colonne unique : à trente élèves, la liste
 * empilée occupait deux écrans de haut et obligeait à faire défiler pour
 * atteindre les sections suivantes. Deux à trois colonnes selon la largeur, et
 * un filtre par nom pour les grandes classes.
 */
export function StudentManager({
  classGroupId,
  students,
}: {
  classGroupId: string;
  students: StudentView[];
}) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const needle = query.trim().toLowerCase();
  const visible = needle
    ? students.filter((student) =>
        `${student.lastName} ${student.firstName}`.toLowerCase().includes(needle),
      )
    : students;

  function handleDelete(student: StudentView) {
    const confirmed = window.confirm(
      `Supprimer ${student.firstName} ${student.lastName} ? Ses incompatibilités et ses places dans les plans de classe seront également supprimées.`,
    );
    if (!confirmed) return;

    startTransition(async () => {
      const result = await deleteStudent(student.id);
      if (!result.ok) setError(result.error);
      else router.refresh();
    });
  }

  return (
    <section>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-medium">
          Élèves <span className="text-muted">({students.length})</span>
        </h2>

        <div className="flex flex-wrap items-center gap-2">
          {/* La largeur est portée par le conteneur : `cn()` est une simple
              concaténation, une classe `w-*` passée à `Input` n'écraserait pas
              le `w-full` de CONTROL_BASE de façon fiable. */}
          {students.length > 8 && (
            <div className="relative w-52">
              <SearchIcon className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted" />
              <Input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Rechercher un élève"
                aria-label="Rechercher un élève"
                className="pl-8"
              />
            </div>
          )}
          {!adding && (
            <Button size="sm" onClick={() => setAdding(true)}>
              <PlusIcon />
              Ajouter un élève
            </Button>
          )}
        </div>
      </div>

      <FieldError message={error} />

      {adding && (
        <StudentForm
          classGroupId={classGroupId}
          onDone={() => {
            setAdding(false);
            router.refresh();
          }}
          onCancel={() => setAdding(false)}
        />
      )}

      {students.length === 0 && !adding ? (
        <EmptyState
          Illustration={EmptyClassArt}
          title="Aucun élève"
          description="Ajoutez-les un par un, ou importez une liste — un nom par ligne suffit."
        />
      ) : visible.length === 0 ? (
        <p className="rounded-card border border-dashed border-border p-6 text-center text-sm text-muted">
          Aucun élève ne correspond à « {query} ».
        </p>
      ) : (
        <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((student) =>
            editingId === student.id ? (
              // Le formulaire garde ses deux colonnes : il prend toute la largeur.
              <li key={student.id} className="col-span-full">
                <StudentForm
                  classGroupId={classGroupId}
                  student={student}
                  onDone={() => {
                    setEditingId(null);
                    router.refresh();
                  }}
                  onCancel={() => setEditingId(null)}
                />
              </li>
            ) : (
              // La fiche de la maquette 2c, en réduction : médaillon à
              // initiales, nom, jauge de difficulté à cinq segments, pastilles
              // de besoins, note encadrée. C'est la MÊME fiche que celle du
              // panneau de l'éditeur de plan — un élève se reconnaît donc à la
              // même carte partout dans l'application.
              <li
                key={student.id}
                className="material flex flex-col rounded-card border border-border bg-surface shadow-soft transition-colors hover:border-primary/40"
              >
                <div className="halftone flex items-center gap-2.5 border-b border-border p-2.5">
                  <span
                    aria-hidden="true"
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border bg-surface text-xs font-bold shadow-soft"
                  >
                    {`${student.firstName.charAt(0)}${student.lastName.charAt(0)}`.toUpperCase()}
                  </span>

                  <p className="min-w-0 flex-1 truncate text-sm font-bold">
                    {student.lastName} {student.firstName}
                  </p>

                  <div className="flex shrink-0 items-center gap-0.5">
                    <Button size="sm" variant="ghost" onClick={() => setEditingId(student.id)}>
                      Modifier
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={pending}
                      onClick={() => handleDelete(student)}
                      aria-label={`Supprimer ${student.firstName} ${student.lastName}`}
                    >
                      <TrashIcon />
                    </Button>
                  </div>
                </div>

                <div className="flex flex-1 flex-col gap-2.5 p-2.5">
                  <DifficultyMeter difficulty={student.difficulty} />

                  {(student.needsFront || student.leftHanded) && (
                    <div className="flex flex-wrap gap-1.5">
                      {student.needsFront && (
                        <span className="rounded-full bg-primary-soft px-2 py-0.5 text-[11px] font-medium text-primary">
                          1er rang
                        </span>
                      )}
                      {student.leftHanded && (
                        <span className="rounded-full bg-primary-soft px-2 py-0.5 text-[11px] font-medium text-primary">
                          Gaucher
                        </span>
                      )}
                    </div>
                  )}

                  {student.comment && (
                    <p
                      className="mt-auto rounded-control border border-border bg-surface-muted/60 p-2 text-xs leading-snug text-muted"
                      title={student.comment}
                    >
                      {student.comment}
                    </p>
                  )}
                </div>
              </li>
            ),
          )}
        </ul>
      )}

      {students.length > 0 && <DifficultyLegend className="mt-3" />}
    </section>
  );
}

function StudentForm({
  classGroupId,
  student,
  onDone,
  onCancel,
}: {
  classGroupId: string;
  student?: StudentView;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const formData = new FormData(event.currentTarget);
    const input = {
      firstName: String(formData.get("firstName") ?? ""),
      lastName: String(formData.get("lastName") ?? ""),
      comment: String(formData.get("comment") ?? ""),
      difficulty: Number(formData.get("difficulty") ?? 1),
      needsFront: formData.get("needsFront") === "on",
      leftHanded: formData.get("leftHanded") === "on",
    };

    startTransition(async () => {
      const result = student
        ? await updateStudent(student.id, input)
        : await createStudent(classGroupId, input);

      if (!result.ok) setError(result.error);
      else onDone();
    });
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mb-3 rounded-card border border-border bg-surface p-4"
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label htmlFor="lastName">Nom</Label>
          <Input id="lastName" name="lastName" required autoFocus defaultValue={student?.lastName} />
        </div>
        <div>
          <Label htmlFor="firstName">Prénom</Label>
          <Input id="firstName" name="firstName" required defaultValue={student?.firstName} />
        </div>
      </div>

      <div className="mt-3">
        <Label htmlFor="difficulty">Note de difficulté</Label>
        <Select id="difficulty" name="difficulty" defaultValue={String(student?.difficulty ?? 1)}>
          {DIFFICULTY_VALUES.map((level) => (
            <option key={level} value={level}>
              {level} — {DIFFICULTY_LABELS[level]}
            </option>
          ))}
        </Select>
        <p className="mt-1.5 text-xs text-muted">
          Plus la note est élevée, plus l&apos;élève sera placé près du bureau et à l&apos;écart
          des autres élèves difficiles.
        </p>
      </div>

      <div className="mt-3">
        <Label htmlFor="comment">Commentaire</Label>
        <Textarea
          id="comment"
          name="comment"
          defaultValue={student?.comment}
          placeholder="Observations utiles au placement…"
        />
        <p className="mt-1.5 text-xs text-muted">
          Chiffré dans la base et exclu du PDF par défaut.
        </p>
      </div>

      <fieldset className="mt-3">
        <legend className="mb-1.5 text-sm font-medium">Besoins particuliers</legend>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="needsFront" defaultChecked={student?.needsFront} />
          Doit être au premier rang (vue, audition)
        </label>
        <label className="mt-1.5 flex items-center gap-2 text-sm">
          <input type="checkbox" name="leftHanded" defaultChecked={student?.leftHanded} />
          Gaucher (à placer en bout de table)
        </label>
      </fieldset>

      <FieldError message={error} />

      <div className="mt-4 flex gap-2">
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "Enregistrement…" : student ? "Enregistrer" : "Ajouter"}
        </Button>
        <Button type="button" size="sm" variant="secondary" onClick={onCancel}>
          Annuler
        </Button>
      </div>
    </form>
  );
}
