import Link from "next/link";

import { Logo } from "@/components/ui/logo";
import { ThemeToggle } from "@/components/ui/theme-toggle";

/**
 * Connexion et inscription.
 *
 * La pastille ronde « SP » et le titre « StudentPlace » ont laissé la place au
 * MOT-SYMBOLE, le même que partout ailleurs (`ui/logo.tsx`) — c'est ce qui
 * garantit qu'il ne diverge plus d'un écran à l'autre, ce qu'un commentaire
 * demandait jusqu'ici sans pouvoir l'assurer.
 *
 * Il est CLIQUABLE, et renvoie à l'accueil : depuis qu'une page d'accueil
 * existe, un visiteur arrivé ici par erreur doit pouvoir en repartir.
 *
 * Le quadrillage `.seyes` en fond rattache ces deux pages aux pages publiques,
 * dont elles sont la suite immédiate.
 */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="seyes flex min-h-screen flex-col">
      <header className="flex items-center justify-between p-4">
        <Link href="/" className="flex items-center" aria-label="Sisit, accueil">
          <Logo />
        </Link>
        <ThemeToggle />
      </header>

      <main className="flex flex-1 items-center justify-center px-4 pb-16">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex flex-col items-center text-center">
            <Logo size="lg" className="mb-3" />
            <p className="text-sm text-muted">Vos plans de classe, sans le casse-tête.</p>
          </div>
          {children}
        </div>
      </main>
    </div>
  );
}
