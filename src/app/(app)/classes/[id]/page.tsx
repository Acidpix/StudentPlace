import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { CsvImport } from "@/components/class/csv-import";
import { DeleteClassButton } from "@/components/class/delete-class-button";
import { RelationManager } from "@/components/class/relation-manager";
import { StudentManager } from "@/components/class/student-manager";
import { NewPlanDialog } from "@/components/plan/new-plan-dialog";
import { ArrowLeftIcon } from "@/components/ui/icons";
import { decryptComment } from "@/lib/crypto";
import { prisma } from "@/lib/db";
import { toDifficulty, type RelationType } from "@/lib/domain";
import { requireUser } from "@/lib/session";

export const metadata: Metadata = { title: "Classe" };

export default async function ClassDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();

  const classGroup = await prisma.classGroup.findFirst({
    where: { id, userId: user.id },
    include: {
      students: { orderBy: [{ lastName: "asc" }, { firstName: "asc" }] },
      relations: true,
      seatingPlans: {
        include: { room: { select: { name: true } } },
        orderBy: { updatedAt: "desc" },
      },
    },
  });

  if (!classGroup) notFound();

  const rooms = await prisma.room.findMany({
    where: { userId: user.id },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });

  // Les commentaires sont déchiffrés ici, au plus près de l'affichage.
  const students = classGroup.students.map((student) => ({
    id: student.id,
    firstName: student.firstName,
    lastName: student.lastName,
    comment: decryptComment(student.commentEnc) ?? "",
    difficulty: toDifficulty(student.difficulty),
    needsFront: student.needsFront,
    leftHanded: student.leftHanded,
  }));

  const relations = classGroup.relations.map((relation) => ({
    id: relation.id,
    studentAId: relation.studentAId,
    studentBId: relation.studentBId,
    type: relation.type as RelationType,
  }));

  return (
    <div className="space-y-8">
      <div>
        <Link href="/classes" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-foreground">
          <ArrowLeftIcon />
          Toutes les classes
        </Link>

        <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{classGroup.name}</h1>
            <p className="mt-1 text-sm text-muted">
              {classGroup.schoolYear ? `${classGroup.schoolYear} · ` : ""}
              {students.length} élève{students.length > 1 ? "s" : ""}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            {rooms.length > 0 && (
              <NewPlanDialog
                classGroups={[{ id: classGroup.id, name: classGroup.name }]}
                rooms={rooms}
                defaultClassGroupId={classGroup.id}
              />
            )}
            <DeleteClassButton classGroupId={classGroup.id} classGroupName={classGroup.name} />
          </div>
        </div>
      </div>

      <StudentManager classGroupId={classGroup.id} students={students} />

      <RelationManager classGroupId={classGroup.id} students={students} relations={relations} />

      <CsvImport classGroupId={classGroup.id} hasStudents={students.length > 0} />

      <section>
        <h2 className="mb-3 font-medium">Plans de cette classe</h2>
        {classGroup.seatingPlans.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted">
            {rooms.length === 0 ? (
              <>
                Créez d&apos;abord une{" "}
                <Link href="/salles" className="text-primary hover:underline">
                  salle
                </Link>{" "}
                pour pouvoir composer un plan.
              </>
            ) : (
              "Aucun plan pour cette classe."
            )}
          </p>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {classGroup.seatingPlans.map((plan) => (
              <li key={plan.id}>
                <Link
                  href={`/plans/${plan.id}`}
                  className="block rounded-xl border border-border bg-surface p-4 hover:border-primary"
                >
                  <p className="font-medium">{plan.name}</p>
                  <p className="mt-1 text-sm text-muted">{plan.room.name}</p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
