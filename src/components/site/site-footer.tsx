import Link from "next/link";

import { Logo } from "@/components/ui/logo";

/**
 * Pied de page des pages publiques.
 *
 * Volontairement maigre : trois colonnes de liens qui existent tous. Un pied de
 * page de site vitrine énumère d'ordinaire une quinzaine d'entrées — blog,
 * carrières, presse, réseaux sociaux — dont aucune n'a de page ici. Il grandira
 * quand il y aura quelque chose à y mettre.
 */

const COLUMNS: { title: string; links: { href: string; label: string }[] }[] = [
  {
    title: "Le produit",
    links: [{ href: "/fonctionnement", label: "Fonctionnement" }],
  },
  {
    title: "Votre compte",
    links: [
      { href: "/connexion", label: "Connexion" },
      { href: "/inscription", label: "Créer un compte" },
    ],
  },
  {
    title: "Vos données",
    links: [{ href: "/confidentialite", label: "Traitement des données" }],
  },
];

export function SiteFooter() {
  return (
    <footer className="print-hidden border-t border-border bg-surface">
      <div className="mx-auto grid w-full max-w-6xl gap-8 px-4 py-10 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <Logo />
          <p className="mt-3 max-w-xs text-sm text-muted">
            Vos plans de classe, sans le casse-tête.
          </p>
        </div>

        {COLUMNS.map((column) => (
          <div key={column.title}>
            <h2 className="eyebrow mb-2">{column.title}</h2>
            <ul className="space-y-1.5">
              {column.links.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-sm text-muted transition-colors hover:text-foreground"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="mx-auto w-full max-w-6xl border-t border-border px-4 py-5">
        <p className="text-xs text-muted">
          Sisit — les données d&apos;élèves ne quittent jamais le serveur qui héberge
          l&apos;application.
        </p>
      </div>
    </footer>
  );
}
