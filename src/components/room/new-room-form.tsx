"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";

import { createRoom } from "@/actions/rooms";
import { Button } from "@/components/ui/button";
import { FieldError, Hint, Input, Label } from "@/components/ui/field";
import { PlusIcon } from "@/components/ui/icons";

export function NewRoomForm() {
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
      // Saisie en mètres, stockage en centimètres.
      widthCm: Math.round(Number(formData.get("width") ?? 9) * 100),
      heightCm: Math.round(Number(formData.get("height") ?? 7) * 100),
    };

    startTransition(async () => {
      const result = await createRoom(input);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setOpen(false);
      router.push(`/salles/${result.data.id}`);
    });
  }

  if (!open) {
    return (
      <Button onClick={() => setOpen(true)}>
        <PlusIcon />
        Nouvelle salle
      </Button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-sm rounded-card border border-border bg-surface p-4">
      <div className="space-y-3">
        <div>
          <Label htmlFor="room-name">Nom de la salle</Label>
          <Input id="room-name" name="name" required autoFocus placeholder="Salle 204" />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="room-width">Largeur (m)</Label>
            <Input id="room-width" name="width" type="number" step="0.5" min="3" max="30" defaultValue="9" />
          </div>
          <div>
            <Label htmlFor="room-height">Profondeur (m)</Label>
            <Input id="room-height" name="height" type="number" step="0.5" min="3" max="30" defaultValue="7" />
          </div>
        </div>
        <Hint>Les dimensions restent modifiables ensuite ; approximatives suffit.</Hint>
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
