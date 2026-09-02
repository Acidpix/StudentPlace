"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";

import { deleteStudent } from "@/actions/students";
import { StudentDialog, type StudentDialogRelation } from "@/components/class/student-dialog";
import { Button } from "@/components/ui/button";
import { CARD, CARD_INTERACTIVE } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  DifficultyBadge,
  DifficultyLegend,
  DifficultyMeter,
} from "@/components/ui/difficulty-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { FieldError, Input } from "@/components/ui/field";
import { EmptyClassArt, PencilIcon, PlusIcon, SearchIcon, TrashIcon } from "@/components/ui/icons";
import type { RelationView, StudentView } from "@/lib/view-models";

/**
 * Liste des élèves d'une classe.
 *
 * Disposée en GRILLE et non en colonne unique : à trente élèves, la liste
 * empilée occupait deux écrans de haut et obligeait à faire défiler pour
 * atteindre les sections suivantes. Jusqu'à QUATRE colonnes selon la largeur —
 * voir `StudentTile`, dont la compacité est ce qui les rend possibles — et un
 * filtre par nom pour les grandes classes.
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
        <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {visible.map((student) => (
            <li key={student.id}>
              <StudentTile
                student={student}
                disabled={pending}
                onEdit={() => setEditing(student.id)}
                onDelete={() => setDeleting(student)}
              />
            </li>
          ))}
        </ul>
      )}

      {students.length > 0 && <DifficultyLegend className="mt-3" />}
    </section>
  );
}

/**
 * Vignette d'élève — la fiche 2c ramenée à l'essentiel.
 *
 * La version précédente reprenait la fiche entière : bandeau à médaillon,
 * jauge pleine hauteur, pastilles, commentaire encadré. Quatre blocs empilés
 * par élève, soit une classe de trente qui occupait trois écrans. Ici tout
 * tient en DEUX LIGNES, et la grille passe à quatre colonnes.
 *
 * Ce qui a été rendu :
 *
 * - le médaillon rond a laissé la place à une PASTILLE DE DIFFICULTÉ chiffrée,
 *   qui occupe le même coin mais dit quelque chose ;
 * - la jauge est en version `compact` : mêmes cinq segments, hauteur d'un
 *   filet, le mot conservé — la couleur ne porte jamais l'information seule ;
 *   elle sert à comparer deux élèves du regard, pas à être lue ;
 * - les besoins particuliers sont abrégés en deux jetons minuscules, comme
 *   dans le bac de l'éditeur de plan ;
 * - le commentaire tient sur UNE ligne tronquée, le texte entier restant dans
 *   l'infobulle. Il est de toute façon visible en entier dans le popup.
 *
 * Les deux commandes n'apparaissent qu'au SURVOL et au focus clavier : à
 * quatre colonnes, huit boutons par rangée saturaient la grille. `opacity` et
 * non `hidden` — un bouton retiré du flux ferait sauter la mise en page à
 * chaque passage de souris, et resterait inatteignable au clavier.
 */
function StudentTile({
  student,
  disabled,
  onEdit,
  onDelete,
}: {
  student: StudentView;
  disabled: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const needs = [
    student.needsFront ? { key: "front", short: "1er", label: "Doit être au premier rang" } : null,
    student.leftHanded ? { key: "left", short: "G", label: "Gaucher" } : null,
  ].filter((need): need is { key: string; short: string; label: string } => need !== null);

  return (
    <div className={`group flex flex-col gap-1.5 p-2 ${CARD} ${CARD_INTERACTIVE}`}>
      <div className="flex items-center gap-2">
        <DifficultyBadge difficulty={student.difficulty} size="sm" />

        <p className="min-w-0 flex-1 truncate text-sm leading-tight">
          <span className="font-bold">{student.lastName}</span>{" "}
          <span className="text-muted">{student.firstName}</span>
        </p>

        {needs.map((need) => (
          <span
            key={need.key}
            title={need.label}
            className="shrink-0 rounded bg-primary-soft px-1 text-[10px] font-bold text-primary"
          >
            {need.short}
          </span>
        ))}

        <div className="flex shrink-0 items-center opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
          <Button
            variant="ghost"
            onClick={onEdit}
            aria-label={`Modifier ${student.firstName} ${student.lastName}`}
            className="h-6 w-6 px-0"
          >
            <PencilIcon />
          </Button>
          <Button
            variant="ghost"
            disabled={disabled}
            onClick={onDelete}
            aria-label={`Supprimer ${student.firstName} ${student.lastName}`}
            className="h-6 w-6 px-0 hover:text-danger"
          >
            <TrashIcon />
          </Button>
        </div>
      </div>

      <DifficultyMeter difficulty={student.difficulty} compact />

      {student.comment && (
        <p className="truncate text-[11px] leading-snug text-muted" title={student.comment}>
          {student.comment}
        </p>
      )}
    </div>
  );
}
