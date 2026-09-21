import type { ExcalidrawElement } from "@excalidraw/excalidraw/element/types";
import type { AppState } from "@excalidraw/excalidraw/types";
import type { SceneElement, SceneSnapshot, Viewport } from "../../shared/canvas";

export function viewportOf(appState: AppState): Viewport {
  const zoom = appState.zoom.value || 1;
  return {
    x: -appState.scrollX,
    y: -appState.scrollY,
    width: appState.width / zoom,
    height: appState.height / zoom,
  };
}

export function authorOf(element: ExcalidrawElement): "user" | "agent" {
  const data = element.customData as { author?: unknown } | undefined;
  return data?.author === "agent" ? "agent" : "user";
}

export function liveElements(elements: readonly ExcalidrawElement[]): ExcalidrawElement[] {
  return elements.filter((element) => !element.isDeleted);
}

function boundText(
  element: ExcalidrawElement,
  byId: Map<string, ExcalidrawElement>,
): ExcalidrawElement | undefined {
  const bound = element.boundElements?.find((entry) => entry.type === "text");
  return bound ? byId.get(bound.id) : undefined;
}

function textOf(element: ExcalidrawElement, byId: Map<string, ExcalidrawElement>): string | undefined {
  if (element.type === "text") return element.text;
  const label = boundText(element, byId);
  return label && label.type === "text" ? label.text : undefined;
}

export function toSceneElement(
  element: ExcalidrawElement,
  byId: Map<string, ExcalidrawElement>,
): SceneElement {
  const scene: SceneElement = {
    id: element.id,
    type: element.type,
    x: element.x,
    y: element.y,
    width: element.width,
    height: element.height,
    author: authorOf(element),
    strokeColor: element.strokeColor,
    backgroundColor: element.backgroundColor,
  };
  const text = textOf(element, byId);
  if (text !== undefined) scene.text = text;
  if ("startBinding" in element && element.startBinding) scene.from = element.startBinding.elementId;
  if ("endBinding" in element && element.endBinding) scene.to = element.endBinding.elementId;
  if ("points" in element && Array.isArray(element.points)) scene.points = element.points.length;
  const group = element.groupIds[0];
  if (group) scene.groupId = group;
  if (element.frameId) scene.frameId = element.frameId;
  return scene;
}

/** Bound labels are merged into their container, so the agent sees one element. */
export function snapshotScene(elements: readonly ExcalidrawElement[], appState: AppState): SceneSnapshot {
  const live = liveElements(elements);
  const byId = new Map(live.map((element) => [element.id, element]));
  const labels = new Set(
    live.flatMap((element) => (element.type === "text" && element.containerId ? [element.id] : [])),
  );
  return {
    elements: live.filter((element) => !labels.has(element.id)).map((element) => toSceneElement(element, byId)),
    selection: Object.keys(appState.selectedElementIds).filter((id) => byId.has(id)),
    viewport: viewportOf(appState),
  };
}
