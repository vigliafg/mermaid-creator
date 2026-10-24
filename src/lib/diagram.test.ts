import { describe, expect, it } from "vitest";
import { diagramType, extractMermaidBlocks, sanitizeSvgForExport } from "./diagram";

describe("extractMermaidBlocks", () => {
  it("extracts multiple blocks with titles and strips metadata", () => {
    const text = [
      "Ecco i diagrammi.",
      "```mermaid",
      "%% title: Flusso",
      "flowchart LR",
      "  A --> B",
      "```",
      "e poi",
      "~~~mermaid",
      "%% target: abc-123",
      "sequenceDiagram",
      "  A->>B: ciao",
      "~~~",
    ].join("\n");
    const blocks = extractMermaidBlocks(text);
    expect(blocks).toHaveLength(2);
    expect(blocks[0].title).toBe("Flusso");
    expect(blocks[0].source).toBe("flowchart LR\n  A --> B");
    expect(blocks[1].targetId).toBe("abc-123");
    expect(blocks[1].source).toBe("sequenceDiagram\n  A->>B: ciao");
  });

  it("ignores non-mermaid fences and unclosed blocks when requested", () => {
    const text = ["```js", "```mermaid", "flowchart LR", "```", "```mermaid", "flowchart TD"].join(
      "\n",
    );
    expect(extractMermaidBlocks(text, { closedOnly: true })).toHaveLength(0);
  });

  it("keeps a partial block when not closed", () => {
    const text = "```mermaid\nflowchart TD\nA-->B";
    const blocks = extractMermaidBlocks(text);
    expect(blocks).toHaveLength(1);
    expect(blocks[0].closed).toBe(false);
  });

  it("returns closed blocks when closedOnly is requested", () => {
    const text = [
      "Ecco il diagramma richiesto.",
      "",
      "```mermaid",
      "%% title: Flusso di esempio",
      "flowchart LR",
      "  A[Testo] --> B[Mermaid]",
      "```",
      "",
      "Il diagramma è pronto.",
    ].join("\n");
    const blocks = extractMermaidBlocks(text, { closedOnly: true });
    expect(blocks).toHaveLength(1);
    expect(blocks[0].title).toBe("Flusso di esempio");
    expect(blocks[0].source).toContain("flowchart LR");
  });
});

describe("diagramType", () => {
  it("recognizes common Mermaid types", () => {
    expect(diagramType("flowchart LR\nA-->B")).toBe("flowchart");
    expect(diagramType("graph TD\nA-->B")).toBe("flowchart");
    expect(diagramType("sequenceDiagram\nA->>B: hi")).toBe("sequence");
    expect(diagramType("erDiagram\nA ||--o{ B : has")).toBe("er");
  });
});

describe("sanitizeSvgForExport", () => {
  it("removes scripts and javascript links", () => {
    const svg = '<svg><script>alert(1)</script><a href="javascript:alert(1)">x</a></svg>';
    const clean = sanitizeSvgForExport(svg);
    expect(clean).not.toContain("<script");
    expect(clean).not.toContain("javascript:");
  });
});
