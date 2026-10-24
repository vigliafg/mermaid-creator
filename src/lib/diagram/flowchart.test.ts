import { describe, expect, it } from "vitest";
import {
  addEdge,
  addNode,
  deleteSelectionLine,
  findDefinition,
  nodeLabel,
  replaceNodeLabel,
  setDirection,
  setNodeShape,
} from "./flowchart";
import { readModel } from "./document";
import { makeSelection } from "./selection";

describe("label flowchart", () => {
  it("trova e sostituisce etichette semplici, quotate e con forme", () => {
    expect(nodeLabel("flowchart LR\nA[Hello] --> B", "A")).toBe("Hello");
    expect(nodeLabel('flowchart LR\nA["Hello world"]', "A")).toBe("Hello world");
    expect(nodeLabel("flowchart LR\nA([Stadium])", "A")).toBe("Stadium");
    expect(replaceNodeLabel("flowchart LR\nA[Hello] --> B", "A", "Ciao")).toContain("A[Ciao]");
    expect(replaceNodeLabel('flowchart LR\nA["Hello"]', "A", "Ciao")).toContain('A["Ciao"]');
  });

  it("aggiunge una definizione se il nodo è solo referenziato", () => {
    const next = replaceNodeLabel("flowchart LR\nA --> B", "B", "Nuovo");
    expect(next).toContain("B[Nuovo]");
  });

  it("cambia forma preservando l'etichetta", () => {
    const next = setNodeShape("flowchart LR\nA[Hello]", "A", "diamond");
    expect(next).toContain("A{Hello}");
    expect(findDefinition(next, "A")?.shape.id).toBe("diamond");
  });

  it("aggiunge nodi e archi prima del blocco stili", () => {
    const source = "flowchart LR\nA --> B\n\n%% mc:styles:begin\nstyle A fill:#fff\n%% mc:styles:end";
    const withNode = addNode(source, "N1", "Nuovo");
    expect(withNode.indexOf("N1[Nuovo]")).toBeLessThan(withNode.indexOf("%% mc:styles:begin"));
    const withEdge = addEdge(source, "A", "N1");
    expect(withEdge).toContain("A --> N1");
    expect(withEdge.indexOf("A --> N1")).toBeLessThan(withEdge.indexOf("%% mc:styles:begin"));
  });

  it("cambia la direzione", () => {
    expect(setDirection("flowchart LR\nA-->B", "TD")).toContain("flowchart TD");
  });
});

describe("eliminazione flowchart", () => {
  it("elimina le righe del nodo", () => {
    const source = "flowchart LR\nA[Hello] --> B[World]\nB --> C";
    const model = readModel(source);
    const result = deleteSelectionLine(source, makeSelection("node", "B"), model);
    expect(result.removed).toBeGreaterThan(0);
    expect(result.source).not.toContain("B[World]");
    expect(result.source).not.toContain("B --> C");
  });

  it("rifiuta un arco in catena", () => {
    const source = "flowchart LR\nA --> B --> C";
    const model = readModel(source);
    const result = deleteSelectionLine(
      source,
      makeSelection("edge", "0", 0),
      model,
    );
    expect(result.removed).toBe(0);
    expect(result.note).toBeDefined();
  });
});
