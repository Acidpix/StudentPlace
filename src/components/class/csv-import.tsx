"use client";

import { useRouter } from "next/navigation";
import { useId, useMemo, useState, useTransition, type ChangeEvent, type FormEvent } from "react";

import { importStudents } from "@/actions/students";
import { Button } from "@/components/ui/button";
import { FieldError, Label, Select, Textarea } from "@/components/ui/field";
import { XIcon } from "@/components/ui/icons";
import { Modal } from "@/components/ui/modal";
import { NAME_ORDERS, NAME_ORDER_LABELS, parseStudentList, type NameOrder } from "@/lib/csv";

const EXAMPLE = `Martin Camille
Dupont Léa
Bernard Noah

— ou, depuis un tableur —
Nom;Prénom;Comportement;Commentaire
Martin;Camille;3;Bavarde en fin d'heure`;

/**
 * Import d'une liste d'élèves, en POPUP.
 *
 * Il vivait en pied de page, dans un panneau qui se dépliait sur place et
 * poussait le reste vers le bas. Il est désormais commandé depuis l'en-tête de
 * la liste d'élèves, à côté d'« Ajouter un élève » : les deux façons de peupler
 * une classe se lisent au même endroit, et la seconde ne déplace plus rien.
 *
 * Comme `StudentDialog`, la boîte est une `Modal` — donc un `<dialog>` natif —
 * et son contenu n'est monté qu'à l'ouverture : la saisie abandonnée ne
 * revient pas à la fois suivante.
 */
export function CsvImport({
  open,
  onClose,
  classGroupId,
  hasStudents,
}: {
  open: boolean;
  onClose: () => void;
  classGroupId: string;
  hasStudents: boolean;
}) {
  const titleId = useId();

  return (
    <Modal open={open} onClose={onClose} labelledBy={titleId} className="max-w-lg">
      <CsvImportForm
        titleId={titleId}
        classGroupId={classGroupId}
        hasStudents={hasStudents}
        onClose={onClose}
      />
    </Modal>
  );
}

function CsvImportForm({
  titleId,
  classGroupId,
  hasStudents,
  onClose,
}: {
  titleId: string;
  classGroupId: string;
  hasStudents: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const [content, setContent] = useState("");
  const [nameOrder, setNameOrder] = useState<NameOrder>("lastFirst");
  const [replaceExisting, setReplaceExisting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [pending, startTransition] = useTransition();

  // L'aperçu lève l'ambiguïté du texte simple AVANT l'import : « Martin
  // Camille » ne dit pas de lui-même lequel des deux mots est le nom. La
  // lecture est la même côté serveur, et reste négligeable sur trente lignes.
  const preview = useMemo(
    () => (content.trim() === "" ? null : parseStudentList(content, { nameOrder })),
    [content, nameOrder],
  );

  async function handleFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setContent(await file.text());
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setWarnings([]);

    startTransition(async () => {
      const result = await importStudents({ classGroupId, content, replaceExisting, nameOrder });

      if (!result.ok) {
        setError(result.error);
        return;
      }

      setWarnings(result.data.errors);
      setContent("");
      router.refresh();

      // Les avertissements de lignes doivent rester lisibles : on ne referme
      // la boîte que si tout est passé sans réserve.
      if (result.data.errors.length === 0) onClose();
    });
  }

  return (
    <form onSubmit={handleSubmit}>
      {/* -------------------------------------------------------- en-tête */}
      <header className="halftone flex items-start gap-3 border-b border-border p-4">
        <div className="min-w-0 flex-1">
          <h2 id={titleId} className="text-lg font-bold leading-tight">
            Importer une liste d&apos;élèves
          </h2>
          <p className="mt-1 text-sm leading-snug text-muted">
            Un élève par ligne, en texte simple : « Martin Camille ». Vous pouvez aussi coller
            les colonnes d&apos;un tableur ou choisir un fichier — ordre attendu : nom, prénom,
            comportement (1-5, facultatif), commentaire (facultatif).
          </p>
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
      <div className="max-h-[65vh] overflow-y-auto p-4">
        <Textarea
          autoFocus
          value={content}
          onChange={(event) => setContent(event.target.value)}
          rows={8}
          placeholder={EXAMPLE}
          className="font-mono text-xs"
          aria-label="Liste d'élèves à importer"
        />

        <div className="mt-3 flex flex-wrap items-end gap-4">
          <div className="w-56">
            <Label htmlFor="nameOrder">Ordre des lignes en texte simple</Label>
            <Select
              id="nameOrder"
              value={nameOrder}
              onChange={(event) => setNameOrder(event.target.value as NameOrder)}
            >
              {NAME_ORDERS.map((order) => (
                <option key={order} value={order}>
                  {NAME_ORDER_LABELS[order]}
                </option>
              ))}
            </Select>
          </div>

          <input
            type="file"
            accept=".csv,.txt,text/csv,text/plain"
            onChange={handleFile}
            className="text-sm text-muted file:mr-3 file:rounded-control file:border file:border-border file:bg-surface-muted file:px-3 file:py-1.5 file:text-sm file:text-foreground"
          />

          {hasStudents && (
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={replaceExisting}
                onChange={(event) => setReplaceExisting(event.target.checked)}
              />
              Remplacer les élèves existants
            </label>
          )}
        </div>

        {replaceExisting && (
          <p className="mt-2 rounded-control border border-danger-border bg-danger-soft p-2 text-sm text-danger">
            Les élèves actuels seront supprimés, avec leurs incompatibilités et leurs places
            dans tous les plans de classe qui les utilisent.
          </p>
        )}

        <FieldError message={error} />

        {preview && preview.students.length > 0 && (
          <div className="mt-3 rounded-control border border-border bg-surface-muted p-3">
            <p className="text-sm font-medium">
              {preview.students.length} élève{preview.students.length > 1 ? "s" : ""} à importer
            </p>
            <ul className="mt-1 text-sm text-muted">
              {preview.students.slice(0, 4).map((student, index) => (
                <li key={`${student.lastName}-${student.firstName}-${index}`}>
                  <span className="font-medium text-foreground">{student.lastName}</span>{" "}
                  {student.firstName}
                </li>
              ))}
              {preview.students.length > 4 && <li>…</li>}
            </ul>
            <p className="mt-1.5 text-xs text-muted">
              Le nom de famille est en gras. S&apos;il est inversé, changez l&apos;ordre des
              lignes ci-dessus.
            </p>
          </div>
        )}

        {warnings.length > 0 && (
          <div className="mt-3 rounded-control border border-border bg-surface-muted p-3">
            <p className="text-sm font-medium">Import terminé, avec des réserves :</p>
            <ul className="mt-1 list-inside list-disc text-sm text-muted">
              {warnings.map((warning) => (
                <li key={warning}>{warning}</li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* ----------------------------------------------------------- pied */}
      <footer className="flex justify-end gap-2 border-t border-border p-4">
        <Button type="button" size="sm" variant="secondary" onClick={onClose}>
          Fermer
        </Button>
        <Button type="submit" size="sm" disabled={pending || content.trim() === ""}>
          {pending ? "Import…" : "Importer"}
        </Button>
      </footer>
    </form>
  );
}
