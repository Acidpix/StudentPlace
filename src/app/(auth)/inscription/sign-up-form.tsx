"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { FieldError, Hint, Input, Label } from "@/components/ui/field";
import { authClient } from "@/lib/auth-client";
import { signUpSchema } from "@/lib/validation";

export function SignUpForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const formData = new FormData(event.currentTarget);
    const parsed = signUpSchema.safeParse({
      name: formData.get("name"),
      email: formData.get("email"),
      password: formData.get("password"),
    });

    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Formulaire incomplet.");
      return;
    }

    setPending(true);

    const { error: signUpError } = await authClient.signUp.email(parsed.data);

    if (signUpError) {
      setError(
        signUpError.message?.toLowerCase().includes("exist")
          ? "Un compte existe déjà avec cette adresse."
          : "La création du compte a échoué. Réessayez dans un instant.",
      );
      setPending(false);
      return;
    }

    router.push("/tableau-de-bord");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Label htmlFor="name">Nom</Label>
        <Input id="name" name="name" autoComplete="name" required placeholder="Camille Martin" />
      </div>

      <div>
        <Label htmlFor="email">Adresse e-mail</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          placeholder="prenom.nom@academie.fr"
        />
      </div>

      <div>
        <Label htmlFor="password">Mot de passe</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={10}
        />
        <Hint>12 caractères ou plus, ou une phrase de passe facile à retenir.</Hint>
      </div>

      <FieldError message={error} />

      <Button type="submit" loading={pending} className="w-full">
        {pending ? "Création…" : "Créer mon compte"}
      </Button>
    </form>
  );
}
