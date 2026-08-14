import type { Metadata } from "next";
import Link from "next/link";

import { NewRoomForm } from "@/components/room/new-room-form";
import { RoomCardActions } from "@/components/room/room-card-actions";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/session";

export const metadata: Metadata = { title: "Salles" };

export default async function RoomsPage() {
  const user = await requireUser();

  const rooms = await prisma.room.findMany({
    where: { userId: user.id },
    include: { _count: { select: { seats: true, seatingPlans: true } } },
    orderBy: { name: "asc" },
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Mes salles</h1>
          <p className="mt-1 text-sm text-muted">
            Reproduisez la disposition réelle des tables : c&apos;est elle qui détermine qui est
            voisin de qui.
          </p>
        </div>
        <NewRoomForm />
      </div>

      {rooms.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted">
          Aucune salle. Créez-en une pour y disposer vos tables.
        </p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {rooms.map((room) => (
            <li key={room.id} className="rounded-xl border border-border bg-surface p-4">
              <Link href={`/salles/${room.id}`} className="block hover:text-primary">
                <p className="font-medium">{room.name}</p>
                <p className="mt-1 text-sm text-muted">
                  {room.widthCm / 100} × {room.heightCm / 100} m
                </p>
                <p className="mt-2 text-xs text-muted">
                  {room._count.seats} place{room._count.seats > 1 ? "s" : ""} ·{" "}
                  {room._count.seatingPlans} plan{room._count.seatingPlans > 1 ? "s" : ""}
                </p>
              </Link>

              <RoomCardActions roomId={room.id} roomName={room.name} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
