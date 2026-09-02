import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { SignUpForm } from "./sign-up-form";
import { CARD } from "@/components/ui/card";
import { getCurrentUser } from "@/lib/session";

export const metadata: Metadata = { title: "Créer un compte" };

export default async function SignUpPage() {
  if (await getCurrentUser()) redirect("/tableau-de-bord");

  return (
    <div className={`${CARD} p-6`}>
      <h2 className="text-lg font-bold">Créer un compte</h2>
      <p className="mt-1 mb-5 text-sm text-muted">
        Votre espace est strictement personnel : vos classes ne sont visibles que par vous.
      </p>

      <SignUpForm />

      <p className="mt-5 text-center text-sm text-muted">
        Déjà inscrit ?{" "}
        <Link href="/connexion" className="font-medium text-primary hover:underline">
          Se connecter
        </Link>
      </p>
    </div>
  );
}
