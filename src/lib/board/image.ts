import { resolveTheme, type DiagramTheme, type ThemeMode } from "../diagram/theme";
import { sanitizeSvgForExport } from "../diagram";
import { sceneFromParts, type BoardScene } from "./scene";

function svgToDataUrl(svg: string): string {
  const bytes = new TextEncoder().encode(svg);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return `data:image/svg+xml;base64,${btoa(binary)}`;
}

function randomSeed(): number {
  return Math.floor(Math.random() * 2 ** 31);
}

/**
 * «Inserisci come immagine»: usa l'SVG del render corrente dell'app (Pele o
 * Mermaid), non il fallback interno del fork, per essere fedeli all'anteprima.
 */
export function imageSceneFromSvg(
  svg: string,
  width: number,
  height: number,
  theme: DiagramTheme,
  mode: ThemeMode,
): BoardScene {
  const clean = sanitizeSvgForExport(svg, theme, { background: true, mode });
  const fileId = `mc-image-${crypto.randomUUID()}`;
  const now = Date.now();
  const maxWidth = 1400;
  const scale = Math.min(1, maxWidth / Math.max(1, width));
  const w = Math.max(1, Math.round(width * scale));
  const h = Math.max(1, Math.round(height * scale));
  const element = {
    id: crypto.randomUUID(),
    type: "image",
    x: 0,
    y: 0,
    width: w,
    height: h,
    angle: 0,
    strokeColor: "transparent",
    backgroundColor: "transparent",
    fillStyle: "solid",
    strokeWidth: 1,
    strokeStyle: "solid",
    roughness: 1,
    opacity: 100,
    groupIds: [],
    frameId: null,
    roundness: null,
    seed: randomSeed(),
    version: 1,
    versionNonce: randomSeed(),
    isDeleted: false,
    boundElements: null,
    updated: now,
    link: null,
    locked: false,
    fileId,
    status: "saved",
    scale: [1, 1],
    crop: null,
  };
  const tokens = resolveTheme(theme, mode);
  const files = {
    [fileId]: {
      id: fileId,
      mimeType: "image/svg+xml",
      dataURL: svgToDataUrl(clean),
      created: now,
      lastRetrieved: now,
    },
  };
  return sceneFromParts([element], files, "light", tokens.bg);
}
