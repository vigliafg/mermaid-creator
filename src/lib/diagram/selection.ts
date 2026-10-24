import type { DiagramModel } from "./document";
import type { ElementKind } from "./styles";

export interface Selection {
  kind: ElementKind;
  id: string;
  index?: number;
  key: string;
}

export function makeSelection(kind: ElementKind, id: string, index?: number): Selection {
  return { kind, id, index, key: kind === "edge" ? `edge:${index ?? id}` : `element:${id}` };
}

export function selectionKey(kind: ElementKind, id: string | number): string {
  return kind === "edge" ? `edge:${Number(id)}` : `element:${String(id)}`;
}

export function sameSelection(a: Selection | undefined, b: Selection | undefined): boolean {
  return Boolean(a && b && a.kind === b.kind && a.id === b.id);
}

export function toggleSelection(list: Selection[], selection: Selection): Selection[] {
  const found = list.findIndex((item) => sameSelection(item, selection));
  if (found >= 0) return list.filter((_, index) => index !== found);
  return [...list, selection];
}

export function selectionLabel(model: DiagramModel | null, selection: Selection): string {
  if (!model) return selection.id;
  if (selection.kind === "node") {
    const node = model.nodes.find((item) => item.id === selection.id);
    return node ? `${node.label} · ${node.id}` : selection.id;
  }
  if (selection.kind === "cluster") {
    const cluster = model.clusters.find((item) => item.id === selection.id);
    return cluster ? `${cluster.label} · ${cluster.id}` : selection.id;
  }
  const edge = model.edges.find((item) => item.index === selection.index);
  return edge ? `${edge.from} → ${edge.to}` : `arco ${selection.index ?? selection.id}`;
}

/**
 * Risolve l'id di un nodo Mermaid partendo dall'id DOM. Mermaid produce
 * <renderId>-flowchart-<nodeId>-<n>, <renderId>-class-classId-<id>-<n>,
 * <renderId>-state-state-<id>-<n>, <renderId>-er-entity-<id>-<n>.
 */
export function resolveMermaidNodeId(
  domId: string,
  rendererId: string,
  kind: string,
  ids: string[],
): string | null {
  const prefix = rendererId ? `${rendererId}-` : "";
  const rest = domId.startsWith(prefix) ? domId.slice(prefix.length) : domId;
  const markers =
    kind === "class"
      ? ["class-classId-", "class-"]
      : kind === "state"
        ? ["state-state-", "state-"]
        : kind === "er"
          ? ["er-entity-", "entity-"]
          : ["flowchart-", ""];
  const sorted = [...ids].sort((a, b) => b.length - a.length);
  for (const marker of markers) {
    for (const id of sorted) {
      if (!rest.startsWith(`${marker}${id}-`)) continue;
      const suffix = rest.slice(`${marker}${id}-`.length);
      if (/^\d+$/.test(suffix)) return id;
    }
  }
  // Fallback prudente: rimuove il marcatore e l'ultimo contatore.
  const stripped = rest.replace(/^(flowchart|class-classId|class|state-state|state|er-entity|entity)-/, "").replace(/-\d+$/, "");
  return ids.includes(stripped) ? stripped : null;
}

export function edgeIndexFromDataId(dataId: string | null, model: DiagramModel): number | null {
  if (!dataId) return null;
  const exact = model.edges.find((edge) => edge.id === dataId);
  if (exact) return exact.index;
  for (const edge of model.edges) {
    if (dataId.startsWith(`L_${edge.from}_${edge.to}_`)) return edge.index;
    if (dataId.startsWith(`id_${edge.from}-${edge.to}`)) return edge.index;
    if (dataId.startsWith(`id_${edge.from}_${edge.to}`)) return edge.index;
  }
  return null;
}

