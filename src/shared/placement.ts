import type { ArrangeLayout, ElementSpec, SceneElement, Viewport } from "./canvas";

export interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

const GAP = 56;
const MARGIN = 28;
const STEP = 48;
const MAX_ROWS = 80;
const DEFAULT_SHAPE: Box = { x: 0, y: 0, width: 200, height: 110 };

export function defaultSize(spec: ElementSpec): { width: number; height: number } {
  if (spec.width !== undefined && spec.height !== undefined) return { width: spec.width, height: spec.height };
  if (spec.type === "text") {
    const lines = (spec.text ?? "").split("\n");
    const longest = Math.max(...lines.map((line) => line.length), 1);
    const fontSize = spec.fontSize ?? 20;
    return {
      width: spec.width ?? Math.ceil(longest * fontSize * 0.55),
      height: spec.height ?? lines.length * Math.ceil(fontSize * 1.25),
    };
  }
  return { width: spec.width ?? DEFAULT_SHAPE.width, height: spec.height ?? DEFAULT_SHAPE.height };
}

function overlaps(box: Box, element: SceneElement): boolean {
  return box.x - MARGIN < element.x + element.width
    && box.x + box.width + MARGIN > element.x
    && box.y - MARGIN < element.y + element.height
    && box.y + box.height + MARGIN > element.y;
}

export function isFree(box: Box, elements: readonly SceneElement[]): boolean {
  return !elements.some((element) => overlaps(box, element));
}

/** Scan down, then across, so repeated requests fill a board in reading order. */
export function findFreeSpot(block: Box, elements: readonly SceneElement[]): Box {
  for (let column = 0; column < MAX_ROWS; column += 1) {
    for (let row = 0; row < MAX_ROWS; row += 1) {
      const candidate: Box = {
        x: block.x + column * (block.width + GAP),
        y: block.y + row * STEP,
        width: block.width,
        height: block.height,
      };
      if (isFree(candidate, elements)) return candidate;
    }
  }
  return block;
}

export interface PlacementOptions {
  viewport: Viewport;
  near?: SceneElement;
  /** Raised when a labelled arrow must fit between the placed shapes. */
  gap?: number;
}

/**
 * Every specification without coordinates joins one grid block, and the block
 * is moved until it sits in free space. Agent output never lands on user work.
 */
export function planPlacement(
  specs: readonly ElementSpec[],
  elements: readonly SceneElement[],
  options: PlacementOptions,
): ElementSpec[] {
  const loose = specs.filter((spec) => spec.x === undefined || spec.y === undefined)
    .filter((spec) => spec.type !== "frame")
    .filter((spec) => !(spec.from && spec.to));
  if (loose.length === 0) return [...specs];
  const gap = Math.max(options.gap ?? 0, GAP);

  const sizes = new Map(loose.map((spec) => [spec, defaultSize(spec)]));
  const columns = Math.min(loose.length, Math.max(1, Math.round(Math.sqrt(loose.length))));
  const rows = Math.ceil(loose.length / columns);
  const columnWidth = Math.max(...loose.map((spec) => sizes.get(spec)!.width));
  const rowHeight = Math.max(...loose.map((spec) => sizes.get(spec)!.height));
  const block: Box = {
    width: columns * columnWidth + (columns - 1) * gap,
    height: rows * rowHeight + (rows - 1) * gap,
    x: 0,
    y: 0,
  };
  const anchor = options.near
    ? { x: options.near.x + options.near.width + gap, y: options.near.y }
    : {
        x: Math.round(options.viewport.x + (options.viewport.width - block.width) / 2),
        y: Math.round(options.viewport.y + (options.viewport.height - block.height) / 2),
      };
  const placed = findFreeSpot({ ...block, ...anchor }, elements);

  const positions = new Map<ElementSpec, { x: number; y: number }>();
  loose.forEach((spec, index) => {
    positions.set(spec, {
      x: placed.x + (index % columns) * (columnWidth + gap),
      y: placed.y + Math.floor(index / columns) * (rowHeight + gap),
    });
  });

  return specs.map((spec) => {
    const position = positions.get(spec);
    if (!position) return spec;
    return { ...spec, ...position, ...sizes.get(spec)! };
  });
}

export interface Arrangement {
  id: string;
  x: number;
  y: number;
}

/**
 * Alignment only moves one axis, so the other axis is spread until every
 * neighbour has the clear space a labelled arrow needs.
 */
function spreadAlong(
  placed: Arrangement[],
  elements: readonly SceneElement[],
  axis: "x" | "y",
  gap: number,
): Arrangement[] {
  const size = axis === "x" ? "width" : "height";
  const sizes = new Map(elements.map((element) => [element.id, element[size]]));
  const order = [...placed].sort((left, right) => left[axis] - right[axis]);
  let edge = Number.NEGATIVE_INFINITY;
  for (const entry of order) {
    entry[axis] = Math.round(Math.max(entry[axis], edge));
    edge = entry[axis] + (sizes.get(entry.id) ?? 0) + gap;
  }
  return placed;
}

export function arrangeBoxes(
  elements: readonly SceneElement[],
  ids: readonly string[],
  layout: ArrangeLayout,
  gap = GAP,
): Arrangement[] {
  const selected = ids.flatMap((id) => {
    const element = elements.find((candidate) => candidate.id === id);
    return element ? [element] : [];
  });
  if (selected.length === 0) return [];
  const originX = Math.min(...selected.map((element) => element.x));
  const originY = Math.min(...selected.map((element) => element.y));

  if (layout === "align-left" || layout === "align-center-x") {
    const centre = originX + Math.max(...selected.map((element) => element.x + element.width - originX)) / 2;
    const aligned = selected.map((element) => ({
      id: element.id,
      x: layout === "align-left" ? originX : Math.round(centre - element.width / 2),
      y: element.y,
    }));
    return spreadAlong(aligned, selected, "y", gap);
  }
  if (layout === "align-top" || layout === "align-center-y") {
    const centre = originY + Math.max(...selected.map((element) => element.y + element.height - originY)) / 2;
    const aligned = selected.map((element) => ({
      id: element.id,
      x: element.x,
      y: layout === "align-top" ? originY : Math.round(centre - element.height / 2),
    }));
    return spreadAlong(aligned, selected, "x", gap);
  }

  const columns = layout === "row" ? selected.length : layout === "column" ? 1 : Math.ceil(Math.sqrt(selected.length));
  const columnWidth = Math.max(...selected.map((element) => element.width)) + gap;
  const rowHeight = Math.max(...selected.map((element) => element.height)) + gap;
  return selected.map((element, index) => ({
    id: element.id,
    x: originX + (index % columns) * columnWidth,
    y: originY + Math.floor(index / columns) * rowHeight,
  }));
}
