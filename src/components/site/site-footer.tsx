import Link from "next/link";

import { Logo } from "@/components/ui/logo";

/**
 * Pied de page, commun à TOUTES les pages (6 septembre 2026) — public et
 * application connectée. Il ne vivait jusque-là que sous `(site)` ; il est
 * désormais rendu aussi par le layout `(app)`, sur demande explicite, pour
 * qu'un professeur retrouve le même repère (Fonctionnement, ses données) qu'il
 * soit sur la landing ou en train de composer un plan.
 *
 * Volontairement maigre : trois colonnes de liens qui existent tous. Un pied de
 * page de site vitrine énumère d'ordinaire une quinzaine d'entrées — blog,
 * carrières, presse, réseaux sociaux — dont aucune n'a de page ici. Il grandira
 * quand il y aura quelque chose à y mettre.
 *
 * `signedIn` change UNE colonne, sur le même principe que `SiteNav` : proposer
 * « Connexion » / « Créer un compte » à un professeur déjà connecté n'aurait
 * aucun sens, et l'inverse est vrai sur les pages publiques.
 */

const PRODUCT_LINKS = [{ href: "/fonctionnement", label: "Fonctionnement" }];
const PRIVACY_LINKS = [{ href: "/confidentialite", label: "Traitement des données" }];

export function SiteFooter({ signedIn = false }: { signedIn?: boolean }) {
  const accountLinks = signedIn
    ? [
        { href: "/tableau-de-bord", label: "Tableau de bord" },
        { href: "/compte", label: "Mon compte" },
      ]
    : [
        { href: "/connexion", label: "Connexion" },
        { href: "/inscription", label: "Créer un compte" },
      ];

  const columns = [
    { title: "Le produit", links: PRODUCT_LINKS },
    { title: "Votre compte", links: accountLinks },
    { title: "Vos données", links: PRIVACY_LINKS },
  ];

  return (
    <footer className="print-hidden border-t border-border bg-surface">
      <div className="mx-auto grid w-full max-w-6xl gap-8 px-4 py-10 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <Logo />
          <p className="mt-3 max-w-xs text-sm text-muted">
            Vos plans de classe, sans le casse-tête.
          </p>
        </div>

        {columns.map((column) => (
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
