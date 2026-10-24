import { save } from "@tauri-apps/plugin-dialog";
import {
  AlertTriangle,
  Bookmark,
  BookmarkCheck,
  ChevronLeft,
  Copy,
  Download,
  FileCode2,
  ImageDown,
  Loader2,
  Maximize2,
  Pencil,
  RotateCcw,
  Save,
  Star,
  Trash2,
  Workflow,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { api } from "../lib/ipc";
import {
  diagramType,
  renderDiagram,
  sanitizeSvgForExport,
  svgToPngBase64,
} from "../lib/diagram";
import { useApp } from "../store";
import type { Diagram } from "../types";

function slug(value: string): string {
  const clean = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return clean || "diagramma";
}

function date(value: number): string {
  return new Intl.DateTimeFormat("it-IT", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function DiagramGallery({ onOpen }: { onOpen: (id: string) => void }) {
  const diagrams = useApp((s) => s.diagrams);
  return (
    <div className="workspace-empty">
      <div className="workspace-empty-head">
        <div>
          <div className="eyebrow">Workspace</div>
          <h2>I tuoi diagrammi</h2>
        </div>
        <span className="count">{diagrams.length}</span>
      </div>
      {diagrams.length === 0 ? (
        <div className="empty-inline tall">
          <Workflow size={26} />
          <p>I diagrammi generati dalla conversazione appariranno qui.</p>
        </div>
      ) : (
        <div className="diagram-gallery">
          {diagrams.map((diagram) => (
            <button key={diagram.id} className="gallery-card" onClick={() => onOpen(diagram.id)}>
              <span className="gallery-card-top">
                <span className="badge">{diagram.diagramType}</span>
                {diagram.favorite && <Star size={13} className="star-on" />}
              </span>
              <strong>{diagram.title}</strong>
              <small>{diagram.source.split("\n").slice(0, 2).join(" ")}</small>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function WorkspacePane() {
  const selectedDiagramId = useApp((s) => s.selectedDiagramId);
  const diagrams = useApp((s) => s.diagrams);
  const library = useApp((s) => s.library);
  const versions = useApp((s) => s.versions);
  const theme = (useApp((s) => s.settings.theme) ?? "dark") as "dark" | "light";
  const selectDiagram = useApp((s) => s.selectDiagram);
  const saveDiagram = useApp((s) => s.saveDiagram);
  const restoreVersion = useApp((s) => s.restoreVersion);
  const toggleLibrary = useApp((s) => s.toggleLibrary);
  const toggleFavorite = useApp((s) => s.toggleFavorite);
  const deleteDiagram = useApp((s) => s.deleteDiagram);

  const diagram: Diagram | undefined =
    diagrams.find((item) => item.id === selectedDiagramId) ??
    library.find((item) => item.id === selectedDiagramId);

  const [svg, setSvg] = useState("");
  const [error, setError] = useState("");
  const [renderer, setRenderer] = useState("");
  const [loading, setLoading] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");

  const source = diagram?.source ?? "";
  const previewSource = editing ? draft : source;

  useEffect(() => {
    setEditing(false);
    setDraft(source);
    setZoom(1);
    setSvg("");
    setError("");
  }, [diagram?.id, source]);

  useEffect(() => {
    if (!previewSource.trim()) {
      setSvg("");
      setError("");
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    const timer = window.setTimeout(() => {
      void renderDiagram(previewSource, theme)
        .then((result) => {
          if (cancelled) return;
          setSvg(result.svg);
          setRenderer(result.renderer);
          setError("");
        })
        .catch((renderError: unknown) => {
          if (cancelled) return;
          setError(renderError instanceof Error ? renderError.message : String(renderError));
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }, 220);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [previewSource, theme]);

  const type = useMemo(
    () => diagram?.diagramType || (previewSource ? diagramType(previewSource) : "unknown"),
    [diagram?.diagramType, previewSource],
  );

  if (!diagram) {
    return (
      <aside className="workspace-pane">
        <DiagramGallery onOpen={(id) => void selectDiagram(id)} />
      </aside>
    );
  }

  const exportSvg = async () => {
    if (!svg) return;
    try {
      const path = await save({
        defaultPath: `${slug(diagram.title)}.svg`,
        filters: [{ name: "SVG", extensions: ["svg"] }],
      });
      if (path) {
        await api.saveFile(path, sanitizeSvgForExport(svg, theme), false);
        toast.success("SVG esportato");
      }
    } catch (exportError) {
      toast.error(`Export SVG: ${String(exportError)}`);
    }
  };

  const exportPng = async () => {
    if (!svg) return;
    try {
      const path = await save({
        defaultPath: `${slug(diagram.title)}.png`,
        filters: [{ name: "PNG", extensions: ["png"] }],
      });
      if (path) {
        const data = await svgToPngBase64(
          svg,
          2,
          theme === "dark" ? "#0b0e14" : "#ffffff",
          theme,
        );
        await api.saveFile(path, data, true);
        toast.success("PNG 2x esportato");
      }
    } catch (exportError) {
      toast.error(`Export PNG: ${String(exportError)}`);
    }
  };

  const exportMmd = async () => {
    try {
      const path = await save({
        defaultPath: `${slug(diagram.title)}.mmd`,
        filters: [{ name: "Mermaid", extensions: ["mmd"] }],
      });
      if (path) {
        await api.saveFile(path, previewSource, false);
        toast.success("Sorgente Mermaid esportato");
      }
    } catch (exportError) {
      toast.error(`Export sorgente: ${String(exportError)}`);
    }
  };

  const copySvg = async () => {
    if (!svg) return;
    try {
      await navigator.clipboard.writeText(sanitizeSvgForExport(svg, theme));
      toast.success("SVG copiato");
    } catch (copyError) {
      toast.error(`Copia SVG: ${String(copyError)}`);
    }
  };

  const copyMmd = async () => {
    try {
      await navigator.clipboard.writeText(previewSource);
      toast.success("Sorgente Mermaid copiato");
    } catch (copyError) {
      toast.error(`Copia sorgente: ${String(copyError)}`);
    }
  };

  const rename = async () => {
    const title = window.prompt("Titolo del diagramma", diagram.title);
    if (!title || title.trim() === diagram.title) return;
    await saveDiagram(diagram.source, title.trim());
  };

  const startEditing = () => {
    setDraft(diagram.source);
    setEditing(true);
  };

  const saveDraft = async () => {
    await saveDiagram(draft, diagram.title);
    setEditing(false);
  };

  return (
    <aside className="workspace-pane">
      <header className="workspace-header">
        <div className="workspace-title">
          <div className="eyebrow">
            {renderer ? `render: ${renderer}` : "diagramma"} · {type}
          </div>
          <h2>{diagram.title}</h2>
        </div>
        <div className="workspace-actions">
          <button
            className="icon-btn"
            title="Torna alla galleria"
            onClick={() => void selectDiagram(null)}
          >
            <Workflow size={16} />
          </button>
          <button
            className="icon-btn"
            title={diagram.inLibrary ? "Rimuovi dalla libreria" : "Salva in libreria"}
            onClick={() => void toggleLibrary(diagram.id)}
          >
            {diagram.inLibrary ? <BookmarkCheck size={17} /> : <Bookmark size={17} />}
          </button>
          <button
            className={`icon-btn ${diagram.favorite ? "star-on" : ""}`}
            title="Preferito"
            onClick={() => void toggleFavorite(diagram.id)}
          >
            <Star size={17} />
          </button>
          <button className="icon-btn" title="Rinomina" onClick={() => void rename()}>
            <Pencil size={16} />
          </button>
          <button
            className="icon-btn danger"
            title="Elimina diagramma"
            onClick={() => {
              if (window.confirm(`Eliminare “${diagram.title}”?`)) {
                void deleteDiagram(diagram.id);
              }
            }}
          >
            <Trash2 size={16} />
          </button>
        </div>
      </header>

      <div className="workspace-toolbar">
        <button className={`btn btn-ghost ${editing ? "active" : ""}`} onClick={() => (editing ? setEditing(false) : startEditing())}>
          <FileCode2 size={15} /> {editing ? "Chiudi editor" : "Sorgente"}
        </button>
        <button
          className={`btn btn-ghost ${diagram.inLibrary ? "active" : ""}`}
          onClick={() => void toggleLibrary(diagram.id)}
          title={diagram.inLibrary ? "Rimuovi dalla libreria" : "Salva in libreria"}
        >
          {diagram.inLibrary ? <BookmarkCheck size={15} /> : <Bookmark size={15} />}
          {diagram.inLibrary ? "In libreria" : "Salva in libreria"}
        </button>
        <div className="toolbar-spacer" />
        <button className="icon-btn" title="Zoom out" onClick={() => setZoom((z) => Math.max(0.4, z - 0.15))}>
          <ZoomOut size={16} />
        </button>
        <span className="zoom-label">{Math.round(zoom * 100)}%</span>
        <button className="icon-btn" title="Zoom in" onClick={() => setZoom((z) => Math.min(2.5, z + 0.15))}>
          <ZoomIn size={16} />
        </button>
        <button className="icon-btn" title="Reset zoom" onClick={() => setZoom(1)}>
          <Maximize2 size={16} />
        </button>
        <span className="toolbar-divider" />
        <button className="icon-btn" title="Copia SVG" onClick={() => void copySvg()} disabled={!svg}>
          <Copy size={16} />
        </button>
        <button className="icon-btn" title="Copia sorgente Mermaid" onClick={() => void copyMmd()}>
          <FileCode2 size={16} />
        </button>
        <button className="icon-btn" title="Esporta SVG" onClick={() => void exportSvg()} disabled={!svg}>
          <Download size={16} />
        </button>
        <button className="icon-btn" title="Esporta PNG 2x" onClick={() => void exportPng()} disabled={!svg}>
          <ImageDown size={16} />
        </button>
        <button className="icon-btn" title="Esporta .mmd" onClick={() => void exportMmd()}>
          <Download size={16} />
        </button>
      </div>

      {editing ? (
        <div className="editor-panel">
          <textarea
            className="source-editor"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            spellCheck={false}
          />
          <div className="editor-actions">
            <span className="muted">Anteprima live · salva per creare una versione</span>
            <div className="row-actions">
              <button className="btn btn-ghost" onClick={() => { setDraft(diagram.source); setEditing(false); }}>
                Annulla
              </button>
              <button className="btn btn-primary" onClick={() => void saveDraft()}>
                <Save size={15} /> Salva versione
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="diagram-stage">
          {loading && !svg ? (
            <div className="empty-inline tall">
              <Loader2 className="spin" size={22} /> Rendering…
            </div>
          ) : error ? (
            <div className="render-error">
              <AlertTriangle size={22} />
              <h3>Il diagramma non è renderizzabile</h3>
              <pre>{error}</pre>
              <p className="muted">
                Puoi correggere il sorgente, oppure selezionare il diagramma e chiedere
                al modello di sistemarlo.
              </p>
              <button className="btn btn-ghost" onClick={startEditing}>
                <Pencil size={15} /> Apri sorgente
              </button>
            </div>
          ) : (
            <div className="diagram-viewport">
              <div
                className="diagram-svg"
                style={{ transform: `scale(${zoom})` }}
                dangerouslySetInnerHTML={{ __html: svg }}
              />
            </div>
          )}
        </div>
      )}

      <section className="versions-panel">
        <div className="panel-head">
          <h3>Versioni</h3>
          <span className="count">{versions.length}</span>
        </div>
        <div className="version-list">
          {versions.length === 0 ? (
            <div className="empty-inline">Nessuna versione</div>
          ) : (
            versions.map((version) => (
              <div className="version-row" key={version.id}>
                <div>
                  <strong>v{version.versionNo}</strong>
                  <small>
                    {version.origin} · {date(version.createdAt)}
                  </small>
                </div>
                <button
                  className="btn btn-ghost tiny"
                  title="Ripristina questa versione"
                  onClick={() => {
                    if (window.confirm(`Ripristinare la versione v${version.versionNo}?`)) {
                      void restoreVersion(version.id);
                    }
                  }}
                >
                  <RotateCcw size={13} /> Ripristina
                </button>
              </div>
            ))
          )}
        </div>
      </section>

      {diagram.conversationId === null && (
        <button className="back-to-chat" onClick={() => void selectDiagram(null)}>
          <ChevronLeft size={14} /> Torna alla galleria
        </button>
      )}
    </aside>
  );
}
