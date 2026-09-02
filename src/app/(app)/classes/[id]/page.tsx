import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ClassHeader } from "@/components/class/class-header";
import { CsvImport } from "@/components/class/csv-import";
import { DeleteClassButton } from "@/components/class/delete-class-button";
import { RelationManager } from "@/components/class/relation-manager";
import { StudentManager } from "@/components/class/student-manager";
import { NewPlanDialog } from "@/components/plan/new-plan-dialog";
import { PlanCard } from "@/components/plan/plan-card";
import { SectionHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ArrowLeftIcon, EmptyPlanArt } from "@/components/ui/icons";
import { PageWidth } from "@/components/ui/page-width";
import { decryptComment } from "@/lib/crypto";
import { prisma } from "@/lib/db";
import { toDifficulty, type ObjectKind, type RelationType } from "@/lib/domain";
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
        include: {
          // La carte de plan montre la silhouette de la salle et l'état du
          // placement : il lui faut les meubles et le compte d'affectations.
          room: {
            select: {
              name: true,
              widthCm: true,
              heightCm: true,
              objects: {
                select: { id: true, kind: true, x: true, y: true, widthCm: true, heightCm: true },
              },
            },
          },
          _count: { select: { assignments: true } },
        },
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
    <PageWidth className="space-y-8">
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
      {/* `relations` sert aussi à la fiche élève : la maquette 2c y montre une
          section « relations », et elle se remplit avec les mêmes données que
          le gestionnaire ci-dessous. */}
      <StudentManager
        classGroupId={classGroup.id}
        classGroupName={classGroup.name}
        students={students}
        relations={relations}
      />

      <RelationManager classGroupId={classGroup.id} students={students} relations={relations} />

      <CsvImport classGroupId={classGroup.id} hasStudents={students.length > 0} />

      <section>
        <SectionHeader title="Plans de classe" />
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
                {/* La MÊME carte que sur le tableau de bord : la page d'une
                    classe montrait jusqu'ici le même objet en bien plus pauvre.
                    `classGroupName` est omis — on est déjà dans la classe. */}
                <PlanCard
                  plan={{
                    id: plan.id,
                    name: plan.name,
                    roomName: plan.room.name,
                    seated: plan._count.assignments,
                    total: students.length,
                    widthCm: plan.room.widthCm,
                    heightCm: plan.room.heightCm,
                    objects: plan.room.objects.map((object) => ({
                      ...object,
                      kind: object.kind as ObjectKind,
                    })),
                  }}
                />
              </li>
            ))}
          </ul>
        )}
      </section>
    </PageWidth>
  );
}
