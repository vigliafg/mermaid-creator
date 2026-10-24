import type { DiagramModel } from "./document";
import type { Selection } from "./selection";

export interface SourceRange {
  line: number;
  from: number;
  to: number;
}

export interface SourceIndex {
  nodes: Record<string, SourceRange>;
  clusters: Record<string, SourceRange>;
  edges: Record<number, SourceRange>;
}

const NON_STATEMENT = /^\s*(%%|style\b|linkStyle\b|classDef\b|click\b|accTitle|accDescr|title\b)/i;
const EDGE_OPERATOR =
  /(-->|---|-\.->|==>|--x|--o|<-->|->>|--\)|--\||<\|--|--\|>|\*--|--\*|o--|--o|\|\|--|--\|\||\}\||\.\.)/;

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function lineStarts(source: string): number[] {
  const starts = [0];
  for (let index = 0; index < source.length; index += 1) {
    if (source[index] === "\n") starts.push(index + 1);
  }
  return starts;
}

export function lineNumberAt(source: string, offset: number): number {
  let line = 0;
  const limit = Math.min(Math.max(0, offset), source.length);
  for (let index = 0; index < limit; index += 1) {
    if (source[index] === "\n") line += 1;
  }
  return line;
}

export function lineRange(source: string, line: number): SourceRange {
  const starts = lineStarts(source);
  const safeLine = Math.min(Math.max(0, line), starts.length - 1);
  const from = starts[safeLine] ?? 0;
  const next = starts[safeLine + 1] ?? source.length + 1;
  const to = Math.max(from, next - 1);
  return { line: safeLine, from, to };
}

function tokenOccurrences(source: string, token: string): SourceRange[] {
  const ranges: SourceRange[] = [];
  const regex = new RegExp(`(?<![A-Za-z0-9_-])${escapeRegExp(token)}(?![A-Za-z0-9_-])`, "g");
  let match: RegExpExecArray | null;
  while ((match = regex.exec(source))) {
    ranges.push({
      line: lineNumberAt(source, match.index),
      from: match.index,
      to: match.index + token.length,
    });
    if (ranges.length > 200) break;
  }
  return ranges;
}

function firstStatementOccurrence(source: string, token: string): SourceRange | null {
  for (const range of tokenOccurrences(source, token)) {
    const line = lineRange(source, range.line);
    const text = source.slice(line.from, line.to);
    if (!NON_STATEMENT.test(text)) return range;
  }
  return tokenOccurrences(source, token)[0] ?? null;
}

export function buildSourceIndex(source: string, model: DiagramModel): SourceIndex {
  const nodes: Record<string, SourceRange> = {};
  const clusters: Record<string, SourceRange> = {};
  const edges: Record<number, SourceRange> = {};
  for (const node of model.nodes) {
    const range = firstStatementOccurrence(source, node.id);
    if (range) nodes[node.id] = range;
  }
  for (const cluster of model.clusters) {
    const range = firstStatementOccurrence(source, cluster.id);
    if (range) clusters[cluster.id] = range;
  }
  const lines = source.split(/\r?\n/);
  for (const edge of model.edges) {
    const fromRegex = new RegExp(`(?<![A-Za-z0-9_-])${escapeRegExp(edge.from)}(?![A-Za-z0-9_-])`);
    const toRegex = new RegExp(`(?<![A-Za-z0-9_-])${escapeRegExp(edge.to)}(?![A-Za-z0-9_-])`);
    let found = -1;
    for (let index = 0; index < lines.length; index += 1) {
      const line = lines[index];
      if (NON_STATEMENT.test(line)) continue;
      if (fromRegex.test(line) && toRegex.test(line) && EDGE_OPERATOR.test(line)) {
        found = index;
        break;
      }
    }
    if (found >= 0) edges[edge.index] = lineRange(source, found);
  }
  return { nodes, clusters, edges };
}

export function rangeForSelection(
  index: SourceIndex,
  selection: Selection,
): SourceRange | null {
  if (selection.kind === "edge") {
    return index.edges[selection.index ?? Number(selection.id)] ?? null;
  }
  if (selection.kind === "cluster") return index.clusters[selection.id] ?? null;
  return index.nodes[selection.id] ?? null;
}

export function selectionAtCursor(
  source: string,
  offset: number,
  model: DiagramModel,
): Selection | null {
  const safeOffset = Math.min(Math.max(0, offset), source.length);
  const before = source.slice(0, safeOffset);
  const tokenMatch = before.match(/([A-Za-z0-9_.-]+)$/);
  if (tokenMatch) {
    const token = tokenMatch[1];
    const node = model.nodes.find((item) => item.id === token);
    if (node) return { kind: "node", id: node.id, key: `element:${node.id}` };
    const cluster = model.clusters.find((item) => item.id === token);
    if (cluster) return { kind: "cluster", id: cluster.id, key: `element:${cluster.id}` };
  }
  const line = lineNumberAt(source, safeOffset);
  const text = lineRange(source, line);
  const lineText = source.slice(text.from, text.to);
  if (!NON_STATEMENT.test(lineText) && EDGE_OPERATOR.test(lineText)) {
    for (const edge of model.edges) {
      if (lineText.includes(edge.from) && lineText.includes(edge.to)) {
        return { kind: "edge", id: String(edge.index), index: edge.index, key: `edge:${edge.index}` };
      }
    }
  }
  return null;
}
