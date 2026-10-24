import { edgeKey, elementKey, readModel, type DiagramModel, type StyleMap } from "./document";
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

export function setDirection(source: string, direction: "TB" | "TD" | "BT" | "LR" | "RL"): string {
  const eol = eolFor(source);
  const lines = source.split(/\r?\n/);
  for (let index = 0; index < lines.length; index += 1) {
    const match = lines[index].match(/^(\s*)(flowchart|graph)\b(?:\s+\S+)?(.*)$/i);
    if (match) {
      lines[index] = `${match[1]}${match[2]} ${direction}${match[3] ?? ""}`;
      return lines.join(eol);
    }
  }
  return `${source.replace(/\s+$/g, "")}${eol}${direction}${eol}`;
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
