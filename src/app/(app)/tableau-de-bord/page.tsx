import type { Metadata } from "next";
import Link from "next/link";

import { NewPlanDialog } from "@/components/plan/new-plan-dialog";
import { PlanBrowser } from "@/components/plan/plan-browser";
import { CARD } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { EmptyPlanArt } from "@/components/ui/icons";
import { PageWidth } from "@/components/ui/page-width";
import { prisma } from "@/lib/db";
import type { ObjectKind } from "@/lib/domain";
import { requireUser } from "@/lib/session";

export const metadata: Metadata = { title: "Tableau de bord" };

export default async function DashboardPage() {
  const user = await requireUser();

  const [classGroups, rooms, plans] = await Promise.all([
    prisma.classGroup.findMany({
      where: { userId: user.id },
      include: { _count: { select: { students: true } } },
      orderBy: { name: "asc" },
    }),
    prisma.room.findMany({
      where: { userId: user.id },
      include: { _count: { select: { seats: true } } },
      orderBy: { name: "asc" },
    }),
    // Tous les plans, et non plus seulement les neuf derniers : le tri par
    // classe et par salle se fait dans le navigateur, il lui faut la liste
    // entière. `PlanBrowser` n'en affiche qu'une page à la fois.
    prisma.seatingPlan.findMany({
      where: { userId: user.id },
      include: {
        classGroup: { select: { name: true, _count: { select: { students: true } } } },
        // La miniature a besoin de l'agencement, mais pas des places : un
        // rectangle par meuble suffit à reconnaître une salle d'un coup d'œil.
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
    }),
  ]);

  // Compte vierge : ni classe ni salle, donc rien à faire sinon commencer.
  const isEmpty = classGroups.length === 0 && rooms.length === 0;

  return (
    <PageWidth className="space-y-8">
      {/* En-tête de la maquette 2c : la salutation EST le titre, en grand, et
          le contexte chiffré passe en sous-titre. « Tableau de bord » ne
          servait qu'à répéter l'entrée de navigation déjà surlignée. */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
            Bonjour {user.name.split(" ")[0]}
          </h1>
          <p className="mt-1.5 text-sm text-muted">
            {classGroups.length} classe{classGroups.length > 1 ? "s" : ""} · {rooms.length} salle
            {rooms.length > 1 ? "s" : ""} · {plans.length} plan{plans.length > 1 ? "s" : ""} de
            classe
          </p>
        </div>

        {classGroups.length > 0 && rooms.length > 0 && (
          <NewPlanDialog classGroups={classGroups} rooms={rooms} />
        )}
      </div>

      {isEmpty && <GettingStarted />}

      {plans.length > 0 && (
        <PlanBrowser
          plans={plans.map((plan) => ({
            id: plan.id,
            name: plan.name,
            classGroupId: plan.classGroupId,
            classGroupName: plan.classGroup.name,
            roomId: plan.roomId,
            roomName: plan.room.name,
            seated: plan._count.assignments,
            total: plan.classGroup._count.students,
            widthCm: plan.room.widthCm,
            heightCm: plan.room.heightCm,
            objects: plan.room.objects.map((object) => ({
              ...object,
              kind: object.kind as ObjectKind,
            })),
          }))}
        />
      )}

      {!isEmpty && plans.length === 0 && (
        <EmptyState
          Illustration={EmptyPlanArt}
          title="Aucun plan de classe"
          description="Vous avez des classes et des salles : il ne reste qu'à composer un plan de classe."
        />
      )}

      <div className="grid gap-6 md:grid-cols-2">
        <Panel
          title="Mes classes"
          href="/classes"
          emptyLabel="Aucune classe pour l'instant."
          items={classGroups.map((classGroup) => ({
            id: classGroup.id,
            href: `/classes/${classGroup.id}`,
            label: classGroup.name,
            detail: `${classGroup._count.students} élève${classGroup._count.students > 1 ? "s" : ""}`,
          }))}
        />

        <Panel
          title="Mes salles"
          href="/salles"
          emptyLabel="Aucune salle pour l'instant."
          items={rooms.map((room) => ({
            id: room.id,
            href: `/salles/${room.id}`,
            label: room.name,
            detail: `${room._count.seats} place${room._count.seats > 1 ? "s" : ""}`,
          }))}
        />
      </div>
    </PageWidth>
  );
}

function Panel({
  title,
  href,
  items,
  emptyLabel,
}: {
  title: string;
  href: string;
  items: Array<{ id: string; href: string; label: string; detail: string }>;
  emptyLabel: string;
}) {
  return (
    <section className={`${CARD} p-4`}>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="eyebrow">{title}</h2>
        <Link href={href} className="text-sm text-primary hover:underline">
          Tout voir
        </Link>
      </div>

      {items.length === 0 ? (
        <p className="text-sm text-muted">{emptyLabel}</p>
      ) : (
        <ul className="divide-y divide-border">
          {items.slice(0, 6).map((item) => (
            <li key={item.id}>
              <Link
                href={item.href}
                className="flex items-center justify-between py-2 text-sm hover:text-primary"
              >
                <span className="truncate font-medium">{item.label}</span>
                <span className="eyebrow shrink-0 pl-3">{item.detail}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function GettingStarted() {
  const steps = [
    {
      title: "Créez une classe",
      text: "Ajoutez vos élèves, leur note de comportement et leurs incompatibilités.",
      href: "/classes",
      cta: "Aller aux classes",
    },
    {
      title: "Dessinez une salle",
      text: "Disposez les tables, le bureau et le tableau tels qu'ils sont réellement.",
      href: "/salles",
      cta: "Aller aux salles",
    },
    {
      title: "Composez un plan de classe",
      text: "Placez les élèves à la main, ou laissez le placement automatique proposer une disposition.",
      href: "/salles",
      cta: null,
    },
  ];

  return (
    <section className={`${CARD} p-6`}>
      <h2 className="eyebrow">Premiers pas</h2>
      <ol className="mt-4 grid gap-4 sm:grid-cols-3">
        {steps.map((step, index) => (
          <li key={step.title} className="rounded-control bg-surface-muted p-4">
            <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
              {index + 1}
            </span>
            <p className="mt-2 font-medium">{step.title}</p>
            <p className="mt-1 text-sm text-muted">{step.text}</p>
            {step.cta && (
              <Link href={step.href} className="mt-2 inline-block text-sm text-primary hover:underline">
                {step.cta} →
              </Link>
            )}
          </li>
        ))}
      </ol>
    </section>
  );
}
