import type { Metadata } from "next";
import Link from "next/link";

import { NewRoomForm } from "@/components/room/new-room-form";
import { RoomCardActions } from "@/components/room/room-card-actions";
import { CARD } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { EmptyRoomArt } from "@/components/ui/icons";
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
        <EmptyState
          Illustration={EmptyRoomArt}
          title="Aucune salle"
          description="Créez-en une pour y disposer vos tables, le bureau et le tableau."
        />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {rooms.map((room) => (
            <li
              key={room.id}
              className={`p-4 ${CARD} transition-[border-color,box-shadow] duration-150 hover:border-primary/50 hover:shadow-lift`}
            >
              <Link href={`/salles/${room.id}`} className="block hover:text-primary">
                <p className="font-medium">{room.name}</p>
                <p className="mt-1 text-sm text-muted">
                  {room.widthCm / 100} × {room.heightCm / 100} m
                </p>
                <p className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted">
                  <span>
                    <span className="text-base font-semibold tabular-nums text-foreground">
                      {room._count.seats}
                    </span>{" "}
                    place{room._count.seats > 1 ? "s" : ""}
                  </span>
                  <span>
                    <span className="text-base font-semibold tabular-nums text-foreground">
                      {room._count.seatingPlans}
                    </span>{" "}
                    plan{room._count.seatingPlans > 1 ? "s" : ""} de classe
                  </span>
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
