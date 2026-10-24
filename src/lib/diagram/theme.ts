export type ThemeMode = "dark" | "light";

export const THEME_PRESET_IDS = [
  "auto",
  "light",
  "dark",
  "contrast",
  "colorblind",
  "neon",
  "blueprint",
  "sunset",
  "paper",
  "terminal",
  "candy",
  "mono",
  "ocean",
  "custom",
] as const;

export type PresetId = (typeof THEME_PRESET_IDS)[number];

export function isPresetId(value: unknown): value is PresetId {
  return typeof value === "string" && (THEME_PRESET_IDS as readonly string[]).includes(value);
}

export interface DiagramTokens {
  bg: string;
  fg: string;
  muted: string;
  line: string;
  surface: string;
  surfaceAlt: string;
  border: string;
  accent: string;
  font: string;
  fontSize: number;
  strokeWidth: number;
  dash: string | null;
  radius: number;
  series: string[];
}

export interface DiagramTheme {
  preset: PresetId;
  tokens?: Partial<DiagramTokens>;
}

export const FONT_OPTIONS = [
  { id: "Inter, ui-sans-serif, system-ui, -apple-system, sans-serif", label: "Inter / sistema" },
  { id: 'Georgia, "Times New Roman", serif', label: "Georgia / serif" },
  { id: 'Arial, "Helvetica Neue", sans-serif', label: "Arial" },
  { id: '"JetBrains Mono", "SFMono-Regular", Consolas, monospace', label: "Monospace" },
] as const;

const OKABE_ITO = ["#0072b2", "#e69f00", "#009e73", "#d55e00", "#cc79a7", "#56b4e9", "#f0e442", "#000000"];

const LIGHT: DiagramTokens = {
  bg: "#ffffff",
  fg: "#1a2233",
  muted: "#64718a",
  line: "#8d99ad",
  surface: "#f7f8fc",
  surfaceAlt: "#eef2fa",
  border: "#d8dfec",
  accent: "#4767e8",
  font: "Inter, ui-sans-serif, system-ui, -apple-system, sans-serif",
  fontSize: 14,
  strokeWidth: 1.5,
  dash: null,
  radius: 8,
  series: ["#4767e8", "#15966a", "#a86b00", "#d64258", "#6b5bd2", "#0f8b8d", "#b0528c", "#4f5d75"],
};

const DARK: DiagramTokens = {
  bg: "#0b0e14",
  fg: "#e8ecf5",
  muted: "#8995ae",
  line: "#61708f",
  surface: "#171d2a",
  surfaceAlt: "#1f2737",
  border: "#33405a",
  accent: "#8ba4ff",
  font: "Inter, ui-sans-serif, system-ui, -apple-system, sans-serif",
  fontSize: 14,
  strokeWidth: 1.5,
  dash: null,
  radius: 8,
  series: ["#8ba4ff", "#54d6a0", "#f1c36b", "#ff7d8d", "#c3a6ff", "#62d4d9", "#f08fc0", "#a9b6cc"],
};

const CONTRAST: DiagramTokens = {
  bg: "#000000",
  fg: "#ffffff",
  muted: "#d8d8d8",
  line: "#ffffff",
  surface: "#101010",
  surfaceAlt: "#1c1c1c",
  border: "#ffffff",
  accent: "#ffff00",
  font: "Arial, \"Helvetica Neue\", sans-serif",
  fontSize: 15,
  strokeWidth: 2,
  dash: null,
  radius: 4,
  series: ["#ffff00", "#00ffff", "#ff00ff", "#00ff00", "#ff8800", "#ffffff", "#88aaff", "#ff5555"],
};

const COLORBLIND: DiagramTokens = {
  bg: "#fbfbf7",
  fg: "#1a1a1a",
  muted: "#5f5f5f",
  line: "#444444",
  surface: "#ffffff",
  surfaceAlt: "#eef0f4",
  border: "#9aa0aa",
  accent: "#0072b2",
  font: "Inter, ui-sans-serif, system-ui, -apple-system, sans-serif",
  fontSize: 14,
  strokeWidth: 1.8,
  dash: null,
  radius: 6,
  series: OKABE_ITO,
};

