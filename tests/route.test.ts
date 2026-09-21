import { describe, expect, test } from "bun:test";
import { BINDING_GAP, routeArrow, routeLength, type RouteBox } from "../src/shared/route";

const box = (x: number, y: number, width = 200, height = 100): RouteBox => ({ x, y, width, height });

describe("routing a bound arrow", () => {
  test("spans the whole gap between horizontal neighbours", () => {
    const route = routeArrow(box(0, 0), box(400, 0));
    expect(route.x).toBe(200 + BINDING_GAP);
    expect(route.y).toBe(50);
    expect(route.points).toEqual([[0, 0], [200 - 2 * BINDING_GAP, 0]]);
    expect(route.width).toBe(400 - 200 - 2 * BINDING_GAP);
    expect(route.height).toBe(0);
  });

  test("spans the whole gap between vertical neighbours", () => {
    const route = routeArrow(box(0, 0), box(0, 300));
    expect(route.x).toBe(100);
    expect(route.y).toBe(100 + BINDING_GAP);
    expect(route.width).toBe(0);
    expect(route.height).toBe(300 - 100 - 2 * BINDING_GAP);
  });

  test("leaves a diagonal neighbour on the facing corner side", () => {
    const route = routeArrow(box(0, 0), box(400, 300));
    expect(route.points[0]).toEqual([0, 0]);
    expect(route.width).toBeGreaterThan(0);
    expect(route.height).toBeGreaterThan(0);
    expect(routeLength(route)).toBeGreaterThan(100);
  });

  test("reports the midpoint a bound label sits on", () => {
    const route = routeArrow(box(0, 0), box(400, 0));
    expect(route.midX).toBe(300);
    expect(route.midY).toBe(50);
  });

  test("follows one end when it moves", () => {
    const before = routeArrow(box(0, 0), box(400, 0));
    const after = routeArrow(box(0, 0), box(900, 0));
    expect(after.x).toBe(before.x);
    expect(after.width).toBeGreaterThan(before.width);
    expect(after.midX).toBeGreaterThan(before.midX);
  });

  test("keeps the arrow between the boxes after both move", () => {
    const route = routeArrow(box(1000, 500), box(1600, 500));
    expect(route.x).toBeGreaterThan(1000);
    expect(route.x + route.width).toBeLessThan(1600 + 200);
    expect(route.width).toBe(600 - 200 - 2 * BINDING_GAP);
  });

  test("never runs backwards when the boxes overlap", () => {
    const route = routeArrow(box(0, 0), box(50, 0));
    expect(Number.isFinite(route.width)).toBe(true);
    expect(Number.isFinite(route.height)).toBe(true);
    expect(route.points).toHaveLength(2);
  });

  test("points are relative to the arrow origin", () => {
    const route = routeArrow(box(120, 240), box(700, 240));
    expect(route.points[0]).toEqual([0, 0]);
    expect(route.x + (route.points[1]?.[0] ?? 0)).toBe(700 - BINDING_GAP);
  });
});
