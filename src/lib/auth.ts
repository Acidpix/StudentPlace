import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";

import { prisma } from "@/lib/db";

/**
 * Configuration Better Auth.
 *
 * Authentification autonome par e-mail et mot de passe : aucun service tiers,
 * aucune donnée d'élève ne quitte le serveur. Les mots de passe sont hachés
 * par Better Auth (scrypt) dans la table `account`.
 */
export const auth = betterAuth({
  database: prismaAdapter(prisma, {
    provider: "sqlite",
  }),

  secret: process.env.BETTER_AUTH_SECRET,
  baseURL: process.env.BETTER_AUTH_URL ?? "http://localhost:3000",

  emailAndPassword: {
    enabled: true,
    // 10 caractères : au-dessus du minimum courant, cohérent avec la
    // recommandation ANSSI pour un compte protégeant des données de mineurs.
    minPasswordLength: 10,
    maxPasswordLength: 200,
    autoSignIn: true,
  },

  // La suppression de compte n'utilise pas le greffon Better Auth : elle passe
  // par une Server Action qui efface la ligne `user`, ce qui emporte en cascade
  // classes, élèves, salles, plans et sessions (onDelete: Cascade).
  // Voir src/actions/account.ts.

  session: {
    // Une heure GLISSANTE : c'est une heure d'INACTIVITÉ, pas une heure depuis
    // la connexion. `updateAge: 0` fait reconduire l'échéance à chaque requête
    // authentifiée, si bien qu'un professeur en train de composer un plan n'est
    // jamais déconnecté en pleine séance, alors qu'un poste laissé ouvert dans
    // une salle de classe se ferme au bout d'une heure.
    expiresIn: 60 * 60, // 1 heure
    updateAge: 0, // repoussée à chaque requête
  },

  // Freine les attaques par essais successifs sur le formulaire de connexion.
  rateLimit: {
    enabled: true,
    window: 60,
    max: 30,
  },

  advanced: {
    cookiePrefix: "studentplace",
  },

  // nextCookies() doit rester le DERNIER greffon : il intercepte les réponses
  // pour poser les cookies de session depuis les Server Actions.
  plugins: [nextCookies()],
});

export type Session = typeof auth.$Infer.Session;
