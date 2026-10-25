import { parse as peleParse } from "pele";
import type { VisualStyle } from "./styles";

export type DiagramKind =
  | "flowchart"
  | "class"
  | "state"
  | "er"
  | "block"
  | "sequence"
  | "pie"
  | "gantt"
  | "timeline"
  | "journey"
  | "quadrant"
  | "xychart"
  | "sankey"
  | "mindmap"
  | "c4"
  | "unknown";

export interface ModelNode {
  id: string;
  label: string;
}

export interface ModelEdge {
  index: number;
  from: string;
  to: string;
  label: string;
  kind: string;
  id?: string;
}

export interface ModelCluster {
  id: string;
  label: string;
}

export interface DiagramModel {
  kind: DiagramKind;
  nodes: ModelNode[];
  edges: ModelEdge[];
  clusters: ModelCluster[];
  direction?: string;
}

export interface Capabilities {
  nodes: boolean;
  edges: boolean;
  edgeSelection: boolean;
  clusters: boolean;
  structure: boolean;
  direction: boolean;
}

export interface DiagramDocument {
  source: string;
  kind: DiagramKind;
  capabilities: Capabilities;
  model: DiagramModel;
  styles: StyleMap;
}

export interface StyleMap {
  [key: string]: VisualStyle;
}

export interface MergeResult {
  source: string;
  dropped: string[];
  preserved: number;
}

export const STYLE_BLOCK_BEGIN = "%% mc:styles:begin";
export const STYLE_BLOCK_END = "%% mc:styles:end";

const EMPTY_CAPABILITIES: Capabilities = {
  nodes: false,
  edges: false,
  edgeSelection: false,
  clusters: false,
  structure: false,
  direction: false,
};

export function normalizeKind(value: string | undefined | null): DiagramKind {
  const token = (value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "");
  if (!token) return "unknown";
  if (token === "graph" || token.startsWith("flowchart")) return "flowchart";
  if (token.includes("statediagram")) return "state";
  if (token.includes("classdiagram")) return "class";
  if (token.includes("erdiagram")) return "er";
  if (token.includes("block")) return "block";
  if (token.includes("sequence")) return "sequence";
  if (token === "pie" || token.includes("piechart")) return "pie";
  if (token.includes("gantt")) return "gantt";
  if (token.includes("timeline")) return "timeline";
  if (token.includes("journey")) return "journey";
  if (token.includes("quadrant")) return "quadrant";
  if (token.includes("xychart")) return "xychart";
  if (token.includes("sankey")) return "sankey";
  if (token.includes("mindmap")) return "mindmap";
  if (token.includes("c4")) return "c4";
  return "unknown";
}

export function kindFromSource(source: string): DiagramKind {
  const first = source
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find((line) => line && !line.startsWith("%%") && line !== "---");
  if (!first) return "unknown";
  return normalizeKind(first.split(/\s+/)[0]);
}

export function capabilitiesFor(kind: DiagramKind): Capabilities {
  switch (kind) {
    case "flowchart":
      return {
        nodes: true,
        edges: true,
        edgeSelection: true,
        clusters: true,
        structure: true,
        direction: true,
      };
    case "class":
      return {
        nodes: true,
        edges: false,
        edgeSelection: true,
        clusters: false,
        structure: false,
        direction: true,
      };
    case "state":
      return {
        nodes: true,
        edges: true,
        edgeSelection: true,
        clusters: false,
        structure: false,
        direction: true,
      };
    case "er":
      return {
        nodes: true,
        edges: false,
        edgeSelection: true,
        clusters: false,
        structure: false,
        direction: true,
      };
    case "block":
      return {
        nodes: false,
        edges: false,
        edgeSelection: false,
        clusters: false,
        structure: false,
        direction: false,
      };
    default:
      return { ...EMPTY_CAPABILITIES };
  }
}

function asArray<T>(value: Iterable<T> | undefined): T[] {
  return value ? Array.from(value) : [];
}

function labelOf(value: unknown, fallback: string): string {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (Array.isArray(value)) {
    const joined = value.filter((item): item is string => typeof item === "string").join(" ");
    if (joined.trim()) return joined.trim();
  }
  return fallback;
}

