import "@excalidraw/excalidraw/index.css";
import { useEffect, useRef, useState } from "react";
import type {
  ExcalidrawImperativeAPI,
  ExcalidrawInitialDataState,
} from "@excalidraw/excalidraw/types";
import type { BinaryFiles } from "@excalidraw/excalidraw/types";
import type { BoardScene } from "../../lib/board/scene";
import { parseBoardScene, stampSceneTheme } from "../../lib/board/scene";

type ExcalidrawModule = typeof import("@excalidraw/excalidraw");

export interface BoardCanvasHandle {
  api: ExcalidrawImperativeAPI | null;
  module: ExcalidrawModule | null;
  scrollToContent: () => void;
}

interface BoardCanvasProps {
  scene: BoardScene;
  /** Cambia quando la lavagna viene sostituita (rigenerazione/ripristino). */
  sceneKey: string;
  onSceneChange: (sceneJson: string) => void;
  onReady?: (handle: BoardCanvasHandle) => void;
  onLinkOpen?: (url: string) => void;
  readOnly?: boolean;
}

export function BoardCanvas({
  scene,
  sceneKey,
  onSceneChange,
  onReady,
  onLinkOpen,
  readOnly = false,
}: BoardCanvasProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [module, setModule] = useState<ExcalidrawModule | null>(null);
  const apiRef = useRef<ExcalidrawImperativeAPI | null>(null);
  const signatureRef = useRef<string>("");
  const appliedKeyRef = useRef<string>("");
  const filesRef = useRef<BinaryFiles>({});
  const onSceneChangeRef = useRef(onSceneChange);
  const onLinkOpenRef = useRef(onLinkOpen);
  // Il tema dell'editor resta chiaro: Excalidraw inverte i colori della scena
  // in modalità scura, mentre le nostre scene sono già generate nei colori
  // (anche scuri) del diagramma. L'inversione renderebbe illeggibile la lavagna.
  const themeRef = useRef<"dark" | "light">("light");

  useEffect(() => {
    onSceneChangeRef.current = onSceneChange;
  }, [onSceneChange]);

  useEffect(() => {
    onLinkOpenRef.current = onLinkOpen;
  }, [onLinkOpen]);

  useEffect(() => {
    let cancelled = false;
    void import("@excalidraw/excalidraw").then((loaded) => {
      if (!cancelled) setModule(loaded);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Applica una scena sostituita dall'esterno senza rimontare l'editor.
  useEffect(() => {
    const api = apiRef.current;
    if (!api || !module) return;
    if (appliedKeyRef.current === sceneKey) return;
    appliedKeyRef.current = sceneKey;
    let parsed: BoardScene;
    try {
      parsed = parseBoardScene(sceneKey);
    } catch {
      parsed = scene;
    }
    const elements = parsed.elements as never;
    filesRef.current = parsed.files as unknown as BinaryFiles;
    const fileList = Object.values(filesRef.current);
    if (fileList.length) api.addFiles(fileList);
    api.updateScene({
      elements,
      appState: parsed.appState as never,
    });
    window.setTimeout(() => {
      api.scrollToContent(elements, { fitToContent: true });
    }, 60);
  }, [scene, sceneKey, module]);

  if (!module) {
    return (
      <div className="board-canvas board-canvas-loading" aria-busy="true">
        Caricamento editor…
      </div>
    );
  }

  const { Excalidraw, getSceneVersion } = module;

  const initialData: ExcalidrawInitialDataState = {
    elements: scene.elements as never,
    appState: { ...scene.appState, theme: "light" } as never,
    files: scene.files as unknown as BinaryFiles,
  };
  if (!appliedKeyRef.current) appliedKeyRef.current = sceneKey;

  return (
    <div className="board-canvas" ref={hostRef}>
      <Excalidraw
        initialData={initialData}
        theme="light"
        langCode="it-IT"
        name="Lavagna Mermaid Creator"
        viewModeEnabled={readOnly}
        validateEmbeddable={false}
        aiEnabled={false}
        autoFocus={!readOnly}
        UIOptions={{
          canvasActions: {
            export: false,
            loadScene: false,
            saveAsImage: false,
            saveToActiveFile: false,
            toggleTheme: false,
          },
        }}
        onLinkOpen={(element, event) => {
          const link = element.link;
          if (!link) return;
          event.preventDefault();
          onLinkOpenRef.current?.(link);
        }}
        onInitialize={(api) => {
          window.setTimeout(() => {
            api.scrollToContent(api.getSceneElements(), {
              fitToContent: true,
            });
          }, 180);
        }}
        onExcalidrawAPI={(api) => {
          apiRef.current = api;
          if (api) {
            filesRef.current = api.getFiles();
            window.setTimeout(() => {
              if (!api.isDestroyed) {
                api.scrollToContent(api.getSceneElements(), {
                  fitToContent: true,
                });
              }
            }, 320);
          }
          onReady?.({
            api,
            module,
            scrollToContent: () => {
              if (!api) return;
              api.scrollToContent(api.getSceneElements(), {
                fitToContent: true,
              });
            },
          });
        }}
        onChange={(elements, appState, files) => {
          if (!apiRef.current) return;
          filesRef.current = files;
          const signature = [
            getSceneVersion(elements as never),
            Object.keys(files).length,
            appState.viewBackgroundColor,
            appState.gridSize,
            appState.theme,
          ].join("|");
          if (signature === signatureRef.current) return;
          signatureRef.current = signature;
          onSceneChangeRef.current(
            stampSceneTheme(
              module.serializeAsJSON(elements, appState, files, "local"),
              themeRef.current,
            ),
          );
        }}
      />
    </div>
  );
}
