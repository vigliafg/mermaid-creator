import { describe, expect, it } from "vitest";
import { resolveTheme } from "./theme";
import {
  applyThemeCommand,
  extractThemeCommand,
  hasThemeCommandFence,
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

  it("accetta il formato YAML-like usato da alcuni modelli", () => {
    expect(parseThemeCommand("preset: contrast")).toEqual({ preset: "contrast" });
    expect(parseThemeCommand("preset = ocean\nbg: #041b2d")).toMatchObject({
      preset: "ocean",
      tokens: { bg: "#041b2d" },
    });
    expect(parseThemeCommand("contrast")).toEqual({ preset: "contrast" });
    expect(extractThemeCommand("```mc-theme\npreset: contrast\n```")).toEqual({
      preset: "contrast",
    });
  });

  it("normalizza i nomi dei temi Mermaid e gli alias italiani", () => {
    expect(parseThemeCommand('{"preset":"default"}')).toEqual({ preset: "light" });
    expect(parseThemeCommand('{"preset":"neutral"}')).toEqual({ preset: "mono" });
    expect(parseThemeCommand('{"preset":"contrasto"}')).toEqual({ preset: "contrast" });
    expect(parseThemeCommand('{"preset":"forest"}')).toBeNull();
  });

  it("non lascia che la palette corrente sovrascriva un nuovo preset", () => {
    const current = resolveTheme({ preset: "ocean" }, "dark");
    const command = parseThemeCommand(
      `{"preset":"contrast","tokens":${JSON.stringify(current)}}`,
    );
    expect(command).not.toBeNull();
    const theme = applyThemeCommand(command!, current);
    expect(theme).toEqual({ preset: "contrast" });
  });

  it("mantiene i token davvero diversi quando c'è anche un preset", () => {
    const current = resolveTheme({ preset: "ocean" }, "dark");
    const theme = applyThemeCommand(
      { preset: "contrast", tokens: { bg: current.bg, accent: "#ff00ff" } },
      current,
    );
    expect(theme.preset).toBe("custom");
    expect(theme.tokens?.bg).toBe(resolveTheme({ preset: "contrast" }, "dark").bg);
    expect(theme.tokens?.accent).toBe("#ff00ff");
  });

  it("riconosce la presenza di un fence anche quando il contenuto è invalido", () => {
    expect(hasThemeCommandFence('```mc-theme\nnon un tema\n```')).toBe(true);
    expect(hasThemeCommandFence("nessun blocco")).toBe(false);
  });
});