function emptyModel(kind: DiagramKind): DiagramModel {
  return { kind, nodes: [], edges: [], clusters: [] };
}

function fromPele(parsed: any): DiagramModel {
  const kind: DiagramKind = normalizeKind(parsed?.type ?? "");
  if (!parsed || typeof parsed !== "object") return emptyModel(kind);

  if (parsed.type === "flowchart") {
    const nodes: ModelNode[] = asArray(parsed.nodes?.values?.()).map((node: any) => ({
      id: String(node.id),
      label: labelOf(node.text, String(node.id)),
    }));
    const edges: ModelEdge[] = (parsed.edges ?? []).map((edge: any, index: number) => ({
      index,
      from: String(edge.start),
      to: String(edge.end),
      label: labelOf(edge.text, ""),
      kind: String(edge.type ?? ""),
      id: edge.id ? String(edge.id) : undefined,
    }));
    const clusters: ModelCluster[] = (parsed.subgraphs ?? []).map((group: any) => ({
      id: String(group.id),
      label: labelOf(group.title, String(group.id)),
    }));
    return { kind: "flowchart", nodes, edges, clusters, direction: parsed.direction };
  }

  if (parsed.type === "class") {
    const nodes: ModelNode[] = asArray(parsed.classes?.values?.()).map((node: any) => ({
      id: String(node.id),
      label: labelOf(node.label, String(node.id)),
    }));
    const edges: ModelEdge[] = (parsed.relations ?? []).map((relation: any, index: number) => ({
      index,
      from: String(relation.id1),
      to: String(relation.id2),
      label: labelOf(relation.title, ""),
      kind: "relation",
    }));
    return { kind: "class", nodes, edges, clusters: [], direction: parsed.direction };
  }

  if (parsed.type === "state") {
    const nodes: ModelNode[] = asArray(parsed.states?.values?.())
      .filter((state: any) => state && state.id && !String(state.id).startsWith("["))
      .map((state: any) => ({
        id: String(state.id),
        label: labelOf(state.description, String(state.id)),
      }));
    const edges: ModelEdge[] = (parsed.relations ?? []).map((relation: any, index: number) => ({
      index,
      from: String(relation.id1),
      to: String(relation.id2),
      label: labelOf(relation.relationTitle, ""),
      kind: "transition",
    }));
    return { kind: "state", nodes, edges, clusters: [], direction: parsed.direction };
  }

  if (parsed.type === "er") {
    const entities = asArray(parsed.entities?.values?.());
    const names = new Map<string, string>();
    const nodes: ModelNode[] = entities.map((entity: any) => {
      const internal = String(entity.id);
      const id = labelOf(entity.label, internal);
      names.set(internal, id);
      return { id, label: id };
    });
    const edges: ModelEdge[] = (parsed.relationships ?? []).map((relation: any, index: number) => ({
      index,
      from: names.get(String(relation.entityA)) ?? String(relation.entityA),
      to: names.get(String(relation.entityB)) ?? String(relation.entityB),
      label: [relation.roleA, relation.roleB].filter(Boolean).join(" · "),
      kind: "relationship",
    }));
    const clusters: ModelCluster[] = (parsed.subgraphs ?? []).map((group: any) => ({
      id: String(group.id),
      label: labelOf(group.title, String(group.id)),
    }));
    return { kind: "er", nodes, edges, clusters, direction: parsed.direction };
  }

  if (parsed.type === "block") {
    const nodes: ModelNode[] = (parsed.blocks ?? [])
      .filter((block: any) => block && block.id && block.id !== "root")
      .map((block: any) => ({ id: String(block.id), label: labelOf(block.label, String(block.id)) }));
    const edges: ModelEdge[] = (parsed.edges ?? []).map((edge: any, index: number) => ({
      index,
      from: String(edge.start ?? ""),
      to: String(edge.end ?? ""),
      label: labelOf(edge.label, ""),
      kind: "block",
    }));
    return { kind: "block", nodes, edges, clusters: [] };
  }

  if (kind === "unknown") return emptyModel(kind);
  const nodes = asArray(parsed.nodes?.values?.()).map((node: any) => ({
    id: String(node.id),
    label: labelOf(node.text ?? node.label, String(node.id)),
  }));
  return { kind, nodes, edges: [], clusters: [] };
}

