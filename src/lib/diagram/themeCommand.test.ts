import { describe, expect, it } from "vitest";
import { resolveTheme } from "./theme";
import {
  applyThemeCommand,
  extractThemeCommand,
  parseThemeCommand,
  stripThemeCommands,
} from "./themeCommand";

describe("comandi tema AI", () => {
  it("legge un preset e una palette parziale", () => {
    expect(parseThemeCommand('{"preset":"contrast"}')).toEqual({ preset: "contrast" });
    expect(
      parseThemeCommand('{"preset":"custom","tokens":{"bg":"#000000","fg":"#ffee00"}}'),
    ).toMatchObject({ preset: "custom", tokens: { bg: "#000000", fg: "#ffee00" } });
  });

  it("accetta alias e scarta valori invalidi", () => {
    const command = parseThemeCommand(
      '{"tokens":{"background":"#112233","text":"#ffffff","surface_alt":"#223344","radius":"12px","series":["#000000","#111111","#222222","#333333","#444444","#555555","#666666","#777777"]}}',
    );
    expect(command?.tokens).toMatchObject({
      bg: "#112233",
      fg: "#ffffff",
      surfaceAlt: "#223344",
      radius: 12,
    });
    expect(parseThemeCommand('{"tokens":{"bg":"url(javascript:alert(1))"}}')).toBeNull();
    expect(parseThemeCommand("not json")).toBeNull();
  });

  it("mantiene i token correnti quando il comando è parziale", () => {
    const current = resolveTheme({ preset: "dark" }, "dark");
    const command = parseThemeCommand('{"tokens":{"bg":"#000000"}}');
    expect(command).not.toBeNull();
    const theme = applyThemeCommand(command!, current);
    expect(theme.preset).toBe("custom");
    expect(theme.tokens?.bg).toBe("#000000");
    expect(theme.tokens?.fg).toBe(current.fg);
    expect(theme.tokens?.surface).toBe(current.surface);
  });

  it("parte dal preset indicato quando c'è anche una patch", () => {
    const current = resolveTheme({ preset: "light" }, "light");
    const command = parseThemeCommand('{"preset":"contrast","tokens":{"accent":"#ff00ff"}}');
    const theme = applyThemeCommand(command!, current);
    expect(theme.preset).toBe("custom");
    expect(theme.tokens?.bg).toBe("#000000");
    expect(theme.tokens?.accent).toBe("#ff00ff");
  });

  it("estrae e rimuove il blocco mc-theme dal testo", () => {
    const content = `Ecco il diagramma.\n\n\`\`\`mc-theme\n{"preset":"ocean"}\n\`\`\`\n\nFatto.`;
    expect(extractThemeCommand(content)).toEqual({ preset: "ocean" });
    expect(stripThemeCommands(content)).toBe("Ecco il diagramma.\n\nFatto.");
  });
});
