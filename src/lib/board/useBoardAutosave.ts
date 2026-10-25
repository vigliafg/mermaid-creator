import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "../ipc";
import { createSaveQueue, type BoardSaveState } from "./saveQueue";

export type { BoardSaveState } from "./saveQueue";

export interface BoardAutosaveOptions {
  diagramId: string | null;
  debounceMs?: number;
  onSaved?: (sceneJson: string) => void;
  onError?: (message: string | null) => void;
}

export interface BoardAutosave {
  state: BoardSaveState;
  lastSavedAt: number | null;
  notify: (sceneJson: string) => void;
  flush: () => Promise<boolean>;
  /** Riparte dalla scena appena scritta sul server (creazione/rigenerazione). */
  reset: (sceneJson: string | null) => void;
}

function errorText(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

/**
 * Autosave della lavagna: la logica di revisione sta in `saveQueue`, qui
 * restano il collegamento all'IPC, lo stato React e il flush alla navigazione.
 */
export function useBoardAutosave({
  diagramId,
  debounceMs = 600,
  onSaved,
  onError,
}: BoardAutosaveOptions): BoardAutosave {
  const [state, setState] = useState<BoardSaveState>("saved");
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);
  const diagramIdRef = useRef(diagramId);
  const onSavedRef = useRef(onSaved);
  const onErrorRef = useRef(onError);

  useEffect(() => {
    diagramIdRef.current = diagramId;
  }, [diagramId]);

  useEffect(() => {
    onSavedRef.current = onSaved;
    onErrorRef.current = onError;
  }, [onSaved, onError]);

  const queue = useRef<ReturnType<typeof createSaveQueue> | null>(null);
  if (!queue.current) {
    queue.current = createSaveQueue({
      save: async (sceneJson) => {
        const id = diagramIdRef.current;
        if (!id) throw new Error("Nessun diagramma selezionato");
        await api.boardSave(id, sceneJson);
      },
      onState: (next) => setState(next),
      onSaved: (sceneJson) => {
        setLastSavedAt(Date.now());
        onErrorRef.current?.(null);
        onSavedRef.current?.(sceneJson);
      },
      onError: (message) => {
        onErrorRef.current?.(`Salvataggio lavagna non riuscito: ${message}`);
      },
      debounceMs,
    });
  }

  // Cambio diagramma: azzera la coda locale; il chiamante ha già fatto flush.
  useEffect(() => {
    queue.current?.reset(null);
    setLastSavedAt(null);
  }, [diagramId]);

  const notify = useCallback((sceneJson: string) => {
    setState((current) => (current === "saving" ? current : "dirty"));
    onErrorRef.current?.(null);
    queue.current?.notify(sceneJson);
  }, []);

  const flush = useCallback(async () => {
    try {
      return (await queue.current?.flush()) ?? true;
    } catch (error) {
      onErrorRef.current?.(
        `Salvataggio lavagna non riuscito: ${errorText(error)}`,
      );
      return false;
    }
  }, []);

  const reset = useCallback((sceneJson: string | null) => {
    queue.current?.reset(sceneJson);
    setLastSavedAt(null);
  }, []);

  useEffect(() => {
    return () => {
      // Best effort: non blocca lo smontaggio, ma prova a salvare l'ultima scena.
      void queue.current?.flush();
    };
  }, []);

  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === "hidden") void flush();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [flush]);

  return { state, lastSavedAt, notify, flush, reset };
}
