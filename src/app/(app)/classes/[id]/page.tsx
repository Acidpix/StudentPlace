import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ClassHeader } from "@/components/class/class-header";
import { DeleteClassButton } from "@/components/class/delete-class-button";
import { RelationManager } from "@/components/class/relation-manager";
import { StudentManager } from "@/components/class/student-manager";
import { ArrowLeftIcon } from "@/components/ui/icons";
import { PageWidth } from "@/components/ui/page-width";
import { decryptComment } from "@/lib/crypto";
import { prisma } from "@/lib/db";
import { toDifficulty, type RelationType } from "@/lib/domain";
import { requireUser } from "@/lib/session";

export const metadata: Metadata = { title: "Classe" };

/**
 * Page d'une classe : ses élèves et leurs relations.
 *
 * L'import de liste n'a plus de section à lui : il est commandé depuis
 * l'en-tête de la liste d'élèves, à côté d'« Ajouter un élève », et s'ouvre en
 * popup (`CsvImport`).
 *
 * Elle ne parle QUE de la classe. Les plans de classe en ont été retirés — ils
 * vivent sur le tableau de bord, qui les rassemble tous et sait les filtrer,
 * et les montrer une seconde fois ici ne faisait que rallonger la page. Le
 * bouton « Nouveau plan de classe » est parti avec, pour la même raison.
 */
export default async function ClassDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();

  const classGroup = await prisma.classGroup.findFirst({
    where: { id, userId: user.id },
    include: {
      students: { orderBy: [{ lastName: "asc" }, { firstName: "asc" }] },
      relations: true,
    },
  });

  if (!classGroup) notFound();

  // Les commentaires sont déchiffrés ici, au plus près de l'affichage.
  const students = classGroup.students.map((student) => ({
    id: student.id,
    firstName: student.firstName,
    lastName: student.lastName,
    comment: decryptComment(student.commentEnc) ?? "",
    difficulty: toDifficulty(student.difficulty),
    needsFront: student.needsFront,
    leftHanded: student.leftHanded,
  }));

  const relations = classGroup.relations.map((relation) => ({
    id: relation.id,
    studentAId: relation.studentAId,
    studentBId: relation.studentBId,
    type: relation.type as RelationType,
  }));

  return (
    <PageWidth className="space-y-8">
      <div>
        <Link
          href="/classes"
          className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-foreground"
        >
          <ArrowLeftIcon />
          Toutes les classes
        </Link>

        <div className="mt-2">
          <ClassHeader
            classGroupId={classGroup.id}
            name={classGroup.name}
            schoolYear={classGroup.schoolYear}
            studentCount={students.length}
          />
        </div>
      </div>

      {/* Sections empilées : la grille d'élèves a besoin de toute la largeur
          pour tenir sur quatre colonnes, ce qui est justement le but. */}
      {/* `relations` sert aussi à la fiche élève : la maquette 2c y montre une
          section « relations », et elle se remplit avec les mêmes données que
          le gestionnaire ci-dessous. */}
      <StudentManager
        classGroupId={classGroup.id}
        classGroupName={classGroup.name}
        students={students}
        relations={relations}
      />

      <RelationManager classGroupId={classGroup.id} students={students} relations={relations} />

      {/* La suppression est TOUT EN BAS, et en rouge. Elle voisinait le titre,
          à portée d'un clic distrait, alors qu'elle emporte les élèves, leurs
          commentaires et tous les plans de la classe. La reléguer en pied de
          page oblige à la chercher, ce qui est exactement ce qu'on veut. */}
      <DeleteClassButton classGroupId={classGroup.id} classGroupName={classGroup.name} />
    </PageWidth>
  );
}