const NEON: DiagramTokens = {
  bg: "#05060a",
  fg: "#f4f7ff",
  muted: "#a9b4d0",
  line: "#00e5ff",
  surface: "#101526",
  surfaceAlt: "#171f36",
  border: "#00e5ff",
  accent: "#ff2bd6",
  font: "Inter, ui-sans-serif, system-ui, -apple-system, sans-serif",
  fontSize: 14,
  strokeWidth: 1.8,
  dash: null,
  radius: 10,
  series: ["#00e5ff", "#ff2bd6", "#b6ff00", "#ffb000", "#7c5cff", "#00ffa3", "#ff5c7a", "#ffffff"],
};

const BLUEPRINT: DiagramTokens = {
  bg: "#0b2a4a",
  fg: "#eaf6ff",
  muted: "#9fc4e0",
  line: "#7fd8ff",
  surface: "#123a60",
  surfaceAlt: "#17466f",
  border: "#7fd8ff",
  accent: "#ffd166",
  font: '"JetBrains Mono", "SFMono-Regular", Consolas, monospace',
  fontSize: 13,
  strokeWidth: 1.3,
  dash: null,
  radius: 4,
  series: ["#7fd8ff", "#ffd166", "#9be564", "#ff8fab", "#c7a4ff", "#66e0d0", "#ffa94d", "#ffffff"],
};

const SUNSET: DiagramTokens = {
  bg: "#1b1020",
  fg: "#fff4ec",
  muted: "#d3b6c7",
  line: "#ff8a5c",
  surface: "#2a1830",
  surfaceAlt: "#38203f",
  border: "#ff8a5c",
  accent: "#ffd166",
  font: "Inter, ui-sans-serif, system-ui, -apple-system, sans-serif",
  fontSize: 14,
  strokeWidth: 1.8,
  dash: null,
  radius: 12,
  series: ["#ff8a5c", "#ffd166", "#ff5c8a", "#7bdff2", "#c77dff", "#ffb4a2", "#f9c74f", "#ffffff"],
};

const PAPER: DiagramTokens = {
  bg: "#fbf4e6",
  fg: "#2a2118",
  muted: "#6b5a45",
  line: "#8a6a4a",
  surface: "#fffaf0",
  surfaceAlt: "#f2e8d5",
  border: "#c9b79c",
  accent: "#b23a2b",
  font: 'Georgia, "Times New Roman", serif',
  fontSize: 14,
  strokeWidth: 1.4,
  dash: null,
  radius: 4,
  series: ["#b23a2b", "#3c6e71", "#d08c60", "#5f6f52", "#7d4e57", "#2f4858", "#b08968", "#1d1a16"],
};

const TERMINAL: DiagramTokens = {
  bg: "#000000",
  fg: "#c8ffd0",
  muted: "#6fbf7a",
  line: "#38ff62",
  surface: "#06120a",
  surfaceAlt: "#0b1f11",
  border: "#38ff62",
  accent: "#b6ff00",
  font: '"JetBrains Mono", "SFMono-Regular", Consolas, monospace',
  fontSize: 13,
  strokeWidth: 1.2,
  dash: null,
  radius: 0,
  series: ["#38ff62", "#b6ff00", "#00e5ff", "#ffcc00", "#ff5c7a", "#9dffb0", "#ffffff", "#7fbf7f"],
};

const CANDY: DiagramTokens = {
  bg: "#fdf3ff",
  fg: "#2a0a3a",
  muted: "#7a4b8a",
  line: "#a855f7",
  surface: "#ffffff",
  surfaceAlt: "#f3e8ff",
  border: "#d8b4fe",
  accent: "#ec4899",
  font: "Inter, ui-sans-serif, system-ui, -apple-system, sans-serif",
  fontSize: 14,
  strokeWidth: 1.6,
  dash: null,
  radius: 14,
  series: ["#ec4899", "#a855f7", "#22d3ee", "#84cc16", "#f59e0b", "#ef4444", "#6366f1", "#14b8a6"],
};

const MONO: DiagramTokens = {
  bg: "#ffffff",
  fg: "#000000",
  muted: "#4a4a4a",
  line: "#000000",
  surface: "#f5f5f5",
  surfaceAlt: "#e8e8e8",
  border: "#000000",
  accent: "#000000",
  font: 'Arial, "Helvetica Neue", sans-serif',
  fontSize: 14,
  strokeWidth: 2,
  dash: null,
  radius: 0,
  series: ["#000000", "#333333", "#555555", "#777777", "#999999", "#bbbbbb", "#dddddd", "#ffffff"],
};

