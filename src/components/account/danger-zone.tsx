"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { deleteAccount } from "@/actions/account";
import { Button } from "@/components/ui/button";
import { FieldError, Input, Label } from "@/components/ui/field";
import { authClient } from "@/lib/auth-client";

export function DangerZone() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleDelete() {
    setError(null);

    startTransition(async () => {
      const result = await deleteAccount(confirmation);
      if (!result.ok) {
        setError(result.error);
        return;
      }

      // Le compte n'existe plus ; on nettoie le cookie de session côté client.
      await authClient.signOut().catch(() => undefined);
      router.push("/connexion");
      router.refresh();
    });
  }

  return (
    <section className="rounded-card border border-danger-border bg-danger-soft p-4">
      <h2 className="font-medium text-danger">Supprimer mon compte</h2>
      <p className="mt-2 text-sm text-danger">
        Efface définitivement votre compte et l&apos;intégralité de vos données : classes, élèves,
        commentaires, salles et plans de classe. Cette action est irréversible — pensez à exporter vos
        données avant.
      </p>

      {open ? (
        <div className="mt-4">
          <Label htmlFor="confirmation">
            Saisissez <strong>SUPPRIMER</strong> pour confirmer
          </Label>
          <Input
            id="confirmation"
            value={confirmation}
            onChange={(event) => setConfirmation(event.target.value)}
            autoComplete="off"
            className="max-w-xs"
          />

          <FieldError message={error} />

          <div className="mt-3 flex gap-2">
            <Button variant="danger" onClick={handleDelete} disabled={pending}>
              {pending ? "Suppression…" : "Supprimer définitivement"}
            </Button>
            <Button variant="secondary" onClick={() => setOpen(false)}>
              Annuler
            </Button>
          </div>
        </div>
      ) : (
        <Button variant="secondary" className="mt-3" onClick={() => setOpen(true)}>
          Supprimer mon compte
        </Button>
      )}
    </section>
  );
}
