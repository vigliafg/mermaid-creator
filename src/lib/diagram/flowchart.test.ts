import { describe, expect, it } from "vitest";
import {
  addEdge,
  addNode,
  deleteSelectionLine,
  readEdgeArrow,
  reverseEdge,
  setDirection,
  setEdgeArrow,
  findDefinition,
  nodeLabel,
  replaceNodeLabel,
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
    expect(setDirection("flowchart LR\nA-->B", "TB")).toContain("flowchart TB");
    expect(setDirection("graph TD\nA-->B", "RL")).toContain("graph RL");
    expect(setDirection("flowchart-elk LR\nA-->B", "BT")).toContain("flowchart-elk BT");
  });

  it("cambia la direzione di class, state ed ER con la direttiva direction", () => {
    const klass = setDirection("classDiagram\n  class A\n  class B\n  A <|-- B", "LR");
    expect(klass.startsWith("classDiagram\ndirection LR")).toBe(true);

    const state = setDirection("stateDiagram-v2\n  A --> B", "RL");
    expect(state.startsWith("stateDiagram-v2\ndirection RL")).toBe(true);

    const er = setDirection("erDiagram\n  A ||--o{ B : has", "BT");
    expect(er.startsWith("erDiagram\ndirection BT")).toBe(true);
  });

  it("sostituisce la direzione esistente senza duplicarla", () => {
    const next = setDirection("erDiagram\ndirection LR\nA ||--o{ B : has", "RL");
    expect(next.match(/^direction /gm)).toHaveLength(1);
    expect(next).toContain("direction RL");
    const once = setDirection("classDiagram LR\nclass A", "LR");
    expect(once.startsWith("classDiagram\ndirection LR")).toBe(true);
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

  it("elimina le relazioni class ed ER", () => {
    const classSource = "classDiagram\n  class Animal\n  class Duck\n  Animal <|-- Duck";
    const classModel = readModel(classSource);
    const classResult = deleteSelectionLine(
      classSource,
      makeSelection("edge", "0", 0),
      classModel,
    );
    expect(classResult.removed).toBe(1);
    expect(classResult.source).not.toContain("Animal <|-- Duck");

    const erSource = "erDiagram\n  CUSTOMER ||--o{ ORDER : places";
    const erModel = readModel(erSource);
    const erResult = deleteSelectionLine(
      erSource,
      makeSelection("edge", "0", 0),
      erModel,
    );
    expect(erResult.removed).toBe(1);
    expect(erResult.source).not.toContain("CUSTOMER ||--o{ ORDER");
  });
});

describe("punte delle connessioni", () => {
  it("legge e cambia il tipo di punta", () => {
    const source = "flowchart LR\n  A --> B";
    const model = readModel(source);
    expect(readEdgeArrow(source, model, 0)).toMatchObject({
      styleId: "arrow",
      canEdit: true,
    });

    const double = setEdgeArrow(source, model, 0, "arrow-both");
    expect(double.ok).toBe(true);
    expect(double.source).toContain("A <--> B");

    const circle = setEdgeArrow(source, model, 0, "circle-both");
    expect(circle.source).toContain("A o--o B");
  });

  it("preserva le etichette anche nel formato con testo", () => {
    const source = 'flowchart LR\n  D -- "Sì" --> E';
    const model = readModel(source);
    const result = setEdgeArrow(source, model, 0, "circle-both");
    expect(result.ok).toBe(true);
    expect(result.source).toContain("D o-- Sì --o E");

    const dotted = setEdgeArrow(source, model, 0, "dotted");
    expect(dotted.source).toContain("D -. Sì .-> E");
  });

  it("gestisce etichette con parentesi e <br>", () => {
    const source = 'flowchart TD\n  D -- "No<br>(giorni feriali)" --> H';
    const model = readModel(source);
    const result = setEdgeArrow(source, model, 0, "cross");
    expect(result.ok).toBe(true);
    expect(result.source).toContain("D -- No<br>(giorni feriali) --x H");
  });

  it("funziona con le etichette reali dei diagrammi importati", () => {
    const source =
      'flowchart TD\n  D -- "No<br>(giorni feriali)" --> H["Nessuna ulteriore modifica<br>solo deviazione linea 424"]';
    const model = readModel(source);
    const result = setEdgeArrow(source, model, 0, "arrow-both");
    expect(result.ok).toBe(true);
    expect(result.source).toContain(
      'D <-- No<br>(giorni feriali) --> H["Nessuna ulteriore modifica<br>solo deviazione linea 424"]',
    );
  });

  it("cambia una sola connessione in una catena", () => {
    const source = "flowchart LR\n  A --> B --> C";
    const model = readModel(source);
    const result = setEdgeArrow(source, model, 1, "cross");
    expect(result.ok).toBe(true);
    expect(result.source).toContain("A --> B --x C");
  });

  it("inverte gli estremi preservando etichette e forme", () => {
    const source = "flowchart LR\n  A[Start] --> B[End]";
    const model = readModel(source);
    const result = reverseEdge(source, model, 0);
    expect(result.ok).toBe(true);
    expect(result.source).toContain("B[End] --> A[Start]");

    const labeled = 'flowchart LR\n  D -- "Sì" --> E';
    const labeledModel = readModel(labeled);
    const reversed = reverseEdge(labeled, labeledModel, 0);
    expect(reversed.source).toContain("E -- Sì --> D");
  });

  it("riconosce le punte tratteggiate e spesse", () => {
    const dotted = "flowchart LR\n  A -.-> B";
    const thick = "flowchart LR\n  A ==> B";
    expect(readEdgeArrow(dotted, readModel(dotted), 0).styleId).toBe("dotted");
    expect(readEdgeArrow(thick, readModel(thick), 0).styleId).toBe("thick");
  });
});
