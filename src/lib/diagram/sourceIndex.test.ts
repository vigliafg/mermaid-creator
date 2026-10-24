import { describe, expect, it } from "vitest";
import { readModel } from "./document";
import { buildSourceIndex, lineNumberAt, rangeForSelection, selectionAtCursor } from "./sourceIndex";
import { makeSelection } from "./selection";

describe("sourceIndex", () => {
  it("mappa nodi e archi a righe", () => {
    const source = "flowchart LR\nA[Hello] --> B\nB --> C";
    const model = readModel(source);
    const index = buildSourceIndex(source, model);
    expect(index.nodes.A.line).toBe(1);
    expect(index.nodes.B.line).toBe(1);
    expect(index.nodes.C.line).toBe(2);
    expect(index.edges[0].line).toBe(1);
  });

  it("trova le definizioni class", () => {
    const source = "classDiagram\n  class Animal\n  class Duck\n  Animal <|-- Duck";
    const model = readModel(source);
    const index = buildSourceIndex(source, model);
    expect(index.nodes.Animal.line).toBe(1);
    expect(index.edges[0].line).toBe(3);
  });

  it("calcola offset di riga", () => {
    const source = "a\nbb\nccc";
    expect(lineNumberAt(source, 3)).toBe(1);
    expect(lineNumberAt(source, 6)).toBe(2);
  });

  it("risolve la selezione dal cursore", () => {
    const source = "flowchart LR\nA[Hello] --> B";
    const model = readModel(source);
    const offset = source.indexOf("A[");
    const selection = selectionAtCursor(source, offset + 1, model);
    expect(selection?.id).toBe("A");
    expect(rangeForSelection(buildSourceIndex(source, model), makeSelection("node", "B"))).toBeTruthy();
  });
});
