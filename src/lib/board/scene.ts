import type { BoardOrigin, DiagramBoard } from "../../types";

export const MAX_BOARD_BYTES = 25 * 1024 * 1024;
export const BOARD_SCENE_SOURCE = "mermaid-creator";

export type BoardTheme = "dark" | "light";

export interface BoardScene {
  type: "excalidraw";
  version: number;
  source: string;
  elements: readonly Record<string, unknown>[];
  appState: Record<string, unknown>;
  files: Record<string, Record<string, unknown>>;
}

export interface BoardStats {
  elements: number;
  visibleElements: number;
  files: number;
}

export class BoardSceneError extends Error {}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/**
 * Scena vuota con il tema congelato alla creazione. Il tema non segue quello
 * dell'app: per riallinearlo serve «Aggiorna da Mermaid».
 */
export function emptyBoardScene(theme: BoardTheme): BoardScene {
  return {
    type: "excalidraw",
    version: 2,
    source: BOARD_SCENE_SOURCE,
    elements: [],
    appState: {
      theme,
      viewBackgroundColor: theme === "dark" ? "#121212" : "#ffffff",
      gridSize: null,
    },
    files: {},
  };
}

export function sceneFromParts(
  elements: readonly Record<string, unknown>[],
  files: Record<string, Record<string, unknown>> | undefined,
  theme: BoardTheme,
  viewBackgroundColor?: string,
): BoardScene {
  const base = emptyBoardScene(theme);
  return {
    ...base,
    elements,
    files: files ?? {},
    appState: {
      ...base.appState,
      ...(viewBackgroundColor ? { viewBackgroundColor } : {}),
    },
  };
}

/**
 * Convalida una scena prima di caricarla o salvarla. Accetta solo il formato
 * documento Excalidraw; nessun campo viene eseguito come codice.
 */
export function parseBoardScene(json: string): BoardScene {
  if (!json.trim()) {
    throw new BoardSceneError("Scena lavagna vuota");
  }
  if (json.length > MAX_BOARD_BYTES) {
    throw new BoardSceneError(
      `Lavagna troppo grande (${(json.length / (1024 * 1024)).toFixed(1)} MB, max 25 MB)`,
    );
  }
  let value: unknown;
  try {
    value = JSON.parse(json);
  } catch (error) {
    throw new BoardSceneError(`Scena lavagna non valida: ${String(error)}`);
  }
  if (!isRecord(value)) {
    throw new BoardSceneError("Scena lavagna non valida: atteso un oggetto JSON");
  }
  if (value.type !== "excalidraw") {
    throw new BoardSceneError(
      "Scena lavagna non valida: manca type=\"excalidraw\"",
    );
  }
  if (!Array.isArray(value.elements)) {
    throw new BoardSceneError("Scena lavagna non valida: elements non è un array");
  }
  if (value.appState !== undefined && !isRecord(value.appState)) {
    throw new BoardSceneError("Scena lavagna non valida: appState non è un oggetto");
  }
  if (value.files !== undefined && !isRecord(value.files)) {
    throw new BoardSceneError("Scena lavagna non valida: files non è un oggetto");
  }
  return {
    type: "excalidraw",
    version: typeof value.version === "number" ? value.version : 2,
    source:
      typeof value.source === "string" ? value.source : BOARD_SCENE_SOURCE,
    elements: value.elements.filter(isRecord),
    appState: isRecord(value.appState) ? value.appState : {},
    files: isRecord(value.files)
      ? (value.files as Record<string, Record<string, unknown>>)
      : {},
  };
}

/** Legge una board dal DB applicando la validazione della scena. */
export function parseBoard(board: DiagramBoard): {
  board: DiagramBoard;
  scene: BoardScene;
} {
  return { board, scene: parseBoardScene(board.sceneJson) };
}

export function serializeBoardScene(scene: BoardScene): string {
  return JSON.stringify(scene);
}

export function boardByteSize(scene: BoardScene | string): number {
  return typeof scene === "string"
    ? new TextEncoder().encode(scene).length
    : new TextEncoder().encode(serializeBoardScene(scene)).length;
}

export function boardStats(scene: BoardScene): BoardStats {
  return {
    elements: scene.elements.length,
    visibleElements: scene.elements.filter((element) => !element.isDeleted)
      .length,
    files: Object.keys(scene.files).length,
  };
}

/**
 * Una lavagna derivata è da aggiornare quando il sorgente non coincide più
 * esattamente con quello da cui è nata. Una lavagna manuale non è mai stale.
 */
export function isBoardStale(
  board: Pick<DiagramBoard, "origin" | "baseSource"> | null,
  source: string,
): boolean {
  if (!board) return false;
  if (board.origin === "manual") return false;
  return board.baseSource !== source;
}

export function boardOriginLabel(origin: BoardOrigin): string {
  return origin === "diagram" ? "Generata dal diagramma" : "Lavagna libera";
}

export function boardTheme(scene: BoardScene): BoardTheme {
  return scene.appState.theme === "dark" ? "dark" : "light";
}

export function withBoardTheme(scene: BoardScene, theme: BoardTheme): BoardScene {
  return {
    ...scene,
    appState: {
      ...scene.appState,
      theme,
      viewBackgroundColor:
        scene.appState.viewBackgroundColor ??
        (theme === "dark" ? "#121212" : "#ffffff"),
    },
  };
}
