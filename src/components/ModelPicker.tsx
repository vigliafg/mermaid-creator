import { useMemo, useState } from "react";
import { Check, Search, Sparkles, X } from "lucide-react";
import { useApp } from "../store";
import type { ModelInfo } from "../types";

function price(value: number): string {
  if (!value) return "gratis";
  return `$${value.toFixed(2)}/M`;
}

function ModelRow({
  model,
  selected,
  onSelect,
}: {
  model: ModelInfo;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button className={`model-row ${selected ? "selected" : ""}`} onClick={onSelect}>
      <div className="model-row-main">
        <div className="model-name">
          {model.name}
          {model.supportsVision && <span className="badge badge-blue">vision</span>}
          {model.promptPrice === 0 && <span className="badge badge-green">free</span>}
        </div>
        <div className="model-id">{model.id}</div>
      </div>
      <div className="model-meta">
        <span>{model.contextLength ? `${Math.round(model.contextLength / 1000)}k ctx` : "ctx n/d"}</span>
        <span>{price(model.promptPrice)}</span>
        {selected && <Check size={15} />}
      </div>
    </button>
  );
}

export function ModelPicker({ onClose }: { onClose: () => void }) {
  const models = useApp((s) => s.models);
  const modelsLoading = useApp((s) => s.modelsLoading);
  const settings = useApp((s) => s.settings);
  const setModel = useApp((s) => s.setModel);
  const refreshModels = useApp((s) => s.refreshModels);
  const [query, setQuery] = useState("");
  const [visionOnly, setVisionOnly] = useState(false);
  const [freeOnly, setFreeOnly] = useState(false);

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    return models.filter((model) => {
      if (visionOnly && !model.supportsVision) return false;
      if (freeOnly && model.promptPrice !== 0) return false;
      if (!q) return true;
      return `${model.name} ${model.id}`.toLowerCase().includes(q);
    });
  }, [models, query, visionOnly, freeOnly]);

  return (
    <div className="modal-overlay" onMouseDown={onClose}>
      <div className="modal model-modal" onMouseDown={(event) => event.stopPropagation()}>
        <header className="modal-header">
          <div>
            <div className="eyebrow">OpenRouter</div>
            <h2>Seleziona modello</h2>
          </div>
          <button className="icon-btn" onClick={onClose} aria-label="Chiudi">
            <X size={18} />
          </button>
        </header>
        <div className="model-toolbar">
          <div className="input-with-action">
            <Search size={16} className="input-icon" />
            <input
              className="input"
              autoFocus
              placeholder="Cerca per nome o id…"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>
          <label className="check">
            <input
              type="checkbox"
              checked={visionOnly}
              onChange={(event) => setVisionOnly(event.target.checked)}
            />
            Vision
          </label>
          <label className="check">
            <input
              type="checkbox"
              checked={freeOnly}
              onChange={(event) => setFreeOnly(event.target.checked)}
            />
            Gratis
          </label>
          <button
            className="btn btn-ghost"
            onClick={() => void refreshModels()}
            disabled={modelsLoading}
          >
            <Sparkles size={15} />
            {modelsLoading ? "Aggiorno…" : "Aggiorna"}
          </button>
        </div>
        <div className="model-list">
          {filtered.length === 0 ? (
            <div className="empty-inline">
              {modelsLoading ? "Caricamento catalogo…" : "Nessun modello trovato"}
            </div>
          ) : (
            filtered.map((model) => (
              <ModelRow
                key={model.id}
                model={model}
                selected={settings.model_id === model.id}
                onSelect={() => {
                  void setModel(model.id);
                  onClose();
                }}
              />
            ))
          )}
        </div>
        <footer className="modal-footer">
          <span>{filtered.length} modelli</span>
          <span className="muted">Prezzi indicativi per milione di token</span>
        </footer>
      </div>
    </div>
  );
}
