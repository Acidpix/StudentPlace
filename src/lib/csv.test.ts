import { describe, expect, it } from "vitest";

import { parseDelimited, parseStudentList, splitFullName } from "./csv";

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
    expect(result.errors[0]).toContain("qu'un mot");
  });

  it("ne prend pas pour un en-tête un nom qui contient « nom »", () => {
    const result = parseStudentList("Monome Camille\nDupont Léa");

    expect(result.students).toHaveLength(2);
    expect(result.students[0].lastName).toBe("Monome");
  });

  it("ignore les lignes vides", () => {
    const result = parseStudentList("Martin;Camille\n\n\nDupont;Léa\n");

    expect(result.students).toHaveLength(2);
  });

  it("renvoie une erreur explicite sur une saisie vide", () => {
    expect(parseStudentList("   ").errors).toHaveLength(1);
  });
});

describe("liste en texte simple", () => {
  it("lit un élève par ligne, sans séparateur", () => {
    const result = parseStudentList("Martin Camille\nDupont Léa");

    expect(result.errors).toEqual([]);
    expect(result.students).toEqual([
      { lastName: "Martin", firstName: "Camille", difficulty: 1, comment: "" },
      { lastName: "Dupont", firstName: "Léa", difficulty: 1, comment: "" },
    ]);
  });

  it("suit l'ordre demandé quand la casse ne dit rien", () => {
    const result = parseStudentList("Camille Martin", { nameOrder: "firstLast" });

    expect(result.students[0]).toMatchObject({ lastName: "Martin", firstName: "Camille" });
  });

  it("reconnaît le patronyme en capitales, quel que soit l'ordre déclaré", () => {
    expect(parseStudentList("Camille MARTIN").students[0]).toMatchObject({
      lastName: "MARTIN",
      firstName: "Camille",
    });

    expect(
      parseStudentList("MARTIN Camille", { nameOrder: "firstLast" }).students[0],
    ).toMatchObject({ lastName: "MARTIN", firstName: "Camille" });
  });

  it("garde groupé un patronyme composé écrit en capitales", () => {
    expect(splitFullName("Jean-Marc DE LA TOUR")).toEqual({
      lastName: "DE LA TOUR",
      firstName: "Jean-Marc",
    });
  });

  it("verse les mots surnuméraires dans le prénom", () => {
    expect(splitFullName("Dupont Marie Claire")).toEqual({
      lastName: "Dupont",
      firstName: "Marie Claire",
    });

    expect(splitFullName("Marie Claire Dupont", "firstLast")).toEqual({
      lastName: "Dupont",
      firstName: "Marie Claire",
    });
  });

  it("mélange sans broncher lignes simples et lignes délimitées", () => {
    const result = parseStudentList("Martin;Camille;3\nDupont Léa");

    expect(result.errors).toEqual([]);
    expect(result.students).toHaveLength(2);
    expect(result.students[1]).toMatchObject({ lastName: "Dupont", firstName: "Léa" });
  });

  it("refuse un mot isolé plutôt que d'inventer un prénom", () => {
    const result = parseStudentList("Martin Camille\nDupont");

    expect(result.students).toHaveLength(1);
    expect(result.errors[0]).toContain("Ligne 2");
  });
});
