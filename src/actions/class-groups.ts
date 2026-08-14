"use server";

import { revalidatePath } from "next/cache";

import { fail, firstIssue, ok, type ActionResult } from "./result";
import { prisma } from "@/lib/db";
import { findOwnedClassGroup } from "@/lib/guards";
import { requireUser } from "@/lib/session";
import { classGroupSchema } from "@/lib/validation";

export async function createClassGroup(input: unknown): Promise<ActionResult<{ id: string }>> {
  const user = await requireUser();
  const parsed = classGroupSchema.safeParse(input);
  if (!parsed.success) return fail(firstIssue(parsed.error));

  const classGroup = await prisma.classGroup.create({
    data: {
      userId: user.id,
      name: parsed.data.name,
      schoolYear: parsed.data.schoolYear || null,
    },
  });

  revalidatePath("/classes");
  revalidatePath("/tableau-de-bord");
  return ok({ id: classGroup.id });
}

export async function updateClassGroup(id: string, input: unknown): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = classGroupSchema.safeParse(input);
  if (!parsed.success) return fail(firstIssue(parsed.error));

  const existing = await findOwnedClassGroup(id, user.id);
  if (!existing) return fail("Classe introuvable.");

  await prisma.classGroup.update({
    where: { id },
    data: {
      name: parsed.data.name,
      schoolYear: parsed.data.schoolYear || null,
    },
  });

  revalidatePath("/classes");
  revalidatePath(`/classes/${id}`);
  return ok();
}

export async function deleteClassGroup(id: string): Promise<ActionResult> {
  const user = await requireUser();

  const existing = await findOwnedClassGroup(id, user.id);
  if (!existing) return fail("Classe introuvable.");

  // La suppression en cascade emporte élèves, relations et plans associés
  // (voir onDelete: Cascade dans le schéma).
  await prisma.classGroup.delete({ where: { id } });

  revalidatePath("/classes");
  revalidatePath("/tableau-de-bord");
  return ok();
}
