"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";

import { deleteStudent } from "@/actions/students";
import { StudentDialog, type StudentDialogRelation } from "@/components/class/student-dialog";
import { Button } from "@/components/ui/button";
import { CARD, CARD_INTERACTIVE } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { DifficultyLegend, DifficultyMeter } from "@/components/ui/difficulty-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { FieldError, Input } from "@/components/ui/field";
import { EmptyClassArt, PlusIcon, SearchIcon, TrashIcon } from "@/components/ui/icons";
import type { RelationView, StudentView } from "@/lib/view-models";

/**
 * Liste des élèves d'une classe.
 *
 * Disposée en GRILLE et non en colonne unique : à trente élèves, la liste
 * empilée occupait deux écrans de haut et obligeait à faire défiler pour
 * atteindre les sections suivantes. Deux à trois colonnes selon la largeur, et
 * un filtre par nom pour les grandes classes.
 *
 * L'ÉDITION SE FAIT EN POPUP (`StudentDialog`, la fiche de la maquette 2c), et
 * non plus en dépliant un formulaire à la place de la carte. Le formulaire en
 * ligne prenait toute la largeur de la grille, faisait sauter les cartes
 * voisines d'une ligne à l'autre, et l'on perdait de vue l'élève qu'on était
 * en train de modifier.
 */
export function StudentManager({
  classGroupId,
  classGroupName,
  students,
  relations,
}: {
  classGroupId: string;
  classGroupName: string;
  students: StudentView[];
  relations: RelationView[];
}) {
  const router = useRouter();
  /** `"new"` pour une création, un identifiant pour une modification. */
  const [editing, setEditing] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  /** Élève dont la suppression attend confirmation. */
  const [deleting, setDeleting] = useState<StudentView | null>(null);
  const [pending, startTransition] = useTransition();

  const needle = query.trim().toLowerCase();
  const visible = needle
    ? students.filter((student) =>
        `${student.lastName} ${student.firstName}`.toLowerCase().includes(needle),
      )
    : students;

  function handleDelete() {
    const student = deleting;
    if (!student) return;

    startTransition(async () => {
      const result = await deleteStudent(student.id);
      if (!result.ok) setError(result.error);
      else router.refresh();
      setDeleting(null);
    });
  }

  const editingStudent = editing && editing !== "new"
    ? (students.find((student) => student.id === editing) ?? undefined)
    : undefined;

  /**
   * Relations de l'élève ouvert, l'AUTRE élève déjà résolu.
   *
   * `StudentRelation` est normalisée (`studentAId < studentBId`) : l'élève
   * courant peut donc être d'un côté comme de l'autre, et c'est ici qu'on
   * tranche — la fiche n'a pas à connaître cette convention.
   */
  const editingRelations = useMemo<StudentDialogRelation[]>(() => {
    const id = editingStudent?.id;
    if (!id) return [];

    const nameById = new Map(
      students.map((student): [string, string] => [
        student.id,
        `${student.firstName} ${student.lastName}`,
      ]),
    );

    return relations
      .filter((relation) => relation.studentAId === id || relation.studentBId === id)
      .map((relation) => {
        const otherId = relation.studentAId === id ? relation.studentBId : relation.studentAId;
        const otherName = nameById.get(otherId);
        return otherName ? { id: relation.id, type: relation.type, otherName } : null;
      })
      .filter((entry): entry is StudentDialogRelation => entry !== null);
  }, [editingStudent, relations, students]);

  return (
    <section>
      <ConfirmDialog
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        onConfirm={handleDelete}
        loading={pending}
        title={deleting ? `Supprimer ${deleting.firstName} ${deleting.lastName} ?` : ""}
        description="Ses incompatibilités et ses places dans les plans de classe seront également supprimées."
        confirmLabel="Supprimer l'élève"
      />

      <StudentDialog
        open={editing !== null}
        onClose={() => setEditing(null)}
        classGroupId={classGroupId}
        student={editingStudent}
        contextLabel={classGroupName}
        relations={editingRelations}
      />

      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <h2 className="eyebrow">
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
          <Button size="sm" onClick={() => setEditing("new")}>
            <PlusIcon />
            Ajouter un élève
          </Button>
        </div>
      </div>

      <FieldError message={error} />

      {students.length === 0 ? (
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
          {visible.map((student) => (
            // La fiche de la maquette 2c, en réduction : médaillon à
            // initiales, nom, jauge de difficulté à cinq segments, pastilles
            // de besoins, note encadrée. C'est la MÊME fiche que celle du
            // popup et du panneau de l'éditeur de plan — un élève se reconnaît
            // donc à la même carte partout dans l'application.
              <li
                key={student.id}
                className={`flex flex-col ${CARD} ${CARD_INTERACTIVE}`}
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
                    <Button size="sm" variant="ghost" onClick={() => setEditing(student.id)}>
                      Modifier
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={pending}
                      onClick={() => setDeleting(student)}
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
          ))}
        </ul>
      )}

      {students.length > 0 && <DifficultyLegend className="mt-3" />}
    </section>
  );
}
