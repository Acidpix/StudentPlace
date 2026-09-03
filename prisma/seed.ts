import "dotenv/config";

import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";

import { PrismaClient } from "../src/generated/prisma/client";
import { encryptComment } from "../src/lib/crypto";

/**
 * Jeu de démonstration.
 *
 * Le script ne crée PAS de compte : le hachage des mots de passe appartient à
 * Better Auth, et le reproduire ici serait fragile. Créez d'abord votre compte
 * dans l'application, puis lancez `npm run db:seed` — les données de
 * démonstration seront rattachées à ce compte.
 *
 * Utilise volontairement des imports relatifs : le script tourne hors du
 * bundler Next.js, sans les alias « @/ ».
 */

const adapter = new PrismaBetterSqlite3({
  url: process.env.DATABASE_URL ?? "file:./prisma/dev.db",
});
const prisma = new PrismaClient({ adapter });

const CLASS_NAME = "4e B (démonstration)";
const ROOM_NAME = "Salle 204 (démonstration)";

/** Noms, prénoms, difficulté, commentaire éventuel. */
const STUDENTS: Array<[string, string, number, string]> = [
  ["Bernard", "Noah", 5, "À garder près du bureau, se lève souvent."],
  ["Martin", "Camille", 4, "Bavarde surtout en fin d'heure."],
  ["Petit", "Lucas", 5, "Cherche le conflit avec Noah."],
  ["Durand", "Léa", 1, ""],
  ["Dubois", "Jade", 2, ""],
  ["Moreau", "Gabriel", 3, "Se déconcentre vite au fond."],
  ["Laurent", "Louise", 1, "Excellente élève, peut aider un voisin."],
  ["Simon", "Raphaël", 4, "Perturbe dès qu'il est en groupe."],
  ["Michel", "Emma", 1, ""],
  ["Lefebvre", "Adam", 2, ""],
  ["Leroy", "Alice", 1, "Myope, doit être devant."],
  ["Roux", "Maël", 3, ""],
  ["David", "Rose", 2, ""],
  ["Bertrand", "Liam", 4, "Difficile à côté de Raphaël."],
  ["Morel", "Chloé", 1, ""],
  ["Fournier", "Nathan", 3, ""],
  ["Girard", "Ambre", 2, ""],
  ["Bonnet", "Ethan", 5, "Très agité, à isoler."],
  ["Dupont", "Anna", 1, ""],
  ["Lambert", "Tom", 3, "Gaucher, préfère un bout de table."],
  ["Fontaine", "Inès", 2, ""],
  ["Rousseau", "Hugo", 4, ""],
  ["Vincent", "Léna", 1, ""],
  ["Muller", "Jules", 2, ""],
  ["Lefevre", "Sarah", 1, "Entend mal de l'oreille droite."],
  ["Faure", "Arthur", 3, ""],
  ["Andre", "Manon", 2, ""],
  ["Mercier", "Eden", 4, "Suit Ethan dans ses bêtises."],
];

