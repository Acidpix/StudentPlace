"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";

import { createClassGroup } from "@/actions/class-groups";
import { Button } from "@/components/ui/button";
import { FieldError, Input, Label } from "@/components/ui/field";
import { PlusIcon } from "@/components/ui/icons";

/** Année scolaire courante, du type « 2026-2027 ». */
function currentSchoolYear(): string {
  const now = new Date();
  // L'année scolaire bascule en août.
  const start = now.getMonth() >= 7 ? now.getFullYear() : now.getFullYear() - 1;
  return `${start}-${start + 1}`;
}

export function NewClassForm() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const formData = new FormData(event.currentTarget);
    const input = {
      name: String(formData.get("name") ?? ""),
      schoolYear: String(formData.get("schoolYear") ?? ""),
    };

    startTransition(async () => {
      const result = await createClassGroup(input);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setOpen(false);
      router.push(`/classes/${result.data.id}`);
    });
  }

  if (!open) {
    return (
      <Button onClick={() => setOpen(true)}>
        <PlusIcon />
        Nouvelle classe
      </Button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-sm rounded-card border border-border bg-surface p-4">
      <div className="space-y-3">
        <div>
          <Label htmlFor="class-name">Nom de la classe</Label>
          <Input id="class-name" name="name" required autoFocus placeholder="4e B" />
        </div>
        <div>
          <Label htmlFor="class-year">Année scolaire</Label>
          <Input id="class-year" name="schoolYear" defaultValue={currentSchoolYear()} />
        </div>
      </div>

      <FieldError message={error} />

      <div className="mt-4 flex gap-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Création…" : "Créer"}
        </Button>
        <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
          Annuler
        </Button>
      </div>
    </form>
  );
}
