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
      <Link href="/tableau-de-bord" className={buttonClasses("primary", "md", "mt-6")}>
        Retour au tableau de bord
      </Link>
    </div>
  );
}
