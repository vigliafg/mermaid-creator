import { RotateCcw, Sun } from "lucide-react";
import { useEffect, useState } from "react";
import {
  contrastLabel,
  contrastRatio,
  FONT_OPTIONS,
  resolveTheme,
  PRESET_OPTIONS,
  type DiagramTheme,
  type DiagramTokens,
  type PresetId,
} from "../../lib/diagram/theme";
import { DASH_OPTIONS } from "../../lib/diagram/styles";

interface Props {
  theme: DiagramTheme;
  tokens: DiagramTokens;
  workspaceBg: string;
  workspaceGrid: boolean;
  onPreset: (preset: PresetId) => void;
  onToken: (patch: Partial<DiagramTokens>) => void;
  onWorkspaceBg: (value: string) => void;
  onWorkspaceGrid: (value: boolean) => void;
  onReset: () => void;
}

function normalizeHex(value: string | undefined, fallback: string): string {
  if (!value) return fallback;
  if (/^#[0-9a-fA-F]{6}$/.test(value)) return value;
  if (/^#[0-9a-fA-F]{3}$/.test(value)) {
    return `#${value[1]}${value[1]}${value[2]}${value[2]}${value[3]}${value[3]}`;
  }
  return fallback;
}

function ColorInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const [text, setText] = useState(value);
  useEffect(() => setText(value), [value]);
  const commit = () => {
    if (/^#[0-9a-fA-F]{3,8}$/.test(text.trim()) || /^rgba?\([^)]*\)$/.test(text.trim())) {
      onChange(text.trim());
    } else {
      setText(value);
    }
  };
  return (
    <label className="theme-token">
      <span>{label}</span>
      <span className="theme-token-control">
        <input
          type="color"
          value={normalizeHex(value, "#000000")}
          onChange={(event) => onChange(event.target.value)}
          aria-label={label}
        />
        <input
          className="input hex-input"
          value={text}
          spellCheck={false}
          onChange={(event) => setText(event.target.value)}
          onBlur={commit}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              commit();
            }
          }}
        />
      </span>
    </label>
  );
}

