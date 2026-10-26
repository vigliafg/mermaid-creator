import { describe, expect, it } from "vitest";
import {
  cleanMermaidSource,
  diagramType,
  ensureDiagramMeta,
  extractMermaidBlocks,
  replaceMermaidBlockSource,
  sanitizeSvgForExport,
  simplifySequenceActivations,
  simplifyQuadrantLabels,
  simplifyXYChartSeries,
} from "./diagram";

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

  it("ignora i blocchi mc-theme senza perdere il diagramma", () => {
    const text = [
      "```mc-theme",
      '{"preset":"terminal"}',
      "```",
      "```mermaid",
      "flowchart LR",
      "  A --> B",
      "```",
    ].join("\n");
    const blocks = extractMermaidBlocks(text, { closedOnly: true });
    expect(blocks).toHaveLength(1);
    expect(blocks[0].source).toBe("flowchart LR\n  A --> B");
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

  it("injects the selected theme for Pele exports", () => {
    const svg = '<svg class="pele"></svg>';
    expect(sanitizeSvgForExport(svg, "light")).toContain("--pele-bg:#ffffff");
    expect(sanitizeSvgForExport(svg, "dark")).toContain("--pele-bg:#0b0e14");
  });
});


describe("riparazione Mermaid", () => {
  it("pulisce i recinti markdown del correttore", () => {
    expect(cleanMermaidSource("```mermaid\nflowchart LR\nA-->B\n```")).toBe(
      "flowchart LR\nA-->B",
    );
    expect(cleanMermaidSource("flowchart LR\nA-->B")).toBe("flowchart LR\nA-->B");
  });

  it("garantisce target e title senza duplicarli", () => {
    const withMeta = ensureDiagramMeta("%% target: old\n%% title: Vecchio\nflowchart LR\nA-->B", {
      title: "Nuovo",
      targetId: "abc",
    });
    expect(withMeta).toContain("%% target: abc");
    expect(withMeta).toContain("%% title: Vecchio");
    expect(withMeta.match(/%% target:/g)).toHaveLength(1);
    const added = ensureDiagramMeta("flowchart LR\nA-->B", {
      title: "Titolo",
      targetId: "x1",
    });
    expect(added).toBe("%% target: x1\n%% title: Titolo\nflowchart LR\nA-->B");
  });

  it("rimuove le attivazioni sequence in ultima istanza", () => {
    expect(
      simplifySequenceActivations(
        "sequenceDiagram\n  A->>+B: avvia\n  B-->>-A: risponde",
      ),
    ).toBe("sequenceDiagram\n  A->>B: avvia\n  B-->>A: risponde");
  });

  it("normalizza numeri e serie xychart", () => {
    expect(
      simplifyXYChartSeries(
        'xychart-beta\n  line [12_000, 14_500] "Visite"\n  bar [Vendite, 320, 380]',
      ),
    ).toBe("xychart-beta\n  line [12000, 14500]\n  bar [320, 380]");
    expect(
      simplifyXYChartSeries(
        "xychart-beta\n  bar [12.000, 14.500, 13.800]",
      ),
    ).toBe("xychart-beta\n  bar [12000, 14500, 13800]");
  });

  it("normalizza point e valori quadrant", () => {
    expect(
      simplifyQuadrantLabels(
        'quadrantChart\n  point "Fornitore B": [0.8, 1.0]\n  point "Fornitore A": [0.0, 0.9]',
      ),
    ).toBe("quadrantChart\n  Fornitore B: [0.8, 1]\n  Fornitore A: [0, 0.9]");
  });

  it("rimuove le virgolette dai punti quadrant", () => {
    expect(
      simplifyQuadrantLabels(
        'quadrantChart\n  "Fornitore B": [0.8, 1.0]\n  "Fornitore A": [0.1, 0.9]',
      ),
    ).toBe("quadrantChart\n  Fornitore B: [0.8, 1]\n  Fornitore A: [0.1, 0.9]");
  });

  it("ripulisce le serie xychart con etichette testuali", () => {
    expect(
      simplifyXYChartSeries(
        "xychart-beta\n  line [Ricavi, 120, 145]\n  bar [Costi, 90, 95]",
      ),
    ).toBe("xychart-beta\n  line [120, 145]\n  bar [90, 95]");
    expect(
      simplifyXYChartSeries('xychart-beta\n  line "Ricavi" 120, 145'),
    ).toBe("xychart-beta\n  line [120, 145]");
    expect(simplifyXYChartSeries("flowchart LR\nA-->B")).toBe(
      "flowchart LR\nA-->B",
    );
  });

  it("sostituisce solo il blocco richiesto e preserva il testo attorno", () => {
    const text = [
      "Prima",
      "```mermaid",
      "%% title: A",
      "flowchart LR",
      "  A --> B",
      "```",
      "In mezzo",
      "```mermaid",
      "%% title: B",
      "sequenceDiagram",
      "  X->>Y: hi",
      "```",
      "Dopo",
    ].join("\n");
    const replaced = replaceMermaidBlockSource(
      text,
      1,
      "%% title: B\nstateDiagram-v2\n[*] --> Uno",
    );
    expect(replaced).toContain("Prima");
    expect(replaced).toContain("In mezzo");
    expect(replaced).toContain("Dopo");
    expect(replaced).toContain("%% title: A\nflowchart LR");
    expect(replaced).toContain("%% title: B\nstateDiagram-v2");
    expect(replaced).not.toContain("sequenceDiagram");
  });
});
