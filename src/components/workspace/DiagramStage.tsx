import { Maximize2, ZoomIn, ZoomOut } from "lucide-react";
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import type { DiagramModel } from "../../lib/diagram/document";
import {
  annotateSvg,
  selectionFromTarget,
  type Selection,
} from "../../lib/diagram/selection";
import {
  actualSizeViewport,
  clampViewport,
  fitViewport,
  panViewport,
  resizeViewport,
  viewportScale,
  zoomViewportAt,
  type Viewport,
} from "../../lib/diagram/viewport";

export interface DiagramStageHandle {
  zoomIn: () => void;
  zoomOut: () => void;
  fit: () => void;
  actualSize: () => void;
  scale: () => number;
}

export interface LabelEditState {
  nodeId: string;
  value: string;
  left: number;
  top: number;
  width: number;
  height: number;
}

interface Props {
  svg: string;
  diagramKey: string;
  renderer: "pele" | "mermaid" | "";
  model: DiagramModel | null;
  selections: Selection[];
  onSelect: (selection: Selection | null, additive: boolean) => void;
  onStartLabelEdit: (nodeId: string, rect: { left: number; top: number; width: number; height: number }) => void;
  labelEdit: LabelEditState | null;
  onLabelCommit: (value: string) => void;
  onLabelCancel: () => void;
  canEditLabels: boolean;
}

interface OverlayRect {
  key: string;
  left: number;
  top: number;
  width: number;
  height: number;
}

function svgNaturalSize(svg: string): { width: number; height: number } {
  const viewBox = svg.match(/viewBox="([^"]+)"/i);
  if (viewBox) {
    const parts = viewBox[1].trim().split(/[\s,]+/).map(Number);
    if (parts.length === 4 && parts.every((value) => Number.isFinite(value)) && parts[2] > 0 && parts[3] > 0) {
      return { width: parts[2], height: parts[3] };
    }
  }
  const width = svg.match(/\swidth="(\d+(?:\.\d+)?)"/i);
  const height = svg.match(/\sheight="(\d+(?:\.\d+)?)"/i);
  return {
    width: width ? Number(width[1]) : 800,
    height: height ? Number(height[1]) : 600,
  };
}

