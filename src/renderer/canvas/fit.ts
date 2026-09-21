import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";
import { liveElements, viewportOf } from "./snapshot";

const PADDING = 0.86;

export function viewSignature(api: ExcalidrawImperativeAPI | null): string {
  if (!api) return "";
  const state = api.getAppState();
  return `${Math.round(state.scrollX)}|${Math.round(state.scrollY)}|${state.zoom.value.toFixed(3)}`;
}

function outsideView(api: ExcalidrawImperativeAPI, ids: readonly string[]): boolean {
  const view = viewportOf(api.getAppState());
  return liveElements(api.getSceneElements())
    .filter((element) => ids.includes(element.id))
    .some((element) => element.x < view.x
      || element.y < view.y
      || element.x + element.width > view.x + view.width
      || element.y + element.height > view.y + view.height);
}

/**
 * After a turn, show what the agent drew. The view is never taken from the
 * person: this runs only when they left the viewport alone during the turn.
 */
export function fitToTurn(
  api: ExcalidrawImperativeAPI | null,
  ids: readonly string[],
  options: { animate: boolean },
): boolean {
  if (!api || ids.length === 0) return false;
  const targets = liveElements(api.getSceneElements()).filter((element) => ids.includes(element.id));
  if (targets.length === 0 || !outsideView(api, ids)) return false;
  api.scrollToContent(targets, {
    fitToViewport: true,
    viewportZoomFactor: PADDING,
    maxZoom: 1,
    animate: options.animate,
    duration: 220,
  });
  return true;
}
