"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";

import { createPlan } from "@/actions/plans";
import { Button } from "@/components/ui/button";
import { FieldError, Input, Label, Select } from "@/components/ui/field";
import { PlusIcon } from "@/components/ui/icons";

interface Option {
  id: string;
  name: string;
}

export function NewPlanDialog({
  classGroups,
  rooms,
  defaultClassGroupId,
}: {
  classGroups: Option[];
  rooms: Option[];
  defaultClassGroupId?: string;
}) {
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
      classGroupId: String(formData.get("classGroupId") ?? ""),
      roomId: String(formData.get("roomId") ?? ""),
    };

    startTransition(async () => {
      const result = await createPlan(input);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setOpen(false);
      router.push(`/plans/${result.data.id}`);
    });
  }

  if (!open) {
    return (
      <Button onClick={() => setOpen(true)}>
        <PlusIcon />
        Nouveau plan de classe
      </Button>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="w-full max-w-md rounded-card border border-border bg-surface p-4 shadow-lift"
    >
      <h2 className="mb-3 font-medium">Nouveau plan de classe</h2>

      <div className="space-y-3">
        <div>
          <Label htmlFor="plan-name">Nom du plan de classe</Label>
          <Input
            id="plan-name"
            name="name"
            required
            defaultValue="Plan principal"
            placeholder="Plan principal, Groupe A, Évaluation…"
          />
        </div>

        <div>
          <Label htmlFor="plan-class">Classe</Label>
          <Select id="plan-class" name="classGroupId" required defaultValue={defaultClassGroupId}>
            {classGroups.map((classGroup) => (
              <option key={classGroup.id} value={classGroup.id}>
                {classGroup.name}
              </option>
            ))}
          </Select>
        </div>

        <div>
          <Label htmlFor="plan-room">Salle</Label>
          <Select id="plan-room" name="roomId" required>
            {rooms.map((room) => (
              <option key={room.id} value={room.id}>
                {room.name}
              </option>
            ))}
          </Select>
        </div>
      </div>

      <FieldError message={error} />

      <div className="mt-4 flex gap-2">
        <Button type="submit" loading={pending}>
          {pending ? "Création…" : "Créer le plan de classe"}
        </Button>
        <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
          Annuler
        </Button>
      </div>
    </form>
  );
}
