import { render as peleRender } from "pele";

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
    sequenceDiagram: "sequence",
    classDiagram: "class",
    stateDiagram: "state",
    stateDiagramV2: "state",
    erDiagram: "er",
    gantt: "gantt",
    pie: "pie",
    mindmap: "mindmap",
    timeline: "timeline",
    quadrantChart: "quadrant",
    xychart: "xychart",
    sankey: "sankey",
    "C4Context": "c4",
    "C4Container": "c4",
    "C4Component": "c4",
    "C4Dynamic": "c4",
    "C4Deployment": "c4",
  };
  return map[token] ?? (token.replace(/[^A-Za-z0-9_-]/g, "").toLowerCase() || "unknown");
}

let mermaidApi: any = null;

async function getMermaid(theme: "dark" | "light") {
  if (!mermaidApi) {
    const module = await import("mermaid");
    mermaidApi = module.default;
  }
  mermaidApi.initialize({
    startOnLoad: false,
    securityLevel: "strict",
    htmlLabels: false,
    theme: theme === "dark" ? "dark" : "default",
    fontFamily: "Inter, system-ui, sans-serif",
  });
  return mermaidApi;
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  return "Errore di rendering del diagramma";
}

export async function renderDiagram(
  source: string,
  theme: "dark" | "light" = "dark",
): Promise<RenderResult> {
  try {
    const result = peleRender(source);
    return { svg: result.svg, renderer: "pele" };
  } catch (peleError) {
    try {
      const mermaid = await getMermaid(theme);
      const id = `mc-${crypto.randomUUID()}`;
      const result = await mermaid.render(id, source);
      return { svg: result.svg, renderer: "mermaid" };
    } catch (mermaidError) {
      throw new Error(
        `Pele: ${errorMessage(peleError)}\nMermaid: ${errorMessage(mermaidError)}`,
      );
    }
  }
}

export type DiagramTheme = "dark" | "light";

const PELE_PALETTES: Record<DiagramTheme, string> = {
  dark: `--pele-bg:#0b0e14; --pele-fg:#e8ecf5; --pele-muted:#8f9ab3;
         --pele-line:#61708f; --pele-surface:#171d2a; --pele-surface-alt:#1f2737;
         --pele-border:#33405a; --pele-accent:#8ba4ff;`,
  light: `--pele-bg:#ffffff; --pele-fg:#1a2233; --pele-muted:#64718a;
          --pele-line:#8d99ad; --pele-surface:#f7f8fc; --pele-surface-alt:#eef2fa;
          --pele-border:#d8dfec; --pele-accent:#4767e8;`,
};

export function sanitizeSvgForExport(
  svg: string,
  theme: DiagramTheme = "dark",
): string {
  let clean = svg
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/\son[a-z]+\s*=\s*"[^"]*"/gi, "")
    .replace(/\son[a-z]+\s*=\s*'[^']*'/gi, "")
    .replace(/javascript:/gi, "")
    .replace(/(href|xlink:href)\s*=\s*"data:[^"]*"/gi, '$1="#"');

  if (!clean.includes("--pele-bg")) {
    const style = `<style>
      svg.pele, .pele {
        ${PELE_PALETTES[theme]}
        --pele-font:Inter,system-ui,sans-serif; --pele-radius:8px;
      }
    </style>`;
    clean = clean.replace(/<svg([^>]*)>/i, `<svg$1>${style}`);
  }
  return clean;
}

export async function svgToPngBase64(
  svg: string,
  scale = 2,
  background = "#0b0e14",
  theme: DiagramTheme = "dark",
): Promise<string> {
  const blob = new Blob([sanitizeSvgForExport(svg, theme)], {
    type: "image/svg+xml;charset=utf-8",
  });
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
      ctx.fillStyle = background;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/png").split(",")[1];
  } finally {
    URL.revokeObjectURL(url);
  }
}
