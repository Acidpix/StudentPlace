import Link from "next/link";
import type { SVGProps } from "react";

import { cn } from "@/lib/cn";

type Tone = "primary" | "accent" | "neutral";

const TONES: Record<Tone, { bar: string; ink: string }> = {
  primary: { bar: "bg-primary", ink: "text-primary" },
  accent: { bar: "bg-accent", ink: "text-accent" },
  neutral: { bar: "bg-muted", ink: "text-muted" },
};

/**
 * Tuile chiffrée du tableau de bord : un nombre, ce qu'il compte, et une icône
 * en filigrane. Le liseré supérieur coloré donne à l'œil un point d'accroche
 * sans multiplier les fonds teintés.
 */
export function StatTile({
  label,
  value,
  href,
  tone = "neutral",
  Icon,
}: {
  label: string;
  value: number | string;
  href?: string;
  tone?: Tone;
  Icon: (props: SVGProps<SVGSVGElement>) => React.ReactElement;
}) {
  const { bar, ink } = TONES[tone];

  const body = (
    <>
      <span className={cn("absolute inset-x-0 top-0 h-1 rounded-t-card", bar)} aria-hidden="true" />
      <Icon
        width={72}
        height={72}
        className={cn("pointer-events-none absolute -right-3 -bottom-4 opacity-[0.06]", ink)}
      />
      <p className="text-3xl font-semibold tabular-nums tracking-tight">{value}</p>
      <p className="mt-0.5 text-sm text-muted">{label}</p>
    </>
  );

  const shell =
    "relative overflow-hidden rounded-card border border-border bg-surface p-4 pt-5 shadow-soft";

  if (!href) {
    return <div className={shell}>{body}</div>;
  }

  return (
    <Link
      href={href}
      className={cn(
        shell,
        "block transition-[border-color,box-shadow,transform] duration-150",
        "hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-lift",
      )}
    >
      {body}
    </Link>
  );
}
