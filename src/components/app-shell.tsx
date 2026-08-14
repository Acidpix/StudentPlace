"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";

import {
  GridIcon,
  LayoutIcon,
  LogOutIcon,
  SettingsIcon,
  UsersIcon,
} from "@/components/ui/icons";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { authClient } from "@/lib/auth-client";
import { cn } from "@/lib/cn";

/**
 * Coquille de navigation : un rail vertical d'icônes de 4 rem à gauche sur
 * grand écran, une barre d'onglets en bas sur mobile.
 *
 * Le rail reste étroit en permanence — c'est ce qui rend la largeur disponible
 * prévisible pour l'éditeur de plan de classe, qui en manquait cruellement. Les
 * libellés ne sont pas perdus pour autant : ils réapparaissent en infobulle au
 * survol comme au focus clavier (classe `.rail-tip`, définie dans globals.css).
 */

const LINKS = [
  { href: "/tableau-de-bord", label: "Tableau de bord", Icon: LayoutIcon },
  { href: "/classes", label: "Classes", Icon: UsersIcon },
  { href: "/salles", label: "Salles", Icon: GridIcon },
  { href: "/compte", label: "Compte", Icon: SettingsIcon },
];

/** Deux initiales au plus, pour la pastille du bas de rail. */
function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
}

export function AppShell({ userName }: { userName: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);

  async function handleSignOut() {
    setSigningOut(true);
    await authClient.signOut();
    router.push("/connexion");
    router.refresh();
  }

  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  return (
    <>
      {/* ------------------------------------------------- rail (≥ md) */}
      <aside
        className={cn(
          "print-hidden fixed inset-y-0 left-0 z-40 hidden w-16 flex-col items-center",
          "border-r border-border bg-surface/80 py-4 backdrop-blur md:flex",
        )}
      >
        <Link
          href="/tableau-de-bord"
          aria-label="StudentPlace — tableau de bord"
          data-tip="StudentPlace"
          className="rail-tip flex h-10 w-10 items-center justify-center rounded-control bg-gradient-to-br from-primary to-accent text-sm font-bold text-primary-foreground shadow-soft"
        >
          SP
        </Link>

        <nav className="mt-6 flex flex-1 flex-col items-center gap-1">
          {LINKS.map(({ href, label, Icon }) => {
            const active = isActive(href);
            return (
              <Link
                key={href}
                href={href}
                aria-label={label}
                aria-current={active ? "page" : undefined}
                data-tip={label}
                className={cn(
                  "rail-tip relative flex h-10 w-10 items-center justify-center rounded-control transition-colors",
                  active
                    ? "bg-primary-soft text-primary"
                    : "text-muted hover:bg-surface-muted hover:text-foreground",
                )}
              >
                {active && (
                  <span
                    aria-hidden="true"
                    className="absolute -left-4 h-6 w-1 rounded-r-full bg-primary"
                  />
                )}
                <Icon width={20} height={20} />
              </Link>
            );
          })}
        </nav>

        <div className="flex flex-col items-center gap-2">
          <ThemeToggle />

          <span
            data-tip={userName}
            className="rail-tip flex h-9 w-9 items-center justify-center rounded-full border border-border bg-surface-muted text-xs font-semibold text-muted"
          >
            {initials(userName)}
          </span>

          <button
            type="button"
            onClick={handleSignOut}
            disabled={signingOut}
            aria-label="Déconnexion"
            data-tip="Déconnexion"
            className="rail-tip flex h-9 w-9 items-center justify-center rounded-control text-muted hover:bg-surface-muted hover:text-danger disabled:opacity-50"
          >
            <LogOutIcon width={18} height={18} />
          </button>
        </div>
      </aside>

      {/* ------------------------------------------- barre basse (< md) */}
      <nav
        className={cn(
          "print-hidden fixed inset-x-0 bottom-0 z-40 flex items-center justify-around",
          "border-t border-border bg-surface/95 px-2 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden",
        )}
      >
        {LINKS.map(({ href, label, Icon }) => {
          const active = isActive(href);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex flex-1 flex-col items-center gap-0.5 py-2 text-[10px]",
                active ? "text-primary" : "text-muted",
              )}
            >
              <Icon width={20} height={20} />
              {label}
            </Link>
          );
        })}

        <button
          type="button"
          onClick={handleSignOut}
          disabled={signingOut}
          className="flex flex-1 flex-col items-center gap-0.5 py-2 text-[10px] text-muted disabled:opacity-50"
        >
          <LogOutIcon width={20} height={20} />
          Quitter
        </button>
      </nav>
    </>
  );
}
