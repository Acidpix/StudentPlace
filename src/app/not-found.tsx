import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 text-center">
      <p className="text-sm font-medium text-primary">404</p>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight">Page introuvable</h1>
      <p className="mt-2 max-w-sm text-sm text-muted">
        Cette page n&apos;existe pas, ou elle appartient à un autre compte que le vôtre.
      </p>
      <Link
        href="/tableau-de-bord"
        className="mt-6 inline-flex h-10 items-center rounded-control bg-primary px-4 text-sm font-medium text-primary-foreground shadow-soft hover:brightness-110"
      >
        Retour au tableau de bord
      </Link>
    </div>
  );
}
