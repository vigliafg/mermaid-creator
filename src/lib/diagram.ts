import { render as peleRender } from "pele";
import { runInSharedMermaidQueue } from "./board/mermaidQueue";
import {
  applyThemeToSvg,
  detectRenderer,
  flattenThemeVariables,
  mermaidThemeVariables,
  resolveTheme,
  type DiagramTheme,
  type DiagramTokens,
  type ThemeMode,
} from "./diagram/theme";

export interface ExtractedDiagram {
  ordinal: number;
  title: string;
  source: string;
  targetId: string | null;
  closed: boolean;
}

export interface RenderResult {
  svg: string;
  renderer: "pele" | "mermaid";
  rendererId: string;
  width: number;
  height: number;
  type: string;
}

const FENCE = /^(\s{0,3})(`{3,}|~{3,})\s*([\w-]*)\s*$/;

function parseMeta(raw: string[], fallback: string) {
  let title = "";
  let targetId: string | null = null;
  const source: string[] = [];
  for (const line of raw) {
    const titleMatch = line.match(/^\s*%%\s*title\s*:\s*(.+?)\s*$/i);
    if (titleMatch && !title) {
      title = titleMatch[1].trim();
      continue;
    }
    const targetMatch = line.match(/^\s*%%\s*target\s*:\s*([A-Za-z0-9-]+)\s*$/i);
    if (targetMatch && !targetId) {
      targetId = targetMatch[1].trim();
      continue;
    }
    source.push(line);
  }
  while (source.length && !source[0].trim()) source.shift();
  while (source.length && !source[source.length - 1].trim()) source.pop();
  return {
    title: title || fallback,
    targetId,
    source: source.join("\n"),
  };
}

export function extractMermaidBlocks(
  text: string,
  options: { closedOnly?: boolean } = {},
): ExtractedDiagram[] {
  const lines = text.split(/\r?\n/);
  const out: ExtractedDiagram[] = [];
  let mode: "none" | "mermaid" | "skip" = "none";
  let fenceChar = "";
  let fenceLen = 0;
  let buffer: string[] = [];

  for (const line of lines) {
    const match = line.match(FENCE);
    if (mode === "mermaid") {
      if (
        match &&
        match[2][0] === fenceChar &&
        match[2].length >= fenceLen &&
        match[3] === ""
      ) {
        const meta = parseMeta(buffer, `Diagramma ${out.length + 1}`);
        if (meta.source.trim()) {
          out.push({
            ordinal: out.length,
            title: meta.title,
            source: meta.source,
            targetId: meta.targetId,
            closed: true,
          });
        }
        buffer = [];
        mode = "none";
        continue;
      }
      buffer.push(line);
      continue;
    }
    if (mode === "skip") {
      if (
        match &&
        match[2][0] === fenceChar &&
        match[2].length >= fenceLen &&
        match[3] === ""
      ) {
        mode = "none";
      }
      continue;
    }
    if (match) {
      const lang = match[3].toLowerCase();
      if (lang === "mermaid" || lang === "mmd") {
        mode = "mermaid";
        fenceChar = match[2][0];
        fenceLen = match[2].length;
        buffer = [];
      } else {
        mode = "skip";
        fenceChar = match[2][0];
        fenceLen = match[2].length;
      }
    }
  }

  if (mode === "mermaid" && !options.closedOnly && buffer.length) {
    const meta = parseMeta(buffer, `Diagramma ${out.length + 1}`);
    if (meta.source.trim()) {
      out.push({
        ordinal: out.length,
        title: meta.title,
        source: meta.source,
        targetId: meta.targetId,
        closed: false,
      });
    }
  }

  return out;
}

/** Rimuove un eventuale recinto markdown dalla risposta del correttore. */
export function cleanMermaidSource(value: string): string {
  const text = value.trim();
  const fenced = text.match(/```(?:mermaid|mmd)?\s*\r?\n([\s\S]*?)```/i);
  if (fenced) return fenced[1].trim();
  if (!text.startsWith("```")) return text;
  const lines = text.split(/\r?\n/);
  if (lines[0]?.trim().startsWith("```")) lines.shift();
  if (lines[lines.length - 1]?.trim().startsWith("```")) lines.pop();
  return lines.join("\n").trim();
}

