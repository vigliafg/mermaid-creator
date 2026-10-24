export interface Viewport {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Size {
  width: number;
  height: number;
}

export function safeSize(size: Size): Size {
  return {
    width: Math.max(1, Number.isFinite(size.width) ? size.width : 1),
    height: Math.max(1, Number.isFinite(size.height) ? size.height : 1),
  };
}

/**
 * Finestra visibile in coordinate SVG. Il suo aspect ratio è quello del
 * contenitore, così il mapping schermo→SVG resta lineare (preserveAspectRatio
 * "none") e il diagramma viene centrato con del margine.
 */
export function fitViewport(natural: Size, container: Size, padding = 28): Viewport {
  const nat = safeSize(natural);
  const box = safeSize(container);
  const pad = Math.min(
    Math.max(0, padding),
    Math.max(2, Math.min(box.width, box.height) * 0.08),
  );
  const available = {
    width: Math.max(1, box.width - pad * 2),
    height: Math.max(1, box.height - pad * 2),
  };
  const scale = Math.min(available.width / nat.width, available.height / nat.height);
  const width = box.width / Math.max(scale, 1e-6);
  const height = box.height / Math.max(scale, 1e-6);
  return {
    x: nat.width / 2 - width / 2,
    y: nat.height / 2 - height / 2,
    width,
    height,
  };
}

export function actualSizeViewport(natural: Size, container: Size): Viewport {
  const nat = safeSize(natural);
  const box = safeSize(container);
  return {
    x: nat.width / 2 - box.width / 2,
    y: nat.height / 2 - box.height / 2,
    width: box.width,
    height: box.height,
  };
}

export function viewportScale(viewport: Viewport, container: Size): number {
  return safeSize(container).width / Math.max(viewport.width, 1e-6);
}

export function minWidthFor(natural: Size): number {
  return Math.max(1, safeSize(natural).width / 8);
}

export function maxWidthFor(natural: Size): number {
  return Math.max(8, safeSize(natural).width * 8);
}

export function clampViewport(viewport: Viewport, natural: Size, container: Size): Viewport {
  const minWidth = Math.min(minWidthFor(natural), safeSize(container).width);
  const maxWidth = Math.max(maxWidthFor(natural), safeSize(container).width);
  const width = Math.min(maxWidth, Math.max(minWidth, viewport.width));
  const aspect = safeSize(container).width / safeSize(container).height;
  const height = width / aspect;
  const nat = safeSize(natural);
  const minX = -width + 40;
  const maxX = nat.width - 40;
  const minY = -height + 40;
  const maxY = nat.height - 40;
  return {
    x: Math.min(maxX, Math.max(minX, viewport.x)),
    y: Math.min(maxY, Math.max(minY, viewport.y)),
    width,
    height,
  };
}

/**
 * Zoom che mantiene fermo il punto sotto il puntatore. px/py sono relativi
 * al contenitore; il punto viene convertito in coordinate SVG con il
 * viewport corrente e poi riusato con il nuovo viewport.
 */
export function zoomViewportAt(
  viewport: Viewport,
  factor: number,
  px: number,
  py: number,
  container: Size,
  natural: Size,
): Viewport {
  const box = safeSize(container);
  const safeFactor = Math.min(8, Math.max(0.125, Number.isFinite(factor) ? factor : 1));
  const pointX = viewport.x + (px / box.width) * viewport.width;
  const pointY = viewport.y + (py / box.height) * viewport.height;
  const width = viewport.width / safeFactor;
  const aspect = box.width / box.height;
  const height = width / aspect;
  const next: Viewport = {
    x: pointX - (px / box.width) * width,
    y: pointY - (py / box.height) * height,
    width,
    height,
  };
  return clampViewport(next, natural, box);
}

export function panViewport(
  viewport: Viewport,
  dxPixels: number,
  dyPixels: number,
  container: Size,
  natural: Size,
): Viewport {
  const box = safeSize(container);
  return clampViewport(
    {
      ...viewport,
      x: viewport.x - (dxPixels / box.width) * viewport.width,
      y: viewport.y - (dyPixels / box.height) * viewport.height,
    },
    natural,
    box,
  );
}

export function resizeViewport(
  viewport: Viewport,
  oldContainer: Size,
  newContainer: Size,
  natural: Size,
): Viewport {
  const oldBox = safeSize(oldContainer);
  const newBox = safeSize(newContainer);
  const centerX = viewport.x + viewport.width / 2;
  const centerY = viewport.y + viewport.height / 2;
  const aspect = newBox.width / newBox.height;
  const height = viewport.width / aspect;
  return clampViewport(
    { x: centerX - viewport.width / 2, y: centerY - height / 2, width: viewport.width, height },
    natural,
    newBox,
  );
}

export function screenToSvg(
  viewport: Viewport,
  px: number,
  py: number,
  container: Size,
): { x: number; y: number } {
  const box = safeSize(container);
  return {
    x: viewport.x + (px / box.width) * viewport.width,
    y: viewport.y + (py / box.height) * viewport.height,
  };
}
