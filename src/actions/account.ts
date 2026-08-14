"use server";

import { fail, ok, type ActionResult } from "./result";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/session";

/**
 * Suppression définitive du compte.
 *
 * Toutes les données rattachées partent en cascade : classes, élèves,
 * commentaires, salles, plans, sessions. C'est le droit à l'effacement du
 * RGPD, et il doit être immédiat et complet.
 */
export async function deleteAccount(confirmation: string): Promise<ActionResult> {
  const user = await requireUser();

  // Garde-fou volontairement pénible : la suppression est irréversible.
  if (confirmation.trim().toUpperCase() !== "SUPPRIMER") {
    return fail("Saisissez SUPPRIMER pour confirmer.");
  }

  await prisma.user.delete({ where: { id: user.id } });

  return ok();
}