export function ThemePanel({
  theme,
  tokens,
  workspaceBg,
  workspaceGrid,
  onPreset,
  onToken,
  onWorkspaceBg,
  onWorkspaceGrid,
  onReset,
}: Props) {
  const fgBg = contrastRatio(tokens.fg, tokens.bg);
  const lineBg = contrastRatio(tokens.line, tokens.bg);
  const surfaceBg = contrastRatio(tokens.surface, tokens.bg);
  const borderBg = contrastRatio(tokens.border, tokens.bg);
  const lowText = fgBg !== null && fgBg < 4.5;
  const lowLine = lineBg !== null && lineBg < 1.2;
  const lowSurface =
    surfaceBg !== null && surfaceBg < 1.2 && (borderBg === null || borderBg < 1.2);

  return (
    <div className="theme-panel">
      <div className="theme-panel-head">
        <div>
          <div className="eyebrow">Tema del diagramma</div>
          <h3>Palette, tipografia e sfondo</h3>
        </div>
        <button className="btn btn-ghost tiny" onClick={onReset}>
          <RotateCcw size={13} /> Auto
        </button>
      </div>

      <div className="preset-grid">
        {PRESET_OPTIONS.map((preset) => {
          const preview =
            preset.id === "auto" ? tokens : resolveTheme({ preset: preset.id }, "dark");
          return (
          <button
            key={preset.id}
            className={`preset-card ${theme.preset === preset.id ? "active" : ""}`}
            onClick={() => onPreset(preset.id)}
            title={preset.hint}
          >
            <span className="preset-swatches">
              <i style={{ background: preview.bg }} />
              <i style={{ background: preview.surface }} />
              <i style={{ background: preview.accent }} />
            </span>
            <strong>{preset.label}</strong>
            <small>{preset.hint}</small>
          </button>
          );
        })}
      </div>

      <div className={`contrast-summary ${lowText || lowLine || lowSurface ? "warn" : ""}`}>
        <span>testo/sfondo {contrastLabel(fgBg)}</span>
        <span>linee/sfondo {contrastLabel(lineBg)}</span>
        <span>box/sfondo {contrastLabel(surfaceBg)}</span>
        {lowText && <strong>Testo sotto 4.5:1</strong>}
        {lowLine && <strong>Linee quasi invisibili</strong>}
        {lowSurface && <strong>Box quasi invisibile sul fondo</strong>}
      </div>

      <div className="theme-grid">
        <ColorInput label="Sfondo canvas" value={tokens.bg} onChange={(value) => onToken({ bg: value })} />
        <ColorInput label="Testo" value={tokens.fg} onChange={(value) => onToken({ fg: value })} />
        <ColorInput label="Testo attenuato" value={tokens.muted} onChange={(value) => onToken({ muted: value })} />
        <ColorInput label="Linee" value={tokens.line} onChange={(value) => onToken({ line: value })} />
        <ColorInput label="Superficie box" value={tokens.surface} onChange={(value) => onToken({ surface: value })} />
        <ColorInput
          label="Superficie alternativa"
          value={tokens.surfaceAlt}
          onChange={(value) => onToken({ surfaceAlt: value })}
        />
        <ColorInput label="Bordo" value={tokens.border} onChange={(value) => onToken({ border: value })} />
        <ColorInput label="Accento" value={tokens.accent} onChange={(value) => onToken({ accent: value })} />
      </div>

      <div className="theme-row">
        <label className="theme-token">
          <span>Font</span>
          <select
            className="input"
            value={tokens.font}
            onChange={(event) => onToken({ font: event.target.value })}
          >
            {FONT_OPTIONS.map((font) => (
              <option key={font.id} value={font.id}>
                {font.label}
              </option>
            ))}
          </select>
        </label>
        <label className="theme-token">
          <span>Tratto predefinito</span>
          <select
            className="input"
            value={tokens.dash ?? "solid"}
            onChange={(event) => {
              const option = DASH_OPTIONS.find((item) => item.value === event.target.value);
              onToken({ dash: option ? option.value : event.target.value });
            }}
          >
            {DASH_OPTIONS.map((option) => (
              <option key={option.id} value={option.value ?? "solid"}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="theme-grid">
        <label className="theme-token">
          <span>Spessore predefinito</span>
          <span className="theme-slider">
            <input
              type="range"
              min={0}
              max={8}
              step={0.5}
              value={tokens.strokeWidth}
              onChange={(event) => onToken({ strokeWidth: Number(event.target.value) })}
            />
            <b>{tokens.strokeWidth}px</b>
          </span>
        </label>
        <label className="theme-token">
          <span>Raggio</span>
          <span className="theme-slider">
            <input
              type="range"
              min={0}
              max={32}
              step={1}
              value={tokens.radius}
              onChange={(event) => onToken({ radius: Number(event.target.value) })}
            />
            <b>{tokens.radius}px</b>
          </span>
        </label>
        <label className="theme-token">
          <span>Font label</span>
          <span className="theme-slider">
            <input
              type="range"
              min={10}
              max={24}
              step={1}
              value={tokens.fontSize}
              onChange={(event) => onToken({ fontSize: Number(event.target.value) })}
            />
            <b>{tokens.fontSize}px</b>
          </span>
        </label>
      </div>

      <div className="workspace-theme">
        <div className="theme-panel-head">
          <div>
            <div className="eyebrow">Area di lavoro</div>
            <h3>
              <Sun size={14} /> Sfondo attorno al diagramma
            </h3>
          </div>
          <button className="btn btn-ghost tiny" onClick={() => onWorkspaceBg("auto")}>
            Auto
          </button>
        </div>
        <div className="theme-row">
          <label className="theme-token">
            <span>Colore</span>
            <span className="theme-token-control">
              <input
                type="color"
                value={normalizeHex(workspaceBg === "auto" ? tokens.bg : workspaceBg, "#0b0e14")}
                onChange={(event) => onWorkspaceBg(event.target.value)}
                aria-label="Sfondo area di lavoro"
              />
              <input
                className="input hex-input"
                value={workspaceBg}
                onChange={(event) => onWorkspaceBg(event.target.value)}
                onBlur={(event) => {
                  const value = event.target.value.trim();
                  if (value !== "auto" && !/^#[0-9a-fA-F]{3,8}$/.test(value)) onWorkspaceBg("auto");
                }}
                spellCheck={false}
              />
            </span>
          </label>
          <label className="checkbox-field">
            <input
              type="checkbox"
              checked={workspaceGrid}
              onChange={(event) => onWorkspaceGrid(event.target.checked)}
            />
            <span>Griglia</span>
          </label>
        </div>
      </div>
    </div>
  );
}
