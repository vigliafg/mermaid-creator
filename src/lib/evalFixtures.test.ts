import { describe, expect, it } from "vitest";
import cases from "../../eval/prompts/cases.json";
import holdout from "../../eval/prompts/holdout.json";

interface EvalCase {
  id: string;
  title: string;
  text: string;
  expectedTypes: string[];
  expectedTopType?: string;
  expectedTopTypes?: string[];
  mustMention: string[];
}

const ALLOWED_TYPES = new Set([
  "flowchart",
  "sequence",
  "class",
  "state",
  "er",
  "gantt",
  "pie",
  "mindmap",
  "timeline",
  "journey",
  "quadrant",
  "xychart",
  "sankey",
  "c4",
  "block",
]);

function validateSet(name: string, fixtures: EvalCase[]) {
  const ids = new Set<string>();
  for (const item of fixtures) {
    expect(item.id, `${name}: id`).toBeTruthy();
    expect(ids.has(item.id), `${name}: id duplicato ${item.id}`).toBe(false);
    ids.add(item.id);
    expect(item.text.length, `${name}: testo ${item.id}`).toBeGreaterThan(80);
    expect(item.expectedTypes.length, `${name}: tipi ${item.id}`).toBeGreaterThan(0);
    expect(item.mustMention.length, `${name}: mustMention ${item.id}`).toBeGreaterThan(0);
    for (const type of item.expectedTypes) {
      expect(ALLOWED_TYPES.has(type), `${name}: tipo ${type}`).toBe(true);
    }
    if (item.expectedTopTypes) {
      for (const type of item.expectedTopTypes) {
        expect(item.expectedTypes.includes(type), `${name}: top ${type}`).toBe(true);
      }
    } else {
      expect(
        typeof item.expectedTopType === "string" &&
          item.expectedTypes.includes(item.expectedTopType),
        `${name}: expectedTopType ${item.id}`,
      ).toBe(true);
    }
  }
  return ids;
}

const tune = cases as EvalCase[];
const holdoutCases = holdout as EvalCase[];

describe("eval prompt fixtures", () => {
  it("ha set tune e holdout validi e indipendenti", () => {
    const tuneIds = validateSet("tune", tune);
    const holdoutIds = validateSet("holdout", holdoutCases);
    expect(tune.length).toBe(60);
    expect(holdoutCases.length).toBe(15);
    for (const id of holdoutIds) {
      expect(tuneIds.has(id), `id holdout condiviso con tune: ${id}`).toBe(false);
    }
  });

  it("copre i tipi più usati dal catalogo", () => {
    const covered = new Set([...tune, ...holdoutCases].flatMap((item) => item.expectedTypes));
    for (const type of ["flowchart", "sequence", "class", "er", "state", "mindmap", "xychart"]) {
      expect(covered.has(type)).toBe(true);
    }
  });
});
