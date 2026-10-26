import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CommunityLibrary } from "./community";

const apiMock = vi.hoisted(() => ({
  boardLibraryLoad: vi.fn(),
  boardLibrarySave: vi.fn(),
  boardLibraryCatalogLoad: vi.fn(),
  boardLibraryCatalogSave: vi.fn(),
}));

vi.mock("../ipc", () => ({ api: apiMock }));

import {
  loadBoardLibraryItems,
  loadCachedCommunityCatalog,
  saveBoardLibraryItems,
  saveCommunityCatalog,
} from "./libraryStore";

function memoryStorage() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value);
    },
    removeItem: (key: string) => {
      values.delete(key);
    },
  };
}

const libraryItem = { id: "lib-1", name: "Test", elements: [] };

describe("board library persistence", () => {
  let storage: ReturnType<typeof memoryStorage>;

  beforeEach(() => {
    storage = memoryStorage();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("usa localStorage nel browser di sviluppo", async () => {
    vi.stubGlobal("window", { localStorage: storage });
    expect(await loadBoardLibraryItems()).toBeNull();

    await saveBoardLibraryItems([libraryItem]);
    expect(await loadBoardLibraryItems()).toEqual([libraryItem]);
    expect(apiMock.boardLibrarySave).not.toHaveBeenCalled();
  });

  it("usa SQLite in Tauri e propaga gli errori di lettura", async () => {
    vi.stubGlobal("window", {
      __TAURI_INTERNALS__: {},
      localStorage: storage,
    });
    apiMock.boardLibraryLoad.mockResolvedValue({
      itemsJson: JSON.stringify([libraryItem]),
      updatedAt: 12,
    });
    expect(await loadBoardLibraryItems()).toEqual([libraryItem]);

    apiMock.boardLibraryLoad.mockResolvedValue({
      itemsJson: "{}",
      updatedAt: 12,
    });
    await expect(loadBoardLibraryItems()).rejects.toThrow("array");
  });

  it("salva la libreria passando l'array serializzato a Tauri", async () => {
    vi.stubGlobal("window", {
      __TAURI_INTERNALS__: {},
      localStorage: storage,
    });
    apiMock.boardLibrarySave.mockResolvedValue({
      itemsJson: JSON.stringify([libraryItem]),
      updatedAt: 12,
    });
    await saveBoardLibraryItems([libraryItem]);
    expect(apiMock.boardLibrarySave).toHaveBeenCalledWith(
      JSON.stringify([libraryItem]),
    );
  });

  it("conserva il catalogo e i download tra sessioni", async () => {
    vi.stubGlobal("window", {
      __TAURI_INTERNALS__: {},
      localStorage: storage,
    });
    const libraries = [
      {
        id: "a-lib",
        name: "Lib",
        description: "",
        authors: [],
        source: "a/lib.excalidrawlib",
        preview: null,
        created: "2024-01-01",
        updated: "2024-01-01",
        version: 1,
        itemNames: [],
        downloads: { total: 42, week: 3 },
      },
    ] satisfies CommunityLibrary[];
    apiMock.boardLibraryCatalogSave.mockResolvedValue({
      catalogJson: JSON.stringify(libraries),
      fetchedAt: 99,
    });
    apiMock.boardLibraryCatalogLoad.mockResolvedValue({
      catalogJson: JSON.stringify(libraries),
      fetchedAt: 99,
    });

    await saveCommunityCatalog(libraries, 99);
    expect(apiMock.boardLibraryCatalogSave).toHaveBeenCalledWith(
      JSON.stringify(libraries),
    );
    const cached = await loadCachedCommunityCatalog();
    expect(cached?.fetchedAt).toBe(99);
    expect(cached?.libraries[0].downloads).toEqual({ total: 42, week: 3 });
  });

  it("ignora un catalogo locale corrotto", async () => {
    vi.stubGlobal("window", { localStorage: storage });
    storage.setItem("mermaid-creator.excalidraw-library-catalog.v1", "non-json");
    expect(await loadCachedCommunityCatalog()).toBeNull();
  });
});
