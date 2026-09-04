import Link from "next/link";

import { buttonClasses } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 text-center">
      <p className="eyebrow text-primary">Erreur 404</p>
      <h1 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">Page introuvable</h1>
      <p className="mt-2 max-w-sm text-sm text-muted">
        Cette page n&apos;existe pas, ou elle appartient à un autre compte que le vôtre.
      </p>
      {/* Vers l'ACCUEIL et non plus le tableau de bord : cette page s'affiche
          aussi pour un visiteur anonyme, à qui l'on proposait jusqu'ici un lien
          vers une page protégée — donc un aller simple vers l'écran de
          connexion. L'accueil, lui, s'adresse aux deux. */}
      <Link href="/" className={buttonClasses("primary", "md", "mt-6")}>
        Retour à l&apos;accueil
      </Link>
    </div>
  );
}
