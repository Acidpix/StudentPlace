import type { Metadata } from "next";
import Link from "next/link";

import { NewRoomForm } from "@/components/room/new-room-form";
import { RoomCardActions } from "@/components/room/room-card-actions";
import { CARD, CARD_INTERACTIVE } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { EmptyRoomArt } from "@/components/ui/icons";
import { PageWidth } from "@/components/ui/page-width";
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
    <PageWidth className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Mes salles</h1>
          <p className="mt-1.5 text-sm text-muted">
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
              className={`p-4 ${CARD} ${CARD_INTERACTIVE}`}
            >
              <Link href={`/salles/${room.id}`} className="block hover:text-primary">
                <p className="text-base font-bold">{room.name}</p>
                <p className="mt-0.5 text-xs text-muted">
                  {room.widthCm / 100} × {room.heightCm / 100} m
                </p>
                <p className="eyebrow mt-3 flex flex-wrap gap-x-3 gap-y-1">
                  <span className="tabular-nums">
                    {room._count.seats} place{room._count.seats > 1 ? "s" : ""}
                  </span>
                  <span className="tabular-nums">
                    {room._count.seatingPlans} plan{room._count.seatingPlans > 1 ? "s" : ""}
                  </span>
                </p>
              </Link>

              <RoomCardActions roomId={room.id} roomName={room.name} />
            </li>
          ))}
        </ul>
      )}
    </PageWidth>
  );
}
