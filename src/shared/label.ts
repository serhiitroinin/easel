/** Text measured in the face the canvas actually draws with. */
export type Measure = (text: string, fontSize: number) => number;

export const LABEL_PADDING = 8;
export const LABEL_LINE_HEIGHT = 1.25;
export const LABEL_MIN_WIDTH = 160;
export const LABEL_MAX_WIDTH = 420;
export const LABEL_MIN_HEIGHT = 56;
/** Clear shaft an arrow label needs on each side, so the line stays readable. */
export const ARROW_LABEL_CLEARANCE = 40;
/** The shaft that must stay visible on each side of a label. */
export const ARROW_SHAFT_VISIBLE = 32;
/** Above this width a label is balanced over two lines instead of one. */
export const ARROW_LABEL_SINGLE_LINE_MAX = 260;
export const ARROW_LABEL_MAX_LINES = 2;

export interface LabelBox {
  text: string;
  lines: string[];
  width: number;
  height: number;
}

export interface FitOptions {
  measure: Measure;
  fontSize: number;
  width?: number;
  height?: number;
  minWidth?: number;
  maxWidth?: number;
  padding?: number;
}

export function wrapLines(text: string, limit: number, measure: Measure, fontSize: number): string[] {
  const lines: string[] = [];
  for (const paragraph of text.split("\n")) {
    const words = paragraph.split(/\s+/).filter((word) => word !== "");
    if (words.length === 0) {
      lines.push("");
      continue;
    }
    let line = "";
    for (const word of words) {
      const candidate = line === "" ? word : `${line} ${word}`;
      if (line !== "" && measure(candidate, fontSize) > limit) {
        lines.push(line);
        line = word;
      } else {
        line = candidate;
      }
    }
    lines.push(line);
  }
  return lines;
}

/**
 * A container that always holds its label: the text wraps to the width, the
 * height grows to the wrapped lines, and the width grows only when one word
 * cannot fit, up to the cap.
 */
export function fitLabel(text: string, options: FitOptions): LabelBox {
  const padding = options.padding ?? LABEL_PADDING;
  const minWidth = options.minWidth ?? LABEL_MIN_WIDTH;
  const maxWidth = options.maxWidth ?? LABEL_MAX_WIDTH;
  let width = Math.max(options.width ?? minWidth, minWidth);

  let lines = wrapLines(text, width - padding * 2, options.measure, options.fontSize);
  const widest = () => Math.max(...lines.map((line) => options.measure(line, options.fontSize)), 0);

  if (widest() > width - padding * 2) {
    width = Math.min(maxWidth, Math.ceil(widest()) + padding * 2);
    lines = wrapLines(text, width - padding * 2, options.measure, options.fontSize);
  }

  const lineHeight = Math.ceil(options.fontSize * LABEL_LINE_HEIGHT);
  const height = Math.max(
    options.height ?? 0,
    LABEL_MIN_HEIGHT,
    lines.length * lineHeight + padding * 2,
  );
  return { text: lines.join("\n"), lines, width: Math.ceil(width), height: Math.ceil(height) };
}

/** A standalone text element is measured, never wrapped for a container. */
export function fitText(text: string, options: { measure: Measure; fontSize: number }): LabelBox {
  const lines = text.split("\n");
  const width = Math.ceil(Math.max(...lines.map((line) => options.measure(line, options.fontSize)), 1));
  return {
    text,
    lines,
    width,
    height: Math.ceil(lines.length * options.fontSize * LABEL_LINE_HEIGHT),
  };
}

/** The narrowest width, within the limit, that holds the text in `maxLines`. */
function narrowestWidth(
  text: string,
  limit: number,
  maxLines: number,
  measure: Measure,
  fontSize: number,
): number {
  const words = text.split(/\s+/).filter((word) => word !== "");
  const longestWord = Math.max(...words.map((word) => measure(word, fontSize)), 1);
  let low = Math.ceil(longestWord);
  let high = Math.ceil(Math.max(Math.min(limit, Number.MAX_SAFE_INTEGER), longestWord));
  if (wrapLines(text, high, measure, fontSize).length > maxLines) return high;
  while (low < high) {
    const middle = Math.floor((low + high) / 2);
    if (wrapLines(text, middle, measure, fontSize).length <= maxLines) high = middle;
    else low = middle + 1;
  }
  return high;
}

/**
 * An arrow label is drawn by the host, never left to the shaft length: one line
 * while it is short, otherwise balanced over two lines inside the clear space.
 */
export function arrowLabelBox(text: string, options: {
  measure: Measure;
  fontSize: number;
  /** The whole shaft length. Absent means "decide the natural size". */
  shaft?: number;
}): LabelBox {
  const room = options.shaft === undefined
    ? ARROW_LABEL_SINGLE_LINE_MAX
    : Math.max(options.shaft - ARROW_LABEL_CLEARANCE * 2, 1);
  const single = measure(text, options);
  const limit = Math.min(room, ARROW_LABEL_SINGLE_LINE_MAX);
  const lineHeight = Math.ceil(options.fontSize * LABEL_LINE_HEIGHT);

  if (single <= limit) {
    return { text, lines: [text], width: Math.ceil(single), height: lineHeight };
  }
  const width = narrowestWidth(text, room, ARROW_LABEL_MAX_LINES, options.measure, options.fontSize);
  const lines = wrapLines(text, width, options.measure, options.fontSize);
  const widest = Math.ceil(Math.max(...lines.map((line) => options.measure(line, options.fontSize)), 1));
  return { text: lines.join("\n"), lines, width: widest, height: lines.length * lineHeight };
}

function measure(text: string, options: { measure: Measure; fontSize: number }): number {
  return options.measure(text, options.fontSize);
}

/** The space two shapes need so their labelled arrow keeps a visible shaft. */
export function minimumArrowGap(labelWidth: number): number {
  return Math.ceil(labelWidth) + ARROW_LABEL_CLEARANCE * 2;
}

export function arrowGapFor(text: string, options: { measure: Measure; fontSize: number }): number {
  return minimumArrowGap(arrowLabelBox(text, options).width);
}

export interface Span {
  x: number;
  width: number;
}

/** Free space between two boxes along the axis that separates them. */
export function gapBetween(
  from: { x: number; y: number; width: number; height: number },
  to: { x: number; y: number; width: number; height: number },
): number {
  const horizontal = Math.max(from.x, to.x) - Math.min(from.x + from.width, to.x + to.width);
  const vertical = Math.max(from.y, to.y) - Math.min(from.y + from.height, to.y + to.height);
  return Math.max(horizontal, vertical);
}
