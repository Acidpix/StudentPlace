import type { SVGProps } from "react";

import { cn } from "@/lib/cn";

/**
 * État vide : une illustration discrète, une phrase qui dit quoi faire, et
 * l'action pour le faire. Sans illustration, ces zones ressemblaient à un
 * chargement qui n'aboutit pas.
 */
export function EmptyState({
  Illustration,
  title,
  description,
  action,
  className,
}: {
  Illustration?: (props: SVGProps<SVGSVGElement>) => React.ReactElement;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center rounded-card border border-dashed border-border bg-surface/50 px-6 py-10 text-center",
        className,
      )}
    >
      {Illustration && (
        <Illustration width={112} height={72} className="mb-4 text-muted opacity-60" />
      )}
      <p className="font-bold">{title}</p>
      {description && <p className="mt-1 max-w-sm text-sm text-muted">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
