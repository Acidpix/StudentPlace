"use server";

import { revalidatePath } from "next/cache";

import { fail, firstIssue, ok, type ActionResult } from "./result";
import { prisma } from "@/lib/db";
import { findOwnedClassGroup } from "@/lib/guards";
import { normalizePair } from "@/lib/domain";
import { requireUser } from "@/lib/session";
import { relationSchema } from "@/lib/validation";

export async function createRelation(
  classGroupId: string,
  input: unknown,
): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = relationSchema.safeParse(input);
  if (!parsed.success) return fail(firstIssue(parsed.error));

  const { studentAId, studentBId, type } = parsed.data;

  if (studentAId === studentBId) {
    return fail("Choisissez deux élèves différents.");
  }

  const classGroup = await findOwnedClassGroup(classGroupId, user.id);
  if (!classGroup) return fail("Classe introuvable.");

  // Les deux élèves doivent appartenir à CETTE classe : sans cette
  // vérification, on pourrait lier un élève d'une autre classe, voire d'un
  // autre professeur, en forgeant la requête.
  const count = await prisma.student.count({
    where: { classGroupId, id: { in: [studentAId, studentBId] } },
  });
  if (count !== 2) return fail("Ces élèves n'appartiennent pas à cette classe.");

  const [a, b] = normalizePair(studentAId, studentBId);

  // Une paire ne porte qu'une relation : déclarer une affinité entre deux
  // élèves déjà incompatibles remplace la première déclaration.
  await prisma.studentRelation.upsert({
    where: { studentAId_studentBId: { studentAId: a, studentBId: b } },
    create: { classGroupId, studentAId: a, studentBId: b, type },
    update: { type },
  });

  revalidatePath(`/classes/${classGroupId}`);
  return ok();
}

export async function deleteRelation(id: string): Promise<ActionResult> {
  const user = await requireUser();

  const relation = await prisma.studentRelation.findFirst({
    where: { id, classGroup: { userId: user.id } },
  });
  if (!relation) return fail("Relation introuvable.");

  await prisma.studentRelation.delete({ where: { id } });

  revalidatePath(`/classes/${relation.classGroupId}`);
  return ok();
}
