import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Pas de build « standalone » : le serveur conserve node_modules et démarre
  // avec `next start`. C'est le chemin le mieux documenté, et le seul qui
  // charge sans détour le binaire natif de better-sqlite3 ainsi que le client
  // Prisma généré. Sur une application auto-hébergée pour quelques dizaines
  // d'utilisateurs, l'espace disque économisé ne vaut pas le risque.

  // Modules qui ne doivent JAMAIS être empaquetés par le bundler :
  // - better-sqlite3 est un binaire natif (.node), illisible par Turbopack ;
  // - le client Prisma et son adaptateur chargent ce binaire ;
  // - @react-pdf/renderer n'est utilisé que dans une route serveur.
  serverExternalPackages: [
    "@prisma/client",
    "@prisma/adapter-better-sqlite3",
    "better-sqlite3",
    "@react-pdf/renderer",
  ],

  eslint: {
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
