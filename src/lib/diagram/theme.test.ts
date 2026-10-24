import { describe, expect, it } from "vitest";
import {
  applyThemeToSvg,
  checkContrast,
  contrastRatio,
  parseColor,
  PRESET_OPTIONS,
  PRESETS,
  customTheme,
  parseThemeMap,
  resolveTheme,
  suggestTextColor,
  themeForId,
} from "./theme";

describe("tema diagramma", () => {
  it("risolve auto, preset e custom", () => {
    expect(resolveTheme({ preset: "auto" }, "dark").bg).toBe("#0b0e14");
    expect(resolveTheme({ preset: "auto" }, "light").bg).toBe("#ffffff");
    expect(resolveTheme({ preset: "contrast" }, "light").bg).toBe("#000000");
    const custom = customTheme(resolveTheme({ preset: "light" }, "light"), { bg: "#123456" });
    expect(resolveTheme(custom, "dark").bg).toBe("#123456");
  });

  it("tutti i preset hanno testo leggibile e serie complete", () => {
    for (const option of PRESET_OPTIONS) {
      if (option.id === "auto") continue;
      const tokens = PRESETS[option.id];
      expect(tokens, option.id).toBeDefined();
      expect(contrastRatio(tokens.fg, tokens.bg), option.id).toBeGreaterThanOrEqual(4.5);
      expect(tokens.series, option.id).toHaveLength(8);
      for (const color of tokens.series) expect(parseColor(color), `${option.id}:${color}`).not.toBeNull();
    }
  });

  it("calcola contrasto e suggerisce il testo", () => {
    expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21, 1);
    expect(contrastRatio("#ffffff", "#ffffff")).toBeCloseTo(1, 3);
    expect(contrastRatio("not-a-color", "#fff")).toBeNull();
    expect(suggestTextColor("#ffffff")).toBe("#000000");
    expect(suggestTextColor("#000000")).toBe("#ffffff");
    const report = checkContrast({ fill: "#ffffff", text: "#ffffff", stroke: "#ffffff", background: "#ffffff" });
    expect(report.warnings.length).toBe(3);
  });

  it("applica le variabili Pele e lo stile scoped", () => {
    const tokens = resolveTheme({ preset: "light" }, "light");
    const svg = applyThemeToSvg('<svg class="pele pele-flowchart"></svg>', tokens, "pele", {
      background: true,
    });
    expect(svg).toContain("--pele-bg:#ffffff");
    expect(svg).toContain('data-mc-themed="true"');
    expect(svg).toContain("data-mc-theme");
    expect(svg).toContain("data-mc-background");
  });

  it("legge la mappa tema per diagramma e tollera JSON rotto", () => {
    expect(themeForId({}, "a").preset).toBe("auto");
    expect(parseThemeMap("not json")).toEqual({});
    const map = parseThemeMap(JSON.stringify({ a: { preset: "dark" } }));
    expect(map.a.preset).toBe("dark");
  });
});
