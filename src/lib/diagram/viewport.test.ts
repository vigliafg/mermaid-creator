import { describe, expect, it } from "vitest";
import {
  actualSizeViewport,
  fitViewport,
  panViewport,
  screenToSvg,
  viewportScale,
  zoomViewportAt,
} from "./viewport";

const natural = { width: 400, height: 200 };
const container = { width: 800, height: 400 };

describe("viewport", () => {
  it("adatta rispettando l'aspect del contenitore", () => {
    const view = fitViewport(natural, container, 20);
    expect(view.width / view.height).toBeCloseTo(2, 6);
    const center = screenToSvg(view, 400, 200, container);
    expect(center.x).toBeCloseTo(natural.width / 2, 4);
    expect(center.y).toBeCloseTo(natural.height / 2, 4);
  });

  it("mantiene fermo il punto sotto il puntatore", () => {
    const view = fitViewport(natural, container, 20);
    const before = screenToSvg(view, 120, 90, container);
    const zoomed = zoomViewportAt(view, 1.8, 120, 90, container, natural);
    const after = screenToSvg(zoomed, 120, 90, container);
    expect(after.x).toBeCloseTo(before.x, 5);
    expect(after.y).toBeCloseTo(before.y, 5);
  });

  it("pan e 100%", () => {
    const view = fitViewport(natural, container, 20);
    const panned = panViewport(view, 30, -10, container, natural);
    expect(panned.x).toBeLessThan(view.x);
    expect(panned.y).toBeGreaterThan(view.y);
    const actual = actualSizeViewport(natural, container);
    expect(viewportScale(actual, container)).toBeCloseTo(1, 6);
  });

  it("resta stabile anche con un contenitore molto basso", () => {
    const view = fitViewport({ width: 466, height: 124 }, { width: 329, height: 57 });
    expect(view.width).toBeLessThan(2000);
    expect(view.width / view.height).toBeCloseTo(329 / 57, 5);
  });

  it("limita lo zoom estremo", () => {
    const view = fitViewport(natural, container);
    const tiny = zoomViewportAt(view, 1000, 0, 0, container, natural);
    const huge = zoomViewportAt(view, 0.0001, 0, 0, container, natural);
    expect(tiny.width).toBeGreaterThan(0);
    expect(huge.width).toBeLessThan(100000);
  });
});