export const DiagramStage = forwardRef<DiagramStageHandle, Props>(function DiagramStage(
  {
    svg,
    diagramKey,
    renderer,
    model,
    selections,
    onSelect,
    onStartLabelEdit,
    labelEdit,
    onLabelCommit,
    onLabelCancel,
    canEditLabels,
  },
  ref,
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const hostRef = useRef<HTMLDivElement>(null);
  const naturalRef = useRef({ width: 800, height: 600 });
  const viewportRef = useRef<Viewport>({ x: 0, y: 0, width: 800, height: 600 });
  const containerSizeRef = useRef({ width: 800, height: 600 });
  const interactedRef = useRef(false);
  const hasFitRef = useRef(false);
  const keyRef = useRef(diagramKey);
  const pointersRef = useRef(new Map<number, { x: number; y: number }>());
  const pressRef = useRef<{ x: number; y: number; selection: Selection | null } | null>(null);
  const panRef = useRef<{ x: number; y: number; viewport: Viewport } | null>(null);
  const pinchRef = useRef<{ distance: number; x: number; y: number } | null>(null);

  const [viewport, setViewport] = useState<Viewport>({
    x: 0,
    y: 0,
    width: 800,
    height: 600,
  });
  const [containerSize, setContainerSize] = useState({ width: 800, height: 600 });
  const [overlay, setOverlay] = useState<OverlayRect[]>([]);
  const [labelValue, setLabelValue] = useState("");
  const labelCommittedRef = useRef(false);

  useEffect(() => {
    setLabelValue(labelEdit?.value ?? "");
    labelCommittedRef.current = false;
  }, [labelEdit?.nodeId, labelEdit?.value]);

  const applyViewport = useCallback((next: Viewport) => {
    viewportRef.current = next;
    setViewport(next);
  }, []);

  const fit = useCallback(() => {
    const container = containerSizeRef.current;
    if (!container.width || !container.height) return;
    interactedRef.current = true;
    applyViewport(fitViewport(naturalRef.current, container));
  }, [applyViewport]);

  const actualSize = useCallback(() => {
    interactedRef.current = true;
    applyViewport(actualSizeViewport(naturalRef.current, containerSizeRef.current));
  }, [applyViewport]);

  const zoomAtCenter = useCallback(
    (factor: number) => {
      const container = containerSizeRef.current;
      interactedRef.current = true;
      applyViewport(
        zoomViewportAt(
          viewportRef.current,
          factor,
          container.width / 2,
          container.height / 2,
          container,
          naturalRef.current,
        ),
      );
    },
    [applyViewport],
  );

  useImperativeHandle(
    ref,
    () => ({
      zoomIn: () => zoomAtCenter(1.2),
      zoomOut: () => zoomAtCenter(1 / 1.2),
      fit,
      actualSize,
      scale: () => viewportScale(viewportRef.current, containerSizeRef.current),
    }),
    [actualSize, fit, zoomAtCenter],
  );

  // Renderizza l'SVG e lo annota. La stringa originale resta quella dell'export:
  // qui lavoriamo solo sul DOM.
  useLayoutEffect(() => {
    const host = hostRef.current;
    const container = containerRef.current;
    if (!host || !container) return;
    const root = host.querySelector<SVGSVGElement>("svg");
    if (!root) return;
    root.style.maxWidth = "none";
    root.style.width = "100%";
    root.style.height = "100%";
    root.style.display = "block";
    root.setAttribute("width", "100%");
    root.setAttribute("height", "100%");
    root.setAttribute("preserveAspectRatio", "none");
    naturalRef.current = svgNaturalSize(svg);
    if (model && renderer) annotateSvg(root, renderer, model);
    const size = {
      width: container.clientWidth,
      height: container.clientHeight,
    };
    containerSizeRef.current = size;
    setContainerSize(size);
    const isNewDiagram = keyRef.current !== diagramKey;
    if (isNewDiagram || !hasFitRef.current) {
      applyViewport(fitViewport(naturalRef.current, size));
      hasFitRef.current = true;
      interactedRef.current = false;
    } else {
      applyViewport(clampViewport(viewportRef.current, naturalRef.current, size));
    }
    keyRef.current = diagramKey;
  }, [applyViewport, diagramKey, model, renderer, svg]);

  // Applica il viewBox senza toccare l'HTML dell'SVG.
  useLayoutEffect(() => {
    const root = hostRef.current?.querySelector<SVGSVGElement>("svg");
    if (!root) return;
    root.setAttribute(
      "viewBox",
      `${viewport.x} ${viewport.y} ${viewport.width} ${viewport.height}`,
    );
    root.setAttribute("preserveAspectRatio", "none");
  }, [viewport, svg]);

  // ResizeObserver: mantiene centro e scala, oppure ri-fit se l'utente non ha interagito.
  useEffect(() => {
    const container = containerRef.current;
    if (!container || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => {
      const nextSize = { width: container.clientWidth, height: container.clientHeight };
      const previous = containerSizeRef.current;
      if (!nextSize.width || !nextSize.height) return;
      containerSizeRef.current = nextSize;
      setContainerSize(nextSize);
      if (!interactedRef.current) {
        applyViewport(fitViewport(naturalRef.current, nextSize));
      } else {
        applyViewport(
          resizeViewport(viewportRef.current, previous, nextSize, naturalRef.current),
        );
      }
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, [applyViewport]);

  // Wheel non passivo: zoom al puntatore; Shift+wheel = pan orizzontale.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const onWheel = (event: WheelEvent) => {
      if ((event.target as Element | null)?.closest("input, textarea, select, button, summary")) return;
      event.preventDefault();
      const rect = container.getBoundingClientRect();
      const px = event.clientX - rect.left;
      const py = event.clientY - rect.top;
      interactedRef.current = true;
      if (event.shiftKey && !event.ctrlKey && !event.metaKey) {
        applyViewport(
          panViewport(
            viewportRef.current,
            -event.deltaY,
            0,
            containerSizeRef.current,
            naturalRef.current,
          ),
        );
        return;
      }
      const factor = Math.exp(-event.deltaY * 0.0016);
      applyViewport(
        zoomViewportAt(
          viewportRef.current,
          factor,
          px,
          py,
          containerSizeRef.current,
          naturalRef.current,
        ),
      );
    };
    container.addEventListener("wheel", onWheel, { passive: false });
    return () => container.removeEventListener("wheel", onWheel);
  }, [applyViewport]);

  // Overlay di selezione: HTML assoluto, così non contamina l'SVG esportato.
  useEffect(() => {
    const container = containerRef.current;
    const root = hostRef.current?.querySelector<SVGSVGElement>("svg");
    if (!container || !root) {
      setOverlay([]);
      return;
    }
    const frame = window.requestAnimationFrame(() => {
      const containerRect = container.getBoundingClientRect();
      const rects: OverlayRect[] = [];
      for (const selection of selections) {
        const element = root.querySelector<Element>(`[data-mc-key="${selection.key}"]`);
        if (!element) continue;
        const rect = element.getBoundingClientRect();
        if (!rect.width && !rect.height) continue;
        rects.push({
          key: selection.key,
          left: rect.left - containerRect.left - 2,
          top: rect.top - containerRect.top - 2,
          width: rect.width + 4,
          height: rect.height + 4,
        });
      }
      setOverlay(rects);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [containerSize, selections, svg, viewport]);

  const pointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    const target = event.target as Element;
    if (target.closest("button, input, textarea, select, summary")) return;
    const selection = selectionFromTarget(target);
    pointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pointersRef.current.size === 2) {
      const [a, b] = Array.from(pointersRef.current.values());
      pinchRef.current = {
        distance: Math.hypot(a.x - b.x, a.y - b.y),
        x: (a.x + b.x) / 2,
        y: (a.y + b.y) / 2,
      };
      panRef.current = null;
      pressRef.current = null;
      return;
    }
    pressRef.current = { x: event.clientX, y: event.clientY, selection };
    if (!selection) {
      panRef.current = { x: event.clientX, y: event.clientY, viewport: viewportRef.current };
    }
    try {
      event.currentTarget.setPointerCapture?.(event.pointerId);
    } catch {
      // Pointer sintetici (test) possono non essere attivi.
    }
  };

  const pointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const previous = pointersRef.current.get(event.pointerId);
    if (!previous) return;
    pointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    const container = containerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();

    if (pointersRef.current.size === 2 && pinchRef.current) {
      const [a, b] = Array.from(pointersRef.current.values());
      const distance = Math.hypot(a.x - b.x, a.y - b.y);
      const midpoint = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      const factor = pinchRef.current.distance > 0 ? distance / pinchRef.current.distance : 1;
      interactedRef.current = true;
      const zoomed = zoomViewportAt(
        viewportRef.current,
        factor,
        midpoint.x - rect.left,
        midpoint.y - rect.top,
        containerSizeRef.current,
        naturalRef.current,
      );
      applyViewport(
        panViewport(
          zoomed,
          midpoint.x - pinchRef.current.x,
          midpoint.y - pinchRef.current.y,
          containerSizeRef.current,
          naturalRef.current,
        ),
      );
      pinchRef.current = { distance, x: midpoint.x, y: midpoint.y };
      return;
    }

    if (panRef.current && pointersRef.current.size === 1) {
      const dx = event.clientX - panRef.current.x;
      const dy = event.clientY - panRef.current.y;
      if (Math.abs(dx) + Math.abs(dy) > 1) interactedRef.current = true;
      applyViewport(
        panViewport(
          panRef.current.viewport,
          dx,
          dy,
          containerSizeRef.current,
          naturalRef.current,
        ),
      );
    }
  };

  const pointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    const press = pressRef.current;
    const selection = press?.selection ?? null;
    const moved = press
      ? Math.abs(event.clientX - press.x) + Math.abs(event.clientY - press.y)
      : 0;
    pointersRef.current.delete(event.pointerId);
    if (pointersRef.current.size < 2) pinchRef.current = null;
    if (pointersRef.current.size === 0) panRef.current = null;
    pressRef.current = null;
    try {
      event.currentTarget.releasePointerCapture?.(event.pointerId);
    } catch {
      // best effort
    }
    if (selection && moved < 5) {
      onSelect(selection, event.shiftKey);
    } else if (!selection && moved < 5) {
      onSelect(null, false);
    }
  };

  const doubleClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!canEditLabels) return;
    const element = (event.target as Element).closest("[data-mc-kind='node']");
    if (!element) return;
    const nodeId = element.getAttribute("data-mc-id");
    if (!nodeId) return;
    const container = containerRef.current;
    if (!container) return;
    const rect = element.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();
    onStartLabelEdit(nodeId, {
      left: rect.left - containerRect.left,
      top: rect.top - containerRect.top,
      width: Math.max(80, rect.width),
      height: Math.max(28, rect.height),
    });
  };

  const scale = viewportScale(viewport, containerSize);
  const commitLabel = () => {
    if (labelCommittedRef.current) return;
    labelCommittedRef.current = true;
    onLabelCommit(labelValue);
  };
  const cancelLabel = () => {
    labelCommittedRef.current = true;
    onLabelCancel();
  };

  return (
    <div
      className="diagram-stage"
      ref={containerRef}
      tabIndex={0}
      aria-label="Diagramma interattivo: usa la rotella per lo zoom e trascina per spostarti"
      onPointerDown={(event) => {
        containerRef.current?.focus();
        pointerDown(event);
      }}
      onPointerMove={pointerMove}
      onPointerUp={pointerUp}
      onPointerCancel={pointerUp}
      onDoubleClick={doubleClick}
      onKeyDown={(event) => {
        if ((event.target as Element).closest("input, textarea, select")) return;
        if (event.key === "+" || event.key === "=") {
          event.preventDefault();
          zoomAtCenter(1.2);
        } else if (event.key === "-") {
          event.preventDefault();
          zoomAtCenter(1 / 1.2);
        } else if (event.key === "0") {
          event.preventDefault();
          actualSize();
        } else if (event.key.toLowerCase() === "f") {
          event.preventDefault();
          fit();
        } else if (event.key.startsWith("Arrow")) {
          event.preventDefault();
          const step = 40;
          applyViewport(
            panViewport(
              viewportRef.current,
              event.key === "ArrowLeft" ? step : event.key === "ArrowRight" ? -step : 0,
              event.key === "ArrowUp" ? step : event.key === "ArrowDown" ? -step : 0,
              containerSizeRef.current,
              naturalRef.current,
            ),
          );
        }
      }}
    >
      <div className="diagram-canvas" ref={hostRef} dangerouslySetInnerHTML={{ __html: svg }} />
      <div className="selection-layer" aria-hidden="true">
        {overlay.map((rect) => (
          <div
            key={rect.key}
            className="selection-box"
            style={{ left: rect.left, top: rect.top, width: rect.width, height: rect.height }}
          />
        ))}
      </div>
      {labelEdit && (
        <input
          className="label-inline-editor"
          style={{
            left: labelEdit.left,
            top: labelEdit.top,
            width: Math.max(120, labelEdit.width),
            height: labelEdit.height,
          }}
          value={labelValue}
          autoFocus
          onChange={(event) => setLabelValue(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              commitLabel();
            }
            if (event.key === "Escape") {
              event.preventDefault();
              cancelLabel();
            }
          }}
          onBlur={commitLabel}
          aria-label="Modifica etichetta"
        />
      )}
      <div className="viewport-controls">
        <button className="icon-btn" title="Zoom out" onClick={() => zoomAtCenter(1 / 1.2)}>
          <ZoomOut size={15} />
        </button>
        <button className="zoom-readout" title="Adatta al contenitore" onClick={fit}>
          {Math.round(scale * 100)}%
        </button>
        <button className="icon-btn" title="Zoom in" onClick={() => zoomAtCenter(1.2)}>
          <ZoomIn size={15} />
        </button>
        <button className="icon-btn" title="Adatta (F)" onClick={fit}>
          <Maximize2 size={15} />
        </button>
      </div>
    </div>
  );
});
