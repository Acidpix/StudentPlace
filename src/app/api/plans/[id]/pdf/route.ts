import type { NextRequest } from "next/server";

import { decryptComment } from "@/lib/crypto";
import { prisma } from "@/lib/db";
import { toBehavior, type ObjectKind } from "@/lib/domain";
import { renderPlanPdf, type PlanPdfAssignment, type PlanPdfOptions } from "@/lib/pdf/plan-document";
import { getCurrentUser } from "@/lib/session";
import type { RoomView, StudentView } from "@/lib/view-models";

/**
 * Génération du PDF d'un plan de classe.
 *
 * Le rendu a lieu CÔTÉ SERVEUR : le PDF est vectoriel, et la bibliothèque de
 * rendu (environ 400 Ko) ne pèse pas sur le navigateur du professeur.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Nom de fichier utilisable par tous les systèmes.
 *
 * La décomposition NFD sépare « é » en « e » suivi d'un accent combinant ;
 * le filtre ASCII qui suit écarte l'accent et conserve la lettre. « 4e B »
 * devient donc « 4e-B » et non « 4-B ».
 */
function sanitizeFilename(value: string): string {
  return (
    value
      .normalize("NFD")
      .replace(/[^a-zA-Z0-9 _-]/g, "")
      .trim()
      .replace(/\s+/g, "-")
      .slice(0, 80) || "plan-de-classe"
  );
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const user = await getCurrentUser();
  if (!user) {
    return new Response("Authentification requise.", { status: 401 });
  }

  const plan = await prisma.seatingPlan.findFirst({
    where: { id, userId: user.id },
    include: {
      classGroup: { include: { students: true } },
      room: { include: { objects: { include: { seats: true } } } },
      assignments: true,
    },
  });

  if (!plan) {
    return new Response("Plan de classe introuvable.", { status: 404 });
  }

  const query = request.nextUrl.searchParams;
  const options: PlanPdfOptions = {
    // Par défaut, aucune donnée comportementale : il faut la demander.
    includeComments: query.get("commentaires") === "1",
    includeBehavior: query.get("comportement") === "1",
    includeRoster: query.get("liste") !== "0",
    // Les cases de participation ne portent aucune donnée : elles sont vides
    // par définition. Elles restent néanmoins décochées par défaut, un plan
    // servant d'abord à situer les élèves.
    includeParticipation: query.get("participation") === "1",
    mirrored: query.get("miroir") === "1",
  };

  const students: StudentView[] = plan.classGroup.students.map((student) => ({
    id: student.id,
    firstName: student.firstName,
    lastName: student.lastName,
    // Ne déchiffrer que si le commentaire doit réellement figurer au document.
    comment: options.includeComments ? (decryptComment(student.commentEnc) ?? "") : "",
    behavior: toBehavior(student.difficulty),
    needsFront: student.needsFront,
    leftHanded: student.leftHanded,
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

  const buffer = await renderPlanPdf(
    {
      planName: plan.name,
      className: plan.classGroup.name,
      roomName: plan.room.name,
      teacherName: user.name,
      room,
      students,
      // Le verrouillage suit jusqu'au PDF : à l'écran il se lit à un cerclage
      // rouge permanent, et le document doit montrer la même chose.
      assignments: new Map(
        plan.assignments.map((a): [string, PlanPdfAssignment] => [
          a.seatId,
          { studentId: a.studentId, pinned: a.pinned },
        ]),
      ),
    },
    options,
  );

  const filename = `${sanitizeFilename(`${plan.classGroup.name} ${plan.room.name}`)}.pdf`;

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      // Un plan peut contenir des données personnelles : jamais de cache.
      "Cache-Control": "no-store, max-age=0",
    },
  });
}
