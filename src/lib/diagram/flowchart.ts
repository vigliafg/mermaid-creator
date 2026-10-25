import { edgeKey, elementKey, kindFromSource, readModel, type DiagramModel, type StyleMap } from "./document";
import { buildSourceIndex, lineRange, type SourceRange } from "./sourceIndex";
import type { Selection } from "./selection";

export interface ShapeOption {
  id: string;
  label: string;
  open: string;
  close: string;
}

export const SHAPE_OPTIONS: ShapeOption[] = [
  { id: "rect", label: "Rettangolo", open: "[", close: "]" },
  { id: "rounded", label: "Arrotondato", open: "(", close: ")" },
  { id: "stadium", label: "Stadio", open: "([", close: "])" },
  { id: "circle", label: "Cerchio", open: "((", close: "))" },
  { id: "diamond", label: "Rombo", open: "{", close: "}" },
  { id: "hex", label: "Esagono", open: "{{", close: "}}" },
  { id: "cylinder", label: "Cilindro", open: "[(", close: ")]" },
  { id: "subroutine", label: "Subroutine", open: "[[", close: "]]" },
  { id: "asymmetric", label: "Asimmetrico", open: ">", close: "]" },
  { id: "parallelogram", label: "Parallelogramma", open: "[/", close: "/]" },
  { id: "parallelogram-alt", label: "Parallelogramma inverso", open: "[\\", close: "\\]" },
  { id: "trapezoid", label: "Trapezio", open: "[/", close: "\\]" },
  { id: "trapezoid-alt", label: "Trapezio inverso", open: "[\\", close: "/]" },
];

export const ARROW_OPTIONS = [
  { id: "arrow", label: "Freccia", value: "-->" },
  { id: "open", label: "Linea", value: "---" },
  { id: "dotted", label: "Tratteggiata", value: "-.->" },
  { id: "thick", label: "Spessa", value: "==>" },
];

export type DiagramDirection = "TB" | "BT" | "LR" | "RL";

export const DIRECTION_OPTIONS: Array<{ id: DiagramDirection; label: string; hint: string }> = [
  { id: "TB", label: "Verticale ↓", hint: "Dall'alto verso il basso (TB)" },
  { id: "BT", label: "Verticale ↑", hint: "Dal basso verso l'alto (BT)" },
  { id: "LR", label: "Orizzontale →", hint: "Da sinistra verso destra (LR)" },
  { id: "RL", label: "Orizzontale ←", hint: "Da destra verso sinistra (RL)" },
];

const DIRECTION_TOKENS = /^(TB|TD|BT|LR|RL)$/i;

export function normalizeDirection(value: string | null | undefined): DiagramDirection {
  const token = (value ?? "").trim().toUpperCase();
  if (token === "BT") return "BT";
  if (token === "LR") return "LR";
  if (token === "RL") return "RL";
  return "TB";
}

export interface EdgeArrowOption {
  id: string;
  label: string;
  syntax: string;
}

export const EDGE_ARROW_OPTIONS: EdgeArrowOption[] = [
  { id: "arrow", label: "Freccia (una punta)", syntax: "-->" },
  { id: "arrow-both", label: "Doppia freccia (due punte)", syntax: "<-->" },
  { id: "circle", label: "Cerchio (una punta)", syntax: "--o" },
  { id: "circle-both", label: "Doppio cerchio", syntax: "o--o" },
  { id: "cross", label: "Croce (una punta)", syntax: "--x" },
  { id: "cross-both", label: "Doppia croce", syntax: "x--x" },
  { id: "open", label: "Nessuna punta", syntax: "---" },
  { id: "dotted", label: "Tratteggiata (una punta)", syntax: "-.->" },
  { id: "dotted-open", label: "Tratteggiata senza punte", syntax: "-.-" },
  { id: "thick", label: "Spessa (una punta)", syntax: "==>" },
  { id: "thick-both", label: "Spessa (due punte)", syntax: "<==>" },
  { id: "thick-open", label: "Spessa senza punte", syntax: "===" },
];


