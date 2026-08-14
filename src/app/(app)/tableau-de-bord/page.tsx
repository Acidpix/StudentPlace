import type { Metadata } from "next";
import Link from "next/link";

import { NewPlanDialog } from "@/components/plan/new-plan-dialog";
import { prisma } from "@/lib/db";
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
    prisma.seatingPlan.findMany({
      where: { userId: user.id },
      include: {
        classGroup: { select: { name: true } },
        room: { select: { name: true } },
        _count: { select: { assignments: true } },
      },
      orderBy: { updatedAt: "desc" },
      take: 12,
    }),
  ]);

  const isEmpty = classGroups.length === 0 && rooms.length === 0;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Tableau de bord</h1>
          <p className="mt-1 text-sm text-muted">
            {classGroups.length} classe{classGroups.length > 1 ? "s" : ""} · {rooms.length} salle
            {rooms.length > 1 ? "s" : ""} · {plans.length} plan{plans.length > 1 ? "s" : ""}
          </p>
        </div>

        {classGroups.length > 0 && rooms.length > 0 && (
          <NewPlanDialog classGroups={classGroups} rooms={rooms} />
        )}
      </div>

      {isEmpty && <GettingStarted />}

      {plans.length > 0 && (
        <section>
          <h2 className="mb-3 text-sm font-medium text-muted">Plans récents</h2>
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {plans.map((plan) => (
              <li key={plan.id}>
                <Link
                  href={`/plans/${plan.id}`}
                  className="block rounded-xl border border-border bg-surface p-4 hover:border-primary"
                >
                  <p className="font-medium">{plan.name}</p>
                  <p className="mt-1 text-sm text-muted">
                    {plan.classGroup.name} · {plan.room.name}
                  </p>
                  <p className="mt-2 text-xs text-muted">
                    {plan._count.assignments} élève{plan._count.assignments > 1 ? "s" : ""} placé
                    {plan._count.assignments > 1 ? "s" : ""}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        </section>
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
    </div>
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
    <section className="rounded-xl border border-border bg-surface p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-medium">{title}</h2>
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
              <Link href={item.href} className="flex items-center justify-between py-2 text-sm hover:text-primary">
                <span>{item.label}</span>
                <span className="text-muted">{item.detail}</span>
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
    { title: "Créez une classe", text: "Ajoutez vos élèves, leur note de difficulté et leurs incompatibilités.", href: "/classes", cta: "Aller aux classes" },
    { title: "Dessinez une salle", text: "Disposez les tables, le bureau et le tableau tels qu'ils sont réellement.", href: "/salles", cta: "Aller aux salles" },
    { title: "Composez un plan", text: "Placez les élèves à la main, ou laissez le placement automatique proposer une disposition.", href: "/salles", cta: null },
  ];

  return (
    <section className="rounded-xl border border-border bg-surface p-6">
      <h2 className="font-medium">Premiers pas</h2>
      <ol className="mt-4 grid gap-4 sm:grid-cols-3">
        {steps.map((step, index) => (
          <li key={step.title} className="rounded-lg bg-surface-muted p-4">
            <span className="text-xs font-semibold text-primary">Étape {index + 1}</span>
            <p className="mt-1 font-medium">{step.title}</p>
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
