import { describe, expect, it } from "vitest";
import { readModel } from "./document";
import { edgeIndexFromDataId, resolveMermaidNodeId, selectionLabel, toggleSelection, makeSelection } from "./selection";

describe("selezione", () => {
  it("risolve gli id DOM di Mermaid", () => {
    expect(resolveMermaidNodeId("mc-1-flowchart-A-0", "mc-1", "flowchart", ["A"])).toBe("A");
    expect(resolveMermaidNodeId("mc-1-flowchart-my-node-2", "mc-1", "flowchart", ["my-node"])).toBe(
      "my-node",
    );
    expect(resolveMermaidNodeId("mc-1-class-classId-Animal-0", "mc-1", "class", ["Animal"])).toBe(
      "Animal",
    );
    expect(resolveMermaidNodeId("mc-1-state-state-Still-1", "mc-1", "state", ["Still"])).toBe(
      "Still",
    );
    expect(resolveMermaidNodeId("mc-1-er-entity-CUSTOMER-0", "mc-1", "er", ["CUSTOMER"])).toBe(
      "CUSTOMER",
    );
    expect(resolveMermaidNodeId("mc-1-flowchart-X-0", "mc-1", "flowchart", ["A"])).toBeNull();
  });

  it("risolve gli archi da data-id", () => {
    const flow = readModel("flowchart LR\nA-->B\nA-->C");
    expect(edgeIndexFromDataId("L_A_B_0", flow)).toBe(0);
    expect(edgeIndexFromDataId("L_A_C_0", flow)).toBe(1);
    expect(edgeIndexFromDataId("nope", flow)).toBeNull();
    const klass = readModel("classDiagram\n  class Animal\n  class Duck\n  Animal <|-- Duck");
    expect(edgeIndexFromDataId("id_Animal_Duck_1", klass)).toBe(0);
    const er = readModel("erDiagram\n  CUSTOMER ||--o{ ORDER : places");
    expect(edgeIndexFromDataId("id_entity-CUSTOMER-0_entity-ORDER-1_0", er)).toBe(0);
    const erMultiple = readModel(
      "erDiagram\n  CUSTOMER ||--o{ ORDER : places\n  CUSTOMER ||--o{ ORDER : ships",
    );
    expect(edgeIndexFromDataId("id_entity-CUSTOMER-0_entity-ORDER-1_0", erMultiple)).toBe(0);
    expect(edgeIndexFromDataId("id_entity-CUSTOMER-0_entity-ORDER-1_1", erMultiple)).toBe(1);
  });

  it("mostra le etichette dei nodi negli estremi degli archi", () => {
    const model = readModel("erDiagram\n  CUSTOMER ||--o{ ORDER : places");
    expect(selectionLabel(model, makeSelection("edge", "0", 0))).toBe("CUSTOMER → ORDER");
  });

  it("fa toggle della selezione multipla", () => {
    const a = makeSelection("node", "A");
    const b = makeSelection("node", "B");
    expect(toggleSelection([a], b)).toEqual([a, b]);
    expect(toggleSelection([a, b], a)).toEqual([b]);
  });
});
