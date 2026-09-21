import { describe, expect, test } from "bun:test";
import type { SceneElement, SceneSnapshot } from "../src/shared/canvas";
import { describeChanges, diffScene } from "../src/shared/scene-diff";
import { describeSelection, summariseScene } from "../src/shared/scene-summary";

function element(id: string, over: Partial<SceneElement> = {}): SceneElement {
  return { id, type: "rectangle", x: 0, y: 0, width: 100, height: 50, author: "user", ...over };
}

function snapshot(elements: SceneElement[], over: Partial<SceneSnapshot> = {}): SceneSnapshot {
  return { elements, selection: [], viewport: { x: 0, y: 0, width: 1000, height: 800 }, ...over };
}

describe("scene summary", () => {
  test("drops points and rounds coordinates", () => {
    const summary = summariseScene(snapshot([element("a", { x: 10.4, y: 20.6, points: 240 })]));
    expect(summary.elements[0]).toMatchObject({ id: "a", x: 10, y: 21, points: 240 });
  });

  test("truncates long text but keeps the element", () => {
    const summary = summariseScene(snapshot([element("a", { text: "x".repeat(400) })]));
    expect(summary.elements[0]?.text?.length).toBe(140);
  });

  test("omits a transparent background", () => {
    const summary = summariseScene(snapshot([element("a", { backgroundColor: "transparent" })]));
    expect(summary.elements[0]).not.toHaveProperty("backgroundColor");
  });

  test("keeps the selection and the visible elements when the board is too large", () => {
    const far = Array.from({ length: 10 }, (_, index) => element(`far-${index}`, { x: 5000, y: 5000 }));
    const near = Array.from({ length: 10 }, (_, index) => element(`near-${index}`, { x: index * 10, y: 0 }));
    const summary = summariseScene(snapshot([...far, ...near], { selection: ["far-9"] }), 11);
    const ids = summary.elements.map((kept) => kept.id);
    expect(ids).toContain("far-9");
    expect(ids).toContain("near-0");
    expect(summary.omitted).toBe(9);
  });

  test("reports the selection for the composer and the context source", () => {
    const scene = snapshot([element("a", { text: "API" }), element("b")], { selection: ["a"] });
    expect(describeSelection(scene)).toBe('1 selected: rectangle "API" (a)');
    expect(describeSelection(snapshot([element("a")]))).toBe("Nothing is selected.");
  });
});

describe("changes since the last turn", () => {
  test("separates added, deleted, moved, retexted and restyled", () => {
    const before = [element("a"), element("b", { text: "old" }), element("c", { strokeColor: "#111" })];
    const after = [
      element("a", { x: 400 }),
      element("b", { text: "new" }),
      element("c", { strokeColor: "#f00" }),
      element("d"),
    ];
    expect(diffScene(before, after)).toEqual({
      added: ["d"], removed: [], moved: ["a"], resized: [], retexted: ["b"], restyled: ["c"],
    });
  });

  test("ignores sub-pixel drift", () => {
    expect(diffScene([element("a")], [element("a", { x: 0.4 })]).moved).toEqual([]);
  });

  test("reports a deletion", () => {
    expect(diffScene([element("a")], []).removed).toEqual(["a"]);
  });

  test("says so when nothing changed", () => {
    expect(describeChanges(diffScene([element("a")], [element("a")]))).toBe("No change since your last turn.");
  });
});
