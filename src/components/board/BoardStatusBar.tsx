import {
  AlertTriangle,
  Check,
  CloudOff,
  Loader2,
  RefreshCw,
  Sparkles,
} from "lucide-react";
import type { DiagramBoard } from "../../types";
import type { BoardSaveState } from "../../lib/board/useBoardAutosave";
import { boardOriginLabel, isBoardStale } from "../../lib/board/scene";

interface BoardStatusBarProps {
  board: DiagramBoard;
  source: string;
  saveState: BoardSaveState;
  lastSavedAt: number | null;
  saveError: string | null;
  busy: boolean;
  onUpdate: () => void;
  onSaveAndUpdate: () => void;
  onRetrySave: () => void;
}

function savedTime(value: number | null): string {
  if (!value) return "";
  return new Intl.DateTimeFormat("it-IT", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export function BoardStatusBar({
  board,
  source,
  saveState,
  lastSavedAt,
  saveError,
  busy,
  onUpdate,
  onSaveAndUpdate,
  onRetrySave,
}: BoardStatusBarProps) {
  const stale = isBoardStale(board, source);
  const saveText =
    saveState === "saving"
      ? "Salvataggio…"
      : saveState === "dirty"
        ? "Modifiche non salvate"
        : saveState === "error"
          ? "Errore di salvataggio"
          : lastSavedAt
            ? `Salvato · ${savedTime(lastSavedAt)}`
            : "Salvato";

  return (
    <div className={`board-status ${stale ? "is-stale" : ""}`}>
      <div className="board-status-main">
        <span className="board-origin">{boardOriginLabel(board.origin)}</span>
        {stale && (
          <span className="board-stale-badge">
            <AlertTriangle size={12} /> Da aggiornare
          </span>
        )}
        <span
          className={`board-save board-save-${saveState}`}
          role="status"
          aria-live="polite"
        >
          {saveState === "saving" ? (
            <Loader2 size={12} className="spin" />
          ) : saveState === "saved" ? (
            <Check size={12} />
          ) : saveState === "error" ? (
            <CloudOff size={12} />
          ) : null}
          {saveText}
        </span>
      </div>

      <div className="board-status-actions">
        {stale && (
          <button
            className="btn btn-ghost tiny"
            onClick={onSaveAndUpdate}
            disabled={busy}
            title="Il sorgente è cambiato: salva una versione della lavagna e poi rigenerala"
          >
            <Sparkles size={13} /> Salva e aggiorna
          </button>
        )}
        <button
          className="btn btn-ghost tiny"
          onClick={onUpdate}
          disabled={busy}
          title={
            stale
              ? "Il sorgente è cambiato: rigenera la lavagna (senza salvare prima una versione)"
              : "Rigenera la lavagna dal sorgente Mermaid"
          }
          aria-label={stale ? "Aggiorna la lavagna" : "Rigenera la lavagna"}
        >
          {busy ? (
            <Loader2 size={13} className="spin" />
          ) : (
            <RefreshCw size={13} />
          )}
        </button>
        {saveState === "error" && (
          <button
            className="btn btn-ghost tiny danger"
            onClick={onRetrySave}
            title={saveError ?? "Riprova il salvataggio"}
          >
            Riprova salvataggio
          </button>
        )}
      </div>
    </div>
  );
}
