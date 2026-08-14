"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { deleteClassGroup } from "@/actions/class-groups";
import { Button } from "@/components/ui/button";
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
  const [pending, startTransition] = useTransition();

  function handleDelete() {
    const confirmed = window.confirm(
      `Supprimer définitivement la classe « ${classGroupName} » ?\n\nSes élèves, leurs commentaires, leurs incompatibilités et tous ses plans de classe seront effacés. Cette action est irréversible.`,
    );
    if (!confirmed) return;

    startTransition(async () => {
      const result = await deleteClassGroup(classGroupId);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.push("/classes");
      router.refresh();
    });
  }

  return (
    <div>
      <Button variant="secondary" onClick={handleDelete} disabled={pending}>
        {pending ? "Suppression…" : "Supprimer la classe"}
      </Button>
      <FieldError message={error} />
    </div>
  );
}
