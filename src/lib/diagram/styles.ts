import type { DiagramTokens } from "./theme";
import type { DiagramModel, StyleMap } from "./document";
import { edgeKey, elementKey } from "./document";

export interface VisualStyle {
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  dash?: string | null;
  textColor?: string;
  opacity?: number;
  radius?: number;
  fontSize?: number;
  fontWeight?: string;
}

export type ElementKind = "node" | "edge" | "cluster";

export interface EffectiveStyle extends VisualStyle {
  fill: string;
  stroke: string;
  textColor: string;
  strokeWidth: number;
  dash: string | null;
  opacity: number;
  radius: number;
  fontSize: number;
  fontWeight: string;
}

export const DASH_OPTIONS = [
  { id: "solid", label: "Continuo", value: null as string | null },
  { id: "dashed", label: "Tratteggiato", value: "6 4" },
  { id: "dotted", label: "Punteggiato", value: "2 3" },
  { id: "long", label: "Tratti lunghi", value: "12 5" },
];

export function dashId(dash: string | null | undefined): string {
  if (dash === null) return "solid";
  if (!dash) return "solid";
  return DASH_OPTIONS.find((option) => option.value === dash)?.id ?? "custom";
}

export function effectiveStyle(
  tokens: DiagramTokens,
  kind: ElementKind,
  override?: VisualStyle,
): EffectiveStyle {
  const base: EffectiveStyle =
    kind === "edge"
      ? {
          fill: "none",
          stroke: tokens.line,
          textColor: tokens.fg,
          strokeWidth: tokens.strokeWidth,
          dash: null,
          opacity: 1,
          radius: 0,
          fontSize: tokens.fontSize,
          fontWeight: "normal",
        }
      : kind === "cluster"
        ? {
            fill: tokens.surfaceAlt,
            stroke: tokens.border,
            textColor: tokens.muted,
            strokeWidth: tokens.strokeWidth,
            dash: null,
            opacity: 1,
            radius: tokens.radius,
            fontSize: tokens.fontSize,
            fontWeight: "normal",
          }
        : {
            fill: tokens.surface,
            stroke: tokens.border,
            textColor: tokens.fg,
            strokeWidth: tokens.strokeWidth,
            dash: null,
            opacity: 1,
            radius: tokens.radius,
            fontSize: tokens.fontSize,
            fontWeight: "normal",
          };
  if (!override) return base;
  const next: EffectiveStyle = { ...base };
  for (const [key, value] of Object.entries(override) as Array<[keyof VisualStyle, unknown]>) {
    if (value === undefined) continue;
    if (key === "dash") {
      next.dash = (value as string | null) ?? null;
      continue;
    }
    (next as unknown as Record<string, unknown>)[key] = value;
  }
  return next;
}

export function styleFor(
  styles: StyleMap,
  kind: ElementKind,
  id: string | number,
): VisualStyle | undefined {
  return styles[kind === "edge" ? edgeKey(Number(id)) : elementKey(String(id))];
}

export function mergeStyle(base: VisualStyle | undefined, patch: Partial<VisualStyle>): VisualStyle {
  const next: VisualStyle = { ...(base ?? {}) };
  for (const [key, value] of Object.entries(patch) as Array<[keyof VisualStyle, unknown]>) {
    if (value === undefined) {
      delete next[key];
    } else if (key === "dash") {
      next.dash = (value as string | null) ?? null;
    } else {
      (next as unknown as Record<string, unknown>)[key] = value;
    }
  }
  return next;
}

export function withPatch(styles: StyleMap, keys: string[], patch: Partial<VisualStyle>): StyleMap {
  const next: StyleMap = { ...styles };
  for (const key of keys) {
    const merged = mergeStyle(next[key], patch);
    if (!hasProps(merged)) delete next[key];
    else next[key] = merged;
  }
  return next;
}

export function resetKeys(styles: StyleMap, keys: string[]): StyleMap {
  const next: StyleMap = { ...styles };
  for (const key of keys) delete next[key];
  return next;
}

export function hasProps(style: VisualStyle): boolean {
  return Object.values(style).some((value) => value !== undefined);
}

export function keysForElement(kind: ElementKind, id: string | number): string {
  return kind === "edge" ? edgeKey(Number(id)) : elementKey(String(id));
}

export function allNodeKeys(model: DiagramModel): string[] {
  return model.nodes.map((node) => elementKey(node.id));
}

export function allClusterKeys(model: DiagramModel): string[] {
  return model.clusters.map((cluster) => elementKey(cluster.id));
}

export function allEdgeKeys(model: DiagramModel): string[] {
  return model.edges.map((edge) => edgeKey(edge.index));
}

export function buildElementStyle(fill: string, stroke: string, text: string): VisualStyle {
  return { fill, stroke, textColor: text };
}

export function normalizeDash(value: string | null | undefined): string | null {
  if (value === null || value === undefined || value === "" || value === "solid") return null;
  if (value === "dashed") return "6 4";
  if (value === "dotted") return "2 3";
  return value;
}
