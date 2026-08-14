import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { SignInForm } from "./sign-in-form";
import { getCurrentUser } from "@/lib/session";

export const metadata: Metadata = { title: "Connexion" };

export default async function SignInPage() {
  if (await getCurrentUser()) redirect("/tableau-de-bord");

  return (
    <div className="rounded-xl border border-border bg-surface p-6">
      <h2 className="text-lg font-semibold">Connexion</h2>
      <p className="mt-1 mb-5 text-sm text-muted">Accédez à votre espace personnel.</p>

      <SignInForm />

      <p className="mt-5 text-center text-sm text-muted">
        Pas encore de compte ?{" "}
        <Link href="/inscription" className="font-medium text-primary hover:underline">
          Créer un compte
        </Link>
      </p>
    </div>
  );
}
