import { useEffect, useMemo, useRef, useState } from "react";
import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";
import {
  Download,
  Library,
  Loader2,
  RefreshCw,
  Search,
  Upload,
  WifiOff,
  X,
} from "lucide-react";
import { toast } from "sonner";
import {
  COMMUNITY_SORT_LABELS,
  communityLibraryPreviewUrl,
  fetchCommunityCatalog,
  fetchCommunityLibrary,
  searchCommunityLibraries,
  sortCommunityLibraries,
  type CommunityLibrary,
  type CommunitySort,
} from "../../lib/board/community";
import {
  loadCachedCommunityCatalog,
  saveCommunityCatalog,
} from "../../lib/board/libraryStore";

interface CommunityLibraryDialogProps {
  open: boolean;
  api: ExcalidrawImperativeAPI | null;
  onClose: () => void;
}

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function previewSrc(library: CommunityLibrary): string | null {
  if (!library.preview) return null;
  try {
    return communityLibraryPreviewUrl(library.preview);
  } catch {
    return null;
  }
}

function installErrorMessage(error: unknown): string {
  return `Installazione non riuscita: ${errorText(error)}`;
}

export function CommunityLibraryDialog({
  open,
  api,
  onClose,
}: CommunityLibraryDialogProps) {
  const [libraries, setLibraries] = useState<CommunityLibrary[] | null>(null);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<CommunitySort>("recommended");
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [offline, setOffline] = useState(false);
  const [fetchedAt, setFetchedAt] = useState(0);
  const [installing, setInstalling] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    let cancelled = false;
    setError("");
    setInstalling(null);

    void (async () => {
      let cached: Awaited<ReturnType<typeof loadCachedCommunityCatalog>> = null;
      try {
        cached = await loadCachedCommunityCatalog();
      } catch {
        cached = null;
      }
      if (cancelled) return;
      if (cached) {
        setLibraries(cached.libraries);
        setFetchedAt(cached.fetchedAt);
        setLoading(false);
        setOffline(false);
      } else {
        setLoading(true);
      }
      setRefreshing(true);
      try {
        const fresh = await fetchCommunityCatalog(controller.signal);
        if (cancelled) return;
        setLibraries(fresh.libraries);
        setFetchedAt(fresh.fetchedAt);
        setOffline(false);
        setError("");
        await saveCommunityCatalog(fresh.libraries, fresh.fetchedAt).catch(
          () => undefined,
        );
      } catch (loadError) {
        if (cancelled || controller.signal.aborted) return;
        setError(errorText(loadError));
        setOffline(Boolean(cached));
      } finally {
        if (!cancelled) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    })();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [open, reloadToken]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const visible = useMemo(
    () =>
      sortCommunityLibraries(
        searchCommunityLibraries(libraries ?? [], query),
        sort,
      ),
    [libraries, query, sort],
  );

  if (!open) return null;

  const install = async (library: CommunityLibrary) => {
    if (!api || installing) return;
    setInstalling(library.source);
    try {
      const blob = await fetchCommunityLibrary(library.source);
      await api.updateLibrary({
        libraryItems: blob,
        prompt: false,
        merge: true,
        openLibraryMenu: true,
        defaultStatus: "published",
      });
      toast.success(`«${library.name}» aggiunta alla libreria`);
      onClose();
    } catch (installError) {
      toast.error(installErrorMessage(installError));
    } finally {
      setInstalling(null);
    }
  };

  const importFile = async (file: File | undefined) => {
    if (!api || !file || installing) return;
    setInstalling("__file__");
    try {
      await api.updateLibrary({
        libraryItems: file,
        prompt: false,
        merge: true,
        openLibraryMenu: true,
        defaultStatus: "unpublished",
      });
      toast.success(`«${file.name}» aggiunta alla libreria`);
      onClose();
    } catch (importError) {
      toast.error(installErrorMessage(importError));
    } finally {
      setInstalling(null);
    }
  };

  const updatedLabel = fetchedAt
    ? new Intl.DateTimeFormat("it-IT", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      }).format(new Date(fetchedAt))
    : null;

  return (
    <div
      className="modal-overlay community-library-overlay"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        className="modal community-library-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="community-library-title"
      >
        <header className="modal-header community-library-header">
          <div>
            <div className="eyebrow">Excalidraw</div>
            <h2 id="community-library-title">Librerie della comunità</h2>
            <p className="muted">
              Sfoglia il catalogo pubblico, installa forme e icone nella tua
              libreria e ritrovale in ogni sessione.
            </p>
          </div>
          <button
            className="icon-btn"
            onClick={onClose}
            aria-label="Chiudi le librerie della comunità"
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
              placeholder="Cerca per nome, autore o contenuto…"
              aria-label="Cerca nelle librerie della comunità"
              autoFocus
            />
          </label>
          <select
            value={sort}
            onChange={(event) => setSort(event.target.value as CommunitySort)}
            aria-label="Ordina le librerie"
          >
            {(Object.keys(COMMUNITY_SORT_LABELS) as CommunitySort[]).map(
              (key) => (
                <option key={key} value={key}>
                  {COMMUNITY_SORT_LABELS[key]}
                </option>
              ),
            )}
          </select>
          <button
            className="btn btn-ghost tiny"
            onClick={() => setReloadToken((value) => value + 1)}
            disabled={refreshing}
            title="Aggiorna il catalogo dalla rete"
          >
            <RefreshCw size={13} className={refreshing ? "spin" : undefined} />
            Aggiorna
          </button>
          <button
            className="btn btn-ghost tiny"
            onClick={() => fileInputRef.current?.click()}
            disabled={!api || Boolean(installing)}
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
              void importFile(event.target.files?.[0]);
              event.target.value = "";
            }}
          />
        </div>

        {offline && (
          <div className="community-library-notice" role="status">
            <WifiOff size={14} />
            <span>
              Catalogo offline
              {updatedLabel ? ` (aggiornato il ${updatedLabel})` : ""}. Le
              librerie già installate restano disponibili.
            </span>
          </div>
        )}

        <div className="community-library-body">
          {loading && !libraries ? (
            <div className="empty-inline tall">
              <Loader2 className="spin" size={20} /> Caricamento catalogo…
            </div>
          ) : error && !libraries ? (
            <div className="render-error community-library-error">
              <WifiOff size={22} />
              <h3>Catalogo non raggiungibile</h3>
              <pre>{error}</pre>
              <p className="muted">
                Controlla la connessione. Le librerie già installate sono
                comunque disponibili nell'editor.
              </p>
              <button
                className="btn btn-ghost"
                onClick={() => setReloadToken((value) => value + 1)}
              >
                <RefreshCw size={14} /> Riprova
              </button>
            </div>
          ) : visible.length === 0 ? (
            <div className="empty-inline tall">
              Nessuna libreria corrisponde alla ricerca.
            </div>
          ) : (
            <div className="community-library-grid">
              {visible.map((library) => {
                const src = previewSrc(library);
                const isInstalling = installing === library.source;
                return (
                  <article
                    className="community-library-card"
                    key={library.source}
                  >
                    <div className="community-library-preview">
                      {src ? (
                        <img
                          src={src}
                          alt=""
                          loading="lazy"
                          onError={(event) => {
                            event.currentTarget.style.display = "none";
                          }}
                        />
                      ) : (
                        <Library size={26} />
                      )}
                    </div>
                    <div className="community-library-info">
                      <h3 title={library.name}>{library.name}</h3>
                      {library.authors.length > 0 && (
                        <p className="community-library-authors">
                          {library.authors
                            .map((author) => `@${author.name}`)
                            .join(" ")}
                        </p>
                      )}
                      <p className="community-library-description">
                        {library.description || "Nessuna descrizione."}
                      </p>
                      {library.itemNames.length > 0 && (
                        <p
                          className="community-library-items"
                          title={library.itemNames.join(", ")}
                        >
                          {library.itemNames.slice(0, 6).join(" · ")}
                          {library.itemNames.length > 6 ? " …" : ""}
                        </p>
                      )}
                      <div className="community-library-meta">
                        <span>
                          {library.downloads.total.toLocaleString("it-IT")}{" "}
                          download
                        </span>
                        <span>v{library.version}</span>
                        <span>{library.updated}</span>
                      </div>
                    </div>
                    <button
                      className="btn btn-primary tiny community-library-install"
                      onClick={() => void install(library)}
                      disabled={!api || Boolean(installing)}
                    >
                      {isInstalling ? (
                        <Loader2 className="spin" size={13} />
                      ) : (
                        <Download size={13} />
                      )}
                      {isInstalling ? "Installo…" : "Installa"}
                    </button>
                  </article>
                );
              })}
            </div>
          )}
        </div>

        <footer className="community-library-footer">
          <span>
            {visible.length} librer
            {visible.length === 1 ? "ia" : "ie"}
            {libraries ? ` su ${libraries.length}` : ""}
          </span>
          <span>
            Le librerie installate sono salvate nel database dell'app e restano
            disponibili tra sessioni.
          </span>
        </footer>
      </div>
    </div>
  );
}
