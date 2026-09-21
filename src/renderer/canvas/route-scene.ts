import type { ExcalidrawElement } from "@excalidraw/excalidraw/element/types";
import { arrowLabelBox } from "../../shared/label";
import { routeArrow, routeLength, type RouteBox } from "../../shared/route";
import { measureLabel } from "./measure";
import { withPatch, type Patch } from "./patch";

function bindingOf(element: ExcalidrawElement, key: "startBinding" | "endBinding"): string | undefined {
  const bound = (element as unknown as Record<string, unknown>)[key];
  return typeof bound === "object" && bound !== null
    ? (bound as { elementId?: string }).elementId
    : undefined;
}

/**
 * Excalidraw re-routes a bound arrow when a person drags its shape. A host that
 * writes elements straight into the scene must do the same work itself, or the
 * arrow keeps the geometry it had before the shapes moved.
 */
export function routeBoundArrows(all: readonly ExcalidrawElement[]): ExcalidrawElement[] {
  const live = new Map(all.filter((element) => !element.isDeleted).map((element) => [element.id, element]));
  const patches = new Map<string, Patch>();

  for (const element of live.values()) {
    if (element.type !== "arrow" && element.type !== "line") continue;
    const from = live.get(bindingOf(element, "startBinding") ?? "");
    const to = live.get(bindingOf(element, "endBinding") ?? "");
    if (!from || !to) continue;

    const route = routeArrow(from as RouteBox, to as RouteBox);
    patches.set(element.id, {
      x: route.x,
      y: route.y,
      points: route.points,
      width: route.width,
      height: route.height,
    });

    const bound = element.boundElements?.find((entry) => entry.type === "text");
    const label = bound ? live.get(bound.id) : undefined;
    if (label && label.type === "text") {
      // Excalidraw sizes an arrow label from the shaft and then clips it, so the
      // host writes the wrapped lines and the box that holds them.
      const box = arrowLabelBox(label.text.replace(/\n/g, " "), {
        measure: measureLabel,
        fontSize: label.fontSize,
        shaft: routeLength(route),
      });
      patches.set(label.id, {
        text: box.text,
        originalText: box.text,
        autoResize: false,
        width: box.width,
        height: box.height,
        x: route.midX - box.width / 2,
        y: route.midY - box.height / 2,
      });
    }
  }

  if (patches.size === 0) return [...all];
  return all.map((element) => {
    const patch = patches.get(element.id);
    return patch ? withPatch(element, patch) : element;
  });
}
