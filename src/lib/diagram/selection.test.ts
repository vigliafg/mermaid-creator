import { describe, expect, it } from "vitest";
import { readModel } from "./document";
import { edgeIndexFromDataId, resolveMermaidNodeId, toggleSelection, makeSelection } from "./selection";

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
    const model = readModel("flowchart LR\nA-->B\nA-->C");
    expect(edgeIndexFromDataId("L_A_B_0", model)).toBe(0);
    expect(edgeIndexFromDataId("L_A_C_0", model)).toBe(1);
    expect(edgeIndexFromDataId("nope", model)).toBeNull();
  });

  it("fa toggle della selezione multipla", () => {
    const a = makeSelection("node", "A");
    const b = makeSelection("node", "B");
    expect(toggleSelection([a], b)).toEqual([a, b]);
    expect(toggleSelection([a, b], a)).toEqual([b]);
  });
});
