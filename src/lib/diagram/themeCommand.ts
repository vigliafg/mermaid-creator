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

export function parseThemeCommand(raw: string): ThemeCommand | null {
  const text = raw.trim();
  if (!text) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
  const source = parsed as Record<string, unknown>;
  const preset = isPresetId(source.preset) ? source.preset : undefined;
  const tokens = normalizeTokens(source.tokens);
  if (!preset && !tokens) return null;
  return { preset, tokens };
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

/**
 * Applica un comando AI ai token correnti. Se ci sono token, il risultato è
 * custom: i token non citati restano quelli correnti (o quelli del preset
 * indicato, se il comando specifica preset + patch).
 */
export function applyThemeCommand(
  command: ThemeCommand,
  current: DiagramTokens,
): DiagramTheme {
  if (!command.tokens) {
    return { preset: command.preset ?? "auto" };
  }
  const base =
    command.preset && command.preset !== "custom" && command.preset !== "auto"
      ? PRESETS[command.preset]
      : current;
  const series = command.tokens.series
    ? base.series.map((color, index) => command.tokens?.series?.[index] ?? color)
    : base.series;
  return {
    preset: "custom",
    tokens: { ...base, ...command.tokens, series },
  };
}

export function themeCommandSummary(command: ThemeCommand): string {
  if (command.tokens) {
    const keys = Object.keys(command.tokens);
    return `palette personalizzata (${keys.slice(0, 4).join(", ")}${keys.length > 4 ? "…" : ""})`;
  }
  return `preset ${command.preset ?? "auto"}`;
}
