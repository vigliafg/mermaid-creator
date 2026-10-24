import { describe, expect, it } from "vitest";
import { resolveTheme } from "./theme";
import { effectiveStyle, resetKeys, withPatch } from "./styles";

describe("stili effettivi", () => {
  it("parte dai token e applica gli override", () => {
    const tokens = resolveTheme({ preset: "light" }, "light");
    const base = effectiveStyle(tokens, "node");
    expect(base.fill).toBe(tokens.surface);
    const changed = effectiveStyle(tokens, "node", { fill: "#ff0000", strokeWidth: 3 });
    expect(changed.fill).toBe("#ff0000");
    expect(changed.strokeWidth).toBe(3);
  });

  it("applica patch e reset", () => {
    const styles = withPatch({}, ["element:A", "edge:0"], { fill: "#ff0000" });
    expect(styles["element:A"].fill).toBe("#ff0000");
    expect(styles["edge:0"].fill).toBe("#ff0000");
    const reset = resetKeys(styles, ["element:A"]);
    expect(reset["element:A"]).toBeUndefined();
    expect(reset["edge:0"]).toBeDefined();
  });
});
