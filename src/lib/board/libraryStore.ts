import { api } from "../ipc";
import {
  buildCommunityCatalog,
  type CommunityLibrary,
} from "./community";

const LOCAL_LIBRARY_KEY = "mermaid-creator.excalidraw-library.v1";
const LOCAL_CATALOG_KEY = "mermaid-creator.excalidraw-library-catalog.v1";

function runningInTauri(): boolean {
  return (
    typeof window !== "undefined" && "__TAURI_INTERNALS__" in window
  );
}

function parseArray(raw: string, label: string): unknown[] {
  const value: unknown = JSON.parse(raw);
  if (!Array.isArray(value)) {
    throw new Error(`${label}: atteso un array JSON`);
  }
  return value;
}

function readLocal(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeLocal(key: string, value: string): void {
  window.localStorage.setItem(key, value);
}

/**
 * Carica gli elementi della libreria Excalidraw. In Tauri la fonte di verità è
 * SQLite; nel browser di sviluppo si usa localStorage per non rompere il
 * flusso di lavoro.
 */
export async function loadBoardLibraryItems(): Promise<unknown[] | null> {
  if (runningInTauri()) {
    const stored = await api.boardLibraryLoad();
    return stored ? parseArray(stored.itemsJson, "Libreria Excalidraw") : null;
  }
  const raw = readLocal(LOCAL_LIBRARY_KEY);
  return raw ? parseArray(raw, "Libreria Excalidraw") : null;
}

export async function saveBoardLibraryItems(
  items: readonly unknown[],
): Promise<void> {
  const json = JSON.stringify(items);
  if (runningInTauri()) {
    await api.boardLibrarySave(json);
    return;
  }
  writeLocal(LOCAL_LIBRARY_KEY, json);
}

/** Cache del catalogo, così la finestra si apre subito anche senza rete. */
export async function loadCachedCommunityCatalog(): Promise<{
  libraries: CommunityLibrary[];
  fetchedAt: number;
} | null> {
  let raw: string | null = null;
  let fetchedAt = 0;
  if (runningInTauri()) {
    const stored = await api.boardLibraryCatalogLoad();
    raw = stored?.catalogJson ?? null;
    fetchedAt = stored?.fetchedAt ?? 0;
  } else {
    raw = readLocal(LOCAL_CATALOG_KEY);
    const stamp = readLocal(`${LOCAL_CATALOG_KEY}.at`);
    fetchedAt = stamp ? Number(stamp) || 0 : 0;
  }
  if (!raw) return null;
  try {
    return {
      libraries: buildCommunityCatalog(parseArray(raw, "Catalogo librerie")),
      fetchedAt,
    };
  } catch {
    return null;
  }
}

export async function saveCommunityCatalog(
  libraries: readonly CommunityLibrary[],
  fetchedAt: number,
): Promise<void> {
  const json = JSON.stringify(libraries);
  if (runningInTauri()) {
    await api.boardLibraryCatalogSave(json);
    return;
  }
  writeLocal(LOCAL_CATALOG_KEY, json);
  writeLocal(`${LOCAL_CATALOG_KEY}.at`, String(fetchedAt));
}
