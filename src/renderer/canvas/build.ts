import { convertToExcalidrawElements } from "@excalidraw/excalidraw";
import type { ExcalidrawElement } from "@excalidraw/excalidraw/element/types";
import type { ExcalidrawElementSkeleton } from "@excalidraw/excalidraw/data/transform";
import type { ElementSpec } from "../../shared/canvas";
import { defaultSize } from "../../shared/placement";

export interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ArrowBinding {
  id: string;
  from: string;
  to: string;
}

export interface BuildResult {
  elements: ExcalidrawElement[];
  arrows: ArrowBinding[];
}

const AGENT = { author: "agent" } as const;
const GAP = 6;

/** The point where the centre-to-centre line leaves a box, plus a small gap. */
function exitPoint(box: Box, towardsX: number, towardsY: number): { x: number; y: number } {
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  const dx = towardsX - cx;
  const dy = towardsY - cy;
  if (dx === 0 && dy === 0) return { x: cx, y: cy };
  const scale = Math.min(
    dx === 0 ? Infinity : (box.width / 2 + GAP) / Math.abs(dx),
    dy === 0 ? Infinity : (box.height / 2 + GAP) / Math.abs(dy),
  );
  return { x: cx + dx * scale, y: cy + dy * scale };
}

function styleOf(spec: ElementSpec): Record<string, unknown> {
  const style: Record<string, unknown> = {};
  if (spec.strokeColor) style.strokeColor = spec.strokeColor;
  if (spec.backgroundColor) style.backgroundColor = spec.backgroundColor;
  if (spec.fillStyle) style.fillStyle = spec.fillStyle;
  if (spec.strokeStyle) style.strokeStyle = spec.strokeStyle;
  return style;
}

function shapeSkeleton(spec: ElementSpec): ExcalidrawElementSkeleton {
  const size = defaultSize(spec);
  const common = { ...styleOf(spec), customData: AGENT, x: spec.x ?? 0, y: spec.y ?? 0 };
  if (spec.type === "text") {
    return {
      type: "text",
      text: spec.text ?? "",
      ...common,
      ...(spec.fontSize ? { fontSize: spec.fontSize } : {}),
      ...(spec.id ? { id: spec.id } : {}),
    } as ExcalidrawElementSkeleton;
  }
  if (spec.type === "frame") {
    return {
      type: "frame",
      children: spec.children ?? [],
      ...(spec.name ? { name: spec.name } : {}),
      ...(spec.id ? { id: spec.id } : {}),
    } as ExcalidrawElementSkeleton;
  }
  return {
    type: spec.type,
    ...common,
    width: size.width,
    height: size.height,
    ...(spec.text ? { label: { text: spec.text, ...(spec.fontSize ? { fontSize: spec.fontSize } : {}) } } : {}),
    ...(spec.id ? { id: spec.id } : {}),
  } as ExcalidrawElementSkeleton;
}

function boxOf(element: ExcalidrawElement | Box): Box {
  return { x: element.x, y: element.y, width: element.width, height: element.height };
}

function arrowSkeleton(spec: ElementSpec, start: Box | null, end: Box | null): ExcalidrawElementSkeleton {
  const from = start
    ? exitPoint(start, (end ?? start).x + (end ?? start).width / 2, (end ?? start).y + (end ?? start).height / 2)
    : { x: spec.x ?? 0, y: spec.y ?? 0 };
  const to = end
    ? exitPoint(end, (start ?? end).x + (start ?? end).width / 2, (start ?? end).y + (start ?? end).height / 2)
    : { x: (spec.x ?? 0) + (spec.width ?? 120), y: (spec.y ?? 0) + (spec.height ?? 0) };
  return {
    type: spec.type === "line" ? "line" : "arrow",
    x: from.x,
    y: from.y,
    points: [[0, 0], [to.x - from.x, to.y - from.y]],
    customData: AGENT,
    ...styleOf(spec),
    ...(spec.text ? { label: { text: spec.text } } : {}),
    ...(spec.id ? { id: spec.id } : {}),
  } as ExcalidrawElementSkeleton;
}

export class BuildError extends Error {}

/**
 * Shapes go through Excalidraw's skeleton converter. Arrows are placed by this
 * host so they can bind to elements that are already on the board, which the
 * converter only does inside one batch.
 */
export function buildElements(specs: readonly ElementSpec[], existing: readonly ExcalidrawElement[]): BuildResult {
  const shapes = specs.filter((spec) => spec.type !== "arrow" && spec.type !== "line");
  const connectors = specs.filter((spec) => spec.type === "arrow" || spec.type === "line");
  const known = new Map(existing.map((element) => [element.id, element]));

  for (const spec of shapes) {
    if (spec.type !== "frame") continue;
    const batch = new Set(shapes.flatMap((other) => (other.id ? [other.id] : [])));
    const missing = (spec.children ?? []).filter((id) => !batch.has(id));
    if (missing.length > 0) {
      throw new BuildError(
        `A frame can only hold elements created in the same add_elements call. Unknown here: ${missing.join(", ")}.`,
      );
    }
  }

  const built = convertToExcalidrawElements(shapes.map(shapeSkeleton), { regenerateIds: false });
  const boxes = new Map<string, Box>();
  for (const element of built) boxes.set(element.id, boxOf(element));

  const arrows: ArrowBinding[] = [];
  const skeletons = connectors.map((spec) => {
    const resolve = (id: string | undefined): Box | null => {
      if (!id) return null;
      const box = boxes.get(id) ?? (known.has(id) ? boxOf(known.get(id)!) : undefined);
      if (!box) throw new BuildError(`No element has the id "${id}". Call get_scene to read the current ids.`);
      return box;
    };
    const start = resolve(spec.from);
    const end = resolve(spec.to);
    if (spec.id && spec.from && spec.to) arrows.push({ id: spec.id, from: spec.from, to: spec.to });
    return arrowSkeleton(spec, start, end);
  });
  const builtArrows = convertToExcalidrawElements(skeletons, { regenerateIds: false });

  return { elements: [...built, ...builtArrows], arrows };
}
