import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ClassHeader } from "@/components/class/class-header";
import { CsvImport } from "@/components/class/csv-import";
import { DeleteClassButton } from "@/components/class/delete-class-button";
import { RelationManager } from "@/components/class/relation-manager";
import { StudentManager } from "@/components/class/student-manager";
import { NewPlanDialog } from "@/components/plan/new-plan-dialog";
import { CARD, CARD_INTERACTIVE } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ArrowLeftIcon, EmptyPlanArt } from "@/components/ui/icons";
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
          <ClassHeader
            classGroupId={classGroup.id}
            name={classGroup.name}
            schoolYear={classGroup.schoolYear}
            studentCount={students.length}
          />

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

      {/* Sections empilées : la grille d'élèves a besoin de toute la largeur
          pour tenir sur trois colonnes, ce qui est justement le but. */}
      <StudentManager classGroupId={classGroup.id} students={students} />

      <RelationManager classGroupId={classGroup.id} students={students} relations={relations} />

      <CsvImport classGroupId={classGroup.id} hasStudents={students.length > 0} />

      <section>
        <h2 className="mb-3 font-medium">Plans de classe</h2>
        {classGroup.seatingPlans.length === 0 ? (
          <EmptyState
            Illustration={EmptyPlanArt}
            title="Aucun plan de classe"
            description={
              rooms.length === 0
                ? "Créez d'abord une salle pour pouvoir composer un plan de classe."
                : "Composez-en un pour placer les élèves dans une de vos salles."
            }
            action={
              rooms.length === 0 ? (
                <Link href="/salles" className="text-sm text-primary hover:underline">
                  Aller aux salles →
                </Link>
              ) : null
            }
          />
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {classGroup.seatingPlans.map((plan) => (
              <li key={plan.id}>
                <Link
                  href={`/plans/${plan.id}`}
                  className={`block p-4 ${CARD} ${CARD_INTERACTIVE}`}
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
