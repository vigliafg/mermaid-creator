import {
  AlertTriangle,
  Image as ImageIcon,
  Loader2,
  PenTool,
  RefreshCw,
  Wand2,
} from "lucide-react";

interface BoardFirstRunProps {
  busy: boolean;
  error: string;
  onConvert: () => void;
  onManual: () => void;
  onImage: () => void;
  onRetry: () => void;
  onOpenSource: () => void;
}

export function BoardFirstRun({
  busy,
  error,
  onConvert,
  onManual,
  onImage,
  onRetry,
  onOpenSource,
}: BoardFirstRunProps) {
  return (
    <div className="board-first-run">
      <div className="board-first-card">
        <div className="board-first-head">
          <span className="board-first-icon">
            <PenTool size={20} />
          </span>
          <div>
            <h3>Crea una lavagna</h3>
            <p>
              Il diagramma resta la fonte di verità: la lavagna è una copia che
              puoi modificare liberamente. Se il sorgente cambia, la lavagna non
              viene sovrascritta.
            </p>
          </div>
        </div>

        {busy ? (
          <div className="board-progress" role="status" aria-live="polite">
            <Loader2 size={18} className="spin" />
            Conversione del diagramma in elementi Excalidraw…
          </div>
        ) : (
          <>
            <div className="board-first-actions">
              <button className="btn btn-primary" onClick={onConvert}>
                <Wand2 size={15} /> Crea lavagna modificabile
              </button>
              <button className="btn btn-ghost" onClick={onManual}>
                <PenTool size={15} /> Disegna da zero
              </button>
            </div>
            <button className="board-first-image" onClick={onImage}>
              <ImageIcon size={14} /> Inserisci come immagine
              <small>Fedeltà all'anteprima, elementi non modificabili</small>
            </button>
          </>
        )}

        {error && (
          <div className="board-error" role="alert">
            <AlertTriangle size={16} />
            <div>
              <strong>Conversione non riuscita</strong>
              <p>{error}</p>
              <div className="board-error-actions">
                <button className="btn btn-ghost tiny" onClick={onRetry}>
                  <RefreshCw size={13} /> Riprova
                </button>
                <button className="btn btn-ghost tiny" onClick={onOpenSource}>
                  Apri sorgente
                </button>
                <button className="btn btn-ghost tiny" onClick={onManual}>
                  Lavagna vuota
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
