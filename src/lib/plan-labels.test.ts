import { describe, expect, it } from "vitest";

import {
  PT_PER_PX,
  SEAT_FONT_MAX_PX,
  planLabelStyle,
  seatLabelText,
  seatMetrics,
  textWidthRatio,
} from "./plan-labels";
import type { StudentView } from "./view-models";

function student(firstName: string, lastName: string): StudentView {
  return {
    id: `${firstName}-${lastName}`,
    firstName,
    lastName,
    comment: "",
    difficulty: 3,
    needsFront: false,
    leftHanded: false,
  };
}

const camille = student("Camille", "Martin");
const jeanBaptiste = student("Jean-Baptiste", "Villeneuve");

/** Une table de deux places au barème : 340 × 45 cm, donc un pas de 170 cm. */
const roomyTable = { widthCm: 170, heightCm: 45 };
/** Une table serrée, comme une salle très grande affichée en petit. */
const crampedTable = { widthCm: 40, heightCm: 20 };

describe("étiquettes du plan", () => {
  it("estime la largeur d'un texte en multiples du corps", () => {
    expect(textWidthRatio("")).toBe(0);
    // « Camille M. » vaut environ 4,4 fois sa taille de police : c'est cette
    // estimation, légèrement majorée, qui remplace une mesure au canvas.
    expect(textWidthRatio("Camille M.")).toBeGreaterThan(4);
    expect(textWidthRatio("Camille M.")).toBeLessThan(5);
    // Les jambages fins pèsent moins que les capitales.
    expect(textWidthRatio("ill")).toBeLessThan(textWidthRatio("MMM"));
  });

  it("plafonne le corps au maximum, dans l'unité de l'appelant", () => {
    const onScreen = seatMetrics(roomyTable, 1);
    const inPdf = seatMetrics(roomyTable, 1, { unit: PT_PER_PX });

    // À l'écran la hauteur commande (45 × 0,46), sous le plafond de 22 px.
    expect(onScreen.font).toBeCloseTo(45 * 0.46);
    expect(onScreen.font).toBeLessThanOrEqual(SEAT_FONT_MAX_PX);
    // En PDF, tous les seuils sont exprimés en points : le plafond descend à
    // 16,5 pt, soit exactement les 22 px de l'écran une fois imprimés.
    expect(inPdf.font).toBeCloseTo(SEAT_FONT_MAX_PX * PT_PER_PX);
    expect(inPdf.unit).toBe(PT_PER_PX);
  });

  it("rend aux cases de participation une part de la hauteur du nom", () => {
    const plain = seatMetrics(roomyTable, 1, { unit: PT_PER_PX });
    const withBoxes = seatMetrics(roomyTable, 1, { unit: PT_PER_PX, heightShare: 0.3 });

    // La carte ne change pas de taille : c'est le NOM qui cède de la place.
    expect(withBoxes.height).toBe(plain.height);
    expect(withBoxes.font).toBeLessThan(plain.font);
  });

  it("écrit toute la classe dans la même forme et le même corps", () => {
    const metrics = seatMetrics(roomyTable, 1);
    const style = planLabelStyle([camille, jeanBaptiste], metrics);

    expect(style.form).toBe("short");
    expect(style.font).toBeLessThanOrEqual(metrics.font);
    expect(seatLabelText(camille, style.form)).toBe("Camille M.");
    expect(seatLabelText(jeanBaptiste, style.form)).toBe("Jean-Baptiste V.");
  });

  it("abrège plutôt que d'écrire trop petit, et pour tout le monde", () => {
    const metrics = seatMetrics(crampedTable, 1);
    // « Jean-Baptiste V. » ne tient qu'à 4 px, son prénom seul à 5 : les deux
    // sont sous les planchers de lisibilité, on tombe aux initiales.
    const style = planLabelStyle([camille, jeanBaptiste], metrics);

    expect(style.form).toBe("initials");
    expect(seatLabelText(camille, style.form)).toBe("CM");
    expect(seatLabelText(jeanBaptiste, style.form)).toBe("JV");
  });

  it("ne laisse pas un seul nom long décider seul quand il tient", () => {
    // La même carte serrée, mais sans le nom à rallonge : la classe garde sa
    // forme complète. C'est bien le PLUS LONG des noms qui commande.
    const metrics = seatMetrics({ widthCm: 70, heightCm: 30 }, 1);

    expect(planLabelStyle([camille], metrics).form).toBe("short");
    expect(planLabelStyle([camille, jeanBaptiste], metrics).form).not.toBe("short");
  });
});
