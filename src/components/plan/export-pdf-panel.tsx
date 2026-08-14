"use client";

import { useState } from "react";

import { DownloadIcon } from "@/components/ui/icons";

/**
 * Options d'export PDF.
 *
 * Les commentaires et les notes de difficulté sont DÉCOCHÉS par défaut, et ce
 * n'est pas un détail : un plan de classe imprimé circule, traîne sur un
 * bureau, se photographie. Le professeur doit poser un geste délibéré pour y
 * faire figurer des appréciations sur des mineurs.
 */
export function ExportPdfPanel({ planId, mirrored }: { planId: string; mirrored: boolean }) {
  const [includeComments, setIncludeComments] = useState(false);
  const [includeDifficulty, setIncludeDifficulty] = useState(false);
  const [includeRoster, setIncludeRoster] = useState(true);

  const params = new URLSearchParams({
    commentaires: includeComments ? "1" : "0",
    difficulte: includeDifficulty ? "1" : "0",
    liste: includeRoster ? "1" : "0",
    miroir: mirrored ? "1" : "0",
  });

  const sensitive = includeComments || includeDifficulty;

  return (
    <div className="material rounded-card border border-border bg-surface p-3 shadow-soft">
      <h2 className="mb-2 text-sm font-medium">Export PDF</h2>

      <div className="space-y-1.5 text-sm">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={includeRoster}
            onChange={(event) => setIncludeRoster(event.target.checked)}
          />
          Ajouter la liste alphabétique
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={includeDifficulty}
            onChange={(event) => setIncludeDifficulty(event.target.checked)}
          />
          Inclure les notes de difficulté
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={includeComments}
            onChange={(event) => setIncludeComments(event.target.checked)}
          />
          Inclure les commentaires
        </label>
      </div>

      {sensitive && (
        <p className="mt-2 rounded-control border border-danger-border bg-danger-soft p-2 text-xs text-danger">
          Ce PDF contiendra des appréciations sur des élèves. Ne le laissez pas circuler.
        </p>
      )}

      <a
        href={`/api/plans/${planId}/pdf?${params.toString()}`}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-3 inline-flex h-9 w-full items-center justify-center gap-2 rounded-control bg-primary text-sm font-medium text-primary-foreground shadow-soft hover:brightness-110"
      >
        <DownloadIcon />
        Télécharger le PDF
      </a>

      <p className="mt-2 text-xs text-muted">
        Le plan de classe est exporté tel qu&apos;il est affiché,{" "}
        {mirrored ? "vue depuis le bureau" : "vue du dessus"}. Enregistrez vos modifications avant
        d&apos;exporter.
      </p>
    </div>
  );
}
