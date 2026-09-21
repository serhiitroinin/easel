import { describe, expect, test } from "bun:test";
import {
  validateAddElements,
  validateArrange,
  validateIds,
  validateUpdateElements,
  validateView,
} from "../src/shared/validate";

describe("add_elements input", () => {
  test("accepts a shape with a label and keeps the given id", () => {
    const result = validateAddElements({ elements: [{ id: "api", type: "rectangle", text: "API" }] });
    expect(result).toEqual({ ok: true, value: { elements: [{ type: "rectangle", id: "api", text: "API" }] } });
  });

  test("names the unknown property so the model can fix the call", () => {
    const result = validateAddElements({ elements: [{ type: "rectangle", colour: "red" }] });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toContain("colour");
    expect(result.error).toContain("Allowed");
  });

  test("refuses an arrow with neither a binding nor coordinates", () => {
    const result = validateAddElements({ elements: [{ type: "arrow", from: "a" }] });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('"from" and "to"');
  });

  test("accepts an arrow bound to two elements", () => {
    const result = validateAddElements({ elements: [{ type: "arrow", from: "a", to: "b" }] });
    expect(result.ok).toBe(true);
  });

  test("refuses a text element without text", () => {
    const result = validateAddElements({ elements: [{ type: "text" }] });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('"text" is required');
  });

  test("refuses an empty element list", () => {
    expect(validateAddElements({ elements: [] }).ok).toBe(false);
  });
});

describe("update_elements input", () => {
  test("keeps only the fields that change", () => {
    const result = validateUpdateElements({ updates: [{ id: "api", backgroundColor: "#b2f2bb" }] });
    expect(result).toEqual({ ok: true, value: { updates: [{ id: "api", backgroundColor: "#b2f2bb" }] } });
  });

  test("refuses an update that changes nothing", () => {
    const result = validateUpdateElements({ updates: [{ id: "api" }] });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("changes nothing");
  });

  test("refuses a non-string identifier", () => {
    expect(validateUpdateElements({ updates: [{ id: 3, x: 1 }] }).ok).toBe(false);
  });
});

describe("other tool inputs", () => {
  test("delete_elements needs at least one id", () => {
    expect(validateIds({ ids: [] }).ok).toBe(false);
    expect(validateIds({ ids: ["a"] })).toEqual({ ok: true, value: { ids: ["a"] } });
  });

  test("arrange names the valid layouts", () => {
    const result = validateArrange({ ids: ["a"], layout: "spiral" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("grid");
  });

  test("view_canvas defaults to the visible area", () => {
    expect(validateView({})).toEqual({ ok: true, value: { region: "viewport" } });
    expect(validateView(undefined)).toEqual({ ok: true, value: { region: "viewport" } });
    expect(validateView({ region: "everything" }).ok).toBe(false);
  });
});

describe("placing beside an existing element", () => {
  test("accepts near on the call", () => {
    const result = validateAddElements({ elements: [{ type: "rectangle", text: "Cache" }], near: "api" });
    expect(result).toEqual({ ok: true, value: { elements: [{ type: "rectangle", text: "Cache" }], near: "api" } });
  });

  test("accepts near on a single element", () => {
    const result = validateAddElements({ elements: [{ type: "rectangle", text: "Cache", near: "api" }] });
    expect(result).toEqual({ ok: true, value: { elements: [{ type: "rectangle", text: "Cache", near: "api" }] } });
  });

  test("accepts both, so the element can override the call", () => {
    const result = validateAddElements({
      elements: [{ type: "rectangle", near: "db" }, { type: "rectangle" }],
      near: "api",
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.elements[0]?.near).toBe("db");
  });

  test("still refuses a property that is not part of the schema", () => {
    const result = validateAddElements({ elements: [{ type: "rectangle", nearby: "api" }] });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("nearby");
  });

  test("refuses a near that is not a string", () => {
    expect(validateAddElements({ elements: [{ type: "rectangle", near: 7 }] }).ok).toBe(false);
  });
});
