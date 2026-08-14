import "dotenv/config";
import { defineConfig } from "prisma/config";

// Prisma 7 ne lit plus automatiquement le fichier .env : d'où l'import
// « dotenv/config » ci-dessus, indispensable aux commandes CLI
// (prisma db push, prisma studio, prisma generate).
//
// La valeur de repli n'est pas un confort : `prisma generate` tourne au
// postinstall, donc AVANT que le développeur ait eu l'occasion de créer son
// .env. Sans elle, un simple `npm install` échouerait sur un dépôt neuf.
export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    url: process.env.DATABASE_URL ?? "file:./prisma/dev.db",
  },
  migrations: {
    seed: "tsx prisma/seed.ts",
  },
});
