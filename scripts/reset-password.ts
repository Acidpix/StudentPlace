import "dotenv/config";

import { randomBytes, randomUUID } from "node:crypto";

import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";

import { PrismaClient } from "../src/generated/prisma/client";

/**
 * Réinitialisation d'un mot de passe depuis le serveur.
 *
 * L'application n'offre aucun « mot de passe oublié » : cela demanderait un
 * serveur SMTP. Ce script est le recours d'administration, à lancer sur la
 * machine qui héberge la base.
 *
 * Le hachage n'est PAS réimplémenté ici : on emprunte celui de Better Auth
 * (scrypt) via `auth.$context`, puis on vérifie le condensat obtenu avant de
 * l'écrire. Recopier l'algorithme à la main produirait tôt ou tard un compte
 * définitivement inaccessible, sans que rien ne le signale.
 *
 * Imports relatifs volontaires : le script tourne hors du bundler Next.js,
 * sans les alias « @/ ».
 *
 *   npx tsx scripts/reset-password.ts --list
 *   npx tsx scripts/reset-password.ts prof@exemple.fr
 *   npx tsx scripts/reset-password.ts prof@exemple.fr "mot de passe choisi"
 */

const MIN_LENGTH = 10; // doit rester aligné sur src/lib/auth.ts
const MAX_LENGTH = 200;

const url = process.env.DATABASE_URL;

if (!url) {
  console.error(
    "DATABASE_URL est absent. Lancer le script depuis le dossier de l'application,\n" +
      "là où se trouve le fichier .env (en production : /opt/studentplace).",
  );
  process.exit(1);
}

const prisma = new PrismaClient({ adapter: new PrismaBetterSqlite3({ url }) });

// Instance minimale : seule la fabrique de condensats nous intéresse. Elle doit
// néanmoins recevoir le même adaptateur que l'application pour que le contexte
// s'initialise.
const auth = betterAuth({
  database: prismaAdapter(prisma, { provider: "sqlite" }),
  secret: process.env.BETTER_AUTH_SECRET,
  emailAndPassword: {
    enabled: true,
    minPasswordLength: MIN_LENGTH,
    maxPasswordLength: MAX_LENGTH,
  },
});

/** Mot de passe de secours : 20 caractères tirés au hasard. */
function generatePassword(): string {
  return randomBytes(15).toString("base64url");
}

async function listAccounts(): Promise<void> {
  const users = await prisma.user.findMany({
    select: { email: true, name: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });

  if (users.length === 0) {
    console.log("Aucun compte dans cette base.");
    return;
  }

  console.log(`${users.length} compte(s) :`);
  for (const user of users) {
    console.log(`  ${user.email}  —  ${user.name}  (créé le ${user.createdAt.toLocaleDateString("fr-FR")})`);
  }
}

async function main(): Promise<void> {
  const [emailArg, passwordArg] = process.argv.slice(2);

  if (!emailArg || emailArg === "--help" || emailArg === "-h") {
    console.log(
      "Usage :\n" +
        "  npx tsx scripts/reset-password.ts --list\n" +
        "  npx tsx scripts/reset-password.ts <e-mail> [nouveau mot de passe]\n\n" +
        "Sans mot de passe, le script en tire un au hasard et l'affiche.",
    );
    return;
  }

  if (emailArg === "--list") {
    await listAccounts();
    return;
  }

  // SQLite ne connaît pas `mode: "insensitive"` sous Prisma : la comparaison
  // insensible à la casse se fait donc en mémoire. Le volume s'y prête, une
  // instance n'héberge qu'une poignée de comptes.
  const needle = emailArg.trim().toLowerCase();
  const users = await prisma.user.findMany({ select: { id: true, email: true, name: true } });
  const user = users.find((candidate) => candidate.email.toLowerCase() === needle);

  if (!user) {
    console.error(`Aucun compte pour « ${emailArg} ».`);
    await listAccounts();
    process.exit(1);
  }

  const password = passwordArg ?? generatePassword();

  if (password.length < MIN_LENGTH) {
    console.error(`Mot de passe trop court : ${MIN_LENGTH} caractères au minimum.`);
    process.exit(1);
  }

  if (password.length > MAX_LENGTH) {
    console.error(`Mot de passe trop long : ${MAX_LENGTH} caractères au maximum.`);
    process.exit(1);
  }

  const ctx = await auth.$context;
  const hash = await ctx.password.hash(password);

  // Garde-fou : un condensat que Better Auth ne saurait pas relire fermerait le
  // compte pour de bon. On préfère s'arrêter avant l'écriture.
  if (!(await ctx.password.verify({ hash, password }))) {
    console.error(
      "Le condensat produit n'est pas relu par Better Auth : rien n'a été écrit.\n" +
        "Vérifier que la version de better-auth installée est bien celle de l'application.",
    );
    process.exit(1);
  }

  const now = new Date();

  // Le fournisseur « credential » est celui de l'authentification par mot de
  // passe. La ligne peut manquer si le compte n'a jamais eu que des sessions.
  const account = await prisma.account.findFirst({
    where: { userId: user.id, providerId: "credential" },
    select: { id: true },
  });

  if (account) {
    await prisma.account.update({
      where: { id: account.id },
      data: { password: hash, updatedAt: now },
    });
  } else {
    await prisma.account.create({
      data: {
        id: randomUUID(),
        accountId: user.id,
        providerId: "credential",
        userId: user.id,
        password: hash,
        createdAt: now,
        updatedAt: now,
      },
    });
  }

  // Les sessions ouvertes survivraient au changement : on les coupe, seul le
  // nouveau mot de passe doit rouvrir le compte.
  const { count } = await prisma.session.deleteMany({ where: { userId: user.id } });

  console.log(`\nMot de passe réinitialisé pour ${user.email} (${user.name}).`);
  if (!passwordArg) {
    console.log(`Nouveau mot de passe : ${password}`);
    // L'application n'offre aucun écran de changement de mot de passe : le
    // seul moyen d'en choisir un autre est de relancer ce script.
    console.log("Pour en choisir un autre : relancer le script en le passant en second argument.");
  }
  console.log(`${count} session(s) close(s).`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
