import { describe, expect, it } from "vitest";
import {
  conversionQualityMessage,
  conversionStatsLabel,
  themeConvertedElements,
} from "./conversion";
import { resolveTheme } from "../diagram/theme";

const tokens = resolveTheme({ preset: "ocean" }, "dark");

describe("conversion helpers", () => {
  it("riallinea solo i colori di default del fork", () => {
    const themed = themeConvertedElements(
      [
        { type: "rectangle", strokeColor: "#1e1e1e", backgroundColor: "transparent" },
        { type: "text", strokeColor: "#1e1e1e", backgroundColor: "transparent" },
        { type: "arrow", strokeColor: "#000000", backgroundColor: "transparent" },
        { type: "rectangle", strokeColor: "#ff0000", backgroundColor: "#ff0000" },
      ],
      tokens,
    );
    expect(themed[0]).toMatchObject({
      strokeColor: tokens.line,
      backgroundColor: tokens.surface,
    });
    expect(themed[1]).toMatchObject({
      strokeColor: tokens.fg,
      backgroundColor: "transparent",
    });
    expect(themed[2]).toMatchObject({
      strokeColor: tokens.line,
      backgroundColor: "transparent",
    });
    expect(themed[3]).toMatchObject({
      strokeColor: "#ff0000",
      backgroundColor: "#ff0000",
    });
  });

  it("spiega le qualità non semantiche", () => {
    expect(conversionQualityMessage("semantic", "flowchart")).toBeNull();
    expect(conversionQualityMessage("generic", "pie")).toContain("generica");
    expect(conversionQualityMessage("image", "sankey")).toContain("immagine");
    expect(conversionStatsLabel({ elements: 3, files: 1, type: "x", quality: "semantic" })).toBe(
      "3 elementi · 1 immagini",
    );
  });
});
