"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { deleteClassGroup } from "@/actions/class-groups";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { FieldError } from "@/components/ui/field";

export function DeleteClassButton({
  classGroupId,
  classGroupName,
}: {
  classGroupId: string;
  classGroupName: string;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();

  function handleDelete() {
    startTransition(async () => {
      const result = await deleteClassGroup(classGroupId);
      if (!result.ok) {
        setError(result.error);
        setConfirming(false);
        return;
      }
      router.push("/classes");
      router.refresh();
    });
  }

  return (
    <div>
      <ConfirmDialog
        open={confirming}
        onClose={() => setConfirming(false)}
        onConfirm={handleDelete}
        loading={pending}
        title={`Supprimer « ${classGroupName} » ?`}
        description="Ses élèves, leurs commentaires, leurs incompatibilités et tous ses plans de classe seront effacés. Cette action est irréversible."
        confirmLabel="Supprimer la classe"
      />

      <Button variant="secondary" onClick={() => setConfirming(true)} disabled={pending}>
        Supprimer la classe
      </Button>
      <FieldError message={error} />
    </div>
  );
}
