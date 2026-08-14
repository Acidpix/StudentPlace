"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { deleteRoom, duplicateRoom } from "@/actions/rooms";
import { FieldError } from "@/components/ui/field";

export function RoomCardActions({ roomId, roomName }: { roomId: string; roomName: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleDuplicate() {
    startTransition(async () => {
      const result = await duplicateRoom(roomId);
      if (!result.ok) setError(result.error);
      else router.push(`/salles/${result.data.id}`);
    });
  }

  function handleDelete() {
    const confirmed = window.confirm(
      `Supprimer la salle « ${roomName} » ?\n\nTous les plans de classe qui l'utilisent seront également supprimés.`,
    );
    if (!confirmed) return;

    startTransition(async () => {
      const result = await deleteRoom(roomId);
      if (!result.ok) setError(result.error);
      else router.refresh();
    });
  }

  return (
    <div className="mt-3 border-t border-border pt-3">
      <div className="flex gap-3 text-sm">
        <button
          type="button"
          onClick={handleDuplicate}
          disabled={pending}
          className="text-muted hover:text-foreground disabled:opacity-50"
        >
          Dupliquer
        </button>
        <button
          type="button"
          onClick={handleDelete}
          disabled={pending}
          className="text-muted hover:text-danger disabled:opacity-50"
        >
          Supprimer
        </button>
      </div>
      <FieldError message={error} />
    </div>
  );
}
