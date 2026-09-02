"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { deleteRoom, duplicateRoom } from "@/actions/rooms";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { FieldError } from "@/components/ui/field";

export function RoomCardActions({ roomId, roomName }: { roomId: string; roomName: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();

  function handleDuplicate() {
    startTransition(async () => {
      const result = await duplicateRoom(roomId);
      if (!result.ok) setError(result.error);
      else router.push(`/salles/${result.data.id}`);
    });
  }

  function handleDelete() {
    startTransition(async () => {
      const result = await deleteRoom(roomId);
      if (!result.ok) {
        setError(result.error);
        setConfirming(false);
        return;
      }
      setConfirming(false);
      router.refresh();
    });
  }

  return (
    <div className="mt-3 border-t border-border pt-3">
      {/* La confirmation passe par la modale du thème et non plus par
          `window.confirm()`, qui ouvrait une boîte du système au milieu de
          l'application. */}
      <ConfirmDialog
        open={confirming}
        onClose={() => setConfirming(false)}
        onConfirm={handleDelete}
        loading={pending}
        title={`Supprimer « ${roomName} » ?`}
        description="Tous les plans de classe qui utilisent cette salle seront également supprimés. Cette action est définitive."
        confirmLabel="Supprimer la salle"
      />

      <div className="flex gap-1">
        <Button variant="ghost" size="sm" onClick={handleDuplicate} disabled={pending}>
          Dupliquer
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setConfirming(true)}
          disabled={pending}
          className="hover:text-danger"
        >
          Supprimer
        </Button>
      </div>
      <FieldError message={error} />
    </div>
  );
}
