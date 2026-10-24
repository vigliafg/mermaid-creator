import { describe, expect, it } from "vitest";
import { renderDiagram, sanitizeSvgForExport } from "../diagram";
import { customTheme, FONT_OPTIONS, resolveTheme } from "./theme";

describe("export standalone", () => {
  it("materializza le variabili Pele e conserva gli oggetti", async () => {
    const source = `flowchart LR
  A[Cliente] --> B[Ordine]
  B --> C[Spedizione]`;
    const rendered = await renderDiagram(source, { preset: "dark" }, "dark");
    const exported = sanitizeSvgForExport(rendered.svg, { preset: "dark" }, {
      background: true,
      mode: "dark",
    });
    expect(exported).toContain("pele-node");
    expect(exported).toContain('fill="#171d2a"');
    expect(exported).not.toContain("var(--_");
    expect(exported).toContain("data-mc-background");
    expect(exported.indexOf("data-mc-background")).toBeLessThan(
      exported.indexOf("pele-node"),
    );
  });

  it("non rompe l'attributo style con font che contengono virgolette", async () => {
    const rendered = await renderDiagram("flowchart LR\nA-->B", { preset: "dark" }, "dark");
    const mono = customTheme(resolveTheme({ preset: "dark" }, "dark"), {
      font: FONT_OPTIONS[3].id,
    });
    const exported = sanitizeSvgForExport(rendered.svg, mono, {
      background: true,
      mode: "dark",
    });
    expect(exported).not.toContain('--_fm:"');
    expect(exported).toContain("pele-node");
  });

  it("può esportare senza sfondo", async () => {
    const rendered = await renderDiagram("flowchart LR\nA-->B", { preset: "light" }, "light");
    const exported = sanitizeSvgForExport(rendered.svg, { preset: "light" }, {
      background: false,
      mode: "light",
    });
    expect(exported).not.toContain("data-mc-background");
    expect(exported).toContain("pele-node");
  });
});
