"use client";

import { useId } from "react";

import { Button } from "@/components/ui/button";
import { WarningIcon } from "@/components/ui/icons";
import { Modal } from "@/components/ui/modal";

/**
 * Confirmation d'une action irréversible.
 *
 * Remplace `window.confirm()`, qui affichait une boîte du système d'exploitation
 * au milieu d'une application au thème très marqué — la rupture visuelle était
 * franche, et le texte n'y admettait aucune mise en forme.
 *
 * Deux garde-fous conservés de l'ancienne version :
 *
 * - le bouton de confirmation est en variante `danger`, jamais en `primary` ;
 * - `Annuler` est le bouton qui reçoit le focus à l'ouverture. `Modal` place le
 *   focus sur le premier élément focalisable du panneau : « Annuler » est donc
 *   déclaré EN PREMIER dans le DOM, puis renvoyé à droite par `flex-row-reverse`.
 *   Une frappe d'Entrée réflexe n'efface ainsi jamais rien.
 */
export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel,
  loading = false,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description: React.ReactNode;
  confirmLabel: string;
  loading?: boolean;
}) {
  const titleId = useId();

  return (
    <Modal open={open} onClose={onClose} labelledBy={titleId} className="max-w-sm">
      <div className="flex items-start gap-3 border-b border-border p-4">
        <span
          aria-hidden="true"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-danger-soft text-danger"
        >
          <WarningIcon />
        </span>
        <div className="min-w-0">
          <h2 id={titleId} className="text-base font-bold leading-tight">
            {title}
          </h2>
          <div className="mt-1.5 text-sm leading-snug text-muted">{description}</div>
        </div>
      </div>

      {/* `Annuler` est DÉCLARÉ EN PREMIER pour recevoir le focus à l'ouverture,
          puis renvoyé à droite par `flex-row-reverse`. L'ordre visuel reste
          celui de la maquette — bouton plein à gauche, bouton bordé à droite —
          sans qu'une frappe d'Entrée réflexe efface quoi que ce soit. */}
      <div className="flex flex-row-reverse gap-2 p-4">
        <Button variant="secondary" onClick={onClose} disabled={loading}>
          Annuler
        </Button>
        <Button variant="danger" onClick={onConfirm} loading={loading} className="flex-1">
          {confirmLabel}
        </Button>
      </div>
    </Modal>
  );
}
