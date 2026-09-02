"use client";

import { useEffect, useRef, useState } from "react";

import { FieldError } from "@/components/ui/field";
import { PencilIcon } from "@/components/ui/icons";
import { cn } from "@/lib/cn";

/**
 * Titre renommable sur place.
 *
 * Le titre reste un vrai `<h1>` tant qu'on ne l'édite pas : c'est ce que lisent
 * les lecteurs d'écran et ce qu'attend le plan du document. Le passage en champ
 * de saisie est déclenché au clic ou au clavier, `Entrée` valide, `Échap`
 * annule et restaure la valeur d'origine.
 *
 * `onRename` reçoit le nom nettoyé et renvoie un message d'erreur, ou `null` si
 * tout s'est bien passé — les Server Actions du projet renvoient déjà un
 * `ActionResult`, l'appelant n'a qu'à en extraire l'erreur.
 */
export function InlineRename({
  value,
  onRename,
  label,
  as: Tag = "h1",
  className,
  maxLength = 80,
}: {
  value: string;
  onRename: (name: string) => Promise<string | null>;
  /** Ce que l'on renomme, pour l'étiquette d'accessibilité : « ce plan de classe ». */
  label: string;
  as?: "h1" | "h2";
  className?: string;
  maxLength?: number;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Le nom peut changer sous nos pieds (rafraîchissement du serveur après une
  // autre modification) : on resynchronise tant que l'utilisateur n'édite pas.
  useEffect(() => {
    if (!editing) setDraft(value);
  }, [value, editing]);

  useEffect(() => {
    if (editing) inputRef.current?.select();
  }, [editing]);

  async function commit() {
    const name = draft.trim();

    if (name === value) {
      setEditing(false);
      setError(null);
      return;
    }
    if (name.length === 0) {
      setError("Le nom ne peut pas être vide.");
      return;
    }

    setSaving(true);
    const message = await onRename(name);
    setSaving(false);

    if (message) {
      setError(message);
      return;
    }

    setError(null);
    setEditing(false);
  }

  /** Échap : on restaure la valeur d'origine sans rien envoyer au serveur. */
  function cancel() {
    setDraft(value);
    setError(null);
    setEditing(false);
  }

  if (editing) {
    return (
      <div>
        <input
          ref={inputRef}
          value={draft}
          maxLength={maxLength}
          disabled={saving}
          aria-label={`Nouveau nom pour ${label}`}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={commit}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              void commit();
            } else if (event.key === "Escape") {
              event.preventDefault();
              cancel();
            }
          }}
          className={cn(
            "w-full max-w-xl rounded-control border border-primary bg-surface px-2 py-1",
            "text-2xl font-bold tracking-tight sm:text-3xl outline-none ring-2 ring-primary/25",
            "disabled:opacity-60",
            className,
          )}
        />
        <FieldError message={error} />
      </div>
    );
  }

  return (
    <div>
      <Tag className={cn("text-2xl font-bold tracking-tight sm:text-3xl", className)}>
        <button
          type="button"
          onClick={() => setEditing(true)}
          title={`Renommer ${label}`}
          className="group inline-flex items-center gap-2 rounded-control px-1 -mx-1 text-left hover:bg-surface-muted"
        >
          <span>{value}</span>
          <PencilIcon
            width={15}
            height={15}
            className="shrink-0 text-muted opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
          />
          <span className="sr-only">Renommer {label}</span>
        </button>
      </Tag>
      <FieldError message={error} />
    </div>
  );
}
