import "@excalidraw/excalidraw/index.css";
import { useEffect, useRef, useState } from "react";
import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";
import { api } from "../../lib/ipc";
import "./board-spike.css";

type Check = { name: string; ok: boolean; detail: string };

const FONT_FILE =
  "/excalidraw-assets/fonts/Excalifont/Excalifont-Regular-a88b72a24fb54c9f94e3b5fdaa7481c9.woff2";

/**
 * Spike temporaneo del Passo 1: verifica in WebKitGTK reale che Excalidraw
 * carichi i font locali, disegni, accetti updateScene e produca export.
 * Non fa parte della UI finale.
 */
export function BoardSpike() {
  const hostRef = useRef<HTMLDivElement>(null);
  const [checks, setChecks] = useState<Check[]>([]);
  const [done, setDone] = useState(false);
  const started = useRef(false);
  const liveChecks = useRef<Check[]>([]);

  const testClipboard = async () => {
    const item: Check = { name: "clipboard (gesto utente)", ok: false, detail: "" };
    try {
      await navigator.clipboard.writeText("board spike clipboard");
      item.ok = true;
      item.detail = "scrittura appunti riuscita";
    } catch (error) {
      item.detail = String(error);
    }
    liveChecks.current = [...liveChecks.current, item];
    setChecks((current) => [...current, item]);
    await api.saveFile(
      "/tmp/opencode/board-spike-clipboard.json",
      JSON.stringify(item, null, 2),
      false,
    );
  };

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const checks: Check[] = [];
    const push = (name: string, ok: boolean, detail: string) => {
      checks.push({ name, ok, detail });
      setChecks([...checks]);
    };

    let apiRef: ExcalidrawImperativeAPI | null = null;

    const run = async () => {
      const mod = await import("@excalidraw/excalidraw");
      const React = await import("react");
      const elements = mod.convertToExcalidrawElements([
        {
          type: "rectangle",
          x: 60,
          y: 60,
          width: 260,
          height: 140,
          backgroundColor: "#a5d8ff",
          label: { text: "Board spike" },
        },
        {
          type: "text",
          x: 60,
          y: 230,
          width: 300,
          height: 30,
          text: "Testo con font locale",
          fontSize: 22,
        },
      ]);
      const initialData = {
        elements,
        appState: {
          viewBackgroundColor: "#ffffff",
          theme: "light" as const,
        },
      };
      const root = hostRef.current;
      if (!root) return;
      const { createRoot } = await import("react-dom/client");
      const reactRoot = createRoot(root);
      reactRoot.render(
        React.createElement(mod.Excalidraw, {
          initialData,
          langCode: "it-IT",
          onExcalidrawAPI: (instance: ExcalidrawImperativeAPI | null) => {
            apiRef = instance;
          },
          theme: "light",
          UIOptions: { canvasActions: { export: false, saveAsImage: false } },
        }),
      );

      const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
      for (let i = 0; i < 60 && !apiRef; i += 1) await wait(150);

      const canvas = () =>
        document.querySelector<HTMLCanvasElement>(".excalidraw canvas.interactive") ??
        document.querySelector<HTMLCanvasElement>(".excalidraw canvas");
      push(
        "componente montato",
        Boolean(apiRef),
        apiRef ? "ExcalidrawImperativeAPI disponibile" : "API non disponibile",
      );
      push(
        "canvas presente",
        Boolean(canvas()),
        `${document.querySelectorAll(".excalidraw canvas").length} canvas`,
      );

      try {
        const response = await fetch(FONT_FILE);
        const buffer = await response.arrayBuffer();
        push(
          "font locale",
          response.ok && buffer.byteLength > 1000,
          `${FONT_FILE} · ${response.status} · ${buffer.byteLength} byte`,
        );
      } catch (error) {
        push("font locale", false, String(error));
      }
      push(
        "font caricati",
        document.fonts.check('16px "Excalifont"'),
        `fonts.size=${document.fonts.size}`,
      );

      try {
        const remote = await fetch("https://esm.sh/react");
        push(
          "CSP blocca CDN",
          false,
          `richiesta remota riuscita inattesa: ${remote.status}`,
        );
      } catch (error) {
        push("CSP blocca CDN", true, `richiesta remota bloccata: ${String(error)}`);
      }

      const instance = apiRef;
      if (!instance) {
        push("updateScene", false, "API assente");
      } else {
        try {
          const before = instance.getSceneElements().length;
          const extra = mod.convertToExcalidrawElements([
            {
              type: "ellipse",
              x: 380,
              y: 80,
              width: 160,
              height: 100,
              backgroundColor: "#ffec99",
            },
          ]);
          instance.updateScene({ elements: [...instance.getSceneElements(), ...extra] });
          await wait(300);
          const after = instance.getSceneElements().length;
          push("updateScene", after === before + 1, `${before} → ${after} elementi`);
        } catch (error) {
          push("updateScene", false, String(error));
        }

        try {
          const json = mod.serializeAsJSON(
            instance.getSceneElements(),
            instance.getAppState(),
            instance.getFiles(),
            "local",
          );
          const parsed = JSON.parse(json) as { elements?: unknown[] };
          push(
            "serializeAsJSON",
            json.length > 100 && Array.isArray(parsed.elements),
            `${json.length} byte · ${parsed.elements?.length ?? 0} elementi`,
          );
        } catch (error) {
          push("serializeAsJSON", false, String(error));
        }

        try {
          const blob = await mod.exportToBlob({
            elements: instance.getSceneElements(),
            appState: {
              ...instance.getAppState(),
              exportBackground: true,
            },
            files: instance.getFiles(),
            mimeType: "image/png",
            quality: 1,
          });
          push(
            "export PNG",
            blob.size > 1000,
            `${blob.type} · ${blob.size} byte`,
          );
        } catch (error) {
          push("export PNG", false, String(error));
        }

        try {
          const svg = await mod.exportToSvg({
            elements: instance.getSceneElements(),
            appState: {
              ...instance.getAppState(),
              exportBackground: false,
            },
            files: instance.getFiles(),
          });
          const markup = svg.outerHTML;
          push("export SVG", markup.includes("<svg"), `${markup.length} byte`);
        } catch (error) {
          push("export SVG", false, String(error));
        }

        try {
          instance.setActiveTool({ type: "rectangle" });
          await wait(350);
          const target = canvas();
          if (!target) throw new Error("canvas assente");
          const rect = target.getBoundingClientRect();
          const options = {
            bubbles: true,
            pointerId: 1,
            pointerType: "mouse",
            isPrimary: true,
            button: 0,
            buttons: 1,
            clientX: rect.left + 420,
            clientY: rect.top + 240,
            pressure: 0.5,
          } as PointerEventInit;
          target.dispatchEvent(new PointerEvent("pointerdown", options));
          for (let step = 1; step <= 6; step += 1) {
            target.dispatchEvent(
              new PointerEvent("pointermove", {
                ...options,
                clientX: rect.left + 420 + step * 16,
                clientY: rect.top + 240 + step * 10,
                pressure: 0.5,
              }),
            );
          }
          target.dispatchEvent(new PointerEvent("pointerup", { ...options, buttons: 0 }));
          await wait(400);
          const drawn = instance
            .getSceneElements()
            .filter((element) => element.type === "rectangle").length;
          push("disegno pointer", drawn >= 2, `${drawn} rettangoli in scena`);
        } catch (error) {
          push("disegno pointer", false, String(error));
        }

        try {
          instance.setActiveTool({ type: "selection" });
          instance.history.clear();
          push("undo/zoom API", true, "history.clear e setActiveTool eseguiti");
        } catch (error) {
          push("undo/zoom API", false, String(error));
        }
      }

      try {
        await navigator.clipboard.writeText("board spike");
        push("clipboard", true, "scrittura appunti riuscita");
      } catch (error) {
        push("clipboard", false, String(error));
      }

      const report = {
        timestamp: new Date().toISOString(),
        userAgent: navigator.userAgent,
        devicePixelRatio: window.devicePixelRatio,
        checks,
      };
      try {
        await api.saveFile(
          "/tmp/opencode/board-spike-report.json",
          JSON.stringify(report, null, 2),
          false,
        );
        push("report scritto", true, "/tmp/opencode/board-spike-report.json");
      } catch (error) {
        push("report scritto", false, String(error));
      }
      setDone(true);
      document.title = "SPIKE DONE";

      // Snapshot periodico: permette di verificare con input reale (xdotool)
      // che il disegno produca elementi senza fidarsi degli eventi sintetici.
      window.setInterval(() => {
        const current = apiRef;
        if (!current) return;
        const elements = current.getSceneElements();
        void api
          .saveFile(
            "/tmp/opencode/board-spike-live.json",
            JSON.stringify(
              {
                timestamp: new Date().toISOString(),
                activeTool: current.getAppState().activeTool.type,
                count: elements.length,
                types: elements.map((element) => element.type),
              },
              null,
              2,
            ),
            false,
          )
          .catch(() => undefined);
      }, 800);
    };

    void run().catch((error) => {
      push("spike", false, String(error));
      setDone(true);
    });
  }, []);

  return (
    <div className="spike-shell">
      <div ref={hostRef} className="spike-canvas" />
      <aside className="spike-report">
        <h1>Board spike {done ? "· completato" : "· in corso"}</h1>
        <button type="button" className="spike-clipboard" onClick={() => void testClipboard()}>
          Test clipboard
        </button>
        <ul>
          {checks.map((check) => (
            <li key={check.name} className={check.ok ? "ok" : "ko"}>
              <strong>{check.ok ? "OK" : "KO"}</strong> {check.name}
              <small>{check.detail}</small>
            </li>
          ))}
        </ul>
      </aside>
    </div>
  );
}