const OCEAN: DiagramTokens = {
  bg: "#041b2d",
  fg: "#e6fbff",
  muted: "#8fc7d8",
  line: "#35d0ba",
  surface: "#082c42",
  surfaceAlt: "#0d3a54",
  border: "#35d0ba",
  accent: "#ffd166",
  font: "Inter, ui-sans-serif, system-ui, -apple-system, sans-serif",
  fontSize: 14,
  strokeWidth: 1.6,
  dash: null,
  radius: 8,
  series: ["#35d0ba", "#ffd166", "#7bdff2", "#ff8fab", "#9b5de5", "#00bbf9", "#f15bb5", "#ffffff"],
};

export const PRESETS: Record<Exclude<PresetId, "auto" | "custom">, DiagramTokens> = {
  light: LIGHT,
  dark: DARK,
  contrast: CONTRAST,
  colorblind: COLORBLIND,
  neon: NEON,
  blueprint: BLUEPRINT,
  sunset: SUNSET,
  paper: PAPER,
  terminal: TERMINAL,
  candy: CANDY,
  mono: MONO,
  ocean: OCEAN,
};

export const PRESET_OPTIONS: Array<{
  id: Exclude<PresetId, "custom">;
  label: string;
  hint: string;
}> = [
  { id: "auto", label: "Auto", hint: "Segue il tema dell'app" },
  { id: "light", label: "Chiaro", hint: "Fondo bianco, inchiostro scuro" },
  { id: "dark", label: "Scuro", hint: "Fondo notte, testo chiaro" },
  { id: "contrast", label: "Contrasto", hint: "Nero/giallo, massima leggibilità" },
  { id: "colorblind", label: "Daltonici", hint: "Palette Okabe-Ito" },
  { id: "neon", label: "Neon", hint: "Nero, ciano e magenta ad alto impatto" },
  { id: "blueprint", label: "Blueprint", hint: "Blu tecnico, linee ciano, mono" },
  { id: "sunset", label: "Sunset", hint: "Prugna calda, corallo e ambra" },
  { id: "paper", label: "Carta", hint: "Crema, inchiostro bruno, serif" },
  { id: "terminal", label: "Terminal", hint: "Nero, verde fosforo, mono" },
  { id: "candy", label: "Candy", hint: "Lilla chiaro, rosa e viola vividi" },
  { id: "mono", label: "Mono", hint: "Bianco/nero, stampa e contrasto" },
  { id: "ocean", label: "Oceano", hint: "Blu profondo, teal e oro" },
];

export function defaultTheme(): DiagramTheme {
  return { preset: "auto" };
}

export function baseTokens(mode: ThemeMode): DiagramTokens {
  return mode === "light" ? LIGHT : DARK;
}

function clone(tokens: DiagramTokens): DiagramTokens {
  return { ...tokens, series: [...tokens.series] };
}

export function resolveTheme(theme: DiagramTheme | undefined, mode: ThemeMode): DiagramTokens {
  if (!theme || theme.preset === "auto") return clone(baseTokens(mode));
  if (theme.preset === "custom") {
    const base = baseTokens(mode);
    const series = Array.isArray(theme.tokens?.series) ? theme.tokens.series : base.series;
    return { ...clone(base), ...(theme.tokens ?? {}), series };
  }
  const preset = PRESETS[theme.preset];
  return clone(preset ?? baseTokens(mode));
}

export function customTheme(tokens: DiagramTokens, patch: Partial<DiagramTokens> = {}): DiagramTheme {
  return { preset: "custom", tokens: { ...tokens, ...patch } };
}

export function themeLabel(theme: DiagramTheme): string {
  if (theme.preset === "custom") return "Personalizzato";
  return PRESET_OPTIONS.find((option) => option.id === theme.preset)?.label ?? "Auto";
}

