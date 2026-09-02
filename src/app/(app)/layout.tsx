import { AppNav } from "@/components/app-nav";
import { requireUser } from "@/lib/session";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();

  return (
    <div className="flex min-h-screen flex-col">
      <AppNav userName={user.name} />
      {/* Plus de plafond de largeur ICI : chaque page pose le sien avec
          `PageWidth`. L'éditeur de plan de classe en demande un plus large que
          les autres, et un layout parent ne peut pas être élargi par la page
          qu'il contient. Le layout ne garde donc que le rembourrage. */}
      <main className="w-full flex-1 px-4 py-8">{children}</main>
    </div>
  );
}
