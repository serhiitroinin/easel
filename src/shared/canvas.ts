export type ElementAuthor = "user" | "agent";

export type ShapeType = "rectangle" | "ellipse" | "diamond";
export type SpecType = ShapeType | "text" | "arrow" | "line" | "frame";

export interface SceneElement {
  id: string;
  type: string;
  x: number;
  y: number;
  width: number;
  height: number;
  author: ElementAuthor;
  text?: string;
  strokeColor?: string;
  backgroundColor?: string;
  from?: string;
  to?: string;
  groupId?: string;
  frameId?: string;
  /** Point count for a freehand or multi-point element, instead of its points. */
  points?: number;
}

export interface Viewport {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface SceneSnapshot {
  elements: SceneElement[];
  selection: string[];
  viewport: Viewport;
}

export interface SceneSummary extends SceneSnapshot {
  omitted: number;
}

export interface ElementSpec {
  id?: string;
  type: SpecType;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  text?: string;
  strokeColor?: string;
  backgroundColor?: string;
  fillStyle?: "solid" | "hachure" | "cross-hatch";
  strokeStyle?: "solid" | "dashed" | "dotted";
  fontSize?: number;
  from?: string;
  to?: string;
  children?: string[];
  name?: string;
  /** Place this element beside an existing one. It wins over the batch `near`. */
  near?: string;
}

export interface ElementUpdate {
  id: string;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  text?: string;
  strokeColor?: string;
  backgroundColor?: string;
  fillStyle?: "solid" | "hachure" | "cross-hatch";
  strokeStyle?: "solid" | "dashed" | "dotted";
}

export type ArrangeLayout = "row" | "column" | "grid" | "align-left" | "align-top" | "align-center-x" | "align-center-y";

export type ViewRegion = "viewport" | "selection" | "all";

export type CanvasCommand =
  | { kind: "get_scene" }
  | { kind: "view_canvas"; region: ViewRegion }
  | { kind: "add_elements"; elements: ElementSpec[]; near?: string }
  | { kind: "update_elements"; updates: ElementUpdate[] }
  | { kind: "delete_elements"; ids: string[] }
  | { kind: "arrange"; ids: string[]; layout: ArrangeLayout; gap?: number }
  | { kind: "focus"; ids: string[] };

export interface PlacedBounds {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export type CanvasResult =
  | { ok: true; kind: "scene"; scene: SceneSummary }
  | { ok: true; kind: "image"; mediaType: string; data: string; width: number; height: number }
  | { ok: true; kind: "elements"; elements: PlacedBounds[] }
  | { ok: true; kind: "ids"; ids: string[] }
  | { ok: true; kind: "note"; text: string }
  | { ok: false; error: string };

export const SCENE_ELEMENT_LIMIT = 120;
export const TEXT_SUMMARY_LIMIT = 140;
