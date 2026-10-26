import { describe, expect, it } from "vitest";
import { normalizeBoardLibraryItems } from "./libraryItems";

describe("normalizeBoardLibraryItems", () => {
  it("legge la libreria v2 e conserva nome, stato ed elementi", () => {
    const items = normalizeBoardLibraryItems([
      {
        id: "one",
        status: "published",
        name: "Rettangolo",
        created: 123,
        elements: [{ id: "e1", type: "rectangle" }],
      },
    ]);
    expect(items).toEqual([
      {
        id: "one",
        status: "published",
        name: "Rettangolo",
        created: 123,
        elements: [{ id: "e1", type: "rectangle" }],
      },
    ]);
  });

  it("migra la v1 (array di elementi) e assegna un nome", () => {
    const items = normalizeBoardLibraryItems([
      [{ id: "e1", type: "ellipse" }],
    ]);
    expect(items).toHaveLength(1);
    expect(items[0].status).toBe("unpublished");
    expect(items[0].name).toBe("Elementi 1");
    expect(items[0].elements).toHaveLength(1);
  });

  it("scarta valori non validi e voci vuote", () => {
    expect(
      normalizeBoardLibraryItems([
        null,
        {},
        { id: "no-elements", elements: [] },
        { id: "ok", elements: [{ id: "e1" }] },
      ]),
    ).toEqual([
      {
        id: "ok",
        status: "unpublished",
        name: "Elementi 4",
        created: expect.any(Number),
        elements: [{ id: "e1" }],
      },
    ]);
    expect(normalizeBoardLibraryItems("x")).toEqual([]);
  });
});
