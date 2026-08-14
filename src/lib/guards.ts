import { prisma } from "@/lib/db";

/**
 * Garde-fous de propriété.
 *
 * RÈGLE ABSOLUE du projet : aucune requête de lecture ou d'écriture ne doit
 * cibler une ressource par son seul identifiant. Toute recherche est filtrée
 * par `userId`, faute de quoi il suffirait de deviner un identifiant dans
 * l'URL pour consulter la classe d'un collègue.
 *
 * Les fonctions `find*` renvoient `null` si la ressource n'existe pas OU
 * n'appartient pas à l'utilisateur : les deux cas sont délibérément
 * indiscernables, pour ne pas révéler l'existence d'une ressource d'autrui.
 */

export async function findOwnedClassGroup(id: string, userId: string) {
  return prisma.classGroup.findFirst({ where: { id, userId } });
}

export async function findOwnedRoom(id: string, userId: string) {
  return prisma.room.findFirst({ where: { id, userId } });
}

export async function findOwnedPlan(id: string, userId: string) {
  return prisma.seatingPlan.findFirst({ where: { id, userId } });
}

/** Vérifie qu'un élève appartient bien à une classe de l'utilisateur. */
export async function findOwnedStudent(id: string, userId: string) {
  return prisma.student.findFirst({
    where: { id, classGroup: { userId } },
  });
}

/** Vérifie qu'une place appartient bien à une salle de l'utilisateur. */
export async function findOwnedSeat(id: string, userId: string) {
  return prisma.seat.findFirst({
    where: { id, room: { userId } },
  });
}