async function main() {
  const email = process.env.SEED_EMAIL;

  const user = email
    ? await prisma.user.findUnique({ where: { email } })
    : await prisma.user.findFirst({ orderBy: { createdAt: "asc" } });

  if (!user) {
    console.error(
      "\nAucun compte trouvé.\n" +
        "Créez d'abord votre compte dans l'application (page « Créer un compte »),\n" +
        "puis relancez : npm run db:seed\n" +
        "Pour cibler un compte précis : SEED_EMAIL=vous@exemple.fr npm run db:seed\n",
    );
    process.exitCode = 1;
    return;
  }

  console.log(`Données de démonstration pour ${user.email}…`);

  // Repartir de zéro rend le script rejouable sans accumuler les doublons.
  await prisma.classGroup.deleteMany({ where: { userId: user.id, name: CLASS_NAME } });
  await prisma.room.deleteMany({ where: { userId: user.id, name: ROOM_NAME } });

  // ------------------------------------------------------------- la classe
  const classGroup = await prisma.classGroup.create({
    data: { userId: user.id, name: CLASS_NAME, schoolYear: "2026-2027" },
  });

  // Un `map` plutôt qu'une boucle qui empile dans un tableau vide : TypeScript
  // en déduit le type des élèves créés, que `byName` exploite juste en dessous.
  const students = await Promise.all(
    STUDENTS.map(([lastName, firstName, difficulty, comment]) =>
      prisma.student.create({
        data: {
          classGroupId: classGroup.id,
          lastName,
          firstName,
          difficulty,
          commentEnc: encryptComment(comment),
          needsFront: comment.includes("Myope") || comment.includes("Entend mal"),
          leftHanded: comment.includes("Gaucher"),
        },
      }),
    ),
  );

  const byName = (firstName: string) => students.find((s) => s.firstName === firstName)!;

  // studentAId < studentBId : invariant du modèle StudentRelation.
  const relate = (a: string, b: string, type: "INCOMPATIBLE" | "AFFINITY") => {
    const [first, second] = [byName(a).id, byName(b).id].sort();
    return prisma.studentRelation.create({
      data: { classGroupId: classGroup.id, studentAId: first, studentBId: second, type },
    });
  };

  await relate("Noah", "Lucas", "INCOMPATIBLE");
  await relate("Raphaël", "Liam", "INCOMPATIBLE");
  await relate("Ethan", "Eden", "INCOMPATIBLE");
  await relate("Louise", "Gabriel", "AFFINITY");
  await relate("Alice", "Emma", "AFFINITY");

  // -------------------------------------------------------------- la salle
  const room = await prisma.room.create({
    data: { userId: user.id, name: ROOM_NAME, widthCm: 1050, heightCm: 700 },
  });

  await prisma.roomObject.create({
    data: { roomId: room.id, kind: "BOARD", x: 375, y: 10, widthCm: 300, heightCm: 12, rotation: 0 },
  });
  await prisma.roomObject.create({
    data: { roomId: room.id, kind: "TEACHER_DESK", x: 455, y: 60, widthCm: 140, heightCm: 70, rotation: 0 },
  });
  await prisma.roomObject.create({
    data: { roomId: room.id, kind: "DOOR", x: 40, y: 688, widthCm: 90, heightCm: 12, rotation: 0 },
  });

  // Quatre rangées de quatre tables doubles : 32 places pour 28 élèves.
  // Deux places d'une même table sont à 115 cm — sous le seuil d'alerte de
  // 120 cm — tandis que deux tables voisines sont à 145 cm : le solveur a donc
  // de quoi séparer les élèves incompatibles.
  //
  // La table fait 230 cm, la largeur type d'une table à deux places : c'est
  // l'écartement des places qui plafonne la taille des étiquettes du plan de
  // classe, et la salle de démonstration doit montrer des noms lisibles. Le
  // pas de 260 cm et la salle de 10,5 m suivent de là — à 210 cm, deux tables
  // voisines se seraient touchées et leurs places seraient passées sous le
  // seuil de proximité.
  const TABLE_WIDTH = 230;
  const TABLE_HEIGHT = 50;

  for (let row = 0; row < 4; row++) {
    for (let column = 0; column < 4; column++) {
      const x = 20 + column * 260;
      const y = 200 + row * 120;

      const table = await prisma.roomObject.create({
        data: {
          roomId: room.id,
          kind: "TABLE",
          x,
          y,
          widthCm: TABLE_WIDTH,
          heightCm: TABLE_HEIGHT,
          rotation: 0,
        },
      });

      await prisma.seat.createMany({
        data: [0, 1].map((index) => ({
          roomId: room.id,
          roomObjectId: table.id,
          // Places réparties sur la largeur, centrées sur la profondeur.
          x: Math.round(x + (TABLE_WIDTH * (index + 0.5)) / 2),
          y: Math.round(y + TABLE_HEIGHT / 2),
          isEndSeat: true,
          label: `${String.fromCharCode(65 + row)}${column * 2 + index + 1}`,
        })),
      });
    }
  }

  // --------------------------------------------------------------- le plan
  const plan = await prisma.seatingPlan.create({
    data: {
      userId: user.id,
      classGroupId: classGroup.id,
      roomId: room.id,
      name: "Plan principal",
    },
  });

  const seatCount = await prisma.seat.count({ where: { roomId: room.id } });

  console.log(
    `\nPrêt.\n` +
      `  Classe : ${classGroup.name} (${students.length} élèves, 3 incompatibilités, 2 affinités)\n` +
      `  Salle  : ${room.name} (${seatCount} places)\n` +
      `  Plan   : ${plan.name} — vide, à composer\n\n` +
      `Ouvrez le plan et cliquez « Placer automatiquement ».\n`,
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
