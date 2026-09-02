import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PlanEditor } from "@/components/plan/plan-editor";
import { PageWidth } from "@/components/ui/page-width";
import { decryptComment } from "@/lib/crypto";
import { prisma } from "@/lib/db";
import { toDifficulty, type ObjectKind, type RelationType } from "@/lib/domain";
import { requireUser } from "@/lib/session";
import type { AssignmentView, RelationView, RoomView, StudentView } from "@/lib/view-models";

export const metadata: Metadata = { title: "Plan de classe" };

export default async function PlanPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();

  const plan = await prisma.seatingPlan.findFirst({
    where: { id, userId: user.id },
    include: {
      classGroup: {
        include: {
          students: { orderBy: [{ lastName: "asc" }, { firstName: "asc" }] },
          relations: true,
        },
      },
      room: { include: { objects: { include: { seats: true } } } },
      assignments: true,
    },
  });

  if (!plan) notFound();

  /**
   * Tous les plans du compte, pour le sélecteur de la barre d'outils.
   *
   * Requête séparée et volontairement MAIGRE — quatre champs par plan, aucun
   * meuble, aucune place : elle ne sert qu'à remplir un menu. Le tri par nom de
   * classe puis nom de plan est celui de l'affichage, groupé par classe.
   */
  const plans = (
    await prisma.seatingPlan.findMany({
      where: { userId: user.id },
      select: {
        id: true,
        name: true,
        classGroup: { select: { name: true } },
        room: { select: { name: true } },
      },
      orderBy: [{ classGroup: { name: "asc" } }, { name: "asc" }],
    })
  ).map((entry) => ({
    id: entry.id,
    name: entry.name,
    classGroupName: entry.classGroup.name,
    roomName: entry.room.name,
  }));

  const students: StudentView[] = plan.classGroup.students.map((student) => ({
    id: student.id,
    firstName: student.firstName,
    lastName: student.lastName,
    comment: decryptComment(student.commentEnc) ?? "",
    difficulty: toDifficulty(student.difficulty),
    needsFront: student.needsFront,
    leftHanded: student.leftHanded,
  }));

  const relations: RelationView[] = plan.classGroup.relations.map((relation) => ({
    id: relation.id,
    studentAId: relation.studentAId,
    studentBId: relation.studentBId,
    type: relation.type as RelationType,
  }));

  const room: RoomView = {
    id: plan.room.id,
    name: plan.room.name,
    widthCm: plan.room.widthCm,
    heightCm: plan.room.heightCm,
    objects: plan.room.objects.map((object) => ({
      id: object.id,
      kind: object.kind as ObjectKind,
      x: object.x,
      y: object.y,
      widthCm: object.widthCm,
      heightCm: object.heightCm,
      rotation: object.rotation,
      label: object.label,
      seats: object.seats.map((seat) => ({
        id: seat.id,
        x: seat.x,
        y: seat.y,
        label: seat.label,
        disabled: seat.disabled,
        isEndSeat: seat.isEndSeat,
      })),
    })),
  };

  const assignments: AssignmentView[] = plan.assignments.map((assignment) => ({
    seatId: assignment.seatId,
    studentId: assignment.studentId,
    pinned: assignment.pinned,
  }));

  return (
    // `wide` : la seule page du site à sortir des 72 rem. Les deux colonnes
    // latérales de l'éditeur mangeaient la moitié de la largeur utile, et il ne
    // restait qu'environ 660 px au plan lui-même.
    <PageWidth wide>
      <PlanEditor
        plan={{
          id: plan.id,
          name: plan.name,
          mirrored: plan.mirrored,
          proximityCm: plan.proximityCm,
          classGroupId: plan.classGroupId,
          classGroupName: plan.classGroup.name,
        }}
        plans={plans}
        room={room}
        students={students}
        relations={relations}
        initialAssignments={assignments}
      />
    </PageWidth>
  );
}
