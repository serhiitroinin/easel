import { describe, expect, test } from "bun:test";
import type { ElementSpec, SceneElement } from "../src/shared/canvas";
import { arrangeBoxes, isFree, planPlacement } from "../src/shared/placement";

const viewport = { x: 0, y: 0, width: 1200, height: 800 };

function element(id: string, over: Partial<SceneElement> = {}): SceneElement {
  return { id, type: "rectangle", x: 0, y: 0, width: 200, height: 110, author: "user", ...over };
}

const box = (spec: ElementSpec) => ({
  x: spec.x ?? 0,
  y: spec.y ?? 0,
  width: spec.width ?? 0,
  height: spec.height ?? 0,
});

describe("free space placement", () => {
  test("centres a group on an empty board", () => {
    const placed = planPlacement([{ type: "rectangle", text: "one" }], [], { viewport });
    expect(placed[0]).toMatchObject({ x: 500, y: 345, width: 200, height: 110 });
  });

  test("never overlaps existing work", () => {
    const drawn = [element("user-1", { x: 400, y: 300, width: 400, height: 300 })];
    const placed = planPlacement(
      [{ type: "rectangle", text: "a" }, { type: "rectangle", text: "b" }],
      drawn,
      { viewport },
    );
    for (const spec of placed) expect(isFree(box(spec), drawn)).toBe(true);
  });

  test("places a group beside the element it relates to", () => {
    const near = element("api", { x: 100, y: 100 });
    const placed = planPlacement([{ type: "rectangle", text: "cache" }], [near], { viewport, near });
    expect(placed[0]?.x).toBeGreaterThan(near.x + near.width);
  });

  test("keeps explicit coordinates untouched", () => {
    const placed = planPlacement([{ type: "rectangle", x: 7, y: 9, width: 10, height: 10 }], [], { viewport });
    expect(placed[0]).toMatchObject({ x: 7, y: 9 });
  });

  test("does not position an arrow that binds two elements", () => {
    const placed = planPlacement([{ type: "arrow", from: "a", to: "b" }], [], { viewport });
    expect(placed[0]?.x).toBeUndefined();
  });

  test("sizes a text element from its content", () => {
    const placed = planPlacement([{ type: "text", text: "Hello canvas" }], [], { viewport });
    expect(placed[0]?.width).toBeGreaterThan(100);
    expect(placed[0]?.height).toBeGreaterThan(20);
  });
});

describe("arrange", () => {
  const scattered = [
    element("a", { x: 0, y: 0 }),
    element("b", { x: 500, y: 300 }),
    element("c", { x: 90, y: 700 }),
  ];

  test("lays elements out in a row from the top left corner", () => {
    expect(arrangeBoxes(scattered, ["a", "b", "c"], "row", 50)).toEqual([
      { id: "a", x: 0, y: 0 },
      { id: "b", x: 250, y: 0 },
      { id: "c", x: 500, y: 0 },
    ]);
  });

  test("aligns without narrowing the free axis", () => {
    expect(arrangeBoxes(scattered, ["a", "b"], "align-left")).toEqual([
      { id: "a", x: 0, y: 0 },
      { id: "b", x: 0, y: 300 },
    ]);
  });

  test("spreads an alignment until a labelled arrow fits between the pair", () => {
    const stacked = [element("a", { x: 40, y: 0 }), element("b", { x: 90, y: 130 })];
    expect(arrangeBoxes(stacked, ["a", "b"], "align-left", 300)).toEqual([
      { id: "a", x: 40, y: 0 },
      { id: "b", x: 40, y: 410 },
    ]);
  });

  test("spreads the horizontal axis when the alignment is vertical", () => {
    const row = [element("a", { x: 0, y: 0 }), element("b", { x: 210, y: 90 })];
    expect(arrangeBoxes(row, ["a", "b"], "align-top", 300)).toEqual([
      { id: "a", x: 0, y: 0 },
      { id: "b", x: 500, y: 0 },
    ]);
  });

  test("ignores ids that are not on the board", () => {
    expect(arrangeBoxes(scattered, ["ghost"], "row")).toEqual([]);
  });
});

describe("room for a labelled arrow", () => {
  const pair = (gap?: number) => planPlacement(
    [{ type: "rectangle", text: "a", width: 200, height: 110 }, { type: "rectangle", text: "b", width: 200, height: 110 }],
    [],
    gap === undefined ? { viewport } : { viewport, gap },
  );
  const spread = (placed: ElementSpec[]) => Math.abs((placed[1]?.y ?? 0) - (placed[0]?.y ?? 0));

  test("spreads a placed group by the gap the label needs", () => {
    expect(spread(pair(220))).toBe(110 + 220);
  });

  test("never narrows the default gap", () => {
    expect(spread(pair(10))).toBe(110 + 56);
    expect(spread(pair())).toBe(110 + 56);
  });
});
