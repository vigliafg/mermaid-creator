import { ArrowLeftRight, Eye, RotateCcw, Search, WandSparkles } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type {
  Capabilities,
  DiagramKind,
  DiagramModel,
  StyleMap,
} from "../../lib/diagram/document";
import { edgeKey, elementKey } from "../../lib/diagram/document";
import type { Selection } from "../../lib/diagram/selection";
import { selectionLabel } from "../../lib/diagram/selection";
import { findDefinition, EDGE_ARROW_OPTIONS, readEdgeArrow, SHAPE_OPTIONS } from "../../lib/diagram/flowchart";
import type { ElementKind, VisualStyle } from "../../lib/diagram/styles";
import { DASH_OPTIONS, effectiveStyle, styleFor } from "../../lib/diagram/styles";
import {
  checkContrast,
  contrastLabel,
  suggestTextColor,
  type DiagramTokens,
  type PresetId,
} from "../../lib/diagram/theme";

interface Props {
  kind: DiagramKind;
  model: DiagramModel | null;
  source: string;
  capabilities: Capabilities;
  selections: Selection[];
  styles: StyleMap;
  tokens: DiagramTokens;
  onSelect: (selection: Selection | null, additive: boolean) => void;
  onPatch: (patch: Partial<VisualStyle>) => void;
  onReset: () => void;
  onBulk: (scope: "nodes" | "edges") => void;
  onLabelChange: (id: string, label: string) => void;
  onShapeChange: (id: string, shapeId: string) => void;
  onReveal: () => void;
  onApplyPreset: (preset: PresetId) => void;
  onEdgeArrow: (styleId: string) => void;
  onReverseEdge: () => void;
}

function normalizeHex(value: string | undefined, fallback: string): string {
  if (!value) return fallback;
  if (/^#[0-9a-fA-F]{6}$/.test(value)) return value;
  if (/^#[0-9a-fA-F]{3}$/.test(value)) {
    return `#${value[1]}${value[1]}${value[2]}${value[2]}${value[3]}${value[3]}`;
  }
  return fallback;
}

function ColorField({
  label,
  value,
  fallback,
  onChange,
}: {
  label: string;
  value: string | undefined;
  fallback: string;
  onChange: (value: string) => void;
}) {
  const [text, setText] = useState(value ?? fallback);
  useEffect(() => {
    setText(value ?? fallback);
  }, [fallback, value]);
  const commit = () => {
    const next = text.trim();
    if (/^#[0-9a-fA-F]{3,8}$/.test(next) || /^rgba?\([^)]*\)$/.test(next)) onChange(next);
    else setText(value ?? fallback);
  };
  return (
    <div className="style-field color-field">
      <span className="style-label">{label}</span>
      <div className="color-control">
        <input
          type="color"
          value={normalizeHex(value, fallback)}
          onChange={(event) => onChange(event.target.value)}
          aria-label={label}
        />
        <input
          className="input hex-input"
          value={text}
          onChange={(event) => setText(event.target.value)}
          onBlur={commit}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              commit();
            }
          }}
          spellCheck={false}
        />
      </div>
    </div>
  );
}

function NumberField({
  label,
  value,
  min,
  max,
  step = 1,
  suffix,
  onChange,
}: {
  label: string;
  value: number | undefined;
  min: number;
  max: number;
  step?: number;
  suffix?: string;
  onChange: (value: number) => void;
}) {
  return (
    <label className="style-field number-field">
      <span className="style-label">{label}</span>
      <span className="number-control">
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value ?? min}
          onChange={(event) => onChange(Number(event.target.value))}
        />
        <input
          className="input number-input"
          type="number"
          min={min}
          max={max}
          step={step}
          value={value ?? ""}
          placeholder="auto"
          onChange={(event) => {
            const next = Number(event.target.value);
            if (Number.isFinite(next)) onChange(next);
          }}
        />
        {suffix && <span className="style-suffix">{suffix}</span>}
      </span>
    </label>
  );
}