export function readModel(source: string, kindHint?: string): DiagramModel {
  try {
    const parsed = peleParse(source);
    return fromPele(parsed);
  } catch {
    return emptyModel(kindFromSource(source) !== "unknown" ? kindFromSource(source) : normalizeKind(kindHint));
  }
}

/* ------------------------------------------------------------------ */
/* Stili: parse, scrittura, merge                                      */
/* ------------------------------------------------------------------ */

export function elementKey(id: string): string {
  return `element:${id}`;
}

export function edgeKey(index: number): string {
  return `edge:${index}`;
}

export function keyId(key: string): string {
  return key.startsWith("element:") ? key.slice("element:".length) : "";
}

export function keyEdgeIndex(key: string): number | null {
  if (!key.startsWith("edge:")) return null;
  const value = Number(key.slice("edge:".length));
  return Number.isInteger(value) && value >= 0 ? value : null;
}

function splitProps(raw: string): string[] {
  const parts: string[] = [];
  let current = "";
  let quote: string | null = null;
  let depth = 0;
  for (const char of raw) {
    if (quote) {
      current += char;
      if (char === quote) quote = null;
      continue;
    }
    if (char === '"' || char === "'") {
      quote = char;
      current += char;
      continue;
    }
    if (char === "(") {
      depth += 1;
      current += char;
      continue;
    }
    if (char === ")") {
      depth = Math.max(0, depth - 1);
      current += char;
      continue;
    }
    if (char === "," && depth === 0) {
      if (current.trim()) parts.push(current.trim());
      current = "";
      continue;
    }
    current += char;
  }
  if (current.trim()) parts.push(current.trim());
  return parts;
}

function numberValue(value: string, min: number, max: number): number | undefined {
  const parsed = Number.parseFloat(value.replace(/px$/i, "").trim());
  if (!Number.isFinite(parsed)) return undefined;
  return Math.min(max, Math.max(min, parsed));
}

export function styleFromProps(raw: string): VisualStyle {
  const style: VisualStyle = {};
  for (const part of splitProps(raw)) {
    const separator = part.indexOf(":");
    if (separator <= 0) continue;
    const key = part.slice(0, separator).trim().toLowerCase();
    const value = part.slice(separator + 1).trim();
    if (!value) continue;
    if (key === "fill") style.fill = value;
    else if (key === "stroke") style.stroke = value;
    else if (key === "stroke-width") style.strokeWidth = numberValue(value, 0, 24);
    else if (key === "stroke-dasharray") style.dash = /^none$/i.test(value) ? null : value;
    else if (key === "color") style.textColor = value;
    else if (key === "opacity") style.opacity = numberValue(value, 0, 1);
    else if (key === "fill-opacity" || key === "stroke-opacity") {
      const opacity = numberValue(value, 0, 1);
      if (opacity !== undefined) style.opacity = opacity;
    } else if (key === "rx" || key === "ry") style.radius = numberValue(value, 0, 48);
    else if (key === "font-size") style.fontSize = numberValue(value, 8, 32);
    else if (key === "font-weight") {
      if (/^(normal|bold|bolder|[1-9]00)$/i.test(value)) style.fontWeight = value;
    }
  }
  return style;
}

