import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { RoomEditor } from "@/components/room/room-editor";
import { PageWidth } from "@/components/ui/page-width";
import { prisma } from "@/lib/db";
import type { ObjectKind } from "@/lib/domain";
import { requireUser } from "@/lib/session";
import type { RoomView } from "@/lib/view-models";

export const metadata: Metadata = { title: "Éditeur de salle" };

export default async function RoomDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();

  const room = await prisma.room.findFirst({
    where: { id, userId: user.id },
    include: { objects: { include: { seats: true } } },
  });

  if (!room) notFound();

  const view: RoomView = {
    id: room.id,
    name: room.name,
    widthCm: room.widthCm,
    heightCm: room.heightCm,
    objects: room.objects.map((object) => ({
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

  // Même largeur que l'éditeur de plan de classe : les deux éditeurs se
  // ressemblent, et cette page n'en déclarait aucune — elle s'étalait donc sur
  // toute la fenêtre.
  return (
    <PageWidth wide>
      <RoomEditor room={view} />
    </PageWidth>
  );
}