/**
 * Ultima spiaggia per sequenceDiagram: rimuove le attivazioni `+`/`-` dalle
 * frecce. Pele/Mermaid a volte rifiutano deattivazioni di partecipanti non
 * attivi; senza marker il diagramma resta leggibile e valido.
 */
export function simplifySequenceActivations(source: string): string {
  return source.replace(/(-->>|->>|-->|->|--x|--\)|-\))([+-])/g, "$1");
}

/**
 * Ultima spiaggia per xychart-beta: se una serie contiene etichette testuali
 * (`line [Ricavi, 120, 145]`) tiene solo i numeri, che è la sintassi accettata.
 */
export function simplifyXYChartSeries(source: string): string {
  if (!/^\s*xychart-beta/m.test(source)) return source;
  const numbersFrom = (body: string): string[] =>
    body
      .split(/[,\s]+/)
      .map((value) => value.trim().replace(/[€$£%]/g, ""))
      .map((value) => {
        if (/^\d{1,3}(?:\.\d{3})+$/.test(value)) return value.replace(/\./g, "");
        if (/^\d{1,3}(?:,\d{3})+$/.test(value)) return value.replace(/,/g, "");
        return value.replace("_", "").replace(",", ".");
      })
      .filter((value) => /^-?\d+(?:\.\d+)?$/.test(value));
  return source
    .replace(
      /^(\s*(?:line|bar)\s+)\[([^\]]*)\][^\n]*/gm,
      (full, prefix: string, body: string) => {
        const numbers = numbersFrom(body);
        return numbers.length >= 2 ? `${prefix}[${numbers.join(", ")}]` : full;
      },
    )
    .replace(
      /^(\s*(?:line|bar)\s+)"[^"]*"\s+([^\n]+)/gm,
      (full, prefix: string, body: string) => {
        const numbers = numbersFrom(body);
        return numbers.length >= 2 ? `${prefix}[${numbers.join(", ")}]` : full;
      },
    );
}

/**
 * Ultima spiaggia per quadrantChart: rimuove le virgolette dai nomi dei punti.
 * Mermaid accetta `Nome: [0.2, 0.8]`; le virgolette sono la causa più comune
 * dell'errore di parsing.
 */
export function simplifyQuadrantLabels(source: string): string {
  if (!/^\s*quadrantChart/m.test(source)) return source;
  return source
    .replace(/^(\s*)point\s+/gm, "$1")
    .replace(
      /^(\s*)"([^"]+)"\s*:\s*\[([^\]]+)\]/gm,
      (_full, indent: string, label: string, body: string) =>
        `${indent}${label}: [${body.trim()}]`,
    )
    .replace(/\[([^\]]+)\]/g, (full, body: string) => {
      const normalized = body
        .split(",")
        .map((value) => value.trim().replace(/^([01])\.0$/, "$1"))
        .join(", ");
      return `[${normalized}]`;
    });
}

/** Garantisce i metadati che l'app usa per titolo e aggiornamento target. */
export function ensureDiagramMeta(
  value: string,
  options: { title?: string; targetId?: string | null } = {},
): string {
  const lines = cleanMermaidSource(value).split(/\r?\n/);
  const hasTarget = lines.some((line) => /^\s*%%\s*target\s*:/i.test(line));
  const hasTitle = lines.some((line) => /^\s*%%\s*title\s*:/i.test(line));
  if (options.targetId) {
    const targetIndex = lines.findIndex((line) => /^\s*%%\s*target\s*:/i.test(line));
    if (targetIndex >= 0) {
      lines[targetIndex] = `%% target: ${options.targetId}`;
    } else {
      lines.unshift(`%% target: ${options.targetId}`);
    }
  } else if (hasTarget) {
    // Un diagramma nuovo non deve trascinarsi dietro un target precedente.
    for (let index = lines.length - 1; index >= 0; index -= 1) {
      if (/^\s*%%\s*target\s*:/i.test(lines[index])) lines.splice(index, 1);
    }
  }
  if (!hasTitle) {
    const title = options.title?.trim() || "Diagramma corretto";
    const targetIndex = lines.findIndex((line) => /^\s*%%\s*target\s*:/i.test(line));
    lines.splice(targetIndex >= 0 ? targetIndex + 1 : 0, 0, `%% title: ${title}`);
  }
  return lines.join("\n").trim();
}

