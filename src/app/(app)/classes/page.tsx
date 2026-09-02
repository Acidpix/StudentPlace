import type { Metadata } from "next";
import Link from "next/link";

import { NewClassForm } from "@/components/class/new-class-form";
import { CARD, CARD_INTERACTIVE } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { EmptyClassArt } from "@/components/ui/icons";
import { PageWidth } from "@/components/ui/page-width";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/session";

export const metadata: Metadata = { title: "Classes" };

export default async function ClassesPage() {
  const user = await requireUser();

  const classGroups = await prisma.classGroup.findMany({
    where: { userId: user.id },
    include: { _count: { select: { students: true, seatingPlans: true } } },
    orderBy: [{ schoolYear: "desc" }, { name: "asc" }],
  });

  return (
    <PageWidth className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Mes classes</h1>
          <p className="mt-1.5 text-sm text-muted">
            Une classe rassemble des élèves, leurs difficultés et leurs incompatibilités.
          </p>
        </div>
        <NewClassForm />
      </div>

      {classGroups.length === 0 ? (
        <EmptyState
          Illustration={EmptyClassArt}
          title="Aucune classe"
          description="Créez-en une, ajoutez-y vos élèves, et vous pourrez composer un plan de classe."
        />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {classGroups.map((classGroup) => (
            <li key={classGroup.id}>
              <Link
                href={`/classes/${classGroup.id}`}
                className={`block p-4 ${CARD} ${CARD_INTERACTIVE}`}
              >
                <p className="text-base font-bold">{classGroup.name}</p>
                {classGroup.schoolYear && (
                  <p className="mt-0.5 text-xs text-muted">{classGroup.schoolYear}</p>
                )}
                <p className="eyebrow mt-3 flex flex-wrap gap-x-3 gap-y-1">
                  <span className="tabular-nums">
                    {classGroup._count.students} élève{classGroup._count.students > 1 ? "s" : ""}
                  </span>
                  <span className="tabular-nums">
                    {classGroup._count.seatingPlans} plan
                    {classGroup._count.seatingPlans > 1 ? "s" : ""}
                  </span>
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </PageWidth>
  );
}