function setAnnotation(
  element: Element,
  kind: ElementKind,
  id: string,
  index?: number,
): void {
  element.setAttribute("data-mc-kind", kind);
  element.setAttribute("data-mc-id", id);
  element.setAttribute("data-mc-key", selectionKey(kind, kind === "edge" ? index ?? id : id));
}

function annotatePele(root: SVGSVGElement, model: DiagramModel): void {
  const nodes = Array.from(root.querySelectorAll<SVGGElement>("[data-id]"));
  let edgeOrder = 0;
  for (const element of nodes) {
    const dataId = element.getAttribute("data-id");
    if (!dataId) continue;
    const classes = element.getAttribute("class") ?? "";
    if (classes.includes("pele-cluster")) {
      setAnnotation(element, "cluster", dataId);
      continue;
    }
    if (classes.includes("pele-edge-label")) {
      const index = edgeIndexFromDataId(dataId, model) ?? edgeOrder;
      setAnnotation(element, "edge", String(index), index);
      continue;
    }
    if (classes.includes("pele-edge")) {
      const index = edgeIndexFromDataId(dataId, model) ?? edgeOrder;
      edgeOrder += 1;
      setAnnotation(element, "edge", String(index), index);
      continue;
    }
    if (classes.includes("pele-node")) {
      setAnnotation(element, "node", dataId);
    }
  }
}

function annotateMermaid(root: SVGSVGElement, model: DiagramModel): void {
  const rendererId = root.id ?? "";
  const nodeIds = model.nodes.map((node) => node.id);
  const clusterIds = model.clusters.map((cluster) => cluster.id);
  for (const element of Array.from(root.querySelectorAll<SVGGElement>("g.node"))) {
    const id = resolveMermaidNodeId(element.id, rendererId, model.kind, nodeIds);
    if (id) setAnnotation(element, "node", id);
  }
  for (const element of Array.from(root.querySelectorAll<SVGGElement>("g.cluster"))) {
    const prefix = rendererId ? `${rendererId}-` : "";
    const rest = element.id.startsWith(prefix) ? element.id.slice(prefix.length) : element.id;
    const id = clusterIds.find((candidate) => rest === candidate || rest.endsWith(`-${candidate}`)) ?? rest;
    if (id) setAnnotation(element, "cluster", id);
  }
  const edgePaths = Array.from(
    root.querySelectorAll<SVGPathElement>("path.flowchart-link, path.transition"),
  );
  edgePaths.forEach((element, order) => {
    const fromData = edgeIndexFromDataId(element.getAttribute("data-id"), model);
    const index = fromData ?? order;
    setAnnotation(element, "edge", String(index), index);
  });
  const labels = Array.from(root.querySelectorAll<SVGGElement>("g.edgeLabel"));
  labels.forEach((element, order) => {
    const dataId = element.getAttribute("data-id") ?? element.querySelector("[data-id]")?.getAttribute("data-id") ?? null;
    const index = edgeIndexFromDataId(dataId, model) ?? order;
    setAnnotation(element, "edge", String(index), index);
  });
}

export function annotateSvg(
  root: SVGSVGElement,
  renderer: "pele" | "mermaid",
  model: DiagramModel,
): void {
  if (renderer === "pele") annotatePele(root, model);
  else annotateMermaid(root, model);
}

export function selectionFromTarget(target: Element): Selection | null {
  const element = target.closest("[data-mc-key]");
  if (!element) return null;
  const key = element.getAttribute("data-mc-key");
  if (!key) return null;
  if (key.startsWith("edge:")) {
    const index = Number(key.slice(5));
    return makeSelection("edge", String(index), index);
  }
  const id = element.getAttribute("data-mc-id") ?? key.slice("element:".length);
  const kind = (element.getAttribute("data-mc-kind") as ElementKind | null) ?? "node";
  return makeSelection(kind, id);
}

export function elementForSelection(
  root: SVGSVGElement,
  selection: Selection,
): Element | null {
  return root.querySelector(`[data-mc-key="${selection.key}"]`);
}
