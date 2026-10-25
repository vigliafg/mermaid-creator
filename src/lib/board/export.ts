import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";
import type { BoardCanvasHandle } from "../../components/board/BoardCanvas";

export type ExportScale = 1 | 2 | 3;

function requireHandle(handle: BoardCanvasHandle | null) {
  if (!handle?.api || !handle.module || handle.api.isDestroyed) {
    throw new Error("Lavagna non pronta per l'esportazione");
  }
  return handle as BoardCanvasHandle & {
    api: ExcalidrawImperativeAPI;
    module: NonNullable<BoardCanvasHandle["module"]>;
  };
}

function sceneParts(handle: BoardCanvasHandle | null) {
  const ready = requireHandle(handle);
  const appState = ready.api.getAppState();
  return {
    ready,
    elements: ready.api.getSceneElements(),
    appState,
    files: ready.api.getFiles(),
  };
}

function exportAppState(
  appState: ReturnType<ExcalidrawImperativeAPI["getAppState"]>,
  background: boolean,
) {
  return {
    ...appState,
    exportBackground: background,
    exportWithDarkMode: false,
    viewBackgroundColor: background
      ? appState.viewBackgroundColor
      : "transparent",
  };
}

export async function boardPngBase64(
  handle: BoardCanvasHandle | null,
  scale: ExportScale,
  background: boolean,
): Promise<string> {
  const { ready, elements, appState, files } = sceneParts(handle);
  const blob = await ready.module.exportToBlob({
    elements,
    appState: exportAppState(appState, background),
    files,
    mimeType: "image/png",
    quality: 1,
    getDimensions: (width: number, height: number) => ({
      width: Math.max(1, Math.round(width * scale)),
      height: Math.max(1, Math.round(height * scale)),
      scale,
    }),
  });
  const buffer = new Uint8Array(await blob.arrayBuffer());
  let binary = "";
  for (const byte of buffer) binary += String.fromCharCode(byte);
  return btoa(binary);
}

export async function boardSvg(
  handle: BoardCanvasHandle | null,
  background: boolean,
): Promise<string> {
  const { ready, elements, appState, files } = sceneParts(handle);
  const svg = await ready.module.exportToSvg({
    elements,
    appState: exportAppState(appState, background),
    files,
    exportPadding: 10,
  });
  return `<?xml version="1.0" encoding="UTF-8"?>\n${svg.outerHTML}`;
}

export function boardExcalidrawJson(handle: BoardCanvasHandle | null): string {
  const { ready, elements, appState, files } = sceneParts(handle);
  return ready.module.serializeAsJSON(elements, appState, files, "local");
}

export async function copyBoardPng(
  handle: BoardCanvasHandle | null,
): Promise<"ok" | "unsupported"> {
  const { ready, elements, appState, files } = sceneParts(handle);
  const blob = await ready.module.exportToBlob({
    elements,
    appState: exportAppState(appState, true),
    files,
    mimeType: "image/png",
    quality: 1,
  });
  const ClipboardItemCtor = window.ClipboardItem;
  if (!navigator.clipboard?.write || !ClipboardItemCtor) return "unsupported";
  try {
    await navigator.clipboard.write([
      new ClipboardItemCtor({ "image/png": blob }),
    ]);
    return "ok";
  } catch {
    return "unsupported";
  }
}

export async function copyBoardSvg(
  handle: BoardCanvasHandle | null,
): Promise<"ok" | "unsupported"> {
  const svg = await boardSvg(handle, true);
  if (!navigator.clipboard?.writeText) return "unsupported";
  try {
    await navigator.clipboard.writeText(svg);
    return "ok";
  } catch {
    return "unsupported";
  }
}

/** Copia testuale di fallback per la clipboard WebKit senza ClipboardItem. */
export function copyTextFallback(text: string): boolean {
  const area = document.createElement("textarea");
  area.value = text;
  area.style.position = "fixed";
  area.style.opacity = "0";
  document.body.appendChild(area);
  area.select();
  const ok = document.execCommand("copy");
  area.remove();
  return ok;
}

