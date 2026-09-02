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
    /**
     * Zone dangereuse, en pied de page de la classe.
     *
     * Le bouton est ROUGE, dans un encadré rouge, et sous un intitulé qui le
     * dit : il voisinait le titre de la page en gris, à portée d'un clic
     * distrait, alors qu'il emporte les élèves, leurs commentaires et tous les
     * plans. Le rouge est ici pleinement légitime — c'est l'un des deux seuls
     * sens que le thème lui reconnaît.
     */
    <section className="rounded-card border border-danger-border bg-danger-soft p-4">
      <ConfirmDialog
        open={confirming}
        onClose={() => setConfirming(false)}
        onConfirm={handleDelete}
        loading={pending}
        title={`Supprimer « ${classGroupName} » ?`}
        description="Ses élèves, leurs commentaires, leurs incompatibilités et tous ses plans de classe seront effacés. Cette action est irréversible."
        confirmLabel="Supprimer la classe"
      />

      <h2 className="eyebrow text-danger">Zone dangereuse</h2>
      <p className="mt-2 max-w-prose text-sm text-muted">
        Supprimer cette classe efface ses élèves, leurs commentaires, leurs incompatibilités et
        tous ses plans de classe. C&apos;est définitif.
      </p>

      <Button
        variant="danger"
        onClick={() => setConfirming(true)}
        disabled={pending}
        className="mt-4"
      >
        Supprimer la classe
      </Button>
      <FieldError message={error} />
    </section>
  );
}
