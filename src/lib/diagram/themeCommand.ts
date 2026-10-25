import {
  FONT_OPTIONS,
  isPresetId,
  parseColor,
  PRESETS,
  type DiagramTheme,
  type DiagramTokens,
  type PresetId,
} from "./theme";

export interface ThemeCommand {
  preset?: PresetId;
  tokens?: Partial<DiagramTokens>;
}

const COLOR_KEYS = [
  "bg",
  "fg",
  "muted",
  "line",
  "surface",
  "surfaceAlt",
  "border",
  "accent",
] as const;

const COLOR_ALIASES: Record<string, (typeof COLOR_KEYS)[number]> = {
  background: "bg",
  canvas: "bg",
  foreground: "fg",
  text: "fg",
  textcolor: "fg",
  surface_alt: "surfaceAlt",
  "surface-alt": "surfaceAlt",
  surfacealt: "surfaceAlt",
  bordercolor: "border",
  linecolor: "line",
};

// I modelli conoscono spesso i nomi dei temi Mermaid (default, forest,
// neutral…) oppure traducono il nome del preset. Li normalizziamo sui preset
// dell'app invece di scartare il comando in silenzio.
const PRESET_ALIASES: Record<string, PresetId> = {
  default: "light",
  base: "light",
  chiaro: "light",
  scuro: "dark",
  night: "dark",
  notte: "dark",
  contrasto: "contrast",
  "high-contrast": "contrast",
  highcontrast: "contrast",
  daltonici: "colorblind",
  "color-blind": "colorblind",
  neutro: "mono",
  neutral: "mono",
  monochrome: "mono",
  monocromatico: "mono",
  tramonto: "sunset",
  carta: "paper",
  oceano: "ocean",
  personalizzato: "custom",
};

