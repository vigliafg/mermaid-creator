export type BoardSaveState = "saved" | "dirty" | "saving" | "error";

export interface SaveQueueOptions {
  /** Scrive la scena. Deve risolvere o lanciare. */
  save: (sceneJson: string) => Promise<void>;
  onState?: (state: BoardSaveState) => void;
  onSaved?: (sceneJson: string) => void;
  onError?: (message: string) => void;
  debounceMs?: number;
}

export interface SaveQueue {
  notify: (sceneJson: string) => void;
  flush: () => Promise<boolean>;
  reset: (sceneJson: string | null) => void;
  state: () => BoardSaveState;
  revision: () => { current: number; saved: number };
}

/**
 * Coda di salvataggio single-flight con revisione monotona.
 *
 * - una sola scrittura alla volta;
 * - le revisioni arrivate durante una scrittura vengono recuperate dallo
 *   stesso ciclo, nell'ordine in cui sono state notificate;
 * - nessun retry automatico: dopo un errore lo stato resta `error` finché una
 *   nuova notifica o un flush non ritenta.
 */
export function createSaveQueue({
  save,
  onState,
  onSaved,
  onError,
  debounceMs = 600,
}: SaveQueueOptions): SaveQueue {
  let latest: string | null = null;
  let revision = 0;
  let savedRevision = 0;
  let inFlight: Promise<boolean> | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let current: BoardSaveState = "saved";

  const setState = (next: BoardSaveState) => {
    if (current === next) return;
    current = next;
    onState?.(next);
  };

  const clearTimer = () => {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
  };

  const persist = async (): Promise<boolean> => {
    if (inFlight) return inFlight;
    const run = (async () => {
      let ok = true;
      for (;;) {
        if (revision === savedRevision || latest === null) break;
        const runningRevision = revision;
        const scene = latest;
        setState("saving");
        try {
          await save(scene);
          savedRevision = runningRevision;
          onSaved?.(scene);
        } catch (error) {
          ok = false;
          setState("error");
          onError?.(
            error instanceof Error ? error.message : String(error),
          );
          break;
        }
      }
      if (ok) {
        setState(revision === savedRevision ? "saved" : "dirty");
      }
      return ok;
    })();
    inFlight = run;
    try {
      return await run;
    } finally {
      inFlight = null;
    }
  };

  const flush = async (): Promise<boolean> => {
    clearTimer();
    return persist();
  };

  return {
    notify: (sceneJson: string) => {
      latest = sceneJson;
      revision += 1;
      if (current !== "saving") setState("dirty");
      clearTimer();
      timer = setTimeout(() => {
        timer = null;
        void persist();
      }, debounceMs);
    },
    flush,
    reset: (sceneJson: string | null) => {
      clearTimer();
      latest = sceneJson;
      revision = 0;
      savedRevision = 0;
      setState("saved");
    },
    state: () => current,
    revision: () => ({ current: revision, saved: savedRevision }),
  };
}
