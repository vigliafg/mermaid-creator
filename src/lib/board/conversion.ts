import type { BoardQuality } from "../../types";
import {
  mermaidThemeVariables,
  resolveTheme,
  safeFont,
  type DiagramTheme,
  type ThemeMode,
} from "../diagram/theme";
import { sceneFromParts, type BoardScene } from "./scene";
import type { DiagramTokens } from "../diagram/theme";
import type { MermaidConversionQuality } from "@excalidraw/mermaid-to-excalidraw";

export const CONVERSION_TIMEOUT_MS = 30_000;

export interface ConversionStats {
  elements: number;
  files: number;
  type: string;
  quality: BoardQuality;
}

export interface ConversionResult {
  scene: BoardScene;
  quality: BoardQuality;
  /** Famiglia Mermaid riconosciuta dal fork (es. flowchart, sequence). */
  type: string;
  stats: ConversionStats;
}

export type ConversionErrorCode = "timeout" | "source" | "unavailable";

export class BoardConversionError extends Error {
  readonly code: ConversionErrorCode;

  constructor(code: ConversionErrorCode, message: string) {
    super(message);
    this.name = "BoardConversionError";
    this.code = code;
  }
}

const qualityOf = (quality: MermaidConversionQuality): BoardQuality => quality;

/** Colori di default del fork quando il sorgente non dichiara stili. */
const DEFAULT_STROKES = new Set([
  "#1e1e1e",
  "#000",
  "#000000",
  "#333333",
  "#1f1f1f",
]);

const FILLABLE = new Set(["rectangle", "ellipse", "diamond"]);

/**
 * Il fork non applica il tema Mermaid agli elementi semantici: usa colori
 * scuri di default. Riallineiamo **solo** quei default ai token del diagramma,
 * lasciando intatti gli stili espliciti del sorgente. È una deviazione motivata
 * dal piano (che dava per scontato `themeVariables` lato fork): senza questo
 * passaggio una lavagna scura risulta illeggibile.
 */
export function themeConvertedElements(
  elements: readonly Record<string, unknown>[],
  tokens: DiagramTokens,
): Record<string, unknown>[] {
  return elements.map((element) => {
    const type = String(element.type ?? "");
    const stroke = String(element.strokeColor ?? "");
    if (!DEFAULT_STROKES.has(stroke.toLowerCase())) return element;
    return {
      ...element,
      strokeColor: type === "text" ? tokens.fg : tokens.line,
      ...(FILLABLE.has(type) && element.backgroundColor === "transparent"
        ? { backgroundColor: tokens.surface }
        : {}),
    };
  });
}

/**
 * Converte il sorgente nella lavagna usando il fork. Non tocca il DB: il
 * chiamante decide se e quando sostituire la lavagna esistente.
 */
export async function convertMermaidToBoard(
  source: string,
  theme: DiagramTheme,
  mode: ThemeMode,
  options: { timeoutMs?: number } = {},
): Promise<ConversionResult> {
  if (!source.trim()) {
    throw new BoardConversionError("source", "Il sorgente è vuoto");
  }
  const tokens = resolveTheme(theme, mode);
  const timeoutMs = options.timeoutMs ?? CONVERSION_TIMEOUT_MS;

  let timer: number | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = window.setTimeout(() => {
      reject(
        new BoardConversionError(
          "timeout",
          `Conversione non completata entro ${Math.round(timeoutMs / 1000)} s`,
        ),
      );
    }, timeoutMs);
  });

  try {
    const conversion = (async () => {
      const [fork, excalidraw] = await Promise.all([
        import("@excalidraw/mermaid-to-excalidraw"),
        import("@excalidraw/excalidraw"),
      ]);
      const result = await fork.parseMermaidToExcalidraw(source, {
        theme: "base",
        fontFamily: safeFont(tokens.font),
        themeVariables: {
          ...mermaidThemeVariables(tokens),
          fontFamily: safeFont(tokens.font),
          fontSize: `${Math.max(8, Math.min(28, tokens.fontSize || 14))}px`,
        },
        flowchart: { curve: "linear" },
      });
      const converted = excalidraw.convertToExcalidrawElements(
        result.elements as never,
      ) as unknown as Record<string, unknown>[];
      const elements = themeConvertedElements(converted, tokens);
      const files = (result.files ?? {}) as unknown as Record<
        string,
        Record<string, unknown>
      >;
      // L'editor usa sempre il tema chiaro: Excalidraw inverte i colori della
      // scena in modalità scura. I colori del diagramma restano quelli salvati.
      const scene = sceneFromParts(elements, files, "light", tokens.bg);
      return {
        scene,
        quality: qualityOf(result.quality),
        type: result.type,
        stats: {
          elements: elements.length,
          files: Object.keys(files).length,
          type: result.type,
          quality: qualityOf(result.quality),
        },
      } satisfies ConversionResult;
    })();

    return await Promise.race([conversion, timeout]);
  } catch (error) {
    if (error instanceof BoardConversionError) throw error;
    const detail = error instanceof Error ? error.message : String(error);
    throw new BoardConversionError(
      "source",
      `Conversione non riuscita: ${detail}`,
    );
  } finally {
    if (timer !== undefined) window.clearTimeout(timer);
  }
}

/** Messaggio onesto sulla fedeltà, o null per le conversioni semantiche. */
export function conversionQualityMessage(
  quality: BoardQuality,
  type: string,
): string | null {
  if (quality === "semantic") return null;
  if (quality === "image") {
    return `Il tipo «${type}» non ha un adapter nativo: la lavagna contiene un'immagine Mermaid. Puoi disegnarci sopra, ma non modificarne i singoli elementi.`;
  }
  return `Conversione generica per «${type}»: forme e testi sono modificabili, ma la fedeltà all'anteprima è approssimata.`;
}

export function conversionStatsLabel(stats: ConversionStats): string {
  const files = stats.files > 0 ? ` · ${stats.files} immagini` : "";
  return `${stats.elements} elementi${files}`;
}
