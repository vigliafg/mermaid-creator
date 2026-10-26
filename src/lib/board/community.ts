/**
 * Catalogo delle librerie pubbliche di Excalidraw.
 *
 * Il sito ufficiale espone due file statici con CORS aperto:
 * - `libraries.json` con i metadati di ogni libreria;
 * - `stats.json` con i contatori di download.
 *
 * Le librerie installate non passano da qui: vengono salvate nella tabella
 * `excalidraw_library` tramite l'adapter di `useHandleLibrary`.
 */

export const COMMUNITY_LIBRARY_ORIGIN = "https://libraries.excalidraw.com";
export const COMMUNITY_CATALOG_URL = `${COMMUNITY_LIBRARY_ORIGIN}/libraries.json`;
export const COMMUNITY_STATS_URL = `${COMMUNITY_LIBRARY_ORIGIN}/stats.json`;

export interface CommunityLibraryAuthor {
  name: string;
  url?: string;
}

export interface CommunityLibraryDownloads {
  total: number;
  week: number;
}

export interface CommunityLibrary {
  id: string;
  name: string;
  description: string;
  authors: CommunityLibraryAuthor[];
  source: string;
  preview: string | null;
  created: string;
  updated: string;
  version: number;
  itemNames: string[];
  downloads: CommunityLibraryDownloads;
}

export type CommunitySort =
  | "recommended"
  | "downloads"
  | "new"
  | "updated"
  | "name";

