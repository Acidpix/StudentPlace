import type { Metadata } from "next";
import Link from "next/link";

import { NewPlanDialog } from "@/components/plan/new-plan-dialog";
import { PlanThumbnail } from "@/components/plan/plan-thumbnail";
import { CARD, CARD_INTERACTIVE, SectionHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { EmptyPlanArt, GridIcon, LayoutIcon, UsersIcon } from "@/components/ui/icons";
import { StatTile } from "@/components/ui/stat-tile";
import { prisma } from "@/lib/db";
import type { ObjectKind } from "@/lib/domain";
import { requireUser } from "@/lib/session";

export const metadata: Metadata = { title: "Tableau de bord" };

export default async function DashboardPage() {
  const user = await requireUser();

  const [classGroups, rooms, plans, planCount] = await Promise.all([
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
      take: 9,
    }),
    prisma.seatingPlan.count({ where: { userId: user.id } }),
  ]);

  // Compte vierge : ni classe ni salle, donc rien à faire sinon commencer.
  const isEmpty = classGroups.length === 0 && rooms.length === 0;

  return (
    <div className="mx-auto w-full max-w-6xl space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Tableau de bord</h1>
          <p className="mt-1 text-sm text-muted">Bonjour {user.name.split(" ")[0]}.</p>
        </div>

        {classGroups.length > 0 && rooms.length > 0 && (
          <NewPlanDialog classGroups={classGroups} rooms={rooms} />
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <StatTile
          label={`classe${classGroups.length > 1 ? "s" : ""}`}
          value={classGroups.length}
          href="/classes"
          tone="primary"
          Icon={UsersIcon}
        />
        <StatTile
          label={`salle${rooms.length > 1 ? "s" : ""}`}
          value={rooms.length}
          href="/salles"
          tone="accent"
          Icon={GridIcon}
        />
        <StatTile
          label={`plan${planCount > 1 ? "s" : ""} de classe`}
          value={planCount}
          tone="neutral"
          Icon={LayoutIcon}
        />
      </div>

      {isEmpty && <GettingStarted />}

      {plans.length > 0 && (
        <section>
          <SectionHeader title="Plans de classe récents" />
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {plans.map((plan) => {
              const total = plan.classGroup._count.students;
              const seated = plan._count.assignments;
              const ratio = total === 0 ? 0 : Math.round((seated / total) * 100);

              return (
                <li key={plan.id}>
                  <Link
                    href={`/plans/${plan.id}`}
                    className={`block overflow-hidden ${CARD} ${CARD_INTERACTIVE}`}
                  >
                    <PlanThumbnail
                      widthCm={plan.room.widthCm}
                      heightCm={plan.room.heightCm}
                      objects={plan.room.objects.map((object) => ({
                        ...object,
                        kind: object.kind as ObjectKind,
                      }))}
                    />

                    <div className="p-4">
                      <p className="truncate font-medium">{plan.name}</p>
                      <p className="mt-1 truncate text-sm text-muted">
                        {plan.classGroup.name} · {plan.room.name}
                      </p>

                      <div
                        className="mt-3 h-1.5 overflow-hidden rounded-full bg-surface-muted"
                        role="img"
                        aria-label={`${seated} élève${seated > 1 ? "s" : ""} placé${seated > 1 ? "s" : ""} sur ${total}`}
                      >
                        <div
                          className="h-full rounded-full bg-accent"
                          style={{ width: `${ratio}%` }}
                        />
                      </div>
                      <p className="mt-1.5 text-xs text-muted">
                        {seated}/{total} élève{total > 1 ? "s" : ""} placé{seated > 1 ? "s" : ""}
                      </p>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
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
    <section className={`${CARD} p-4`}>
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
              <Link
                href={item.href}
                className="flex items-center justify-between py-2 text-sm hover:text-primary"
              >
                <span className="truncate">{item.label}</span>
                <span className="shrink-0 pl-3 text-muted">{item.detail}</span>
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
      text: "Ajoutez vos élèves, leur note de difficulté et leurs incompatibilités.",
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
      <h2 className="font-medium">Premiers pas</h2>
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