/**
 * Sostituisce il contenuto di un blocco Mermaid senza toccare il testo attorno.
 * `ordinal` è l'indice del blocco come restituito da `extractMermaidBlocks`.
 */
export function replaceMermaidBlockSource(
  content: string,
  ordinal: number,
  newSource: string,
): string {
  const lines = content.split(/\r?\n/);
  const out: string[] = [];
  let mode: "none" | "mermaid" | "skip" = "none";
  let fenceChar = "";
  let fenceLen = 0;
  let buffer: string[] = [];
  let blockIndex = 0;
  let replaced = false;

  const isClosing = (match: RegExpMatchArray | null): boolean =>
    Boolean(
      match &&
        match[2][0] === fenceChar &&
        match[2].length >= fenceLen &&
        match[3] === "",
    );

  for (const line of lines) {
    const match = line.match(FENCE);
    if (mode === "mermaid") {
      if (isClosing(match)) {
        if (blockIndex === ordinal) {
          out.push(...newSource.split(/\r?\n/));
          replaced = true;
        } else {
          out.push(...buffer);
        }
        out.push(line);
        buffer = [];
        mode = "none";
        blockIndex += 1;
      } else {
        buffer.push(line);
      }
      continue;
    }
    if (mode === "skip") {
      out.push(line);
      if (isClosing(match)) mode = "none";
      continue;
    }
    out.push(line);
    if (match) {
      const lang = match[3].toLowerCase();
      if (lang === "mermaid" || lang === "mmd") {
        mode = "mermaid";
        fenceChar = match[2][0];
        fenceLen = match[2].length;
        buffer = [];
      } else {
        mode = "skip";
        fenceChar = match[2][0];
        fenceLen = match[2].length;
      }
    }
  }

  if (!replaced && mode === "mermaid" && blockIndex === ordinal) {
    out.push(...newSource.split(/\r?\n/));
  }
  return out.join("\n");
}

export function diagramType(source: string): string {
  const first = source
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find((line) => line && !line.startsWith("%%"));
  if (!first) return "unknown";
  const token = first.split(/\s+/)[0];
  const map: Record<string, string> = {
    graph: "flowchart",
    flowchart: "flowchart",
    "flowchart-elk": "flowchart",
    sequenceDiagram: "sequence",
    classDiagram: "class",
    stateDiagram: "state",
    "stateDiagram-v2": "state",
    stateDiagramV2: "state",
    erDiagram: "er",
    gantt: "gantt",
    pie: "pie",
    mindmap: "mindmap",
    timeline: "timeline",
    quadrantChart: "quadrant",
    xychart: "xychart",
    sankey: "sankey",
    "block-beta": "block",
    block: "block",
    "C4Context": "c4",
    "C4Container": "c4",
    "C4Component": "c4",
    "C4Dynamic": "c4",
    "C4Deployment": "c4",
  };
  return map[token] ?? (token.replace(/[^A-Za-z0-9_-]/g, "").toLowerCase() || "unknown");
}

let mermaidApi: any = null;

async function getMermaid(tokens: DiagramTokens) {
  if (!mermaidApi) {
    const module = await import("mermaid");
    mermaidApi = module.default;
  }
  mermaidApi.initialize({
    startOnLoad: false,
    securityLevel: "strict",
    htmlLabels: false,
    theme: "base",
    fontFamily: tokens.font,
    themeVariables: mermaidThemeVariables(tokens),
  });
  return mermaidApi;
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  return "Errore di rendering del diagramma";
}

function viewBoxSize(svg: string): { width: number; height: number } {
  const match = svg.match(/viewBox="([^"]+)"/i);
  if (match) {
    const parts = match[1].trim().split(/[\s,]+/).map(Number);
    if (parts.length === 4 && parts.every((value) => Number.isFinite(value))) {
      return { width: Math.max(1, parts[2]), height: Math.max(1, parts[3]) };
    }
  }
  const width = svg.match(/\swidth="(\d+(?:\.\d+)?)"/i);
  const height = svg.match(/\sheight="(\d+(?:\.\d+)?)"/i);
  return {
    width: width ? Math.max(1, Number(width[1])) : 800,
    height: height ? Math.max(1, Number(height[1])) : 600,
  };
}

export function validateSourceSync(source: string): { ok: boolean; error?: string } {
  try {
    peleRender(source);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: errorMessage(error) };
  }
}