function normalizePreset(value: unknown): PresetId | undefined {
  if (typeof value !== "string") return undefined;
  const clean = value
    .trim()
    .toLowerCase()
    .replace(/^["'`]|["'`]$/g, "");
  if (!clean) return undefined;
  if (isPresetId(clean)) return clean;
  return PRESET_ALIASES[clean];
}

function color(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  if (!parseColor(trimmed)) return undefined;
  return trimmed;
}

function number(value: unknown): number | undefined {
  const parsed =
    typeof value === "number" ? value : typeof value === "string" ? Number.parseFloat(value) : NaN;
  return Number.isFinite(parsed) ? parsed : undefined;
}

function font(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const normalized = value.trim().toLowerCase();
  const found = FONT_OPTIONS.find(
    (option) =>
      option.id.toLowerCase() === normalized || option.label.toLowerCase() === normalized,
  );
  if (found) return found.id;
  const aliases: Record<string, string> = {
    inter: FONT_OPTIONS[0].id,
    system: FONT_OPTIONS[0].id,
    georgia: FONT_OPTIONS[1].id,
    serif: FONT_OPTIONS[1].id,
    arial: FONT_OPTIONS[2].id,
    sans: FONT_OPTIONS[2].id,
    mono: FONT_OPTIONS[3].id,
    monospace: FONT_OPTIONS[3].id,
  };
  return aliases[normalized];
}

function normalizeTokens(raw: unknown): Partial<DiagramTokens> | undefined {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return undefined;
  const source = raw as Record<string, unknown>;
  const tokens: Partial<DiagramTokens> = {};
  for (const [rawKey, value] of Object.entries(source)) {
    const key = rawKey.trim();
    const alias = COLOR_ALIASES[key.toLowerCase()];
    const colorKey = alias ?? (COLOR_KEYS.includes(key as (typeof COLOR_KEYS)[number]) ? key : null);
    if (colorKey) {
      const parsed = color(value);
      if (parsed) tokens[colorKey] = parsed;
      continue;
    }
    if (key === "font") {
      const parsed = font(value);
      if (parsed) tokens.font = parsed;
      continue;
    }
    if (key === "fontSize" || key === "font-size" || key === "font_size") {
      const parsed = number(value);
      if (parsed !== undefined) tokens.fontSize = Math.min(32, Math.max(8, parsed));
      continue;
    }
    if (key === "strokeWidth" || key === "stroke-width" || key === "stroke_width") {
      const parsed = number(value);
      if (parsed !== undefined) tokens.strokeWidth = Math.min(12, Math.max(0, parsed));
      continue;
    }
    if (key === "radius") {
      const parsed = number(value);
      if (parsed !== undefined) tokens.radius = Math.min(48, Math.max(0, parsed));
      continue;
    }
    if (key === "dash") {
      if (value === null) tokens.dash = null;
      else if (typeof value === "string") {
        const normalized = value.trim().toLowerCase();
        if (/^(none|solid)$/.test(normalized)) tokens.dash = null;
        else if (normalized === "dashed") tokens.dash = "6 4";
        else if (normalized === "dotted") tokens.dash = "2 3";
        else if (/^[0-9.\s]+$/.test(normalized)) tokens.dash = value.trim();
      }
      continue;
    }
    if (key === "series" && Array.isArray(value) && value.length > 0 && value.length <= 8) {
      const colors = value.map(color).filter((item): item is string => Boolean(item));
      if (colors.length) tokens.series = colors;
    }
  }
  return Object.keys(tokens).length ? tokens : undefined;
}

function series(value: unknown): string[] | undefined {
  const values = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? value
          .replace(/^\[|\]$/g, "")
          .split(/[\s,]+/)
          .filter(Boolean)
      : [];
  const colors = values
    .map((item) =>
      typeof item === "string" ? item.trim().replace(/^["'`]|["'`]$/g, "") : item,
    )
    .map(color)
    .filter((item): item is string => Boolean(item));
  if (!colors.length || colors.length > 8) return undefined;
  return colors;
}

function commandFromObject(source: Record<string, unknown>): ThemeCommand | null {
  const preset = normalizePreset(source.preset ?? source.theme);
  const nested = normalizeTokens(source.tokens ?? source.paletteTokens);
  const flat = normalizeTokens(source);
  const palette = series(source.palette ?? source.colors ?? source.series);
  const tokens: Partial<DiagramTokens> | undefined =
    nested || flat || palette
      ? {
          ...nested,
          ...flat,
          ...(palette ? { series: palette } : {}),
        }
      : undefined;
  if (!preset && !tokens) return null;
  return { preset, tokens };
}

// Fallback per le risposte che usano una sintassi YAML-like invece del JSON:
// "preset: contrast", "preset = ocean", "palette: [#111111, #eeeeee]".
function parseLooseThemeCommand(text: string): ThemeCommand | null {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !/^```|^~~~/.test(line));
  if (lines.length === 1) {
    const preset = normalizePreset(lines[0]);
    if (preset) return { preset };
  }
  const source: Record<string, unknown> = {};
  for (const line of lines) {
    const match = line.match(/^([A-Za-z0-9_.-]+)\s*[:=]\s*(.+)$/);
    if (!match) continue;
    const key = match[1].trim();
    const value = match[2].trim().replace(/^["'`]|["'`]$/g, "");
    source[key] = value;
  }
  return commandFromObject(source);
}

export function parseThemeCommand(raw: string): ThemeCommand | null {
  const text = raw.trim();
  if (!text) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return parseLooseThemeCommand(text);
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return parseLooseThemeCommand(text);
  }
  return commandFromObject(parsed as Record<string, unknown>);
}

const THEME_FENCE = /```(?:mc-theme|theme)[ \t]*\r?\n?([\s\S]*?)```/gi;

export function extractThemeCommand(content: string): ThemeCommand | null {
  let last: ThemeCommand | null = null;
  for (const match of content.matchAll(THEME_FENCE)) {
    const command = parseThemeCommand(match[1]);
    if (command) last = command;
  }
  return last;
}

export function stripThemeCommands(content: string): string {
  return content.replace(THEME_FENCE, "").replace(/\n{3,}/g, "\n\n").trim();
}

const THEME_FENCE_ANY = /```(?:mc-theme|theme)[ \t]*\r?\n?[\s\S]*?```/i;

export function hasThemeCommandFence(content: string): boolean {
  return THEME_FENCE_ANY.test(content);
}

function sameToken(a: unknown, b: unknown): boolean {
  if (Array.isArray(a) || Array.isArray(b)) {
    return (
      Array.isArray(a) &&
      Array.isArray(b) &&
      a.length === b.length &&
      a.every((value, index) => value === b[index])
    );
  }
  return a === b;
}

/**
 * Applica un comando AI ai token correnti. Se ci sono token, il risultato è
 * custom: i token non citati restano quelli correnti (o quelli del preset
 * indicato, se il comando specifica preset + patch).
 *
 * Con un preset esplicito, i token identici a quelli correnti vengono
 * ignorati: i modelli tendono a rimandare indietro tutta la palette ricevuta,
 * e senza questo filtro un cambio preset diventerebbe una copia del tema
 * precedente.
 */
export function applyThemeCommand(
  command: ThemeCommand,
  current: DiagramTokens,
): DiagramTheme {
  if (!command.tokens) {
    return { preset: command.preset ?? "auto" };
  }
  const hasPreset =
    Boolean(command.preset) && command.preset !== "custom" && command.preset !== "auto";
  const base =
    command.preset && command.preset !== "custom" && command.preset !== "auto"
      ? PRESETS[command.preset]
      : current;
  let patch = command.tokens;
  if (hasPreset) {
    const intentional: Partial<DiagramTokens> = {};
    for (const key of Object.keys(patch) as Array<keyof DiagramTokens>) {
      const value = patch[key];
      if (value === undefined || sameToken(value, current[key])) continue;
      (intentional as Record<string, unknown>)[key] = value;
    }
    if (!Object.keys(intentional).length) return { preset: command.preset! };
    patch = intentional;
  }
  const colors = patch.series
    ? base.series.map((color, index) => patch.series?.[index] ?? color)
    : base.series;
  return {
    preset: "custom",
    tokens: { ...base, ...patch, series: colors },
  };
}

export function themeCommandSummary(command: ThemeCommand): string {
  const keys = command.tokens ? Object.keys(command.tokens) : [];
  if (command.preset && command.preset !== "custom") {
    return keys.length
      ? `preset ${command.preset} + ${keys.length} token`
      : `preset ${command.preset}`;
  }
  if (keys.length) {
    return `palette personalizzata (${keys.slice(0, 4).join(", ")}${keys.length > 4 ? "…" : ""})`;
  }
  return `preset ${command.preset ?? "auto"}`;
}
