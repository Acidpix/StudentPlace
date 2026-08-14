"use server";

import { revalidatePath } from "next/cache";

import { fail, firstIssue, ok, type ActionResult } from "./result";
import { prisma } from "@/lib/db";
import { findOwnedRoom } from "@/lib/guards";
import { requireUser } from "@/lib/session";
import { roomLayoutSchema, roomSchema } from "@/lib/validation";

export async function createRoom(input: unknown): Promise<ActionResult<{ id: string }>> {
  const user = await requireUser();
  const parsed = roomSchema.safeParse(input);
  if (!parsed.success) return fail(firstIssue(parsed.error));

  const room = await prisma.room.create({
    data: {
      userId: user.id,
      name: parsed.data.name,
      widthCm: parsed.data.widthCm,
      heightCm: parsed.data.heightCm,
    },
  });

  revalidatePath("/salles");
  revalidatePath("/tableau-de-bord");
  return ok({ id: room.id });
}

export async function deleteRoom(id: string): Promise<ActionResult> {
  const user = await requireUser();

  const room = await findOwnedRoom(id, user.id);
  if (!room) return fail("Salle introuvable.");

  await prisma.room.delete({ where: { id } });

  revalidatePath("/salles");
  revalidatePath("/tableau-de-bord");
  return ok();
}

/**
 * Enregistre l'agencement complet d'une salle.
 *
 * L'éditeur envoie la disposition entière plutôt qu'une liste de
 * modifications : c'est bien plus simple à raisonner qu'une réconciliation
 * incrémentale, et l'agencement d'une salle reste un objet minuscule.
 *
 * Les places qui SURVIVENT conservent leur identifiant. C'est essentiel : une
 * place supprimée emporte les affectations qui la référencent, et déplacer
 * deux tables ne doit pas anéantir les plans de classe déjà composés.
 *
 * En retour, les identifiants attribués sont renvoyés DANS L'ORDRE D'ENVOI :
 * l'éditeur s'en sert pour se resynchroniser, sans quoi un second
 * enregistrement recréerait tout le mobilier en double.
 */
export interface SavedLayoutIds {
  objects: Array<{ id: string; seatIds: string[] }>;
}

export async function saveRoomLayout(input: unknown): Promise<ActionResult<SavedLayoutIds>> {
  const user = await requireUser();
  const parsed = roomLayoutSchema.safeParse(input);
  if (!parsed.success) return fail(firstIssue(parsed.error));

  const { roomId, name, widthCm, heightCm, objects } = parsed.data;

  const room = await findOwnedRoom(roomId, user.id);
  if (!room) return fail("Salle introuvable.");

  // On ne fait confiance qu'aux identifiants appartenant RÉELLEMENT à cette
  // salle : un identifiant forgé pointant vers la salle d'un collègue serait
  // sinon accepté par un update.
  const [existingObjects, existingSeats] = await Promise.all([
    prisma.roomObject.findMany({ where: { roomId }, select: { id: true } }),
    prisma.seat.findMany({ where: { roomId }, select: { id: true } }),
  ]);
  const knownObjectIds = new Set(existingObjects.map((o) => o.id));
  const knownSeatIds = new Set(existingSeats.map((s) => s.id));

  const keptObjectIds = objects
    .map((o) => o.id)
    .filter((id): id is string => Boolean(id) && knownObjectIds.has(id!));
  const keptSeatIds = objects
    .flatMap((o) => o.seats.map((s) => s.id))
    .filter((id): id is string => Boolean(id) && knownSeatIds.has(id!));

  const savedIds = await prisma.$transaction(async (tx) => {
    const result: SavedLayoutIds = { objects: [] };

    await tx.room.update({ where: { id: roomId }, data: { name, widthCm, heightCm } });

    await tx.roomObject.deleteMany(
      keptObjectIds.length > 0
        ? { where: { roomId, id: { notIn: keptObjectIds } } }
        : { where: { roomId } },
    );

    await tx.seat.deleteMany(
      keptSeatIds.length > 0
        ? { where: { roomId, id: { notIn: keptSeatIds } } }
        : { where: { roomId } },
    );

    for (const object of objects) {
      const objectExists = Boolean(object.id) && knownObjectIds.has(object.id!);

      const data = {
        kind: object.kind,
        x: object.x,
        y: object.y,
        widthCm: object.widthCm,
        heightCm: object.heightCm,
        rotation: object.rotation,
        label: object.label ?? null,
      };

      const saved = objectExists
        ? await tx.roomObject.update({ where: { id: object.id! }, data })
        : await tx.roomObject.create({ data: { ...data, roomId } });

      const seatIds: string[] = [];

      for (const seat of object.seats) {
        const seatData = {
          x: seat.x,
          y: seat.y,
          label: seat.label ?? null,
          disabled: seat.disabled,
          isEndSeat: seat.isEndSeat,
        };

        const savedSeat =
          seat.id && knownSeatIds.has(seat.id)
            ? await tx.seat.update({
                where: { id: seat.id },
                data: { ...seatData, roomObjectId: saved.id },
              })
            : await tx.seat.create({
                data: { ...seatData, roomId, roomObjectId: saved.id },
              });

        seatIds.push(savedSeat.id);
      }

      result.objects.push({ id: saved.id, seatIds });
    }

    return result;
  });

  revalidatePath("/salles");
  revalidatePath(`/salles/${roomId}`);
  return ok(savedIds);
}

/** Duplique une salle : les salles d'un même établissement se ressemblent. */
export async function duplicateRoom(id: string): Promise<ActionResult<{ id: string }>> {
  const user = await requireUser();

  const source = await prisma.room.findFirst({
    where: { id, userId: user.id },
    include: { objects: { include: { seats: true } } },
  });
  if (!source) return fail("Salle introuvable.");

  const copy = await prisma.$transaction(async (tx) => {
    const room = await tx.room.create({
      data: {
        userId: user.id,
        name: `${source.name} (copie)`,
        widthCm: source.widthCm,
        heightCm: source.heightCm,
      },
    });

    for (const object of source.objects) {
      const created = await tx.roomObject.create({
        data: {
          roomId: room.id,
          kind: object.kind,
          x: object.x,
          y: object.y,
          widthCm: object.widthCm,
          heightCm: object.heightCm,
          rotation: object.rotation,
          label: object.label,
        },
      });

      if (object.seats.length > 0) {
        await tx.seat.createMany({
          data: object.seats.map((seat) => ({
            roomId: room.id,
            roomObjectId: created.id,
            x: seat.x,
            y: seat.y,
            label: seat.label,
            disabled: seat.disabled,
            isEndSeat: seat.isEndSeat,
          })),
        });
      }
    }

    return room;
  });

  revalidatePath("/salles");
  return ok({ id: copy.id });
}
