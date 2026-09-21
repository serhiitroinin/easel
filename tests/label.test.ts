import { describe, expect, test } from "bun:test";
import {
  ARROW_LABEL_CLEARANCE,
  ARROW_LABEL_SINGLE_LINE_MAX,
  arrowGapFor,
  arrowLabelBox,
  fitLabel,
  fitText,
  gapBetween,
  minimumArrowGap,
  wrapLines,
  type Measure,
} from "../src/shared/label";

/** A deterministic stand-in for the hand-drawn face: every glyph is 10 px wide. */
const wide: Measure = (text, fontSize) => text.length * fontSize * 0.5;

describe("wrapping", () => {
  test("breaks between words at the limit", () => {
    expect(wrapLines("Application Server Business Logic", 140, wide, 20)).toEqual([
      "Application",
      "Server",
      "Business Logic",
    ]);
  });

  test("keeps a hard line break", () => {
    expect(wrapLines("Database Server\n(Data Tier)", 400, wide, 20)).toEqual([
      "Database Server",
      "(Data Tier)",
    ]);
  });

  test("never drops a word that is wider than the limit", () => {
    expect(wrapLines("Extraordinarily", 40, wide, 20)).toEqual(["Extraordinarily"]);
  });
});

describe("fitting a label into its container", () => {
  test("grows the height rather than clipping the text", () => {
    const box = fitLabel("Application Server handling business logic and request routing", {
      measure: wide, fontSize: 20, width: 200, height: 110,
    });
    expect(box.lines.length).toBeGreaterThan(3);
    expect(box.width).toBe(200);
    expect(box.height).toBeGreaterThan(110);
    expect(box.height).toBeGreaterThanOrEqual(box.lines.length * 25 + 16);
  });

  test("keeps a label that already fits", () => {
    const box = fitLabel("API", { measure: wide, fontSize: 20, width: 200, height: 110 });
    expect(box).toMatchObject({ lines: ["API"], width: 200, height: 110 });
  });

  test("grows the width only when one word cannot fit, and stops at the cap", () => {
    const box = fitLabel("Supercalifragilisticexpialidocious", {
      measure: wide, fontSize: 20, width: 160, height: 56,
    });
    expect(box.width).toBeGreaterThan(160);
    expect(box.width).toBeLessThanOrEqual(420);
  });

  test("returns the wrapped text so the canvas draws the same lines", () => {
    const box = fitLabel("Database Server Data Tier", { measure: wide, fontSize: 20, width: 180 });
    expect(box.text).toBe(box.lines.join("\n"));
    expect(box.text).toContain("\n");
  });

  test("measures a standalone text element without padding", () => {
    const box = fitText("Two lines\nhere", { measure: wide, fontSize: 20 });
    expect(box.width).toBe(90);
    expect(box.height).toBe(50);
  });
});

describe("the room a labelled arrow needs", () => {
  test("is the label plus clear shaft on both sides", () => {
    expect(minimumArrowGap(120)).toBe(120 + 2 * ARROW_LABEL_CLEARANCE);
  });

  test("reads the free space between two boxes on either axis", () => {
    const left = { x: 0, y: 0, width: 200, height: 100 };
    expect(gapBetween(left, { x: 300, y: 0, width: 200, height: 100 })).toBe(100);
    expect(gapBetween(left, { x: 0, y: 260, width: 200, height: 100 })).toBe(160);
  });

  test("is negative when the boxes overlap", () => {
    expect(gapBetween(
      { x: 0, y: 0, width: 200, height: 100 },
      { x: 150, y: 0, width: 200, height: 100 },
    )).toBeLessThan(0);
  });
});

describe("an arrow label", () => {
  const shaftFor = (text: string) => arrowGapFor(text, { measure: wide, fontSize: 20 });

  test("stays on one line while it is short", () => {
    const box = arrowLabelBox("SQL Query", { measure: wide, fontSize: 20, shaft: 600 });
    expect(box.lines).toEqual(["SQL Query"]);
    expect(box.width).toBe(90);
  });

  test("balances a long label over two lines", () => {
    const box = arrowLabelBox("HTTP Request and Response payload", { measure: wide, fontSize: 20, shaft: 600 });
    expect(box.lines.length).toBeLessThanOrEqual(2);
    expect(box.lines.length).toBeGreaterThan(1);
    expect(box.text).toBe(box.lines.join("\n"));
  });

  test("never asks for more width than the shaft leaves free", () => {
    const shaft = 300;
    const box = arrowLabelBox("HTTP Request and Response payload", { measure: wide, fontSize: 20, shaft });
    expect(box.width).toBeLessThanOrEqual(shaft - 2 * ARROW_LABEL_CLEARANCE);
  });

  test("wraps once the single line passes the readable maximum", () => {
    const long = "a".repeat(40);
    const box = arrowLabelBox(long, { measure: wide, fontSize: 20 });
    expect(wide(long, 20)).toBeGreaterThan(ARROW_LABEL_SINGLE_LINE_MAX);
    expect(box.width).toBeLessThanOrEqual(Math.ceil(wide(long, 20)));
  });

  test("asks for a gap that holds the label it will draw", () => {
    for (const text of ["SQL Query", "HTTP Request / Response", "Publishes an event to the bus"]) {
      const gap = shaftFor(text);
      const box = arrowLabelBox(text, { measure: wide, fontSize: 20, shaft: gap });
      expect(box.width).toBeLessThanOrEqual(gap - 2 * ARROW_LABEL_CLEARANCE);
      expect(box.lines.length).toBeLessThanOrEqual(2);
    }
  });

  test("leaves visible shaft on both sides of the label", () => {
    const text = "HTTP Request / Response";
    const gap = shaftFor(text);
    const box = arrowLabelBox(text, { measure: wide, fontSize: 20, shaft: gap });
    expect((gap - box.width) / 2).toBeGreaterThanOrEqual(32);
  });
});