export interface DefinitionSpan {
  from: number;
  to: number;
  labelFrom: number;
  labelTo: number;
  label: string;
  shape: ShapeOption;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function tokenRegex(id: string, flags = ""): RegExp {
  return new RegExp(`(?<![A-Za-z0-9_-])${escapeRegExp(id)}(?![A-Za-z0-9_-])`, flags);
}

function findClosing(source: string, start: number, close: string): number {
  let quote: string | null = null;
  for (let index = start; index < source.length; index += 1) {
    const char = source[index];
    if (quote) {
      if (char === quote && source[index - 1] !== "\\") quote = null;
      continue;
    }
    if (char === '"' || char === "'") {
      quote = char;
      continue;
    }
    if (source.startsWith(close, index)) return index;
    if (char === "\n") return -1;
  }
  return -1;
}

export function findDefinition(source: string, id: string): DefinitionSpan | null {
  const regex = tokenRegex(id, "g");
  let match: RegExpExecArray | null;
  while ((match = regex.exec(source))) {
    let index = match.index + id.length;
    while (index < source.length && (source[index] === " " || source[index] === "\t")) index += 1;
    const candidates = [...SHAPE_OPTIONS].sort((a, b) => b.open.length - a.open.length);
    for (const shape of candidates) {
      if (!source.startsWith(shape.open, index)) continue;
      const labelFrom = index + shape.open.length;
      const closeIndex = findClosing(source, labelFrom, shape.close);
      if (closeIndex < 0) continue;
      const raw = source.slice(labelFrom, closeIndex);
      const quoted = raw.length >= 2 && ((raw[0] === '"' && raw.at(-1) === '"') || (raw[0] === "'" && raw.at(-1) === "'"));
      const label = quoted ? raw.slice(1, -1) : raw;
      return {
        from: index,
        to: closeIndex + shape.close.length,
        labelFrom: quoted ? labelFrom + 1 : labelFrom,
        labelTo: quoted ? closeIndex - 1 : closeIndex,
        label,
        shape,
      };
    }
  }
  return null;
}

export function nodeLabel(source: string, id: string): string {
  return findDefinition(source, id)?.label ?? id;
}

function sanitizeLabel(value: string): string {
  return value
    .replace(/\r?\n/g, "<br/>")
    .replace(/"/g, "'")
    .replace(/]/g, ")")
    .replace(/\}/g, ")")
    .trim();
}

function eolFor(source: string): string {
  return source.includes("\r\n") ? "\r\n" : "\n";
}

function styleBlockStart(source: string): number {
  const match = source.match(/^%%\s*mc:styles:begin\s*$/m);
  return match?.index ?? -1;
}

function insertBeforeStyles(source: string, line: string): string {
  const eol = eolFor(source);
  const block = styleBlockStart(source);
  if (block >= 0) {
    return `${source.slice(0, block).replace(/\s+$/g, "")}${eol}${line}${eol}${eol}${source.slice(block)}`;
  }
  return `${source.replace(/\s+$/g, "")}${eol}${line}${eol}`;
}

export function replaceNodeLabel(source: string, id: string, value: string): string {
  const definition = findDefinition(source, id);
  const clean = sanitizeLabel(value);
  if (definition) {
    return `${source.slice(0, definition.labelFrom)}${clean}${source.slice(definition.labelTo)}`;
  }
  if (tokenRegex(id).test(source) && new RegExp(`(?<![A-Za-z0-9_-])${escapeRegExp(id)}\s*@\{`).test(source)) {
    return source;
  }
  return insertBeforeStyles(source, `  ${id}[${clean}]`);
}

export function setNodeShape(source: string, id: string, shapeId: string): string {
  const shape = SHAPE_OPTIONS.find((option) => option.id === shapeId) ?? SHAPE_OPTIONS[0];
  const definition = findDefinition(source, id);
  if (!definition) {
    if (new RegExp(`(?<![A-Za-z0-9_-])${escapeRegExp(id)}\s*@\{`).test(source)) return source;
    const label = sanitizeLabel(nodeLabel(source, id));
    return insertBeforeStyles(source, `  ${id}${shape.open}${label}${shape.close}`);
  }
  return `${source.slice(0, definition.from)}${shape.open}${source.slice(definition.labelFrom, definition.labelTo)}${shape.close}${source.slice(definition.to)}`;
}

export function addNode(source: string, id: string, label = "Nuovo nodo"): string {
  const model = readModel(source);
  let candidate = id;
  let suffix = 1;
  while (model.nodes.some((node) => node.id === candidate)) {
    candidate = `${id}${suffix}`;
    suffix += 1;
  }
  return insertBeforeStyles(source, `  ${candidate}[${sanitizeLabel(label)}]`);
}

export function addEdge(source: string, from: string, to: string, arrow = "-->"): string {
  return insertBeforeStyles(source, `  ${from} ${arrow} ${to}`);
}

