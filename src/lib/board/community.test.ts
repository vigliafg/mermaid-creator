import { describe, expect, it } from "vitest";
import {
  buildCommunityCatalog,
  communityLibraryFileUrl,
  communityLibraryId,
  communityLibraryPreviewUrl,
  searchCommunityLibraries,
  sortCommunityLibraries,
  type CommunityLibrary,
} from "./community";

const rawCatalog = [
  {
    name: "R Icons",
    description: "R and RStudio icons.",
    authors: [{ name: "Jumping Rivers", url: "https://example.com" }],
    source: "jumpingrivers/r.excalidrawlib",
    preview: "jumpingrivers/r.png",
    created: "2021-08-22",
    updated: "2021-08-22",
    version: 1,
    itemNames: ["R logo", "RStudio"],
  },
  {
    name: "Snowflake",
    description: "Snowflake shapes",
    authors: [{ name: "Thijs" }],
    source: "thijsdev/snowflake.excalidrawlib",
    preview: "thijsdev/snowflake.png",
    created: "2022-01-01",
    updated: "2023-05-01",
    version: 2,
  },
  {
    name: "",
    source: "broken.excalidrawlib",
  },
];

const stats = {
  "jumpingrivers-r": { total: 694, week: 12 },
  "thijsdev-snowflake": { total: 1200, week: 3 },
};

describe("community library catalog", () => {
  it("normalizza le voci e unisce le statistiche", () => {
    const libraries = buildCommunityCatalog(rawCatalog, stats);
    expect(libraries).toHaveLength(2);
    expect(libraries[0]).toMatchObject({
      id: "jumpingrivers-r",
      name: "R Icons",
      source: "jumpingrivers/r.excalidrawlib",
      authors: [{ name: "Jumping Rivers", url: "https://example.com" }],
      downloads: { total: 694, week: 12 },
      itemNames: ["R logo", "RStudio"],
    });
    expect(libraries[1].downloads).toEqual({ total: 1200, week: 3 });
  });

  it("conserva i download già incorporati nella cache", () => {
    const cached = buildCommunityCatalog([
      {
        name: "Cached",
        source: "a/cached.excalidrawlib",
        downloads: { total: 7, week: 2 },
      },
    ]);
    expect(cached[0].downloads).toEqual({ total: 7, week: 2 });
  });

  it("scarta catalogo vuoto o non valido", () => {
    expect(() => buildCommunityCatalog({})).toThrow("array");
    expect(() => buildCommunityCatalog([])).toThrow("vuoto");
    expect(() => buildCommunityCatalog([null, 1, {}])).toThrow("vuoto");
  });

  it("ricerca nome, descrizione, autore e nomi degli elementi", () => {
    const libraries = buildCommunityCatalog(rawCatalog, stats);
    expect(searchCommunityLibraries(libraries, "jumping")).toHaveLength(1);
    expect(searchCommunityLibraries(libraries, "snowflake")).toHaveLength(1);
    expect(searchCommunityLibraries(libraries, "rstudio")).toHaveLength(1);
    expect(searchCommunityLibraries(libraries, "  ")).toHaveLength(2);
    expect(searchCommunityLibraries(libraries, "inesistente")).toHaveLength(0);
  });

  it("ordina senza mutare l'array originale", () => {
    const libraries = buildCommunityCatalog(rawCatalog, stats);
    const downloaded = sortCommunityLibraries(libraries, "downloads");
    expect(downloaded.map((item) => item.name)).toEqual([
      "Snowflake",
      "R Icons",
    ]);
    expect(sortCommunityLibraries(libraries, "new")[0].name).toBe("Snowflake");
    expect(sortCommunityLibraries(libraries, "updated")[0].name).toBe(
      "Snowflake",
    );
    expect(sortCommunityLibraries(libraries, "name")[0].name).toBe("R Icons");
    expect(libraries[0].name).toBe("R Icons");
  });

  it("calcola l'id come il sito ufficiale", () => {
    expect(communityLibraryId("jumpingrivers/r.excalidrawlib")).toBe(
      "jumpingrivers-r",
    );
    expect(communityLibraryId("Author/My.Lib.excalidrawlib")).toBe(
      "author-my.lib",
    );
  });

  it("costruisce URL solo sul dominio ufficiale", () => {
    expect(communityLibraryFileUrl("jumpingrivers/r.excalidrawlib")).toBe(
      "https://libraries.excalidraw.com/libraries/jumpingrivers/r.excalidrawlib",
    );
    expect(communityLibraryPreviewUrl("jumpingrivers/r.png")).toBe(
      "https://libraries.excalidraw.com/libraries/jumpingrivers/r.png",
    );
    expect(() => communityLibraryFileUrl("/etc/passwd")).toThrow();
    expect(() => communityLibraryFileUrl("../secret")).toThrow();
    expect(() => communityLibraryFileUrl("")).toThrow();
  });

  it("filtra le voci senza source o nome", () => {
    const libraries = buildCommunityCatalog(
      [
        { name: "Senza source" },
        { source: "a/lib.excalidrawlib" },
        { name: "ok", source: "b/ok.excalidrawlib" },
      ],
      {},
    ) as CommunityLibrary[];
    expect(libraries.map((item) => item.name)).toEqual(["ok"]);
  });
});