export function Inspector({
  kind,
  model,
  source,
  capabilities,
  selections,
  styles,
  tokens,
  onSelect,
  onPatch,
  onReset,
  onBulk,
  onLabelChange,
  onShapeChange,
  onReveal,
  onApplyPreset,
  onEdgeArrow,
  onReverseEdge,
}: Props) {
  const [query, setQuery] = useState("");
  const [labelDraft, setLabelDraft] = useState("");

  const primary = selections[0];
  const labelNode = primary?.kind === "node" ? model?.nodes.find((node) => node.id === primary.id) : null;
  const endpointLabel = (id: string) =>
    model?.nodes.find((node) => node.id === id)?.label ?? id;

  useEffect(() => {
    setLabelDraft(labelNode?.label ?? "");
  }, [labelNode?.id, labelNode?.label]);

  const style = primary
    ? styleFor(styles, primary.kind, primary.kind === "edge" ? primary.index ?? Number(primary.id) : primary.id)
    : undefined;
  const effective = primary ? effectiveStyle(tokens, primary.kind, style) : null;
  const contrast =
    primary && effective
      ? checkContrast({
          fill: effective.fill,
          text: effective.textColor,
          stroke: effective.stroke,
          background: tokens.bg,
        })
      : null;
  const arrowState =
    primary?.kind === "edge" && kind === "flowchart" && model
      ? readEdgeArrow(source, model, primary.index ?? Number(primary.id))
      : null;

  const filteredNodes = useMemo(() => {
    const nodes = model?.nodes ?? [];
    const clusters = model?.clusters ?? [];
    const q = query.trim().toLowerCase();
    const all = [
      ...nodes.map((node) => ({ kind: "node" as ElementKind, id: node.id, text: `${node.label} · ${node.id}` })),
      ...clusters.map((cluster) => ({
        kind: "cluster" as ElementKind,
        id: cluster.id,
        text: `${cluster.label} · ${cluster.id}`,
      })),
    ];
    return q ? all.filter((item) => item.text.toLowerCase().includes(q)) : all;
  }, [model, query]);

  const filteredEdges = useMemo(() => {
    const edges = model?.edges ?? [];
    const q = query.trim().toLowerCase();
    const textFor = (edge: (typeof edges)[number]) =>
      `${endpointLabel(edge.from)} ${endpointLabel(edge.to)} ${edge.from} ${edge.to} ${edge.label}`.toLowerCase();
    return q ? edges.filter((edge) => textFor(edge).includes(q)) : edges;
  }, [model, query]);

  const canEditKind = primary
    ? primary.kind === "edge"
      ? capabilities.edges
      : primary.kind === "cluster"
        ? capabilities.clusters
        : capabilities.nodes
    : false;

  const kindLabel = kind === "unknown" ? "tipo sconosciuto" : kind;

  const elementBrowser = (
  <div className="element-browser">
            <div className="element-search">
              <Search size={14} />
              <input
                className="input"
                placeholder="Cerca nodo o arco…"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </div>
            <div className="element-scroll">
              <div className="element-group-label">
                Nodi e gruppi <span>{filteredNodes.length}</span>
              </div>
              {filteredNodes.map((item) => (
                <button
                  key={`${item.kind}:${item.id}`}
                  className="element-row"
                  onClick={() => onSelect({ kind: item.kind, id: item.id, key: elementKey(item.id) }, false)}
                >
                  <span className={`element-dot ${item.kind}`} />
                  <span>{item.text}</span>
                </button>
              ))}
              <div className="element-group-label">
                Archi <span>{filteredEdges.length}</span>
              </div>
              {filteredEdges.map((edge) => (
                <button
                  key={edge.index}
                  className="element-row"
                  onClick={() =>
                    onSelect(
                      { kind: "edge", id: String(edge.index), index: edge.index, key: edgeKey(edge.index) },
                      false,
                    )
                  }
                >
                  <span className="element-dot edge" />
                  <span>
                    {endpointLabel(edge.from)} → {endpointLabel(edge.to)}
                    {edge.label ? ` · ${edge.label}` : ""}
                  </span>
                </button>
              ))}
            </div>
            <p className="inspector-hint">
              Clicca un elemento nel diagramma (Shift per selezione multipla) oppure scegli
              dall'elenco. Tipi di diagramma: <strong>{kindLabel}</strong>.
            </p>
          </div>
  );

  return (
    <div className="inspector">
      <div className="inspector-head">
        <div>
          <div className="eyebrow">Elemento</div>
          <h3>{primary ? selectionLabel(model, primary) : "Nessuna selezione"}</h3>
        </div>
        {primary && (
          <button className="icon-btn" title="Vai alla riga nel sorgente" onClick={onReveal}>
            <Eye size={15} />
          </button>
        )}
      </div>

      {!primary ? (
        elementBrowser
      ) : (
        <details className="element-picker">
          <summary>Scegli un altro elemento</summary>
          {elementBrowser}
        </details>
      )}

      {primary && !canEditKind && (
        <div className="inspector-banner">
          {primary.kind === "edge" ? (
            <>
              Mermaid non supporta lo stile delle linee in un diagramma{" "}
              <strong>{kindLabel}</strong>. La connessione resta selezionabile: puoi
              andare alla riga nel sorgente ed eliminarla.
            </>
          ) : (
            <>
              Mermaid non supporta lo stile per elemento in un diagramma{" "}
              <strong>{kindLabel}</strong>. Usa la palette globale nella tab Tema.
            </>
          )}
        </div>
      )}

      {primary && canEditKind && effective && (
        <div className="style-controls">
          {selections.length > 1 && (
            <div className="multi-selection">
              {selections.length} elementi selezionati: le modifiche si applicano a tutti.
            </div>
          )}

          {arrowState && (
            <div className="style-field wide">
              <span className="style-label">Punte della connessione</span>
              <div className="arrow-control">
                <select
                  className="input"
                  value={arrowState.styleId}
                  onChange={(event) => onEdgeArrow(event.target.value)}
                  disabled={!arrowState.canEdit}
                  title="Tipo di punta della connessione"
                >
                  {EDGE_ARROW_OPTIONS.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <button
                  className="btn btn-ghost tiny"
                  title="Inverti direzione: sposta la punta all'altro estremo"
                  onClick={onReverseEdge}
                  disabled={!arrowState.canEdit}
                >
                  <ArrowLeftRight size={13} /> Inverti
                </button>
              </div>
              {!arrowState.canEdit && (
                <small className="muted">{arrowState.note}</small>
              )}
            </div>
          )}

          {primary.kind === "node" && labelNode && kind === "flowchart" && (
            <label className="style-field wide">
              <span className="style-label">Etichetta</span>
              <input
                className="input"
                value={labelDraft}
                onChange={(event) => setLabelDraft(event.target.value)}
                onBlur={() => {
                  if (labelDraft !== labelNode.label) onLabelChange(labelNode.id, labelDraft);
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    if (labelDraft !== labelNode.label) onLabelChange(labelNode.id, labelDraft);
                  }
                }}
              />
            </label>
          )}

          {primary.kind === "node" && capabilities.structure && (
            <label className="style-field">
              <span className="style-label">Forma</span>
              <select
                className="input"
                value={findDefinition(source, primary.id)?.shape.id ?? "rect"}
                onChange={(event) => onShapeChange(primary.id, event.target.value)}
              >
                {SHAPE_OPTIONS.map((shape) => (
                  <option key={shape.id} value={shape.id}>
                    {shape.label}
                  </option>
                ))}
              </select>
            </label>
          )}
          {primary.kind !== "edge" && (
            <ColorField
              label="Riempimento"
              value={style?.fill}
              fallback={effective.fill}
              onChange={(value) => onPatch({ fill: value })}
            />
          )}
          <ColorField
            label="Cornice"
            value={style?.stroke}
            fallback={effective.stroke}
            onChange={(value) => onPatch({ stroke: value })}
          />
          {primary.kind !== "edge" && (
            <ColorField
              label="Testo"
              value={style?.textColor}
              fallback={effective.textColor}
              onChange={(value) => onPatch({ textColor: value })}
            />
          )}
          <NumberField
            label="Spessore"
            value={style?.strokeWidth ?? effective.strokeWidth}
            min={0}
            max={12}
            step={0.5}
            suffix="px"
            onChange={(value) => onPatch({ strokeWidth: value })}
          />
          <label className="style-field">
            <span className="style-label">Tratto</span>
            <select
              className="input"
              value={style?.dash === undefined ? "solid" : style.dash === null ? "solid" : style.dash}
              onChange={(event) => {
                const option = DASH_OPTIONS.find((item) => item.value === event.target.value);
                onPatch({ dash: option ? option.value : event.target.value });
              }}
            >
              {DASH_OPTIONS.map((option) => (
                <option key={option.id} value={option.value ?? "solid"}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <NumberField
            label="Opacità"
            value={style?.opacity ?? effective.opacity}
            min={0}
            max={1}
            step={0.05}
            onChange={(value) => onPatch({ opacity: value })}
          />
          {primary.kind === "node" && (
            <NumberField
              label="Raggio"
              value={style?.radius ?? effective.radius}
              min={0}
              max={48}
              step={1}
              suffix="px"
              onChange={(value) => onPatch({ radius: value })}
            />
          )}
          {primary.kind !== "edge" && (
            <NumberField
              label="Font"
              value={style?.fontSize ?? effective.fontSize}
              min={8}
              max={32}
              step={1}
              suffix="px"
              onChange={(value) => onPatch({ fontSize: value })}
            />
          )}
          {primary.kind !== "edge" && (
            <label className="style-field checkbox-field">
              <span className="style-label">Grassetto</span>
              <input
                type="checkbox"
                checked={effective.fontWeight === "bold" || Number(effective.fontWeight) >= 600}
                onChange={(event) => onPatch({ fontWeight: event.target.checked ? "bold" : "normal" })}
              />
            </label>
          )}

          {contrast && contrast.warnings.length > 0 && (
            <div className="contrast-warning">
              <strong>Contrasto da controllare</strong>
              <ul>
                {contrast.warnings.map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
              <div className="contrast-values">
                testo {contrastLabel(contrast.text)} · bordo {contrastLabel(contrast.border)} · sfondo{" "}
                {contrastLabel(contrast.fillBg)}
              </div>
              <div className="row-actions">
                <button
                  className="btn btn-ghost tiny"
                  onClick={() => onPatch({ textColor: suggestTextColor(effective.fill) })}
                >
                  <WandSparkles size={13} /> Testo auto
                </button>
                <button className="btn btn-ghost tiny" onClick={() => onApplyPreset("contrast")}>
                  Preset contrasto
                </button>
              </div>
            </div>
          )}

          <div className="inspector-actions">
            <button className="btn btn-ghost tiny" onClick={onReset}>
              <RotateCcw size={13} /> Ripristina elemento
            </button>
            {capabilities.nodes && primary.kind !== "edge" && (
              <button className="btn btn-ghost tiny" onClick={() => onBulk("nodes")}>
                Applica a tutti i nodi
              </button>
            )}
            {capabilities.edges && primary.kind === "edge" && (
              <button className="btn btn-ghost tiny" onClick={() => onBulk("edges")}>
                Applica a tutti gli archi
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
