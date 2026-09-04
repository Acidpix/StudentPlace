import type { Metadata } from "next";

import { SiteFooter } from "@/components/site/site-footer";
import { SiteNav } from "@/components/site/site-nav";
import { getCurrentUser } from "@/lib/session";

/**
 * Les pages PUBLIQUES : accueil, Fonctionnement, traitement des données.
 *
 * C'est le seul endroit du site qui doive être INDEXABLE. La mise en page
 * racine pose `robots: { index: false, follow: false }` pour tout le reste —
 * l'application contient des données d'élèves mineurs et n'a rien à faire dans
 * un moteur de recherche —, et ce groupe de routes lève la consigne pour lui
 * seul. Les métadonnées de l'App Router fusionnent par route, la plus proche
 * l'emportant : rien d'autre à faire que de la redéclarer ici.
 */
export const metadata: Metadata = {
  robots: { index: true, follow: true },
};

export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  /* La barre a besoin de savoir si le visiteur est connecté pour lui proposer
     « Mon espace » plutôt que « Connexion » / « Essayer ». C'est la SEULE
     raison de lire la session ici : ces pages ne sont jamais protégées, et un
     visiteur anonyme n'est plus renvoyé vers `/connexion` comme le faisait
     l'ancienne page d'accueil. */
  const user = await getCurrentUser();

  return (
    <div className="flex min-h-screen flex-col">
      <SiteNav signedIn={Boolean(user)} />
      <main className="flex-1">{children}</main>
      <SiteFooter />
    </div>
  );
}