export function setDirection(source: string, direction: DiagramDirection): string {
  const eol = eolFor(source);
  const kind = kindFromSource(source);
  const lines = source.split(/\r?\n/);
  const headerRegex =
    kind === "flowchart"
      ? /^(\s*)((?:flowchart|graph)(?:-[A-Za-z0-9-]+)?)\b(.*)$/i
      : kind === "class"
        ? /^(\s*)(classDiagram(?:-v2)?)\b(.*)$/i
        : kind === "state"
          ? /^(\s*)(stateDiagram(?:-v2)?)\b(.*)$/i
          : kind === "er"
            ? /^(\s*)(erDiagram)\b(.*)$/i
            : null;

  if (kind === "flowchart") {
    for (let index = 0; index < lines.length; index += 1) {
      const match = lines[index].match(headerRegex!);
      if (!match) continue;
      const rest = (match[3] ?? "").replace(/^\s+\S+/, "");
      lines[index] = `${match[1]}${match[2]} ${direction}${rest}`;
      return lines.join(eol);
    }
  }

  if (headerRegex) {
    const headerIndex = lines.findIndex((line) => headerRegex.test(line));
    if (headerIndex >= 0) {
      const match = lines[headerIndex].match(headerRegex)!;
      const trailing = (match[3] ?? "").trim();
      if (trailing && DIRECTION_TOKENS.test(trailing)) {
        lines[headerIndex] = `${match[1]}${match[2]}`;
      }
      const existing = lines.findIndex((line) => /^direction\s+\S+\s*$/i.test(line));
      if (existing >= 0) {
        lines[existing] = `direction ${direction}`;
      } else {
        lines.splice(headerIndex + 1, 0, `direction ${direction}`);
      }
      return lines.join(eol);
    }
  }

  return `${source.replace(/\s+$/g, "")}${eol}${kind === "flowchart" ? direction : `direction ${direction}`}${eol}`;
}

interface ParsedEdgeLink {
  styleId: string;
  label: string;
}

interface LocatedEdgeLink {
  line: string;
  lineStart: number;
  lineEnd: number;
  fromStart: number;
  fromEnd: number;
  toStart: number;
  toEnd: number;
  linkStart: number;
  linkEnd: number;
  parsed: ParsedEdgeLink;
}

const LINK_CORE = /^(<==>|<-->|o--o|x--x|-\.->|==>|===|--o|--x|-->|---|-\.-)(?:\|([\s\S]*)\|)?$/;

const LINK_CORE_STYLES: Record<string, string> = {
  "-->": "arrow",
  "<-->": "arrow-both",
  "--o": "circle",
  "o--o": "circle-both",
  "--x": "cross",
  "x--x": "cross-both",
  "---": "open",
  "-.->": "dotted",
  "-.-": "dotted-open",
  "==>": "thick",
  "<==>": "thick-both",
  "===": "thick-open",
};

const LINK_TEXT_PATTERNS: Array<[RegExp, string]> = [
  [/^<--\s+([\s\S]+?)\s+-->$/, "arrow-both"],
  [/^<==\s+([\s\S]+?)\s+==>$/, "thick-both"],
  [/^o--\s+([\s\S]+?)\s+--o$/, "circle-both"],
  [/^x--\s+([\s\S]+?)\s+--x$/, "cross-both"],
  [/^--\s+([\s\S]+?)\s+-->$/, "arrow"],
  [/^--\s+([\s\S]+?)\s+---$/, "open"],
  [/^-\.\s+([\s\S]+?)\s+\.->$/, "dotted"],
  [/^-\.\s+([\s\S]+?)\s+\.-$/, "dotted-open"],
  [/^==\s+([\s\S]+?)\s+==>$/, "thick"],
  [/^==\s+([\s\S]+?)\s+===$/, "thick-open"],
  [/^--\s+([\s\S]+?)\s+--o$/, "circle"],
  [/^--\s+([\s\S]+?)\s+--x$/, "cross"],
];

function edgeTokenPositions(line: string, id: string): number[] {
  const regex = new RegExp(
    `(?<![A-Za-z0-9_.-])${escapeRegExp(id)}(?![A-Za-z0-9_.-])`,
    "g",
  );
  const positions: number[] = [];
  let match: RegExpExecArray | null;
  while ((match = regex.exec(line))) {
    positions.push(match.index);
    if (match[0].length === 0) regex.lastIndex += 1;
  }
  return positions;
}

