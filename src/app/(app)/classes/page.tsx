import type { Metadata } from "next";
import Link from "next/link";

import { NewClassForm } from "@/components/class/new-class-form";
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
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Mes classes</h1>
          <p className="mt-1 text-sm text-muted">
            Une classe rassemble des élèves, leurs difficultés et leurs incompatibilités.
          </p>
        </div>
        <NewClassForm />
      </div>

      {classGroups.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted">
          Aucune classe. Créez-en une pour commencer.
        </p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {classGroups.map((classGroup) => (
            <li key={classGroup.id}>
              <Link
                href={`/classes/${classGroup.id}`}
                className="block rounded-xl border border-border bg-surface p-4 hover:border-primary"
              >
                <p className="font-medium">{classGroup.name}</p>
                {classGroup.schoolYear && (
                  <p className="text-sm text-muted">{classGroup.schoolYear}</p>
                )}
                <p className="mt-2 text-xs text-muted">
                  {classGroup._count.students} élève{classGroup._count.students > 1 ? "s" : ""} ·{" "}
                  {classGroup._count.seatingPlans} plan
                  {classGroup._count.seatingPlans > 1 ? "s" : ""}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
