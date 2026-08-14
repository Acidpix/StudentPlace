import { decryptComment } from "@/lib/crypto";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";

/**
 * Export de toutes les données du professeur, au format JSON.
 *
 * Répond au droit à la portabilité du RGPD. Les commentaires y figurent en
 * clair : c'est bien l'intérêt d'un export, et il est déclenché par le
 * titulaire du compte lui-même.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return new Response("Authentification requise.", { status: 401 });

  const [classGroups, rooms, plans] = await Promise.all([
    prisma.classGroup.findMany({
      where: { userId: user.id },
      include: { students: true, relations: true },
      orderBy: { name: "asc" },
    }),
    prisma.room.findMany({
      where: { userId: user.id },
      include: { objects: { include: { seats: true } } },
      orderBy: { name: "asc" },
    }),
    prisma.seatingPlan.findMany({
      where: { userId: user.id },
      include: { assignments: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const payload = {
    exporteLe: new Date().toISOString(),
    compte: { nom: user.name, email: user.email },
    classes: classGroups.map((classGroup) => ({
      nom: classGroup.name,
      anneeScolaire: classGroup.schoolYear,
      eleves: classGroup.students.map((student) => ({
        id: student.id,
        nom: student.lastName,
        prenom: student.firstName,
        difficulte: student.difficulty,
        premierRang: student.needsFront,
        gaucher: student.leftHanded,
        commentaire: decryptComment(student.commentEnc),
      })),
      relations: classGroup.relations.map((relation) => ({
        eleveA: relation.studentAId,
        eleveB: relation.studentBId,
        type: relation.type,
      })),
    })),
    salles: rooms.map((room) => ({
      nom: room.name,
      largeurCm: room.widthCm,
      profondeurCm: room.heightCm,
      mobilier: room.objects.map((object) => ({
        type: object.kind,
        x: object.x,
        y: object.y,
        largeurCm: object.widthCm,
        profondeurCm: object.heightCm,
        rotation: object.rotation,
        etiquette: object.label,
        places: object.seats.map((seat) => ({ id: seat.id, x: seat.x, y: seat.y })),
      })),
    })),
    plans: plans.map((plan) => ({
      nom: plan.name,
      classeId: plan.classGroupId,
      salleId: plan.roomId,
      affectations: plan.assignments.map((assignment) => ({
        placeId: assignment.seatId,
        eleveId: assignment.studentId,
        verrouillee: assignment.pinned,
      })),
    })),
  };

  return new Response(JSON.stringify(payload, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": 'attachment; filename="studentplace-export.json"',
      "Cache-Control": "no-store, max-age=0",
    },
  });
}
