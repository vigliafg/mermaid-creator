import { useEffect, useMemo, useRef, useState } from "react";
import type {
  ExcalidrawImperativeAPI,
  LibraryItem,
  LibraryItems,
} from "@excalidraw/excalidraw/types";
import {
  AlertTriangle,
  FolderOpen,
  Library,
  Loader2,
  Pencil,
  Plus,
  Search,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { toast } from "sonner";
import {
  normalizeBoardLibraryItems,
  type StoredLibraryItem,
} from "../../lib/board/libraryItems";
import { loadBoardLibraryItems } from "../../lib/board/libraryStore";

type ExcalidrawModule = typeof import("@excalidraw/excalidraw");

interface BoardLibraryDialogProps {
  open: boolean;
  api: ExcalidrawImperativeAPI | null;
  module: ExcalidrawModule | null;
  onClose: () => void;
  onBrowseLibraries: () => void;
}

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function newItemId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `library-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function asLibraryItems(items: readonly StoredLibraryItem[]): LibraryItems {
  return items as unknown as LibraryItems;
}

function LibraryPreview({
  module,
  item,
}: {
  module: ExcalidrawModule | null;
  item: StoredLibraryItem;
}) {
  const [src, setSrc] = useState("");

  useEffect(() => {
    if (!module || !item.elements.length) {
      setSrc("");
      return;
    }
    let cancelled = false;
    // Il canvas è più affidabile dell'SVG inline in WebKitGTK e scala da solo
    // alla card. Se il render fallisce resta il placeholder.
    void module
      .exportToCanvas({
        elements: item.elements as never,
        appState: {
          exportBackground: true,
          viewBackgroundColor: "#ffffff",
          theme: "light",
        },
        files: null,
        maxWidthOrHeight: 240,
        exportPadding: 12,
      })
      .then((canvas: HTMLCanvasElement) => {
        if (cancelled) return;
        setSrc(canvas.toDataURL("image/png"));
      })
      .catch(() => {
        if (!cancelled) setSrc("");
      });
    return () => {
      cancelled = true;
    };
  }, [module, item]);

  return (
    <div className="community-library-preview board-library-preview">
      {src ? (
        <img src={src} alt={item.name ?? "Anteprima libreria"} />
      ) : (
        <Library size={26} />
      )}
    </div>
  );
}

export function BoardLibraryDialog({
  open,
  api,
  module,
  onClose,
  onBrowseLibraries,
}: BoardLibraryDialogProps) {
  const [items, setItems] = useState<StoredLibraryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    setError("");
    setEditingId(null);
    void loadBoardLibraryItems()
      .then((raw) => {
        if (!cancelled) setItems(normalizeBoardLibraryItems(raw ?? []));
      })
      .catch((loadError) => {
        if (!cancelled) setError(errorText(loadError));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return items;
    return items.filter((item) =>
      (item.name ?? "").toLowerCase().includes(needle),
    );
  }, [items, query]);

  if (!open) return null;

  const run = async (operation: () => Promise<void>) => {
    setBusy(true);
    setError("");
    try {
      await operation();
    } catch (operationError) {
      setError(errorText(operationError));
    } finally {
      setBusy(false);
    }
  };

  const applyLibrary = (libraryItems: LibraryItems) => {
    setItems(normalizeBoardLibraryItems(libraryItems));
  };

  const saveSelection = () =>
    run(async () => {
      if (!api) throw new Error("La lavagna non è pronta");
      const appState = api.getAppState();
      const selected = new Set(
        Object.entries(appState.selectedElementIds)
          .filter(([, value]) => value)
          .map(([id]) => id),
      );
      const elements = api
        .getSceneElements()
        .filter((element) => selected.has(element.id));
      if (!elements.length) {
        throw new Error("Seleziona almeno un elemento sulla lavagna");
      }
      const item: LibraryItem = {
        id: newItemId(),
        status: "unpublished",
        elements,
        created: Date.now(),
        name: `Elementi ${items.length + 1}`,
      };
      const libraryItems = await api.updateLibrary({
        libraryItems: [item],
        merge: true,
        prompt: false,
        openLibraryMenu: false,
      });
      applyLibrary(libraryItems);
      toast.success("Selezione aggiunta alla libreria");
    });

  const insert = async (item: StoredLibraryItem) => {
    if (!api || !module) return;
    setBusy(true);
    setError("");
    try {
      const elements = module.convertToExcalidrawElements(
        item.elements as never,
        { regenerateIds: true },
      ) as unknown as Record<string, unknown>[];
      const current = api.getSceneElements() as unknown as Record<
        string,
        unknown
      >[];
      const itemBounds = module.getCommonBounds(elements as never);
      const sceneBounds = current.length
        ? module.getCommonBounds(current as never)
        : null;
      const dx = sceneBounds
        ? sceneBounds[2] + 80 - itemBounds[0]
        : 80 - itemBounds[0];
      const dy = sceneBounds
        ? sceneBounds[1] - itemBounds[1]
        : 80 - itemBounds[1];
      const placed: Record<string, unknown>[] = elements.map((element) => ({
        ...element,
        x: Number(element.x) + dx,
        y: Number(element.y) + dy,
      }));
      api.updateScene({
        elements: [...current, ...placed] as never,
        appState: {
          selectedElementIds: Object.fromEntries(
            placed.map((element) => [String(element.id), true]),
          ),
        } as never,
      });
      window.setTimeout(() => {
        if (!api.isDestroyed) {
          api.scrollToContent(placed as never, { fitToContent: true });
        }
      }, 60);
      toast.success("Elementi inseriti nella lavagna");
      onClose();
    } catch (insertError) {
      setError(errorText(insertError));
    } finally {
      setBusy(false);
    }
  };

  const remove = (item: StoredLibraryItem) =>
    run(async () => {
      if (!api) throw new Error("La lavagna non è pronta");
      if (!window.confirm(`Rimuovere «${item.name ?? "elementi"}» dalla libreria?`)) {
        return;
      }
      const libraryItems = await api.updateLibrary({
        libraryItems: asLibraryItems(items.filter((entry) => entry.id !== item.id)),
        merge: false,
        prompt: false,
        openLibraryMenu: false,
      });
      applyLibrary(libraryItems);
    });

  const clear = () =>
    run(async () => {
      if (!api) throw new Error("La lavagna non è pronta");
      if (!window.confirm("Svuotare tutta la libreria personale?")) return;
      const libraryItems = await api.updateLibrary({
        libraryItems: [],
        merge: false,
        prompt: false,
        openLibraryMenu: false,
      });
      applyLibrary(libraryItems);
    });

  const commitRename = (item: StoredLibraryItem) =>
    run(async () => {
      if (!api) throw new Error("La lavagna non è pronta");
      const name = draftName.trim();
      if (!name) {
        setEditingId(null);
        return;
      }
      const next = items.map((entry) =>
        entry.id === item.id ? { ...entry, name } : entry,
      );
      const libraryItems = await api.updateLibrary({
        libraryItems: asLibraryItems(next),
        merge: false,
        prompt: false,
        openLibraryMenu: false,
      });
      applyLibrary(libraryItems);
      setEditingId(null);
    });

  const importFile = (file: File | undefined) => {
    if (!file) return;
    void run(async () => {
      if (!api) throw new Error("La lavagna non è pronta");
      const libraryItems = await api.updateLibrary({
        libraryItems: file,
        merge: true,
        prompt: false,
        openLibraryMenu: false,
        defaultStatus: "unpublished",
      });
      applyLibrary(libraryItems);
      toast.success(`«${file.name}» aggiunta alla libreria`);
    });
  };

  return (
    <div
      className="modal-overlay community-library-overlay board-library-overlay"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        className="modal community-library-modal board-library-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="board-library-title"
      >
        <header className="modal-header community-library-header">
          <div>
            <div className="eyebrow">Excalidraw</div>
            <h2 id="board-library-title">Libreria</h2>
            <p className="muted">
              Salva le selezioni della lavagna, reinseriscile con un clic e
              gestisci le librerie importate. Funziona anche con il viewer
              espanso.
            </p>
          </div>
          <button
            className="icon-btn"
            onClick={onClose}
            aria-label="Chiudi la libreria"
            title="Chiudi"
          >
            <X size={17} />
          </button>
        </header>

        <div className="community-library-toolbar">
          <label className="community-library-search">
            <Search size={14} />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Cerca nella libreria personale…"
              aria-label="Cerca nella libreria personale"
              autoFocus
            />
          </label>
          <button
            className="btn btn-primary tiny"
            onClick={() => void saveSelection()}
            disabled={!api || busy}
            title="Salva gli elementi selezionati nella lavagna"
          >
            <Plus size={13} />
            Aggiungi selezione
          </button>
          <button
            className="btn btn-ghost tiny"
            onClick={onBrowseLibraries}
            disabled={busy}
            title="Apri il catalogo delle librerie della comunità"
          >
            <FolderOpen size={13} />
            Sfoglia librerie
          </button>
          <button
            className="btn btn-ghost tiny"
            onClick={() => fileInputRef.current?.click()}
            disabled={!api || busy}
            title="Importa un file .excalidrawlib locale"
          >
            <Upload size={13} />
            Importa file
          </button>
          <input
            ref={fileInputRef}
            className="visually-hidden"
            type="file"
            accept=".excalidrawlib,application/json"
            onChange={(event) => {
              importFile(event.target.files?.[0]);
              event.target.value = "";
            }}
          />
          <button
            className="btn btn-ghost tiny danger"
            onClick={() => void clear()}
            disabled={!api || busy || items.length === 0}
            title="Svuota la libreria personale"
          >
            <Trash2 size={13} />
            Svuota
          </button>
        </div>

        {error && (
          <div className="community-library-notice" role="alert">
            <AlertTriangle size={14} />
            <span>{error}</span>
          </div>
        )}

        <div className="community-library-body">
          {loading ? (
            <div className="empty-inline tall">
              <Loader2 className="spin" size={20} /> Caricamento libreria…
            </div>
          ) : visible.length === 0 ? (
            <div className="empty-inline tall">
              <Library size={28} />
              <p>
                {items.length === 0
                  ? "La libreria è vuota. Seleziona elementi sulla lavagna e usa «Aggiungi selezione», oppure importa un file .excalidrawlib."
                  : "Nessun elemento corrisponde alla ricerca."}
              </p>
            </div>
          ) : (
            <div className="community-library-grid">
              {visible.map((item) => (
                <article className="community-library-card" key={item.id}>
                  <LibraryPreview module={module} item={item} />
                  <div className="community-library-info">
                    {editingId === item.id ? (
                      <form
                        className="board-library-rename"
                        onSubmit={(event) => {
                          event.preventDefault();
                          void commitRename(item);
                        }}
                      >
                        <input
                          value={draftName}
                          onChange={(event) => setDraftName(event.target.value)}
                          autoFocus
                          aria-label="Nuovo nome dell'elemento"
                        />
                        <button className="btn btn-primary tiny" type="submit">
                          Salva
                        </button>
                        <button
                          className="btn btn-ghost tiny"
                          type="button"
                          onClick={() => setEditingId(null)}
                        >
                          Annulla
                        </button>
                      </form>
                    ) : (
                      <h3 title={item.name}>{item.name ?? "Elementi"}</h3>
                    )}
                    <p className="community-library-items">
                      {item.elements.length} element
                      {item.elements.length === 1 ? "o" : "i"}
                      {item.status === "published" ? " · pubblicato" : ""}
                    </p>
                  </div>
                  <div className="board-library-actions">
                    <button
                      className="btn btn-primary tiny"
                      onClick={() => void insert(item)}
                      disabled={!api || !module || busy}
                    >
                      Inserisci
                    </button>
                    <button
                      className="btn btn-ghost tiny"
                      onClick={() => {
                        setEditingId(item.id);
                        setDraftName(item.name ?? "");
                      }}
                      disabled={busy}
                      title="Rinomina"
                    >
                      <Pencil size={12} />
                    </button>
                    <button
                      className="btn btn-ghost tiny danger"
                      onClick={() => void remove(item)}
                      disabled={busy}
                      title="Elimina"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>

        <footer className="community-library-footer">
          <span>
            {visible.length} element{visible.length === 1 ? "o" : "i"}
            {items.length !== visible.length ? ` su ${items.length}` : ""}
          </span>
          <span>
            Gli elementi sono salvati nel database dell'app e condivisi tra le
            lavagne.
          </span>
        </footer>
      </div>
    </div>
  );
}
