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
