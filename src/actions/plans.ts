"use server";

import { revalidatePath } from "next/cache";

import { fail, firstIssue, ok, type ActionResult } from "./result";
import { prisma } from "@/lib/db";
import { findOwnedClassGroup, findOwnedPlan, findOwnedRoom } from "@/lib/guards";
import { requireUser } from "@/lib/session";
import { assignmentsSchema, planSchema, planSettingsSchema } from "@/lib/validation";

export async function createPlan(input: unknown): Promise<ActionResult<{ id: string }>> {
  const user = await requireUser();
  const parsed = planSchema.safeParse(input);
  if (!parsed.success) return fail(firstIssue(parsed.error));

  const { name, classGroupId, roomId } = parsed.data;

  const [classGroup, room] = await Promise.all([
    findOwnedClassGroup(classGroupId, user.id),
    findOwnedRoom(roomId, user.id),
  ]);
  if (!classGroup) return fail("Classe introuvable.");
  if (!room) return fail("Salle introuvable.");

  const plan = await prisma.seatingPlan.create({
    data: { userId: user.id, name, classGroupId, roomId },
  });

  revalidatePath("/tableau-de-bord");
  revalidatePath(`/classes/${classGroupId}`);
  return ok({ id: plan.id });
}

export async function updatePlanSettings(id: string, input: unknown): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = planSettingsSchema.safeParse(input);
  if (!parsed.success) return fail(firstIssue(parsed.error));

  const plan = await findOwnedPlan(id, user.id);
  if (!plan) return fail("Plan de classe introuvable.");

  await prisma.seatingPlan.update({
    where: { id },
    data: {
      name: parsed.data.name,
      mirrored: parsed.data.mirrored,
      proximityCm: parsed.data.proximityCm,
    },
  });

  // Le NOM du plan s'affiche aussi sur le tableau de bord et sur la page de sa
  // classe : les revalider tous les trois, sinon un renommage y reste invisible
  // jusqu'au prochain passage à froid.
  revalidatePath(`/plans/${id}`);
  revalidatePath("/tableau-de-bord");
  revalidatePath(`/classes/${plan.classGroupId}`);
  return ok();
}

export async function deletePlan(id: string): Promise<ActionResult> {
  const user = await requireUser();

  const plan = await findOwnedPlan(id, user.id);
  if (!plan) return fail("Plan de classe introuvable.");

  await prisma.seatingPlan.delete({ where: { id } });

  revalidatePath("/tableau-de-bord");
  revalidatePath(`/classes/${plan.classGroupId}`);
  return ok();
}

/**
 * Enregistre l'ensemble des affectations d'un plan.
 *
 * Comme pour l'agencement d'une salle, l'éditeur envoie l'état complet : la
 * table d'affectations d'un plan ne dépasse jamais quelques dizaines de lignes.
 */
export async function saveAssignments(input: unknown): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = assignmentsSchema.safeParse(input);
  if (!parsed.success) return fail(firstIssue(parsed.error));

  const { planId, assignments } = parsed.data;

  const plan = await findOwnedPlan(planId, user.id);
  if (!plan) return fail("Plan de classe introuvable.");

  // Une place doit appartenir à la salle du plan, un élève à sa classe.
  // Sans ce contrôle, un identifiant forgé permettrait d'asseoir l'élève d'un
  // collègue sur une chaise qui n'existe pas dans cette salle.
  const [validSeats, validStudents] = await Promise.all([
    prisma.seat.findMany({ where: { roomId: plan.roomId }, select: { id: true } }),
    prisma.student.findMany({
      where: { classGroupId: plan.classGroupId },
      select: { id: true },
    }),
  ]);
  const seatIds = new Set(validSeats.map((s) => s.id));
  const studentIds = new Set(validStudents.map((s) => s.id));

  const seen = { seats: new Set<string>(), students: new Set<string>() };
  const clean = assignments.filter((assignment) => {
    if (!seatIds.has(assignment.seatId) || !studentIds.has(assignment.studentId)) return false;
    // Une place accueille un seul élève, un élève occupe une seule place.
    if (seen.seats.has(assignment.seatId) || seen.students.has(assignment.studentId)) return false;
    seen.seats.add(assignment.seatId);
    seen.students.add(assignment.studentId);
    return true;
  });

  await prisma.$transaction([
    prisma.assignment.deleteMany({ where: { planId } }),
    prisma.assignment.createMany({
      data: clean.map((assignment) => ({
        planId,
        seatId: assignment.seatId,
        studentId: assignment.studentId,
        pinned: assignment.pinned,
      })),
    }),
    prisma.seatingPlan.update({ where: { id: planId }, data: { updatedAt: new Date() } }),
  ]);

  // Le tableau de bord affiche le compteur « placés » et trie par date de
  // modification : sans cette revalidation il resterait périmé, ce que
  // l'enregistrement automatique rend d'autant plus visible.
  revalidatePath(`/plans/${planId}`);
  revalidatePath("/tableau-de-bord");
  revalidatePath(`/classes/${plan.classGroupId}`);
  return ok();
}

export async function duplicatePlan(id: string): Promise<ActionResult<{ id: string }>> {
  const user = await requireUser();

  const source = await prisma.seatingPlan.findFirst({
    where: { id, userId: user.id },
    include: { assignments: true },
  });
  if (!source) return fail("Plan de classe introuvable.");

  const copy = await prisma.$transaction(async (tx) => {
    const plan = await tx.seatingPlan.create({
      data: {
        userId: user.id,
        classGroupId: source.classGroupId,
        roomId: source.roomId,
        name: `${source.name} (copie)`,
        mirrored: source.mirrored,
        proximityCm: source.proximityCm,
      },
    });

    if (source.assignments.length > 0) {
      await tx.assignment.createMany({
        data: source.assignments.map((assignment) => ({
          planId: plan.id,
          seatId: assignment.seatId,
          studentId: assignment.studentId,
          pinned: assignment.pinned,
        })),
      });
    }

    return plan;
  });

  revalidatePath("/tableau-de-bord");
  return ok({ id: copy.id });
}
