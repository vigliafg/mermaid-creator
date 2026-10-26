import "@excalidraw/excalidraw/index.css";
import { useEffect, useMemo, useRef, useState } from "react";
import type {
  ExcalidrawImperativeAPI,
  ExcalidrawInitialDataState,
  LibraryItems,
} from "@excalidraw/excalidraw/types";
import type { BinaryFiles } from "@excalidraw/excalidraw/types";
import type { BoardScene } from "../../lib/board/scene";
import { parseBoardScene, stampSceneTheme } from "../../lib/board/scene";
import {
  loadBoardLibraryItems,
  saveBoardLibraryItems,
} from "../../lib/board/libraryStore";
import { CommunityLibraryDialog } from "./CommunityLibraryDialog";

type ExcalidrawModule = typeof import("@excalidraw/excalidraw");

type BoardLibraryAdapter = {
  load: (metadata: {
    source: "load" | "save";
  }) => Promise<{ libraryItems: LibraryItems } | null>;
  save: (data: { libraryItems: LibraryItems }) => Promise<void>;
};

/**
 * Ponte tra la libreria interna di Excalidraw e SQLite. Montato solo quando
 * l'API dell'editor esiste: `useHandleLibrary` chiama l'adapter una volta per
 * montaggio e poi a ogni modifica della libreria.
 */
function BoardLibraryPersistence({
  module,
  api,
  adapter,
}: {
  module: ExcalidrawModule;
  api: ExcalidrawImperativeAPI;
  adapter: BoardLibraryAdapter;
}) {
  module.useHandleLibrary({ excalidrawAPI: api, adapter });
  return null;
}

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
  const [api, setApi] = useState<ExcalidrawImperativeAPI | null>(null);
  const [communityLibrariesOpen, setCommunityLibrariesOpen] = useState(false);
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
  const libraryAdapter = useMemo<BoardLibraryAdapter>(
    () => ({
      async load() {
        const items = await loadBoardLibraryItems();
        return items
          ? { libraryItems: items as unknown as LibraryItems }
          : null;
      },
      async save({ libraryItems }) {
        await saveBoardLibraryItems(
          libraryItems as unknown as readonly unknown[],
        );
      },
    }),
    [],
  );

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

  // Excalidraw disegna il link «Sfoglia librerie» con target dedicato: nella
  // webview Tauri aprirebbe una finestra vuota. Lo intercettiamo e mostriamo
  // il catalogo integrato, che scarica solo dal dominio ufficiale.
  useEffect(() => {
    if (!module) return;
    const onClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      const link = target?.closest?.(
        "a.library-menu-browse-button, a[href*='libraries.excalidraw.com']",
      );
      if (!link) return;
      event.preventDefault();
      event.stopPropagation();
      if (apiRef.current) setCommunityLibrariesOpen(true);
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [module]);

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
    <>
      {api && (
        <BoardLibraryPersistence
          module={module}
          api={api}
          adapter={libraryAdapter}
        />
      )}
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
            setApi(api);
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
      <CommunityLibraryDialog
        open={communityLibrariesOpen}
        api={api}
        onClose={() => setCommunityLibrariesOpen(false)}
      />
    </>
  );
}
