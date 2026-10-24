import { describe, expect, it } from "vitest";
import { render as peleRender } from "pele";
import {
  capabilitiesFor,
  edgeSignature,
  mergeAfterAi,
  normalizeKind,
  parseStyles,
  readDocument,
  readModel,
  writeStyleBlock,
} from "./document";

describe("modello diagramma", () => {
  it("legge flowchart con nodi, archi e cluster", () => {
    const model = readModel(`flowchart LR
  A[Hello] --> B[World]
  subgraph S[Gruppo]
    B
  end`);
    expect(model.kind).toBe("flowchart");
    expect(model.nodes.map((node) => node.id).sort()).toEqual(["A", "B"]);
    expect(model.edges).toHaveLength(1);
    expect(model.edges[0]).toMatchObject({ from: "A", to: "B" });
    expect(model.clusters[0].id).toBe("S");
  });

  it("legge class, state ed ER", () => {
    const classModel = readModel("classDiagram\n  class Animal\n  class Duck\n  Animal <|-- Duck");
    expect(classModel.kind).toBe("class");
    expect(classModel.nodes).toHaveLength(2);
    expect(classModel.edges).toHaveLength(1);
    const stateModel = readModel("stateDiagram-v2\n  [*] --> Still\n  Still --> Moving");
    expect(stateModel.kind).toBe("state");
    expect(stateModel.nodes.map((node) => node.id)).toContain("Still");
    const erModel = readModel("erDiagram\n  CUSTOMER ||--o{ ORDER : places");
    expect(erModel.kind).toBe("er");
    expect(erModel.nodes).toHaveLength(2);
  });

  it("normalizza alias e capacità", () => {
    expect(normalizeKind("stateDiagram-v2")).toBe("state");
    expect(normalizeKind("flowchart-elk")).toBe("flowchart");
    expect(capabilitiesFor("sequence").nodes).toBe(false);
    expect(capabilitiesFor("flowchart")).toMatchObject({ nodes: true, edges: true, clusters: true });
    expect(capabilitiesFor("class").edges).toBe(false);
  });
});

describe("blocco stili", () => {
  it("legge stili esterni e blocco, last-wins", () => {
    const source = `flowchart LR
  A --> B
  style A fill:#ff0000,stroke-width:2px
  linkStyle 0 stroke:#0000ff
%% mc:styles:begin
style A fill:#00ff00
%% mc:styles:end`;
    const styles = parseStyles(source);
    expect(styles["element:A"].fill).toBe("#00ff00");
    expect(styles["element:A"].strokeWidth).toBe(2);
    expect(styles["edge:0"].stroke).toBe("#0000ff");
  });

  it("legge classDef/class e lascia vincere lo style inline", () => {
    const source = `flowchart LR
  A[Uno] --> B[Due]
  classDef hot fill:#ff0000,stroke:#00ff00
  class A hot
  style A stroke:#0000ff`;
    const doc = readDocument(source);
    expect(doc.styles["element:A"].fill).toBe("#ff0000");
    expect(doc.styles["element:A"].stroke).toBe("#0000ff");
    const classSource = "classDiagram\n  class Animal\n  Animal <|-- Duck";
    expect(readDocument(classSource).styles["element:Animal"]).toBeUndefined();
  });

  it("scrive un blocco idempotente e rimuove i duplicati", () => {
    const styles = {
      "element:A": { fill: "#ff0000", strokeWidth: 2, dash: "4 2" },
      "edge:0": { stroke: "#0000ff", opacity: 0.5 },
    };
    const once = writeStyleBlock("flowchart LR\nA-->B", styles);
    const twice = writeStyleBlock(once, styles);
    expect(once).toContain("%% mc:styles:begin");
    expect(once).toContain("style A fill:#ff0000,stroke-width:2px,stroke-dasharray:4 2");
    expect(once).toContain("linkStyle 0 stroke:#0000ff,fill-opacity:0.5,stroke-opacity:0.5");
    expect(twice).toBe(once);
  });

  it("gli stili scritti sono onorati da Pele", () => {
    const source = writeStyleBlock("flowchart LR\nA-->B", {
      "element:A": { fill: "#ff0000", strokeWidth: 3 },
      "edge:0": { stroke: "#00ff00", dash: "4 2" },
    });
    const svg = peleRender(source).svg;
    expect(svg).toContain("#ff0000");
    expect(svg).toContain("#00ff00");
  });

  it("preserva i line ending CRLF", () => {
    const source = "flowchart LR\r\nA-->B";
    const styled = writeStyleBlock(source, { "element:A": { fill: "#ff0000" } });
    expect(styled).toContain("\r\n%% mc:styles:begin");
    expect(writeStyleBlock(styled, {})).toBe(source);
  });

  it("elimina il blocco quando non ci sono stili", () => {
    const withBlock = writeStyleBlock("flowchart LR\nA-->B", { "element:A": { fill: "#fff" } });
    expect(writeStyleBlock(withBlock, {})).toBe("flowchart LR\nA-->B");
  });
});

describe("merge AI", () => {
  it("conserva gli stili dei nodi rimasti e droppa gli altri", () => {
    const oldSource = writeStyleBlock(
      `flowchart LR
  A --> B
  B --> C`,
      {
        "element:A": { fill: "#ff0000" },
        "element:C": { fill: "#00ff00" },
        "edge:0": { stroke: "#0000ff" },
      },
    );
    const newSource = `flowchart LR
  A --> B`;
    const result = mergeAfterAi(oldSource, newSource);
    expect(result.source).toContain("style A fill:#ff0000");
    expect(result.source).not.toContain("style C");
    expect(result.dropped).toContain("element:C");
    expect(result.dropped).toContain("edge:0");
  });

  it("conserva gli stili arco se la firma è identica", () => {
    const oldSource = writeStyleBlock("flowchart LR\nA-->B\nB-->C", {
      "edge:0": { stroke: "#0000ff" },
    });
    const result = mergeAfterAi(oldSource, "flowchart LR\nA-->B\nB-->C");
    expect(result.source).toContain("linkStyle 0");
    expect(result.dropped).toHaveLength(0);
  });

  it("calcola una firma archi stabile", () => {
    const model = readModel("flowchart LR\nA-->B\nA-->C");
    expect(edgeSignature(model)).toBe("A>B||arrow_point;A>C||arrow_point");
  });
});
