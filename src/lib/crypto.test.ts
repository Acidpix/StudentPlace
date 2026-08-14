import { beforeAll, describe, expect, it } from "vitest";

import { decryptComment, encryptComment } from "./crypto";

beforeAll(() => {
  // La clé est lue paresseusement au premier chiffrement : la définir ici suffit.
  process.env.ENCRYPTION_KEY = Buffer.alloc(32, 7).toString("base64");
});

describe("chiffrement des commentaires", () => {
  it("retrouve le texte d'origine après un aller-retour", () => {
    const original = "À surveiller en fond de classe — bavarde avec Léa.";
    const encrypted = encryptComment(original);

    expect(encrypted).not.toBeNull();
    expect(encrypted).not.toContain("bavarde");
    expect(decryptComment(encrypted)).toBe(original);
  });

  it("produit un chiffré différent à chaque appel", () => {
    // Vecteur d'initialisation aléatoire : deux commentaires identiques ne
    // doivent pas se reconnaître dans le fichier de base.
    const a = encryptComment("Même texte");
    const b = encryptComment("Même texte");

    expect(a).not.toBe(b);
    expect(decryptComment(a)).toBe(decryptComment(b));
  });

  it("traite le vide comme une absence de commentaire", () => {
    expect(encryptComment("")).toBeNull();
    expect(encryptComment("   ")).toBeNull();
    expect(encryptComment(null)).toBeNull();
    expect(encryptComment(undefined)).toBeNull();
  });

  it("renvoie null plutôt que de lever une exception sur une donnée illisible", () => {
    expect(decryptComment(null)).toBeNull();
    expect(decryptComment("pas-du-tout-chiffré")).toBeNull();
    expect(decryptComment("aaa.bbb.ccc")).toBeNull();
  });

  it("conserve les accents et les caractères spéciaux", () => {
    const original = "Élève très à l'aise — cf. « PAP » n°3 ✓";
    expect(decryptComment(encryptComment(original))).toBe(original);
  });
});
