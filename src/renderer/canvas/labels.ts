import type { ExcalidrawElement } from "@excalidraw/excalidraw/element/types";
import type { ElementSpec } from "../../shared/canvas";
import { arrowGapFor, arrowLabelBox, fitLabel, fitText, gapBetween, minimumArrowGap, type LabelBox } from "../../shared/label";
import { measureLabel } from "./measure";

const DEFAULT_FONT_SIZE = 20;

export interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

export function labelBox(spec: ElementSpec): LabelBox | null {
  const text = spec.text;
  if (text === undefined || text === "") return null;
  const fontSize = spec.fontSize ?? DEFAULT_FONT_SIZE;
  if (spec.type === "text") return fitText(text, { measure: measureLabel, fontSize });
  if (spec.type === "arrow" || spec.type === "line") {
    return arrowLabelBox(text, { measure: measureLabel, fontSize });
  }
  return fitLabel(text, {
    measure: measureLabel,
    fontSize,
    ...(spec.width !== undefined ? { width: spec.width } : {}),
    ...(spec.height !== undefined ? { height: spec.height } : {}),
  });
}

/** Give every labelled shape a box that holds its wrapped label. */
export function sizeSpecs(specs: readonly ElementSpec[]): ElementSpec[] {
  return specs.map((spec) => {
    if (spec.type === "arrow" || spec.type === "line" || spec.type === "frame") return spec;
    const box = labelBox(spec);
    if (!box) return spec;
    return { ...spec, text: box.text, width: box.width, height: box.height };
  });
}

/** The widest arrow label in a batch decides how far apart its shapes go. */
export function requiredGap(specs: readonly ElementSpec[]): number {
  const gaps = specs.flatMap((spec) => {
    if (spec.type !== "arrow" && spec.type !== "line") return [];
    if (spec.text === undefined || spec.text === "") return [];
    return [arrowGapFor(spec.text, { measure: measureLabel, fontSize: spec.fontSize ?? DEFAULT_FONT_SIZE })];
  });
  return gaps.length === 0 ? 0 : Math.max(...gaps);
}

export interface LabelledArrow {
  id: string;
  from: string;
  to: string;
  needed: number;
}

export function labelledArrows(all: readonly ExcalidrawElement[]): LabelledArrow[] {
  const byId = new Map(all.map((element) => [element.id, element]));
  return all.flatMap((element) => {
    if (element.type !== "arrow" && element.type !== "line") return [];
    const start = "startBinding" in element ? element.startBinding?.elementId : undefined;
    const end = "endBinding" in element ? element.endBinding?.elementId : undefined;
    if (!start || !end) return [];
    const bound = element.boundElements?.find((entry) => entry.type === "text");
    const label = bound ? byId.get(bound.id) : undefined;
    if (!label || label.type !== "text") return [];
    const natural = arrowLabelBox(label.text, { measure: measureLabel, fontSize: label.fontSize });
    return [{ id: element.id, from: start, to: end, needed: minimumArrowGap(natural.width) }];
  });
}

/** The space a labelled arrow needs, when its two shapes sit where `boxes` says. */
export function tooClose(
  arrows: readonly LabelledArrow[],
  boxes: ReadonlyMap<string, Box>,
): { arrow: LabelledArrow; gap: number } | null {
  for (const arrow of arrows) {
    const from = boxes.get(arrow.from);
    const to = boxes.get(arrow.to);
    if (!from || !to) continue;
    const gap = gapBetween(from, to);
    if (gap < arrow.needed) return { arrow, gap: Math.round(gap) };
  }
  return null;
}

export function gapError(problem: { arrow: LabelledArrow; gap: number }): string {
  return `The labelled arrow "${problem.arrow.id}" needs at least ${problem.arrow.needed} px between`
    + ` "${problem.arrow.from}" and "${problem.arrow.to}", but they are ${problem.gap} px apart.`
    + " Move them further apart, or use arrange, which widens the gap for you.";
}