function nodeSuffixEnd(line: string, tokenEnd: number): number {
  const shapes = [...SHAPE_OPTIONS].sort((a, b) => b.open.length - a.open.length);
  let index = tokenEnd;
  for (;;) {
    let cursor = index;
    while (cursor < line.length && /\s/.test(line[cursor])) cursor += 1;
    if (line.startsWith(":::", cursor)) {
      cursor += 3;
      while (cursor < line.length && /[\w-]/.test(line[cursor])) cursor += 1;
      index = cursor;
      continue;
    }
    let matched = false;
    for (const shape of shapes) {
      if (!line.startsWith(shape.open, cursor)) continue;
      const close = findClosing(line, cursor + shape.open.length, shape.close);
      if (close < 0) continue;
      index = close + shape.close.length;
      matched = true;
      break;
    }
    if (!matched) break;
  }
  return index;
}

function cleanEdgeLabel(value: string, stripQuotes: boolean): string {
  const trimmed = value.trim();
  if (!stripQuotes || trimmed.length < 2) return trimmed;
  const first = trimmed[0];
  const last = trimmed.at(-1);
  if ((first === '"' && last === '"') || (first === "'" && last === "'")) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function parseEdgeLink(text: string): ParsedEdgeLink | null {
  const core = text.match(LINK_CORE);
  if (core) {
    const styleId = LINK_CORE_STYLES[core[1]];
    if (styleId) return { styleId, label: cleanEdgeLabel(core[2] ?? "", false) };
  }
  for (const [pattern, styleId] of LINK_TEXT_PATTERNS) {
    const match = text.match(pattern);
    if (match) return { styleId, label: cleanEdgeLabel(match[1] ?? "", true) };
  }
  return null;
}

function findLinkInLine(line: string, from: string, to: string): LocatedEdgeLink | null {
  const fromPositions = edgeTokenPositions(line, from);
  const toPositions = edgeTokenPositions(line, to);
  let best: LocatedEdgeLink | null = null;
  for (const fromStart of fromPositions) {
    const fromEnd = nodeSuffixEnd(line, fromStart + from.length);
    for (const toStart of toPositions) {
      if (toStart < fromEnd) continue;
      let linkStart = fromEnd;
      while (linkStart < line.length && /\s/.test(line[linkStart])) linkStart += 1;
      let linkEnd = toStart;
      while (linkEnd > linkStart && /\s/.test(line[linkEnd - 1])) linkEnd -= 1;
      if (linkEnd <= linkStart) continue;
      const parsed = parseEdgeLink(line.slice(linkStart, linkEnd));
      if (!parsed) continue;
      const candidate: LocatedEdgeLink = {
        line,
        lineStart: 0,
        lineEnd: line.length,
        fromStart,
        fromEnd,
        toStart,
        toEnd: nodeSuffixEnd(line, toStart + to.length),
        linkStart,
        linkEnd,
        parsed,
      };
      if (!best || linkEnd - linkStart < best.linkEnd - best.linkStart) best = candidate;
    }
  }
  return best;
}

function findEdgeLink(
  source: string,
  model: DiagramModel,
  index: number,
): LocatedEdgeLink | null {
  const edge = model.edges.find((item) => item.index === index);
  if (!edge) return null;
  const range = buildSourceIndex(source, model).edges[index];
  if (!range) return null;
  const line = source.slice(range.from, range.to);
  const located = findLinkInLine(line, edge.from, edge.to);
  if (!located) return null;
  return {
    ...located,
    lineStart: range.from,
    lineEnd: range.to,
    line,
  };
}

function linkForStyle(styleId: string, label: string): string | null {
  const option = EDGE_ARROW_OPTIONS.find((item) => item.id === styleId);
  if (!option) return null;
  if (!label) return option.syntax;
  const safe = label.replace(/"/g, "&quot;");
  const wrappers: Record<string, [string, string]> = {
    arrow: ["-- ", " -->"],
    "arrow-both": ["<-- ", " -->"],
    circle: ["-- ", " --o"],
    "circle-both": ["o-- ", " --o"],
    cross: ["-- ", " --x"],
    "cross-both": ["x-- ", " --x"],
    open: ["-- ", " ---"],
    dotted: ["-. ", " .->"],
    "dotted-open": ["-. ", " .-"],
    thick: ["== ", " ==>"],
    "thick-both": ["<== ", " ==>"],
    "thick-open": ["== ", " ==="],
  };
  const wrapper = wrappers[styleId];
  if (!wrapper) return null;
  return `${wrapper[0]}${safe}${wrapper[1]}`;
}

export interface EdgeArrowState {
  styleId: string;
  label: string;
  canEdit: boolean;
  note?: string;
}

export function readEdgeArrow(
  source: string,
  model: DiagramModel,
  index: number,
): EdgeArrowState {
  const located = findEdgeLink(source, model, index);
  if (!located) {
    return {
      styleId: "arrow",
      label: "",
      canEdit: false,
      note: "Punte non modificabili da qui: modifica la riga nel sorgente.",
    };
  }
  return {
    styleId: located.parsed.styleId,
    label: located.parsed.label,
    canEdit: true,
  };
}

export function setEdgeArrow(
  source: string,
  model: DiagramModel,
  index: number,
  styleId: string,
): { source: string; ok: boolean; note?: string } {
  const located = findEdgeLink(source, model, index);
  if (!located) {
    return {
      source,
      ok: false,
      note: "Punte non modificabili da qui: modifica la riga nel sorgente.",
    };
  }
  const link = linkForStyle(styleId, located.parsed.label);
  if (!link) return { source, ok: false, note: "Tipo di punta non riconosciuto." };
  const start = located.lineStart + located.linkStart;
  const end = located.lineStart + located.linkEnd;
  return { source: `${source.slice(0, start)}${link}${source.slice(end)}`, ok: true };
}

export function reverseEdge(
  source: string,
  model: DiagramModel,
  index: number,
): { source: string; ok: boolean; note?: string } {
  const located = findEdgeLink(source, model, index);
  if (!located) {
    return {
      source,
      ok: false,
      note: "Direzione non modificabile da qui: modifica la riga nel sorgente.",
    };
  }
  const link = linkForStyle(located.parsed.styleId, located.parsed.label);
  if (!link) return { source, ok: false, note: "Tipo di punta non riconosciuto." };
  const fromSegment = located.line.slice(located.fromStart, located.fromEnd);
  const toSegment = located.line.slice(located.toStart, located.toEnd);
  const before = located.line.slice(0, located.fromStart);
  const after = located.line.slice(located.toEnd);
  const line = `${before}${toSegment} ${link} ${fromSegment}${after}`;
  return {
    source: `${source.slice(0, located.lineStart)}${line}${source.slice(located.lineEnd)}`,
    ok: true,
  };
}

export function deleteSelectionLine(
  source: string,
  selection: Selection,
  model: DiagramModel,
): { source: string; removed: number; note?: string } {
  const index = buildSourceIndex(source, model);
  if (selection.kind === "edge") {
    const range = index.edges[selection.index ?? Number(selection.id)];
    if (!range) return { source, removed: 0, note: "Arco non trovato nel sorgente" };
    const lineText = source.slice(range.from, range.to);
    if ((lineText.match(/-->|---|-.->|==>/g) ?? []).length > 1) {
      return { source, removed: 0, note: "L'arco è in una catena: elimina la riga manualmente" };
    }
    return { source: removeLine(source, range.line), removed: 1 };
  }
  const id = selection.id;
  const eol = eolFor(source);
  const lines = source.split(/\r?\n/);
  const out: string[] = [];
  let removed = 0;
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("%%") || /^linkStyle\b/i.test(trimmed)) {
      out.push(line);
      continue;
    }
    if (/^style\s+/i.test(trimmed) && new RegExp(`^style\\s+${escapeRegExp(id)}\\s`, "i").test(trimmed)) {
      removed += 1;
      continue;
    }
    if (tokenRegex(id).test(trimmed)) {
      removed += 1;
      continue;
    }
    out.push(line);
  }
  if (!removed) return { source, removed: 0, note: "Nodo non trovato nel sorgente" };
  return {
    source: out.join(eol).replace(new RegExp(`(?:${eol === "\r\n" ? "\\r\\n" : "\\n"}){3}`, "g"), `${eol}${eol}`),
    removed,
    note: "Sono state rimosse le righe che contenevano il nodo (e i relativi archi).",
  };
}

function removeLine(source: string, line: number): string {
  const range = lineRange(source, line);
  const next = source.indexOf("\n", range.to);
  const before = source.slice(0, range.from);
  const after = next >= 0 ? source.slice(next + 1) : "";
  return `${before}${after}`.replace(/\n{3,}/g, "\n\n");
}

export function edgeSignatureFor(model: DiagramModel): string {
  return model.edges.map((edge) => `${edge.from}>${edge.to}|${edge.label}`).join(";");
}

export function styleKeysForSelection(selection: Selection): string[] {
  return [selection.kind === "edge" ? edgeKey(selection.index ?? Number(selection.id)) : elementKey(selection.id)];
}

export function removeStylesForNode(styles: StyleMap, id: string): StyleMap {
  const next = { ...styles };
  delete next[elementKey(id)];
  return next;
}