function parseClassStyles(source: string): {
  defs: Record<string, VisualStyle>;
  assigned: Record<string, string>;
} {
  const defs: Record<string, VisualStyle> = {};
  const assigned: Record<string, string> = {};
  for (const rawLine of source.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("%%")) continue;
    const def = line.match(/^classDef\s+([A-Za-z0-9_-]+)\s+(.+)$/i);
    if (def) {
      defs[def[1]] = { ...(defs[def[1]] ?? {}), ...styleFromProps(def[2]) };
      continue;
    }
    const assign = line.match(/^class\s+(.+?)\s+([A-Za-z0-9_-]+)\s*$/i);
    if (assign && !assign[1].includes("{")) {
      const name = assign[2];
      for (const id of assign[1].split(/[,\s]+/).filter(Boolean)) {
        if (id !== "classDef") assigned[id] = name;
      }
      continue;
    }
    const inline = line.match(/\b([A-Za-z0-9_-]+)(?:\[[^\]]*\]|\([^)]*\)|\{[^}]*\}|\[\[[^\]]*\]\])?\s*:::([A-Za-z0-9_-]+)/);
    if (inline) assigned[inline[1]] = inline[2];
  }
  return { defs, assigned };
}

export function parseAllStyles(source: string, model: DiagramModel): StyleMap {
  const styles = parseStyles(source);
  const { defs, assigned } = parseClassStyles(source);
  for (const node of [...model.nodes, ...model.clusters]) {
    const name = assigned[node.id];
    if (!name || !defs[name]) continue;
    const key = elementKey(node.id);
    styles[key] = { ...defs[name], ...(styles[key] ?? {}) };
  }
  return styles;
}

export function parseStyles(source: string): StyleMap {
  const styles: StyleMap = {};
  for (const line of source.split(/\r?\n/)) {
    const trimmed = line.trim();
    const styleMatch = trimmed.match(/^style\s+(\S+)\s+(.+)$/i);
    if (styleMatch) {
      const key = elementKey(styleMatch[1]);
      styles[key] = { ...(styles[key] ?? {}), ...styleFromProps(styleMatch[2]) };
      continue;
    }
    const linkMatch = trimmed.match(/^linkStyle\s+(\d+)\s+(.+)$/i);
    if (linkMatch) {
      const key = edgeKey(Number(linkMatch[1]));
      styles[key] = { ...(styles[key] ?? {}), ...styleFromProps(linkMatch[2]) };
    }
  }
  return styles;
}

