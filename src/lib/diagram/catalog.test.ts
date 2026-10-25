import { describe, expect, it } from "vitest";
import { render as peleRender } from "pele";
import { DIAGRAM_CATALOG } from "./catalog";

describe("catalogo diagrammi", () => {
  it("ha varianti e sorgenti univoche", () => {
    const ids = new Set<string>();
    for (const entry of DIAGRAM_CATALOG) {
      expect(entry.variants.length, entry.id).toBe(10);
      expect(ids.has(entry.id), entry.id).toBe(false);
      ids.add(entry.id);
      const variantIds = new Set<string>();
      for (const variant of entry.variants) {
        expect(variant.source.trim(), `${entry.id}/${variant.id}`).not.toBe("");
        expect(variantIds.has(variant.id), `${entry.id}/${variant.id}`).toBe(false);
        variantIds.add(variant.id);
      }
    }
  });

  it("renderizza tutti gli esempi con Pele", () => {
    for (const entry of DIAGRAM_CATALOG) {
      for (const variant of entry.variants) {
        expect(() => peleRender(variant.source), `${entry.id}/${variant.id}`).not.toThrow();
      }
    }
  });
});
