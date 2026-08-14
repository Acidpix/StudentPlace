import type { ButtonHTMLAttributes } from "react";

import { cn } from "@/lib/cn";

type Variant = "primary" | "secondary" | "ghost" | "accent" | "danger";
type Size = "sm" | "md" | "lg";

/**
 * Les variantes changent de TEINTE au survol plutôt que d'opacité : une
 * opacité réduite laisse transparaître le fond de page et salit la couleur,
 * ce qui se voyait particulièrement sur le dégradé.
 */
const VARIANTS: Record<Variant, string> = {
  primary:
    "bg-primary text-primary-foreground shadow-soft hover:brightness-110 active:brightness-95",
  secondary:
    "bg-surface text-foreground border border-border shadow-soft hover:bg-surface-muted hover:border-primary/40",
  ghost: "text-muted hover:bg-surface-muted hover:text-foreground",
  accent: "bg-accent text-accent-foreground shadow-soft hover:brightness-110 active:brightness-95",
  danger: "bg-danger text-white shadow-soft hover:brightness-110 active:brightness-95",
};

const SIZES: Record<Size, string> = {
  sm: "h-8 px-3 text-sm",
  md: "h-10 px-4 text-sm",
  lg: "h-11 px-5 text-[0.9375rem]",
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  /** Affiche un indicateur d'activité et désactive le bouton. */
  loading?: boolean;
}

/** Petit indicateur d'attente, en SVG pour éviter toute dépendance. */
function Spinner() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      className="animate-spin"
    >
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="3" opacity="0.25" />
      <path
        d="M21 12a9 9 0 0 0-9-9"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function Button({
  variant = "primary",
  size = "md",
  loading = false,
  disabled,
  className,
  type = "button",
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-control font-medium",
        "transition-[background-color,border-color,filter,box-shadow] duration-150",
        "disabled:pointer-events-none disabled:opacity-50",
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
      {...props}
    >
      {loading && <Spinner />}
      {children}
    </button>
  );
}
