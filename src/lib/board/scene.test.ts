import { describe, expect, it } from "vitest";
import {
  boardByteSize,
  boardStats,
  boardTheme,
  emptyBoardScene,
  isBoardStale,
  MAX_BOARD_BYTES,
  parseBoardScene,
  sceneFromParts,
  serializeBoardScene,
  withBoardTheme,
} from "./scene";

describe("board scene", () => {
  it("fa round-trip di una scena vuota con tema congelato", () => {
    const scene = emptyBoardScene("dark");
    const parsed = parseBoardScene(serializeBoardScene(scene));
    expect(parsed.type).toBe("excalidraw");
    expect(parsed.elements).toEqual([]);
    expect(parsed.files).toEqual({});
    expect(boardTheme(parsed)).toBe("dark");
    expect(boardStats(parsed)).toEqual({ elements: 0, visibleElements: 0, files: 0 });
  });

  it("conserva elementi, files e sfondo", () => {
    const scene = sceneFromParts(
      [{ id: "a" }, { id: "b", isDeleted: true }],
      { file1: { id: "file1", mimeType: "image/png" } },
      "light",
      "#fefefe",
    );
    const parsed = parseBoardScene(serializeBoardScene(scene));
    expect(boardStats(parsed)).toEqual({
      elements: 2,
      visibleElements: 1,
      files: 1,
    });
    expect(parsed.appState.viewBackgroundColor).toBe("#fefefe");
    expect(boardByteSize(parsed)).toBeGreaterThan(10);
  });

  it("rifiuta scene non valide", () => {
    expect(() => parseBoardScene("")).toThrow("vuota");
    expect(() => parseBoardScene("non-json")).toThrow("non valida");
    expect(() => parseBoardScene("[]")).toThrow("oggetto");
    expect(() => parseBoardScene('{"type":"other","elements":[]}')).toThrow(
      "excalidraw",
    );
    expect(() =>
      parseBoardScene('{"type":"excalidraw","elements":{}}'),
    ).toThrow("elements");
    expect(() =>
      parseBoardScene('{"type":"excalidraw","elements":[],"files":[]}'),
    ).toThrow("files");
  });

  it("applica il limite di dimensione prima del parse", () => {
    expect(() => parseBoardScene("x".repeat(MAX_BOARD_BYTES + 1))).toThrow(
      "troppo grande",
    );
  });

  it("calcola stale solo per le lavagne derivate", () => {
    expect(isBoardStale(null, "A")).toBe(false);
    expect(
      isBoardStale({ origin: "diagram", baseSource: "A" }, "A"),
    ).toBe(false);
    expect(
      isBoardStale({ origin: "diagram", baseSource: "A" }, "B"),
    ).toBe(true);
    expect(isBoardStale({ origin: "manual", baseSource: null }, "B")).toBe(
      false,
    );
  });

  it("cambia tema solo esplicitamente", () => {
    const scene = emptyBoardScene("light");
    const dark = withBoardTheme(scene, "dark");
    expect(boardTheme(scene)).toBe("light");
    expect(boardTheme(dark)).toBe("dark");
    expect(dark.elements).toBe(scene.elements);
  });
});
