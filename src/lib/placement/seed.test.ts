import { describe, expect, it } from "vitest";

import { seedFromId } from "./seed";

describe("seedFromId", () => {
  it("redonne la même graine pour un même plan de classe", () => {
    expect(seedFromId("clx1234")).toBe(seedFromId("clx1234"));
    expect(seedFromId("clx1234", 3)).toBe(seedFromId("clx1234", 3));
  });

  it("change de graine à chaque variante", () => {
    const variants = [0, 1, 2, 3, 4, 5].map((variant) => seedFromId("clx1234", variant));
    expect(new Set(variants).size).toBe(variants.length);
  });

  it("distingue deux plans de classe", () => {
    expect(seedFromId("plan-a")).not.toBe(seedFromId("plan-b"));
  });

  it("reste dans les bornes attendues par mulberry32", () => {
    for (const id of ["a", "plan-principal", "clx0987654321", ""]) {
      const seed = seedFromId(id, 7);
      expect(Number.isInteger(seed)).toBe(true);
      expect(seed).toBeGreaterThanOrEqual(0);
      expect(seed).toBeLessThan(2_147_483_647);
    }
  });
});
