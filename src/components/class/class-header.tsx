"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { updateClassGroup } from "@/actions/class-groups";
import { InlineRename } from "@/components/ui/inline-rename";

/**
 * En-tête renommable d'une classe.
 *
 * La page de classe est un composant serveur : ce petit client isole le seul
 * fragment interactif. `updateClassGroup` existait déjà mais n'avait jamais eu
 * d'appelant — il n'y manquait que cette interface.
 *
 * L'année scolaire est renvoyée telle quelle : le schéma de validation exige
 * les deux champs, et renommer ne doit pas l'effacer au passage.
 */
export function ClassHeader({
  classGroupId,
  name,
  schoolYear,
  studentCount,
}: {
  classGroupId: string;
  name: string;
  schoolYear: string | null;
  studentCount: number;
}) {
  const router = useRouter();
  const [current, setCurrent] = useState(name);

  async function handleRename(nextName: string): Promise<string | null> {
    const result = await updateClassGroup(classGroupId, {
      name: nextName,
      schoolYear: schoolYear ?? "",
    });
    if (!result.ok) return result.error;

    setCurrent(nextName);
    router.refresh();
    return null;
  }

  return (
    <div className="min-w-0">
      <InlineRename value={current} onRename={handleRename} label="cette classe" />
      <p className="mt-1 text-sm text-muted">
        {schoolYear ? `${schoolYear} · ` : ""}
        {studentCount} élève{studentCount > 1 ? "s" : ""}
      </p>
    </div>
  );
}
