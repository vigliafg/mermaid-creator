/**
 * Normalizza la libreria Excalidraw letta da SQLite/localStorage.
 *
 * `useHandleLibrary` salva la versione v2 (`LibraryItem[]`), ma un DB vecchio
 * può contenere la v1 (`ExcalidrawElement[][]`). Accettiamo entrambe e
 * scartiamo tutto ciò che non ha elementi validi.
 */

export type StoredLibraryItemStatus = "published" | "unpublished";

export interface StoredLibraryItem {
  id: string;
  status: StoredLibraryItemStatus;
  elements: readonly Record<string, unknown>[];
  created: number;
  name?: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function itemName(
  value: Record<string, unknown>,
  index: number,
): string | undefined {
  const name = typeof value.name === "string" ? value.name.trim() : "";
  return name || `Elementi ${index + 1}`;
}

export function normalizeBoardLibraryItems(raw: unknown): StoredLibraryItem[] {
  if (!Array.isArray(raw)) return [];
  const items: StoredLibraryItem[] = [];
  raw.forEach((value, index) => {
    if (Array.isArray(value)) {
      if (!value.length) return;
      items.push({
        id: `legacy-${index}`,
        status: "unpublished",
        elements: value as Record<string, unknown>[],
        created: Date.now(),
        name: `Elementi ${index + 1}`,
      });
      return;
    }
    if (!isRecord(value) || !Array.isArray(value.elements)) return;
    const elements = value.elements as Record<string, unknown>[];
    if (!elements.length) return;
    const id =
      typeof value.id === "string" && value.id.trim()
        ? value.id.trim()
        : `item-${index}`;
    const created =
      typeof value.created === "number" && Number.isFinite(value.created)
        ? value.created
        : Date.now();
    items.push({
      id,
      status: value.status === "published" ? "published" : "unpublished",
      elements,
      created,
      name: itemName(value, index),
    });
  });
  return items;
}