function cssColor(value: string | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (/^#[0-9a-fA-F]{3,8}$/.test(trimmed)) return trimmed;
  if (/^rgba?\([^)]*\)$/.test(trimmed) && !/url\s*\(|expression\s*\(|javascript:/i.test(trimmed)) {
    return trimmed;
  }
  if (/^(none|transparent|currentColor)$/i.test(trimmed)) return trimmed;
  if (/^[a-zA-Z]+$/.test(trimmed) && !/^(url|expression|javascript|import)$/i.test(trimmed)) {
    return trimmed;
  }
  return null;
}

function cssNumber(value: number | undefined, min: number, max: number): string | null {
  if (value === undefined || !Number.isFinite(value)) return null;
  const clamped = Math.min(max, Math.max(min, value));
  return String(Math.round(clamped * 1000) / 1000);
}

function styleToProps(style: VisualStyle): string[] {
  const props: string[] = [];
  const fill = cssColor(style.fill);
  if (fill) props.push(`fill:${fill}`);
  const stroke = cssColor(style.stroke);
  if (stroke) props.push(`stroke:${stroke}`);
  const width = cssNumber(style.strokeWidth, 0, 24);
  if (width !== null) props.push(`stroke-width:${width}px`);
  if (style.dash === null) props.push("stroke-dasharray:none");
  else if (style.dash && /^[0-9.\s]+$/.test(style.dash)) props.push(`stroke-dasharray:${style.dash.trim()}`);
  const text = cssColor(style.textColor);
  if (text) props.push(`color:${text}`);
  const opacity = cssNumber(style.opacity, 0, 1);
  if (opacity !== null) {
    props.push(`fill-opacity:${opacity}`);
    props.push(`stroke-opacity:${opacity}`);
  }
  const radius = cssNumber(style.radius, 0, 48);
  if (radius !== null) props.push(`rx:${radius}px`);
  const fontSize = cssNumber(style.fontSize, 8, 32);
  if (fontSize !== null) props.push(`font-size:${fontSize}px`);
  if (style.fontWeight && /^(normal|bold|bolder|[1-9]00)$/i.test(style.fontWeight)) {
    props.push(`font-weight:${style.fontWeight}`);
  }
  return props;
}

function lineEnding(source: string): string {
  return source.includes("\r\n") ? "\r\n" : "\n";
}

function removeStyleBlock(source: string): string {
  const eol = lineEnding(source);
  const lines = source.split(/\r?\n/);
  const out: string[] = [];
  let inBlock = false;
  for (const line of lines) {
    if (line.trim() === STYLE_BLOCK_BEGIN) {
      inBlock = true;
      continue;
    }
    if (inBlock && line.trim() === STYLE_BLOCK_END) {
      inBlock = false;
      continue;
    }
    if (!inBlock) out.push(line);
  }
  return out.join(eol).replace(/\s+$/g, "");
}

export function writeStyleBlock(source: string, styles: StyleMap): string {
  const eol = lineEnding(source);
  const base = removeStyleBlock(source);
  const elements: Array<[string, VisualStyle]> = [];
  const edges: Array<[number, VisualStyle]> = [];
  for (const [key, style] of Object.entries(styles)) {
    if (key.startsWith("element:")) {
      const id = keyId(key);
      if (!/^[A-Za-z0-9_.-]+$/.test(id)) continue;
      if (styleToProps(style).length) elements.push([id, style]);
    } else if (key.startsWith("edge:")) {
      const index = keyEdgeIndex(key);
      if (index === null) continue;
      if (styleToProps(style).length) edges.push([index, style]);
    }
  }
  elements.sort(([a], [b]) => a.localeCompare(b));
  edges.sort(([a], [b]) => a - b);
  const lines: string[] = [];
  for (const [id, style] of elements) {
    const props = styleToProps(style);
    if (props.length) lines.push(`style ${id} ${props.join(",")}`);
  }
  for (const [index, style] of edges) {
    const props = styleToProps(style);
    if (props.length) lines.push(`linkStyle ${index} ${props.join(",")}`);
  }
  if (!lines.length) return base;
  return `${base}${eol}${eol}${STYLE_BLOCK_BEGIN}${eol}${lines.join(eol)}${eol}${STYLE_BLOCK_END}`;
}

export function readDocument(source: string, kindHint?: string): DiagramDocument {
  const model = readModel(source, kindHint);
  const kind = model.kind !== "unknown" ? model.kind : normalizeKind(kindHint ?? kindFromSource(source));
  return {
    source,
    kind,
    capabilities: capabilitiesFor(kind),
    model: { ...model, kind },
    styles: parseAllStyles(source, model),
  };
}

export function edgeSignature(model: DiagramModel): string {
  return model.edges
    .map((edge) => `${edge.from}>${edge.to}|${edge.label}|${edge.kind}`)
    .join(";");
}

export function mergeAfterAi(oldSource: string, newSource: string, kindHint?: string): MergeResult {
  const oldDoc = readDocument(oldSource, kindHint);
  const newDoc = readDocument(newSource, kindHint);
  const nodeIds = new Set([...newDoc.model.nodes, ...newDoc.model.clusters].map((node) => node.id));
  const preserved: StyleMap = {};
  const dropped: string[] = [];
  for (const [key, style] of Object.entries(oldDoc.styles)) {
    if (key.startsWith("element:")) {
      const id = keyId(key);
      if (newDoc.capabilities.nodes && nodeIds.has(id)) preserved[key] = style;
      else dropped.push(key);
    }
  }
  const sameEdges = edgeSignature(oldDoc.model) === edgeSignature(newDoc.model);
  for (const [key, style] of Object.entries(oldDoc.styles)) {
    if (!key.startsWith("edge:")) continue;
    if (newDoc.capabilities.edges && sameEdges) preserved[key] = style;
    else dropped.push(key);
  }
  const source = writeStyleBlock(newSource, preserved);
  return {
    source,
    dropped,
    preserved: Object.keys(preserved).length,
  };
}

export function styleValueSummary(key: string): string {
  if (key.startsWith("edge:")) return `arco #${key.slice(5)}`;
  return keyId(key);
}
