import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";

import { PrismaClient } from "@/generated/prisma/client";

/**
 * Client Prisma partagé.
 *
 * Le client est généré par `prisma generate` dans src/generated/prisma ; ce
 * dossier est absent d'un dépôt fraîchement cloné, donc TypeScript signalera
 * cet import tant que la commande n'a pas été lancée une première fois.
 *
 * Prisma 7 impose un « driver adapter » explicite : `new PrismaClient()` sans
 * argument échoue désormais au démarrage.
 */

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createPrismaClient(): PrismaClient {
  const url = process.env.DATABASE_URL;

  if (!url) {
    throw new Error(
      "DATABASE_URL est absent. Copier .env.example vers .env et renseigner le chemin de la base SQLite.",
    );
  }

  const adapter = new PrismaBetterSqlite3({ url });

  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });
}

export const prisma: PrismaClient = globalForPrisma.prisma ?? createPrismaClient();

// En développement, Next.js recharge les modules à chaque modification :
// sans ce cache global, chaque rechargement ouvrirait une nouvelle connexion.
if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
