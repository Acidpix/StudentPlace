"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition, type FormEvent } from "react";

import { createRelation, deleteRelation } from "@/actions/relations";
import { Button } from "@/components/ui/button";
import { CARD } from "@/components/ui/card";
import { FieldError, Label, Select } from "@/components/ui/field";
import { TrashIcon, WarningIcon } from "@/components/ui/icons";
import type { RelationType } from "@/lib/domain";
import { studentFullName, type RelationView, type StudentView } from "@/lib/view-models";

export function RelationManager({
  classGroupId,
  students,
  relations,
}: {
  classGroupId: string;
  students: StudentView[];
  relations: RelationView[];
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const nameById = useMemo(
    () => new Map(students.map((student): [string, string] => [student.id, studentFullName(student)])),
    [students],
  );

  const incompatibles = relations.filter((relation) => relation.type === "INCOMPATIBLE");
  const affinities = relations.filter((relation) => relation.type === "AFFINITY");

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const form = event.currentTarget;
    const formData = new FormData(form);
    const input = {
      studentAId: String(formData.get("studentAId") ?? ""),
      studentBId: String(formData.get("studentBId") ?? ""),
      type: String(formData.get("type") ?? "INCOMPATIBLE") as RelationType,
    };

    startTransition(async () => {
      const result = await createRelation(classGroupId, input);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      form.reset();
      router.refresh();
    });
  }

  function handleDelete(id: string) {
    startTransition(async () => {
      const result = await deleteRelation(id);
      if (!result.ok) setError(result.error);
      else router.refresh();
    });
  }

  if (students.length < 2) {
    return (
      <section>
        <h2 className="eyebrow mb-3">Incompatibilités et affinités</h2>
        <p className="rounded-card border border-dashed border-border p-6 text-center text-sm text-muted">
          Ajoutez au moins deux élèves pour déclarer une relation.
        </p>
      </section>
    );
  }

  return (
    <section>
      <h2 className="eyebrow mb-1">Incompatibilités et affinités</h2>
      <p className="mb-3 text-sm text-muted">
        Deux élèves incompatibles ne seront jamais assis à proximité l&apos;un de l&apos;autre ; le
        contraire est signalé en rouge dans l&apos;éditeur.
      </p>

      <form onSubmit={handleSubmit} className={`${CARD} p-4`}>
        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <Label htmlFor="studentAId">Élève</Label>
            <Select id="studentAId" name="studentAId" required>
              {students.map((student) => (
                <option key={student.id} value={student.id}>
                  {studentFullName(student)}
                </option>
              ))}
            </Select>
          </div>

          <div>
            <Label htmlFor="studentBId">Et</Label>
            <Select id="studentBId" name="studentBId" required defaultValue={students[1]?.id}>
              {students.map((student) => (
                <option key={student.id} value={student.id}>
                  {studentFullName(student)}
                </option>
              ))}
            </Select>
          </div>

          <div>
            <Label htmlFor="type">Relation</Label>
            <Select id="type" name="type" defaultValue="INCOMPATIBLE">
              <option value="INCOMPATIBLE">Ne doivent pas être voisins</option>
              <option value="AFFINITY">À rapprocher si possible</option>
            </Select>
          </div>
        </div>

        <FieldError message={error} />

        <Button type="submit" size="sm" className="mt-3" loading={pending}>
          {pending ? "Ajout…" : "Ajouter la relation"}
        </Button>
      </form>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <RelationList
          title="Ne doivent pas être voisins"
          emptyLabel="Aucune incompatibilité déclarée."
          relations={incompatibles}
          nameById={nameById}
          onDelete={handleDelete}
          pending={pending}
          tone="danger"
        />
        <RelationList
          title="À rapprocher si possible"
          emptyLabel="Aucune affinité déclarée."
          relations={affinities}
          nameById={nameById}
          onDelete={handleDelete}
          pending={pending}
          tone="neutral"
        />
      </div>
    </section>
  );
}

function RelationList({
  title,
  emptyLabel,
  relations,
  nameById,
  onDelete,
  pending,
  tone,
}: {
  title: string;
  emptyLabel: string;
  relations: RelationView[];
  nameById: Map<string, string>;
  onDelete: (id: string) => void;
  pending: boolean;
  tone: "danger" | "neutral";
}) {
  return (
    <div className={`${CARD} p-4`}>
      <h3 className="eyebrow mb-2 flex items-center gap-1.5">
        {tone === "danger" && <WarningIcon className="text-danger" />}
        {title}
      </h3>

      {relations.length === 0 ? (
        <p className="text-sm text-muted">{emptyLabel}</p>
      ) : (
        <ul className="divide-y divide-border">
          {relations.map((relation) => (
            <li key={relation.id} className="flex items-center justify-between gap-2 py-2 text-sm">
              <span>
                {nameById.get(relation.studentAId) ?? "?"}
                <span className="mx-1.5 text-muted">↔</span>
                {nameById.get(relation.studentBId) ?? "?"}
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onDelete(relation.id)}
                disabled={pending}
                aria-label="Supprimer la relation"
                className="hover:text-danger"
              >
                <TrashIcon />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
