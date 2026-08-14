import { AppShell } from "@/components/app-shell";
import { requireUser } from "@/lib/session";

/**
 * La coquille est un rail fixe : c'est `main` qui se décale, pas le flux.
 * Le gabarit de largeur n'est PAS imposé ici — chaque page pose son propre
 * `max-w-6xl`, ce qui laisse l'éditeur de plan de classe occuper toute la
 * fenêtre.
 *
 * `pb-24` sur mobile réserve la place de la barre d'onglets basse.
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();

  return (
    <div className="min-h-screen">
      <AppShell userName={user.name} />
      {/* `print:ml-0` : le rail disparaît à l'impression, sa gouttière aussi. */}
      <main className="px-4 pb-24 pt-6 md:ml-16 md:px-6 md:pb-10 md:pt-8 print:ml-0 print:p-0">
        {children}
      </main>
    </div>
  );
}
