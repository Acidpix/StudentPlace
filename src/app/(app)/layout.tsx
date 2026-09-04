import { AppNav } from "@/components/app-nav";
import { SiteFooter } from "@/components/site/site-footer";
import { requireUser } from "@/lib/session";

/**
 * `seyes` et `SiteFooter` sont partagés avec les pages publiques
 * (6 septembre 2026, sur demande explicite) : le quadrillage du cahier et le
 * même pied de page partout, application connectée comprise. `SiteFooter`
 * reçoit `signedIn` pour proposer « Tableau de bord » / « Mon compte » plutôt
 * que « Connexion » / « Créer un compte », qui n'auraient aucun sens ici.
 *
 * Point d'attention : les deux éditeurs (plan de classe, salle) dimensionnent
 * leur canevas à `DEFAULT_VIEWPORT_SHARE` (88 %) de la HAUTEUR DE LA FENÊTRE,
 * sans tenir compte de ce qu'il y a en dessous (`use-plan-scale.ts`). Le pied
 * de page qui suit n'est donc plus visible sans défiler sur ces deux pages —
 * c'était déjà le cas dans une moindre mesure avec la seule barre de
 * navigation, mais un pied de page de plusieurs colonnes l'aggrave. Personne
 * n'a demandé de revoir ce calcul ; à faire si le défilement gêne en usage.
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();

  return (
    <div className="seyes flex min-h-screen flex-col">
      <AppNav userName={user.name} />
      {/* Plus de plafond de largeur ICI : chaque page pose le sien avec
          `PageWidth`. L'éditeur de plan de classe en demande un plus large que
          les autres, et un layout parent ne peut pas être élargi par la page
          qu'il contient. Le layout ne garde donc que le rembourrage. */}
      <main className="w-full flex-1 px-4 py-8">{children}</main>
      <SiteFooter signedIn />
    </div>
  );
}
