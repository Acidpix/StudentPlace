"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { GridIcon, LayoutIcon, SettingsIcon, UsersIcon } from "@/components/ui/icons";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { authClient } from "@/lib/auth-client";
import { cn } from "@/lib/cn";

/**
 * Barre de navigation, en haut de page.
 *
 * Un rail latéral avait été essayé pour rendre de la largeur à l'éditeur de
 * plan de classe : le gain ne compensait pas la perte de lisibilité de la
 * navigation. La largeur se récupère autrement — panneau droit repliable et
 * plan ajusté à la fenêtre.
 */

const LINKS = [
  { href: "/tableau-de-bord", label: "Plan de classe", Icon: LayoutIcon },
  { href: "/classes", label: "Classes", Icon: UsersIcon },
  { href: "/salles", label: "Salles", Icon: GridIcon },
  { href: "/compte", label: "Compte", Icon: SettingsIcon },
];

export function AppNav({ userName }: { userName: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);

  async function handleSignOut() {
    setSigningOut(true);
    await authClient.signOut();
    router.push("/connexion");
    router.refresh();
  }

  return (
    <header className="material print-hidden sticky top-0 z-40 border-b border-border bg-surface/85 backdrop-blur">
      <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center gap-4 px-4 py-3">
        {/* Pastille RONDE et non plus carrée : c'est la marque du modèle, et un
            disque se distingue au premier coup d'œil des pavés rectangulaires
            qui remplissent le reste de l'écran — cartes, boutons, places. */}
        <Link
          href="/tableau-de-bord"
          className="flex items-center gap-2 font-bold tracking-tight"
        >
          <span
            aria-hidden="true"
            className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-primary to-accent text-[10px] font-bold text-primary-foreground shadow-soft"
          >
            SP
          </span>
          StudentPlace
        </Link>

        <nav className="flex flex-1 flex-wrap items-center gap-1">
          {LINKS.map(({ href, label, Icon }) => {
            const active = pathname === href || pathname.startsWith(`${href}/`);
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "inline-flex items-center gap-2 rounded-control px-3 py-1.5 text-sm transition-colors",
                  active
                    ? "bg-primary-soft font-medium text-primary"
                    : "text-muted hover:bg-surface-muted hover:text-foreground",
                )}
              >
                <Icon />
                {label}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-2">
          {/* Le nom de l'utilisateur reste en casse normale : `.eyebrow` met en
              capitales, ce qui convient à un intitulé de panneau ou à un
              compteur, pas au nom d'une personne. */}
          <span className="hidden text-sm text-muted sm:inline">{userName}</span>
          <ThemeToggle />
          <Button variant="secondary" onClick={handleSignOut} loading={signingOut}>
            Déconnexion
          </Button>
        </div>
      </div>
    </header>
  );
}
