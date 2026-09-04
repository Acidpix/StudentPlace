import Link from "next/link";

import { buttonClasses } from "@/components/ui/button";
import { Logo } from "@/components/ui/logo";
import { ThemeToggle } from "@/components/ui/theme-toggle";

/**
 * Barre de navigation des PAGES PUBLIQUES — landing, Fonctionnement,
 * traitement des données. À ne pas confondre avec `app-nav.tsx`, qui est celle
 * de l'application connectée : celle-là est `"use client"` et sait déconnecter,
 * celle-ci n'est qu'une poignée de liens et reste donc un composant serveur.
 *
 * TROIS ENTRÉES, ET SEULEMENT TROIS. La maquette en montrait quatre —
 * Fonctionnement, Tarifs, Aide, Essayer. « Tarifs » et « Aide » ont été
 * RETIRÉES sur demande : il n'y a pas de grille tarifaire, et pas de centre
 * d'aide ; deux liens qui promettent des pages inexistantes coûtent plus que le
 * peu qu'ils apportent. « Connexion » les remplace — c'est ce qui manquait le
 * plus, puisqu'un professeur déjà inscrit n'avait aucun moyen d'entrer depuis
 * la page d'accueil.
 *
 * Trois entrées tiennent sur la largeur d'un téléphone : pas de menu
 * escamotable, donc pas d'état, donc aucun JavaScript à envoyer.
 */
export function SiteNav({ signedIn }: { signedIn: boolean }) {
  return (
    <header className="print-hidden sticky top-0 z-40 border-b border-border bg-surface/85 backdrop-blur">
      <div className="mx-auto flex w-full max-w-6xl items-center gap-4 px-4 py-3">
        <Link href="/" className="flex items-center" aria-label="Sisit, accueil">
          <Logo />
        </Link>

        <nav className="ml-auto flex items-center gap-1 sm:gap-4">
          <Link
            href="/fonctionnement"
            className="rounded-control px-2 py-1.5 text-sm font-medium text-muted transition-colors hover:text-foreground sm:px-3"
          >
            Fonctionnement
          </Link>

          {signedIn ? (
            /* Un professeur déjà connecté qui revient sur l'accueil n'a que
               faire de « Connexion » ni d'« Essayer » : on lui rend l'entrée de
               son espace. C'est aussi ce qui permet à la landing de rester
               visitable une fois inscrit — elle redirigeait jusqu'ici. */
            <Link href="/tableau-de-bord" className={buttonClasses("ink", "sm")}>
              Mon espace
            </Link>
          ) : (
            <>
              <Link
                href="/connexion"
                className="rounded-control px-2 py-1.5 text-sm font-medium text-muted transition-colors hover:text-foreground sm:px-3"
              >
                Connexion
              </Link>
              <Link href="/inscription" className={buttonClasses("primary", "sm")}>
                Essayer
              </Link>
            </>
          )}

          <ThemeToggle />
        </nav>
      </div>
    </header>
  );
}
