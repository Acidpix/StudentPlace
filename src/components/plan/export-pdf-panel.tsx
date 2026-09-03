"use client";

import { useState } from "react";

import { buttonClasses } from "@/components/ui/button";
import { CARD } from "@/components/ui/card";
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
  const [includeParticipation, setIncludeParticipation] = useState(false);

  const params = new URLSearchParams({
    commentaires: includeComments ? "1" : "0",
    difficulte: includeDifficulty ? "1" : "0",
    liste: includeRoster ? "1" : "0",
    participation: includeParticipation ? "1" : "0",
    miroir: mirrored ? "1" : "0",
  });

  const sensitive = includeComments || includeDifficulty;

  return (
    <div className={`${CARD} p-3`}>
      <h2 className="eyebrow mb-2">Export PDF</h2>

      <div className="space-y-1.5 text-sm">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            className="accent-primary"
            checked={includeRoster}
            onChange={(event) => setIncludeRoster(event.target.checked)}
          />
          Ajouter la liste alphabétique
        </label>
        {/* Les cases de participation ne portent AUCUNE donnée sur les élèves :
            elles sortent vides de l'imprimante. Elles voisinent malgré tout les
            deux cases sensibles, parce que ce sont toutes des options du même
            document — et elles restent décochées par défaut, un plan servant
            d'abord à situer les élèves. */}
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            className="accent-primary"
            checked={includeParticipation}
            onChange={(event) => setIncludeParticipation(event.target.checked)}
          />
          Ajouter 5 cases de participation
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            className="accent-primary"
            checked={includeDifficulty}
            onChange={(event) => setIncludeDifficulty(event.target.checked)}
          />
          Inclure les notes de difficulté
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            className="accent-primary"
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

      {includeParticipation && includeComments && (
        <p className="mt-2 text-xs text-muted">
          Les cases occupent le bas des étiquettes : les commentaires ne figureront que dans la
          liste alphabétique.
        </p>
      )}

      <a
        href={`/api/plans/${planId}/pdf?${params.toString()}`}
        target="_blank"
        rel="noopener noreferrer"
        className={buttonClasses("primary", "sm", "mt-3 w-full")}
      >
        <DownloadIcon />
        Télécharger le PDF
      </a>

      <p className="mt-2 text-xs text-muted">
        Le plan de classe est exporté tel qu&apos;il est affiché,{" "}
        {mirrored ? "vue depuis le bureau" : "vue du dessus"}. Les modifications sont enregistrées
        automatiquement : il reflète toujours ce que vous voyez.
      </p>
    </div>
  );
}
