import {
  SCENE_ELEMENT_LIMIT,
  TEXT_SUMMARY_LIMIT,
  type SceneElement,
  type SceneSnapshot,
  type SceneSummary,
} from "./canvas";

const round = (value: number): number => Math.round(value);

function truncate(text: string, limit: number): string {
  return text.length <= limit ? text : `${text.slice(0, limit - 1)}…`;
}

function compact(element: SceneElement): SceneElement {
  const summary: SceneElement = {
    id: element.id,
    type: element.type,
    x: round(element.x),
    y: round(element.y),
    width: round(element.width),
    height: round(element.height),
    author: element.author,
  };
  if (element.text !== undefined && element.text !== "") summary.text = truncate(element.text, TEXT_SUMMARY_LIMIT);
  if (element.strokeColor) summary.strokeColor = element.strokeColor;
  if (element.backgroundColor && element.backgroundColor !== "transparent") {
    summary.backgroundColor = element.backgroundColor;
  }
  if (element.from) summary.from = element.from;
  if (element.to) summary.to = element.to;
  if (element.groupId) summary.groupId = element.groupId;
  if (element.frameId) summary.frameId = element.frameId;
  if (element.points !== undefined) summary.points = element.points;
  return summary;
}

function inViewport(element: SceneElement, snapshot: SceneSnapshot): boolean {
  const view = snapshot.viewport;
  return element.x < view.x + view.width
    && element.x + element.width > view.x
    && element.y < view.y + view.height
    && element.y + element.height > view.y;
}

/**
 * A provider request is bounded, so a large board is reduced to the elements
 * the agent is most likely to need: the selection, then what the user can see.
 */
export function summariseScene(snapshot: SceneSnapshot, limit = SCENE_ELEMENT_LIMIT): SceneSummary {
  const selected = new Set(snapshot.selection);
  const ranked = [...snapshot.elements].sort((left, right) => {
    const score = (element: SceneElement) =>
      (selected.has(element.id) ? 0 : 1) + (inViewport(element, snapshot) ? 0 : 2);
    return score(left) - score(right);
  });
  const kept = ranked.slice(0, limit);
  const order = new Map(snapshot.elements.map((element, index) => [element.id, index]));
  kept.sort((left, right) => (order.get(left.id) ?? 0) - (order.get(right.id) ?? 0));
  return {
    elements: kept.map(compact),
    selection: snapshot.selection,
    viewport: {
      x: round(snapshot.viewport.x),
      y: round(snapshot.viewport.y),
      width: round(snapshot.viewport.width),
      height: round(snapshot.viewport.height),
    },
    omitted: snapshot.elements.length - kept.length,
  };
}

export function describeSelection(snapshot: SceneSnapshot): string {
  const selected = snapshot.elements.filter((element) => snapshot.selection.includes(element.id));
  if (selected.length === 0) return "Nothing is selected.";
  const parts = selected.map((element) => {
    const label = element.text ? ` "${truncate(element.text, 40)}"` : "";
    return `${element.type}${label} (${element.id})`;
  });
  return `${selected.length} selected: ${parts.join(", ")}`;
}