export const COMMUNITY_SORT_LABELS: Record<CommunitySort, string> = {
  recommended: "Consigliate",
  downloads: "Più scaricate",
  new: "Più recenti",
  updated: "Aggiornate di recente",
  name: "Nome",
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const text = (value: unknown): string =>
  typeof value === "string" ? value : "";

const count = (value: unknown): number =>
  typeof value === "number" && Number.isFinite(value) && value >= 0
    ? Math.round(value)
    : 0;

/** Stesso id usato dal sito per collegare `libraries.json` a `stats.json`. */
export function communityLibraryId(source: string): string {
  return source.toLowerCase().replace(/\/|\.excalidrawlib/g, (match) =>
    match === "/" ? "-" : "",
  );
}

function normalizeAuthors(value: unknown): CommunityLibraryAuthor[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((author) => {
    if (!isRecord(author) || !text(author.name).trim()) return [];
    const name = text(author.name).trim();
    const url = text(author.url).trim();
    return [{ name, ...(url ? { url } : {}) }];
  });
}

function normalizeLibrary(
  value: unknown,
  stats: Record<string, unknown>,
): CommunityLibrary | null {
  if (!isRecord(value)) return null;
  const name = text(value.name).trim();
  const source = text(value.source).trim();
  if (!name || !source) return null;
  const id = communityLibraryId(source);
  const stat = isRecord(stats[id]) ? stats[id] : {};
  const embedded = isRecord(value.downloads) ? value.downloads : {};
  const itemNames = Array.isArray(value.itemNames)
    ? value.itemNames.filter((item): item is string => typeof item === "string")
    : [];
  return {
    id,
    name,
    description: text(value.description),
    authors: normalizeAuthors(value.authors),
    source,
    preview: text(value.preview).trim() || null,
    created: text(value.created),
    updated: text(value.updated) || text(value.created),
    version:
      typeof value.version === "number" && Number.isFinite(value.version)
        ? value.version
        : 1,
    itemNames,
    downloads: {
      total: count(stat.total) || count(embedded.total),
      week: count(stat.week) || count(embedded.week),
    },
  };
}

/** Convalida il catalogo remoto e unisce i contatori di download. */
export function buildCommunityCatalog(
  rawCatalog: unknown,
  rawStats: unknown = {},
): CommunityLibrary[] {
  if (!Array.isArray(rawCatalog)) {
    throw new Error("Catalogo librerie non valido: atteso un array");
  }
  const stats = isRecord(rawStats) ? rawStats : {};
  const seen = new Set<string>();
  const libraries: CommunityLibrary[] = [];
  for (const entry of rawCatalog) {
    const library = normalizeLibrary(entry, stats);
    if (!library || seen.has(library.source)) continue;
    seen.add(library.source);
    libraries.push(library);
  }
  if (!libraries.length) {
    throw new Error("Catalogo librerie vuoto");
  }
  return libraries;
}

export function searchCommunityLibraries(
  libraries: readonly CommunityLibrary[],
  query: string,
): CommunityLibrary[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return [...libraries];
  return libraries.filter((library) => {
    const haystack = [
      library.name,
      library.description,
      ...library.authors.map((author) => author.name),
      ...library.itemNames,
    ]
      .join(" ")
      .toLowerCase();
    return haystack.includes(needle);
  });
}

export function sortCommunityLibraries(
  libraries: readonly CommunityLibrary[],
  sort: CommunitySort,
): CommunityLibrary[] {
  const list = [...libraries];
  switch (sort) {
    case "downloads":
      return list.sort(
        (a, b) =>
          b.downloads.total - a.downloads.total ||
          b.downloads.week - a.downloads.week ||
          a.name.localeCompare(b.name),
      );
    case "new":
      return list.sort(
        (a, b) =>
          b.created.localeCompare(a.created) || a.name.localeCompare(b.name),
      );
    case "updated":
      return list.sort(
        (a, b) =>
          b.updated.localeCompare(a.updated) || a.name.localeCompare(b.name),
      );
    case "name":
      return list.sort((a, b) => a.name.localeCompare(b.name));
    case "recommended":
    default:
      return list.sort(
        (a, b) =>
          b.downloads.total - a.downloads.total ||
          b.updated.localeCompare(a.updated) ||
          a.name.localeCompare(b.name),
      );
  }
}

function publicLibraryUrl(relative: string): string {
  if (!relative.trim() || relative.startsWith("/")) {
    throw new Error("Percorso libreria non valido");
  }
  const url = new URL(`libraries/${relative}`, `${COMMUNITY_LIBRARY_ORIGIN}/`);
  if (
    url.origin !== COMMUNITY_LIBRARY_ORIGIN ||
    !url.pathname.startsWith("/libraries/")
  ) {
    throw new Error("Percorso libreria non valido");
  }
  return url.toString();
}

export function communityLibraryFileUrl(source: string): string {
  return publicLibraryUrl(source);
}

export function communityLibraryPreviewUrl(preview: string): string {
  return publicLibraryUrl(preview);
}

async function fetchJson(url: string, signal?: AbortSignal): Promise<unknown> {
  const response = await fetch(url, { signal, cache: "no-cache" });
  if (!response.ok) {
    throw new Error(`Richiesta non riuscita (${response.status})`);
  }
  return response.json();
}

/** Scarica catalogo e statistiche. Le statistiche sono opzionali. */
export async function fetchCommunityCatalog(
  signal?: AbortSignal,
): Promise<{ libraries: CommunityLibrary[]; fetchedAt: number }> {
  const [catalog, stats] = await Promise.all([
    fetchJson(COMMUNITY_CATALOG_URL, signal),
    fetchJson(COMMUNITY_STATS_URL, signal).catch(() => ({})),
  ]);
  return {
    libraries: buildCommunityCatalog(catalog, stats),
    fetchedAt: Date.now(),
  };
}

/** Scarica il file `.excalidrawlib` di una libreria della comunità. */
export async function fetchCommunityLibrary(
  source: string,
  signal?: AbortSignal,
): Promise<Blob> {
  const response = await fetch(communityLibraryFileUrl(source), {
    signal,
    cache: "no-cache",
  });
  if (!response.ok) {
    throw new Error(`Download libreria non riuscito (${response.status})`);
  }
  return response.blob();
}
