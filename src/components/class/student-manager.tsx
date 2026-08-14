"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";

import { createStudent, deleteStudent, updateStudent } from "@/actions/students";
import { Button } from "@/components/ui/button";
import { DifficultyBadge, DifficultyLegend } from "@/components/ui/difficulty-badge";
import { FieldError, Input, Label, Select, Textarea } from "@/components/ui/field";
import { PlusIcon, TrashIcon } from "@/components/ui/icons";
import { DIFFICULTY_LABELS, DIFFICULTY_VALUES } from "@/lib/domain";
import type { StudentView } from "@/lib/view-models";

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
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleDelete(student: StudentView) {
    const confirmed = window.confirm(
      `Supprimer ${student.firstName} ${student.lastName} ? Ses incompatibilités et ses places dans les plans seront également supprimées.`,
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
        <h2 className="font-medium">Élèves</h2>
        {!adding && (
          <Button size="sm" onClick={() => setAdding(true)}>
            <PlusIcon />
            Ajouter un élève
          </Button>
        )}
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
        <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted">
          Aucun élève. Ajoutez-les un par un, ou importez une liste depuis un tableur.
        </p>
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface">
          {students.map((student) =>
            editingId === student.id ? (
              <li key={student.id} className="p-3">
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
              <li key={student.id} className="flex flex-wrap items-center gap-3 p-3">
                <DifficultyBadge difficulty={student.difficulty} />

                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">
                    {student.lastName} {student.firstName}
                  </p>
                  {student.comment && (
                    <p className="truncate text-sm text-muted" title={student.comment}>
                      {student.comment}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-1.5 text-xs text-muted">
                  {student.needsFront && (
                    <span className="rounded bg-surface-muted px-1.5 py-0.5">1er rang</span>
                  )}
                  {student.leftHanded && (
                    <span className="rounded bg-surface-muted px-1.5 py-0.5">Gaucher</span>
                  )}
                </div>

                <div className="flex gap-1">
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
      className="mb-3 rounded-xl border border-border bg-surface p-4"
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