export function parseThemeMap(raw: string | undefined): Record<string, DiagramTheme> {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    const out: Record<string, DiagramTheme> = {};
    for (const [id, value] of Object.entries(parsed as Record<string, unknown>)) {
      if (!value || typeof value !== "object") continue;
      const candidate = value as { preset?: unknown; tokens?: unknown };
      const preset = typeof candidate.preset === "string" ? candidate.preset : "auto";
      if (!isPresetId(preset)) continue;
      out[id] = {
        preset,
        tokens:
          candidate.tokens && typeof candidate.tokens === "object"
            ? (candidate.tokens as Partial<DiagramTokens>)
            : undefined,
      };
    }
    return out;
  } catch {
    return {};
  }
}

export function themeForId(
  settings: Record<string, string>,
  id: string | null | undefined,
): DiagramTheme {
  if (!id) return defaultTheme();
  return parseThemeMap(settings.diagram_themes)[id] ?? defaultTheme();
}

/* ------------------------------------------------------------------ */
/* Colori, contrasto                                                   */
/* ------------------------------------------------------------------ */

export interface Rgb {
  r: number;
  g: number;
  b: number;
}

export function parseColor(value: string | undefined | null): Rgb | null {
  if (!value) return null;
  const raw = value.trim().toLowerCase();
  const named: Record<string, string> = {
    black: "#000000",
    white: "#ffffff",
    red: "#ff0000",
    green: "#008000",
    blue: "#0000ff",
    yellow: "#ffff00",
    gray: "#808080",
    grey: "#808080",
    transparent: "",
  };
  const normalized = named[raw] ?? raw;
  if (!normalized) return null;
  if (/^#[0-9a-f]{3}$/.test(normalized)) {
    return {
      r: parseInt(normalized[1] + normalized[1], 16),
      g: parseInt(normalized[2] + normalized[2], 16),
      b: parseInt(normalized[3] + normalized[3], 16),
    };
  }
  if (/^#[0-9a-f]{6}$/.test(normalized)) {
    return {
      r: parseInt(normalized.slice(1, 3), 16),
      g: parseInt(normalized.slice(3, 5), 16),
      b: parseInt(normalized.slice(5, 7), 16),
    };
  }
  const rgb = normalized.match(/^rgba?\(\s*(\d{1,3})\s*[,\s]\s*(\d{1,3})\s*[,\s]\s*(\d{1,3})/);
  if (rgb) {
    return {
      r: Math.min(255, Number(rgb[1])),
      g: Math.min(255, Number(rgb[2])),
      b: Math.min(255, Number(rgb[3])),
    };
  }
  return null;
}

function channel(value: number): number {
  const c = value / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

export function relativeLuminance(color: Rgb): number {
  return 0.2126 * channel(color.r) + 0.7152 * channel(color.g) + 0.0722 * channel(color.b);
}

export function contrastRatio(a: string, b: string): number | null {
  const ca = parseColor(a);
  const cb = parseColor(b);
  if (!ca || !cb) return null;
  const la = relativeLuminance(ca);
  const lb = relativeLuminance(cb);
  const light = Math.max(la, lb);
  const dark = Math.min(la, lb);
  return (light + 0.05) / (dark + 0.05);
}

export function suggestTextColor(background: string): "#000000" | "#ffffff" {
  const color = parseColor(background);
  if (!color) return "#ffffff";
  return relativeLuminance(color) > 0.42 ? "#000000" : "#ffffff";
}

export interface ContrastReport {
  text: number | null;
  border: number | null;
  fillBg: number | null;
  warnings: string[];
}

export function checkContrast(input: {
  fill?: string;
  text?: string;
  stroke?: string;
  background: string;
}): ContrastReport {
  const text = input.fill && input.text ? contrastRatio(input.fill, input.text) : null;
  const border = input.fill && input.stroke ? contrastRatio(input.fill, input.stroke) : null;
  const fillBg = input.fill ? contrastRatio(input.fill, input.background) : null;
  const warnings: string[] = [];
  if (text !== null && text < 4.5) {
    warnings.push(`Testo poco leggibile (${text.toFixed(1)}:1, serve 4.5:1)`);
  }
  if (border !== null && border < 1.2) {
    warnings.push(`Bordo quasi invisibile sul riempimento (${border.toFixed(1)}:1)`);
  }
  const borderBg = input.stroke ? contrastRatio(input.stroke, input.background) : null;
  if (fillBg !== null && fillBg < 1.2 && (borderBg === null || borderBg < 1.2)) {
    warnings.push("Il box si confonde con lo sfondo del diagramma");
  }
  return { text, border, fillBg, warnings };
}

export function contrastLabel(ratio: number | null): string {
  if (ratio === null) return "n/d";
  return `${ratio.toFixed(1)}:1`;
}

/* ------------------------------------------------------------------ */
/* Mapping verso i renderer                                            */
/* ------------------------------------------------------------------ */

export function safeCssColor(value: string | undefined, fallback: string): string {
  if (!value) return fallback;
  if (/^#[0-9a-fA-F]{3,8}$/.test(value) || /^rgba?\([^)]*\)$/.test(value)) {
    if (/url\s*\(|expression\s*\(|javascript:/i.test(value)) return fallback;
    return value;
  }
  return fallback;
}

export function safeFont(value: string | undefined): string {
  const found = FONT_OPTIONS.find((option) => option.id === value || option.label === value);
  return found?.id ?? FONT_OPTIONS[0].id;
}

export function peleCssVars(tokens: DiagramTokens): string {
  const vars: Array<[string, string]> = [
    ["--pele-bg", safeCssColor(tokens.bg, LIGHT.bg)],
    ["--pele-fg", safeCssColor(tokens.fg, LIGHT.fg)],
    ["--pele-muted", safeCssColor(tokens.muted, LIGHT.muted)],
    ["--pele-line", safeCssColor(tokens.line, LIGHT.line)],
    ["--pele-surface", safeCssColor(tokens.surface, LIGHT.surface)],
    ["--pele-surface-alt", safeCssColor(tokens.surfaceAlt, LIGHT.surfaceAlt)],
    ["--pele-border", safeCssColor(tokens.border, LIGHT.border)],
    ["--pele-accent", safeCssColor(tokens.accent, LIGHT.accent)],
    ["--pele-font", safeFont(tokens.font)],
    ["--pele-radius", `${Math.max(0, Math.min(40, tokens.radius || 0))}px`],
  ];
  tokens.series.slice(0, 8).forEach((color, index) => {
    vars.push([`--pele-series-${index + 1}`, safeCssColor(color, LIGHT.series[index] ?? LIGHT.accent)]);
  });
  return vars.map(([key, value]) => `${key}:${value}`).join(";");
}

export function mermaidThemeVariables(tokens: DiagramTokens): Record<string, string> {
  const fg = safeCssColor(tokens.fg, LIGHT.fg);
  const bg = safeCssColor(tokens.bg, LIGHT.bg);
  const surface = safeCssColor(tokens.surface, LIGHT.surface);
  const surfaceAlt = safeCssColor(tokens.surfaceAlt, LIGHT.surfaceAlt);
  const border = safeCssColor(tokens.border, LIGHT.border);
  const line = safeCssColor(tokens.line, LIGHT.line);
  const variables: Record<string, string> = {
    background: bg,
    primaryColor: surface,
    primaryTextColor: fg,
    primaryBorderColor: border,
    secondaryColor: surfaceAlt,
    secondaryTextColor: fg,
    secondaryBorderColor: border,
    tertiaryColor: surfaceAlt,
    tertiaryTextColor: fg,
    tertiaryBorderColor: border,
    lineColor: line,
    textColor: fg,
    mainBkg: surface,
    nodeBorder: border,
    nodeTextColor: fg,
    clusterBkg: surfaceAlt,
    clusterBorder: border,
    titleColor: fg,
    edgeLabelBackground: bg,
    fontFamily: safeFont(tokens.font),
    fontSize: `${Math.max(8, Math.min(28, tokens.fontSize || 14))}px`,
    nodeText: fg,
  };
  tokens.series.slice(0, 8).forEach((color, index) => {
    variables[`pie${index + 1}`] = safeCssColor(color, LIGHT.series[index] ?? LIGHT.accent);
    variables[`git${index}`] = safeCssColor(color, LIGHT.series[index] ?? LIGHT.accent);
  });
  return variables;
}

/**
 * CSS scoped che applica i default geometrici. Deliberatamente senza
 * !important: gli stili per elemento (inline) devono sempre vincere.
 */
export function scopedThemeCss(
  tokens: DiagramTokens,
  renderer: "pele" | "mermaid",
  svgId: string,
): string {
  const width = Math.max(0, Math.min(12, tokens.strokeWidth || 0));
  const dash = tokens.dash && /^[0-9.\s]+$/.test(tokens.dash) ? tokens.dash.trim() : "";
  const radius = Math.max(0, Math.min(48, tokens.radius || 0));
  const fontSize = Math.max(8, Math.min(32, tokens.fontSize || 0));
  const scope = renderer === "pele" ? "svg[data-mc-themed].pele" : `#${svgId.replace(/[^A-Za-z0-9_-]/g, "_")}`;
  const rules: string[] = [];
  const shapeSelector =
    renderer === "pele"
      ? `${scope} .pele-node rect, ${scope} .pele-node circle, ${scope} .pele-node ellipse, ${scope} .pele-node polygon, ${scope} .pele-node path`
      : `${scope} .node rect, ${scope} .node circle, ${scope} .node ellipse, ${scope} .node polygon, ${scope} .node path`;
  const clusterSelector = renderer === "pele" ? `${scope} .pele-cluster rect` : `${scope} .cluster rect`;
  const edgeSelector = renderer === "pele" ? `${scope} .pele-edge path` : `${scope} .flowchart-link, ${scope} .transition`;
  const labelSelector = renderer === "pele" ? `${scope} .pele-label` : `${scope} .label text, ${scope} .nodeLabel`;

  const geometry: string[] = [];
  if (width > 0) geometry.push(`stroke-width:${width}px`);
  if (dash) geometry.push(`stroke-dasharray:${dash}`);
  if (radius > 0) geometry.push(`rx:${radius}px`, `ry:${radius}px`);
  if (geometry.length) {
    rules.push(`${shapeSelector}{${geometry.join(";")}}`);
    rules.push(`${clusterSelector}{${geometry.filter((item) => !item.startsWith("rx") && !item.startsWith("ry")).join(";")}}`);
    rules.push(`${edgeSelector}{${geometry.filter((item) => !item.startsWith("rx") && !item.startsWith("ry")).join(";")}}`);
  }
  if (fontSize > 0) rules.push(`${labelSelector}{font-size:${fontSize}px}`);
  return rules.join("\n");
}

function rootSvgId(svg: string): string | null {
  const match = svg.match(/<svg[^>]*\sid="([^"]+)"/i);
  return match ? match[1] : null;
}

function injectRootAttribute(svg: string, attribute: string): string {
  const end = svg.indexOf(">");
  const opening = end >= 0 ? svg.slice(0, end + 1) : svg;
  if (opening.includes(attribute.split("=")[0])) return svg;
  return svg.replace(/<svg\b/i, `<svg ${attribute}`);
}

function backgroundRect(svg: string, color: string): string {
  const viewBox = svg.match(/viewBox="([^"]+)"/i);
  if (viewBox) {
    const parts = viewBox[1].trim().split(/[\s,]+/).map(Number);
    if (parts.length === 4 && parts.every((value) => Number.isFinite(value))) {
      const [x, y, width, height] = parts;
      return `<rect data-mc-background="1" x="${x}" y="${y}" width="${width}" height="${height}" fill="${color}" stroke="none"/>`;
    }
  }
  const width = svg.match(/\swidth="(\d+(?:\.\d+)?)"/i);
  const height = svg.match(/\sheight="(\d+(?:\.\d+)?)"/i);
  if (width && height) {
    return `<rect data-mc-background="1" x="0" y="0" width="${width[1]}" height="${height[1]}" fill="${color}" stroke="none"/>`;
  }
  return `<rect data-mc-background="1" x="0" y="0" width="100%" height="100%" fill="${color}" stroke="none"/>`;
}

export function applyThemeToSvg(
  svg: string,
  tokens: DiagramTokens,
  renderer: "pele" | "mermaid",
  options: { background?: boolean } = {},
): string {
  let out = svg
    .replace(/<style\b[^>]*data-mc-theme="1"[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<rect\b[^>]*data-mc-background="1"[^>]*\/>/gi, "");
  out = injectRootAttribute(out, `data-mc-themed="true"`);
  const id = rootSvgId(out) ?? `mc-theme-${renderer === "pele" ? "pele" : "mermaid"}`;
  if (!rootSvgId(out)) out = out.replace(/<svg\b/i, `<svg id="${id}"`);

  const vars =
    renderer === "pele"
      ? `svg[data-mc-themed].pele{${peleCssVars(tokens)}}`
      : "";
  const css = `${vars}\n${scopedThemeCss(tokens, renderer, id)}`;
  const style = `<style data-mc-theme="1">${css}</style>`;
  const close = out.lastIndexOf("</svg>");
  out = close >= 0 ? `${out.slice(0, close)}${style}${out.slice(close)}` : `${out}${style}`;

  if (options.background) {
    const rect = backgroundRect(out, safeCssColor(tokens.bg, "#ffffff"));
    if (rect) out = out.replace(/(<svg\b[^>]*>)/i, `$1${rect}`);
  }
  return out;
}

const MONO_FONT = "'JetBrains Mono', 'SFMono-Regular', Consolas, monospace";

/**
 * Rende l'SVG standalone: sostituisce le var() di Pele con i valori concreti.
 * Senza questo passaggio alcuni viewer/convertitori esterni non applicano il
 * blocco <style> e mostrano solo lo sfondo, perché gli oggetti hanno
 * fill/stroke="var(--_...)".
 */
export function flattenThemeVariables(svg: string, tokens: DiagramTokens): string {
  const map: Record<string, string> = {
    "--_bg": safeCssColor(tokens.bg, LIGHT.bg),
    "--_fg": safeCssColor(tokens.fg, LIGHT.fg),
    "--_m": safeCssColor(tokens.muted, LIGHT.muted),
    "--_l": safeCssColor(tokens.line, LIGHT.line),
    "--_s": safeCssColor(tokens.surface, LIGHT.surface),
    "--_a": safeCssColor(tokens.surfaceAlt, LIGHT.surfaceAlt),
    "--_b": safeCssColor(tokens.border, LIGHT.border),
    "--_c": safeCssColor(tokens.accent, LIGHT.accent),
    "--_r": `${Math.max(0, Math.min(40, tokens.radius || 0))}px`,
    "--_fm": MONO_FONT,
    "--_tw": "bold",
    "--_hw": "bold",
    "--_w": "bold",
    "--pele-bg": safeCssColor(tokens.bg, LIGHT.bg),
    "--pele-fg": safeCssColor(tokens.fg, LIGHT.fg),
    "--pele-muted": safeCssColor(tokens.muted, LIGHT.muted),
    "--pele-line": safeCssColor(tokens.line, LIGHT.line),
    "--pele-surface": safeCssColor(tokens.surface, LIGHT.surface),
    "--pele-surface-alt": safeCssColor(tokens.surfaceAlt, LIGHT.surfaceAlt),
    "--pele-border": safeCssColor(tokens.border, LIGHT.border),
    "--pele-accent": safeCssColor(tokens.accent, LIGHT.accent),
    "--pele-critical": safeCssColor(tokens.accent, LIGHT.accent),
    "--pele-radius": `${Math.max(0, Math.min(40, tokens.radius || 0))}px`,
    "--pele-font": safeFont(tokens.font).replace(/"/g, "'"),
    "--pele-font-mono": MONO_FONT,
    "--pele-title-weight": "bold",
    "--pele-heading-weight": "bold",
  };
  tokens.series.slice(0, 8).forEach((color, index) => {
    map[`--pele-series-${index + 1}`] = safeCssColor(color, LIGHT.series[index] ?? LIGHT.accent);
  });

  let out = svg;
  for (let pass = 0; pass < 6; pass += 1) {
    let changed = false;
    out = out.replace(
      /var\(\s*(--[A-Za-z0-9_-]+)\s*(?:,\s*([^()]*))?\)/g,
      (match, name: string, fallback: string | undefined) => {
        const value = map[name];
        if (value !== undefined) {
          changed = true;
          return value;
        }
        if (fallback !== undefined && !fallback.includes("var(")) {
          changed = true;
          return fallback.trim();
        }
        return match;
      },
    );
    if (!changed) break;
  }
  return out;
}

export function detectRenderer(svg: string): "pele" | "mermaid" {
  return /class="[^"]*\bpele\b/.test(svg) ? "pele" : "mermaid";
}
