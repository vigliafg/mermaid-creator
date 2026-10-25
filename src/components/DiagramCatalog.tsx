import { ArrowLeft, Copy, Loader2, Search, Sparkles, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { renderDiagram } from "../lib/diagram";
import {
  DIAGRAM_CATALOG,
  DIAGRAM_CATEGORIES,
  type DiagramCatalogEntry,
  type DiagramVariant,
} from "../lib/diagram/catalog";
import { capabilitiesFor } from "../lib/diagram/document";
import { defaultTheme, type ThemeMode } from "../lib/diagram/theme";
import { useApp } from "../store";

interface Props {
  open: boolean;
  onClose: () => void;
  onUsePrompt: (prompt: string) => void;
}

const svgCache = new Map<string, string>();

function useThemeMode(): ThemeMode {
  const settings = useApp((state) => state.settings);
  return settings.theme === "light" ? "light" : "dark";
}

function DiagramPreview({
  source,
  mode,
  eager = false,
  label,
}: {
  source: string;
  mode: ThemeMode;
  eager?: boolean;
  label: string;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(eager);
  const [svg, setSvg] = useState(() => svgCache.get(`${mode}|${source}`) ?? "");
  const [error, setError] = useState("");

  useEffect(() => {
    if (eager || !hostRef.current || typeof IntersectionObserver === "undefined") {
      setVisible(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: "240px" },
    );
    observer.observe(hostRef.current);
    return () => observer.disconnect();
  }, [eager]);

  useEffect(() => {
    if (!visible) return;
    const key = `${mode}|${source}`;
    const cached = svgCache.get(key);
    if (cached) {
      setSvg(cached);
      setError("");
      return;
    }
    let cancelled = false;
    setError("");
    void renderDiagram(source, defaultTheme(), mode)
      .then((result) => {
        if (cancelled) return;
        svgCache.set(key, result.svg);
        setSvg(result.svg);
      })
      .catch((reason: unknown) => {
        if (cancelled) return;
        setError(reason instanceof Error ? reason.message : String(reason));
      });
    return () => {
      cancelled = true;
    };
  }, [mode, source, visible]);

  return (
    <div className={`catalog-preview ${eager ? "large" : ""}`} ref={hostRef} aria-label={label}>
      {svg ? (
        <div className="catalog-svg" dangerouslySetInnerHTML={{ __html: svg }} />
      ) : error ? (
        <span className="catalog-preview-error">Anteprima non disponibile</span>
      ) : (
        <Loader2 className="spin" size={18} />
      )}
    </div>
  );
}

function CatalogCard({
  entry,
  mode,
  onOpen,
}: {
  entry: DiagramCatalogEntry;
  mode: ThemeMode;
  onOpen: (entry: DiagramCatalogEntry, variantId: string) => void;
}) {
  const [activeId, setActiveId] = useState(entry.variants[0]?.id ?? "");
  const active =
    entry.variants.find((item) => item.id === activeId) ?? entry.variants[0];

  if (!active) return null;

  return (
    <article className="catalog-card">
      <div className="catalog-card-stage">
        <button
          type="button"
          className="catalog-card-preview"
          onClick={() => onOpen(entry, active.id)}
          title={`Apri ${entry.name}: ${active.name}`}
        >
          <DiagramPreview
            source={active.source}
            mode={mode}
            label={`Anteprima ${entry.name}: ${active.name}`}
          />
        </button>
        <div
          className="catalog-variant-rail"
          role="tablist"
          aria-label={`Varianti di ${entry.name}`}
        >
          {entry.variants.map((item, index) => (
            <button
              type="button"
              role="tab"
              key={item.id}
              aria-selected={item.id === active.id}
              className={`catalog-variant-pill ${item.id === active.id ? "active" : ""}`}
              title={item.description}
              onClick={() => setActiveId(item.id)}
            >
              <span className="catalog-variant-index">
                {String(index + 1).padStart(2, "0")}
              </span>
              <span className="catalog-variant-name">{item.name}</span>
            </button>
          ))}
        </div>
      </div>
      <button
        type="button"
        className="catalog-card-body"
        onClick={() => onOpen(entry, active.id)}
      >
        <span className="catalog-card-meta">
          <span className="badge">{entry.category}</span>
          <span className="catalog-variant-count">{entry.variants.length} varianti</span>
        </span>
        <strong>{entry.name}</strong>
        <span className="catalog-card-description">{entry.description}</span>
        <span className="catalog-card-active">
          {active.name} · {active.description}
        </span>
      </button>
    </article>
  );
}

function capabilityBadges(entry: DiagramCatalogEntry): string[] {
  const capabilities = capabilitiesFor(entry.kind);
  const badges: string[] = [];
  if (capabilities.nodes) badges.push("Stile nodi");
  if (capabilities.edges) badges.push("Stile archi");
  if (entry.kind === "flowchart") badges.push("Punte");
  if (capabilities.direction) badges.push("Direzione");
  if (capabilities.edgeSelection && !capabilities.edges) badges.push("Selezione archi");
  if (capabilities.structure) badges.push("Editing struttura");
  if (!capabilities.nodes && !capabilities.edges) badges.push("Solo palette");
  return badges;
}

function promptFor(entry: DiagramCatalogEntry, variant: DiagramVariant): string {
  return `Crea un diagramma ${entry.name} (variante "${variant.name}") sul seguente argomento: `;
}

export function DiagramCatalog({ open, onClose, onUsePrompt }: Props) {
  const mode = useThemeMode();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string>("Tutti");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [variantId, setVariantId] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);

  const selected = selectedId
    ? DIAGRAM_CATALOG.find((entry) => entry.id === selectedId) ?? null
    : null;
  const variant =
    selected?.variants.find((item) => item.id === variantId) ?? selected?.variants[0] ?? null;

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const frame = window.requestAnimationFrame(() => searchRef.current?.focus());
    return () => {
      window.cancelAnimationFrame(frame);
      document.body.style.overflow = previous;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        if (selectedId) setSelectedId(null);
        else onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, open, selectedId]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return DIAGRAM_CATALOG.filter((entry) => {
      if (category !== "Tutti" && entry.category !== category) return false;
      if (!q) return true;
      const haystack = [
        entry.name,
        entry.category,
        entry.description,
        entry.useWhen,
        ...entry.tags,
        ...entry.variants.flatMap((item) => [item.name, item.description]),
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [category, query]);

  const openEntry = (entry: DiagramCatalogEntry, initialVariantId?: string) => {
    setSelectedId(entry.id);
    setVariantId(initialVariantId ?? entry.variants[0]?.id ?? "");
  };

  const useVariant = () => {
    if (!selected || !variant) return;
    onUsePrompt(promptFor(selected, variant));
    onClose();
  };

  const copySource = async () => {
    if (!variant) return;
    try {
      await navigator.clipboard.writeText(variant.source);
      toast.success("Sorgente Mermaid copiato");
    } catch (error) {
      toast.error(`Copia sorgente: ${String(error)}`);
    }
  };

  if (!open) return null;

  return (
    <div
      className="catalog-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="catalog-modal" role="dialog" aria-modal="true" aria-label="Catalogo diagrammi">
        <header className="catalog-head">
          {selected ? (
            <button className="icon-btn" title="Torna al catalogo" onClick={() => setSelectedId(null)}>
              <ArrowLeft size={16} />
            </button>
          ) : (
            <span className="catalog-head-icon">
              <Sparkles size={17} />
            </span>
          )}
          <div className="catalog-heading">
            <div className="eyebrow">{selected ? selected.category : "Catalogo Mermaid"}</div>
            <h2>{selected ? selected.name : "Tipi di diagramma"}</h2>
            <p>
              {selected
                ? selected.description
                : "Scegli un tipo, guarda una variante e usala come base per la richiesta."}
            </p>
          </div>
          <button className="icon-btn" title="Chiudi" onClick={onClose}>
            <X size={17} />
          </button>
        </header>

        {selected && variant ? (
          <div className="catalog-detail">
            <p className="catalog-use-when">{selected.useWhen}</p>
            <div className="catalog-badges">
              {capabilityBadges(selected).map((badge) => (
                <span className="badge" key={badge}>
                  {badge}
                </span>
              ))}
            </div>

            <div className="catalog-detail-body">
              <div
                className="catalog-variants"
                role="tablist"
                aria-label={`Varianti di ${selected.name}`}
              >
                {selected.variants.map((item, index) => (
                  <button
                    key={item.id}
                    role="tab"
                    aria-selected={item.id === variant.id}
                    className={`catalog-variant ${item.id === variant.id ? "active" : ""}`}
                    onClick={() => setVariantId(item.id)}
                  >
                    <span className="catalog-variant-index">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <strong>{item.name}</strong>
                    <span>{item.description}</span>
                  </button>
                ))}
              </div>
              <DiagramPreview
                source={variant.source}
                mode={mode}
                eager
                label={`Anteprima ${selected.name}: ${variant.name}`}
              />
              <aside className="catalog-detail-copy">
                <h3>{variant.name}</h3>
                <p>{variant.description}</p>
                <div className="catalog-actions">
                  <button className="btn" onClick={useVariant}>
                    <Sparkles size={14} /> Usa come base
                  </button>
                  <button className="btn btn-ghost" onClick={() => void copySource()}>
                    <Copy size={14} /> Copia sorgente
                  </button>
                </div>
                <p className="catalog-hint">
                  “Usa come base” prepara la richiesta nella chat: poi descrivi il tuo
                  contenuto e invia.
                </p>
              </aside>
            </div>
          </div>
        ) : (
          <>
            <div className="catalog-controls">
              <div className="catalog-search">
                <Search size={14} />
                <input
                  ref={searchRef}
                  className="input"
                  placeholder="Cerca un tipo o un uso: processo, API, timeline…"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                />
              </div>
              <div className="catalog-filters">
                {["Tutti", ...DIAGRAM_CATEGORIES].map((item) => (
                  <button
                    key={item}
                    className={`catalog-filter ${category === item ? "active" : ""}`}
                    onClick={() => setCategory(item)}
                  >
                    {item}
                  </button>
                ))}
              </div>
            </div>

            {filtered.length === 0 ? (
              <div className="catalog-empty">
                Nessun diagramma per questa ricerca. Prova con “processo”, “dati” o “API”.
              </div>
            ) : (
              <div className="catalog-grid">
                {filtered.map((entry) => (
                  <CatalogCard
                    key={entry.id}
                    entry={entry}
                    mode={mode}
                    onOpen={openEntry}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
