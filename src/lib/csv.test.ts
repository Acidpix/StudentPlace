import { describe, expect, it } from "vitest";

import { parseDelimited, parseStudentList } from "./csv";

describe("lecture d'une liste d'élèves", () => {
  it("lit un point-virgule, séparateur habituel des tableurs français", () => {
    const result = parseStudentList("Martin;Camille;3;Bavarde\nDupont;Léa;1;");

    expect(result.errors).toEqual([]);
    expect(result.students).toEqual([
      { lastName: "Martin", firstName: "Camille", difficulty: 3, comment: "Bavarde" },
      { lastName: "Dupont", firstName: "Léa", difficulty: 1, comment: "" },
    ]);
  });

  it("lit aussi la tabulation et la virgule", () => {
    expect(parseStudentList("Martin\tCamille\t3").students[0].firstName).toBe("Camille");
    expect(parseStudentList("Martin,Camille,3").students[0].firstName).toBe("Camille");
  });

  it("ignore une ligne d'en-tête", () => {
    const result = parseStudentList("Nom;Prénom;Difficulté\nMartin;Camille;2");

    expect(result.students).toHaveLength(1);
    expect(result.students[0].lastName).toBe("Martin");
  });

  it("gère les champs entre guillemets d'Excel", () => {
    const result = parseStudentList('Martin;Camille;3;"Bavarde, surtout en fin d\'heure"');

    expect(result.students[0].comment).toBe("Bavarde, surtout en fin d'heure");
  });

  it("gère les guillemets échappés", () => {
    const rows = parseDelimited('a;"il a dit ""bonjour""";c');

    expect(rows[0][1]).toBe('il a dit "bonjour"');
  });

  it("applique une difficulté de 1 par défaut", () => {
    expect(parseStudentList("Martin;Camille").students[0].difficulty).toBe(1);
  });

  it("signale une difficulté hors barème sans perdre l'élève", () => {
    const result = parseStudentList("Martin;Camille;9");

    expect(result.students).toHaveLength(1);
    expect(result.students[0].difficulty).toBe(1);
    expect(result.errors[0]).toContain("Ligne 1");
  });

  it("signale une ligne incomplète", () => {
    const result = parseStudentList("Martin");

    expect(result.students).toHaveLength(0);
    expect(result.errors[0]).toContain("obligatoires");
  });

  it("ignore les lignes vides", () => {
    const result = parseStudentList("Martin;Camille\n\n\nDupont;Léa\n");

    expect(result.students).toHaveLength(2);
  });

  it("renvoie une erreur explicite sur une saisie vide", () => {
    expect(parseStudentList("   ").errors).toHaveLength(1);
  });
});
