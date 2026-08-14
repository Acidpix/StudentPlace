"use server";

import { revalidatePath } from "next/cache";

import { fail, firstIssue, ok, type ActionResult } from "./result";
import { encryptComment } from "@/lib/crypto";
import { parseStudentList } from "@/lib/csv";
import { prisma } from "@/lib/db";
import { findOwnedClassGroup, findOwnedStudent } from "@/lib/guards";
import { requireUser } from "@/lib/session";
import { csvImportSchema, studentSchema } from "@/lib/validation";

export async function createStudent(
  classGroupId: string,
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  const user = await requireUser();
  const parsed = studentSchema.safeParse(input);
  if (!parsed.success) return fail(firstIssue(parsed.error));

  const classGroup = await findOwnedClassGroup(classGroupId, user.id);
  if (!classGroup) return fail("Classe introuvable.");

  const student = await prisma.student.create({
    data: {
      classGroupId,
      firstName: parsed.data.firstName,
      lastName: parsed.data.lastName,
      commentEnc: encryptComment(parsed.data.comment),
      difficulty: parsed.data.difficulty,
      needsFront: parsed.data.needsFront,
      leftHanded: parsed.data.leftHanded,
    },
  });

  revalidatePath(`/classes/${classGroupId}`);
  return ok({ id: student.id });
}

export async function updateStudent(id: string, input: unknown): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = studentSchema.safeParse(input);
  if (!parsed.success) return fail(firstIssue(parsed.error));

  const student = await findOwnedStudent(id, user.id);
  if (!student) return fail("Élève introuvable.");

  await prisma.student.update({
    where: { id },
    data: {
      firstName: parsed.data.firstName,
      lastName: parsed.data.lastName,
      commentEnc: encryptComment(parsed.data.comment),
      difficulty: parsed.data.difficulty,
      needsFront: parsed.data.needsFront,
      leftHanded: parsed.data.leftHanded,
    },
  });

  revalidatePath(`/classes/${student.classGroupId}`);
  return ok();
}

export async function deleteStudent(id: string): Promise<ActionResult> {
  const user = await requireUser();

  const student = await findOwnedStudent(id, user.id);
  if (!student) return fail("Élève introuvable.");

  await prisma.student.delete({ where: { id } });

  revalidatePath(`/classes/${student.classGroupId}`);
  return ok();
}

/**
 * Import d'une liste collée depuis un tableur, ou saisie en texte simple.
 *
 * Les erreurs de lignes ne bloquent pas l'import : les élèves lisibles sont
 * créés, les lignes fautives sont rapportées au professeur qui les corrigera.
 */
export async function importStudents(
  input: unknown,
): Promise<ActionResult<{ imported: number; errors: string[] }>> {
  const user = await requireUser();
  const parsed = csvImportSchema.safeParse(input);
  if (!parsed.success) return fail(firstIssue(parsed.error));

  const { classGroupId, content, replaceExisting, nameOrder } = parsed.data;

  const classGroup = await findOwnedClassGroup(classGroupId, user.id);
  if (!classGroup) return fail("Classe introuvable.");

  const { students, errors } = parseStudentList(content, { nameOrder });
  if (students.length === 0) {
    return fail(errors[0] ?? "Aucun élève n'a pu être lu.");
  }

  await prisma.$transaction(async (tx) => {
    if (replaceExisting) {
      // Emporte aussi relations et affectations de ces élèves, en cascade.
      await tx.student.deleteMany({ where: { classGroupId } });
    }

    await tx.student.createMany({
      data: students.map((student) => ({
        classGroupId,
        firstName: student.firstName,
        lastName: student.lastName,
        difficulty: student.difficulty,
        commentEnc: encryptComment(student.comment),
      })),
    });
  });

  revalidatePath(`/classes/${classGroupId}`);
  return ok({ imported: students.length, errors });
}
