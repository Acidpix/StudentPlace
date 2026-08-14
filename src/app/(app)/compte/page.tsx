import type { Metadata } from "next";
import Link from "next/link";

import { DangerZone } from "@/components/account/danger-zone";
import { DownloadIcon } from "@/components/ui/icons";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/session";

export const metadata: Metadata = { title: "Mon compte" };

export default async function AccountPage() {
  const user = await requireUser();

  const [classCount, studentCount, roomCount, planCount] = await Promise.all([
    prisma.classGroup.count({ where: { userId: user.id } }),
    prisma.student.count({ where: { classGroup: { userId: user.id } } }),
    prisma.room.count({ where: { userId: user.id } }),
    prisma.seatingPlan.count({ where: { userId: user.id } }),
  ]);

  return (
    <div className="mx-auto w-full max-w-2xl space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Mon compte</h1>
        <p className="mt-1 text-sm text-muted">{user.email}</p>
      </div>

      <section className="rounded-card border border-border bg-surface p-4 shadow-soft">
        <h2 className="font-medium">Mes données</h2>
        <dl className="mt-3 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
          {[
            ["Classes", classCount],
            ["Élèves", studentCount],
            ["Salles", roomCount],
            ["Plans de classe", planCount],
          ].map(([label, value]) => (
            <div key={String(label)} className="rounded-control bg-surface-muted p-3">
              <dt className="text-muted">{label}</dt>
              <dd className="mt-0.5 text-xl font-semibold tabular-nums">{value}</dd>
            </div>
          ))}
        </dl>

        <a
          href="/api/compte/export"
          className="mt-4 inline-flex h-9 items-center gap-2 rounded-control border border-border px-3 text-sm hover:bg-surface-muted"
        >
          <DownloadIcon />
          Exporter toutes mes données (JSON)
        </a>
        <p className="mt-2 text-xs text-muted">
          Contient vos classes, élèves, commentaires déchiffrés, salles et plans de classe.
        </p>
      </section>

      <section className="rounded-card border border-border bg-surface p-4 shadow-soft">
        <h2 className="font-medium">Confidentialité</h2>
        <p className="mt-2 text-sm text-muted">
          Vos données restent sur ce serveur et ne sont visibles que par vous. Les commentaires
          sur les élèves sont chiffrés dans la base.
        </p>
        <Link href="/confidentialite" className="mt-2 inline-block text-sm text-primary hover:underline">
          Traitement des données →
        </Link>
      </section>

      <DangerZone />
    </div>
  );
}