export function resolveDiagramTokens(
  theme: DiagramTheme | ThemeMode = "dark",
  mode: ThemeMode = "dark",
): DiagramTokens {
  if (typeof theme === "string") {
    return resolveTheme({ preset: theme === "light" ? "light" : "dark" }, theme);
  }
  return resolveTheme(theme, mode);
}

export async function renderDiagram(
  source: string,
  theme: DiagramTheme | ThemeMode = "dark",
  mode: ThemeMode = "dark",
): Promise<RenderResult> {
  const tokens = resolveDiagramTokens(theme, mode);
  try {
    const result = peleRender(source, { fontFamily: tokens.font });
    return {
      svg: applyThemeToSvg(result.svg, tokens, "pele", { background: true }),
      renderer: "pele",
      rendererId: "",
      width: result.width,
      height: result.height,
      type: diagramType(source),
    };
  } catch (peleError) {
    try {
      const id = `mc-${crypto.randomUUID()}`;
      const result = await runInSharedMermaidQueue(async () => {
        const mermaid = await getMermaid(tokens);
        return mermaid.render(id, source);
      });
      const svg = applyThemeToSvg(result.svg, tokens, "mermaid", { background: true });
      const size = viewBoxSize(svg);
      return {
        svg,
        renderer: "mermaid",
        rendererId: id,
        width: size.width,
        height: size.height,
        type: diagramType(source),
      };
    } catch (mermaidError) {
      throw new Error(
        `Pele: ${errorMessage(peleError)}\nMermaid: ${errorMessage(mermaidError)}`,
      );
    }
  }
}

export type { DiagramTheme } from "./diagram/theme";

export function sanitizeSvgForExport(
  svg: string,
  theme: DiagramTheme | ThemeMode = "dark",
  options: { background?: boolean; mode?: ThemeMode } = {},
): string {
  const clean = svg
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/\son[a-z]+\s*=\s*"[^"]*"/gi, "")
    .replace(/\son[a-z]+\s*=\s*'[^']*'/gi, "")
    .replace(/javascript:/gi, "")
    .replace(/(href|xlink:href)\s*=\s*"data:[^"]*"/gi, '$1="#"');
  const tokens =
    typeof theme === "string"
      ? resolveDiagramTokens(theme, theme)
      : resolveTheme(theme, options.mode ?? "dark");
  const themed = applyThemeToSvg(clean, tokens, detectRenderer(clean), {
    background: options.background ?? false,
  });
  return flattenThemeVariables(themed, tokens);
}

function withIntrinsicSize(svg: string): string {
  const viewBox = svg.match(/viewBox="([^"]+)"/i);
  if (!viewBox) return svg;
  const parts = viewBox[1].trim().split(/[\s,]+/).map(Number);
  if (parts.length !== 4 || !parts.every((value) => Number.isFinite(value))) return svg;
  return svg.replace(/<svg\b([^>]*)>/i, (full, attrs: string) => {
    if (/\swidth="\d+(\.\d+)?"/i.test(attrs) && /\sheight="\d+(\.\d+)?"/i.test(attrs)) {
      return full;
    }
    const cleaned = attrs.replace(/\s(?:width|height)="[^"]*"/gi, "");
    return `<svg${cleaned} width="${parts[2]}" height="${parts[3]}">`;
  });
}

export async function svgToPngBase64(
  svg: string,
  scale = 2,
  background = "#0b0e14",
  theme: DiagramTheme | ThemeMode = "dark",
  mode: ThemeMode = "dark",
): Promise<string> {
  const tokens = resolveDiagramTokens(theme, mode);
  const clean = withIntrinsicSize(
    sanitizeSvgForExport(svg, theme, { background: false, mode }),
  );
  const blob = new Blob([clean], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  try {
    const image = new Image();
    image.decoding = "async";
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error("Impossibile rasterizzare l'SVG"));
      image.src = url;
    });
    const width = Math.max(1, image.naturalWidth || 1200);
    const height = Math.max(1, image.naturalHeight || 800);
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(width * scale);
    canvas.height = Math.round(height * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas non disponibile");
    if (background !== "transparent") {
      ctx.fillStyle = background === "theme" ? tokens.bg : background;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/png").split(",")[1];
  } finally {
    URL.revokeObjectURL(url);
  }
}
