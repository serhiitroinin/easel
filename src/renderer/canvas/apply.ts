import { CaptureUpdateAction, exportToBlob } from "@excalidraw/excalidraw";
import type { ExcalidrawElement } from "@excalidraw/excalidraw/element/types";
import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";
import type { CanvasCommand, CanvasResult, ElementSpec, ElementUpdate, SceneElement } from "../../shared/canvas";
import { fitLabel } from "../../shared/label";
import { arrangeBoxes, planPlacement } from "../../shared/placement";
import { summariseScene } from "../../shared/scene-summary";
import { BuildError, buildElements } from "./build";
import { gapError, labelledArrows, requiredGap, sizeSpecs, tooClose, type Box } from "./labels";
import { measureLabel, fontsReady } from "./measure";
import { withPatch, type Patch } from "./patch";
import { routeBoundArrows } from "./route-scene";
import { liveElements, snapshotScene } from "./snapshot";

const MAX_IMAGE_EDGE = 1100;
const DEFAULT_GAP = 56;


function nameSpecs(specs: readonly ElementSpec[], taken: Set<string>): ElementSpec[] {
  let counter = 0;
  return specs.map((spec) => {
    if (spec.id) return spec;
    let id = "";
    do {
      counter += 1;
      id = `agent-${counter}`;
    } while (taken.has(id));
    taken.add(id);
    return { ...spec, id };
  });
}

/** Every write re-routes the bound arrows, so no arrow keeps a stale shaft. */
function commit(api: ExcalidrawImperativeAPI, elements: readonly ExcalidrawElement[]): void {
  api.updateScene({ elements: routeBoundArrows(elements), captureUpdate: CaptureUpdateAction.IMMEDIATELY });
}

async function render(api: ExcalidrawImperativeAPI, command: Extract<CanvasCommand, { kind: "view_canvas" }>): Promise<CanvasResult> {
  const appState = api.getAppState();
  const live = liveElements(api.getSceneElements());
  const snapshot = snapshotScene(live, appState);
  const view = snapshot.viewport;
  const chosen = command.region === "all"
    ? live
    : command.region === "selection"
      ? live.filter((element) => appState.selectedElementIds[element.id])
      : live.filter((element) => element.x < view.x + view.width && element.x + element.width > view.x
        && element.y < view.y + view.height && element.y + element.height > view.y);
  if (chosen.length === 0) return { ok: true, kind: "note", text: "The board is empty here. Nothing to see yet." };

  const blob = await exportToBlob({
    elements: chosen,
    files: api.getFiles(),
    maxWidthOrHeight: MAX_IMAGE_EDGE,
    mimeType: "image/png",
    exportPadding: 24,
    appState: { ...appState, exportBackground: true, exportWithDarkMode: false },
  });
  const buffer = await blob.arrayBuffer();
  const bitmap = await createImageBitmap(blob);
  let binary = "";
  for (const byte of new Uint8Array(buffer)) binary += String.fromCharCode(byte);
  return {
    ok: true,
    kind: "image",
    mediaType: "image/png",
    data: btoa(binary),
    width: bitmap.width,
    height: bitmap.height,
  };
}

function add(api: ExcalidrawImperativeAPI, command: Extract<CanvasCommand, { kind: "add_elements" }>): CanvasResult {
  const appState = api.getAppState();
  const all = api.getSceneElementsIncludingDeleted();
  const live = liveElements(all);
  const snapshot = snapshotScene(live, appState);
  const taken = new Set(all.map((element) => element.id));

  const clash = command.elements.find((spec) => spec.id !== undefined && taken.has(spec.id));
  if (clash) return { ok: false, error: `The id "${clash.id}" is already on the board. Use update_elements, or pick a new id.` };
  const named = sizeSpecs(nameSpecs(command.elements, taken));

  const batch = new Set(named.flatMap((spec) => (spec.id ? [spec.id] : [])));
  const onBoard = (id: string) => snapshot.elements.find((element) => element.id === id);
  const anchors = [command.near, ...named.map((spec) => spec.near)].filter((id): id is string => id !== undefined);
  const unknown = anchors.find((id) => !onBoard(id) && !batch.has(id));
  if (unknown) {
    return { ok: false, error: `No element has the id "${unknown}". Use an id from get_scene, or one created in this call.` };
  }

  const gap = requiredGap(named);
  const groups = new Map<string, ElementSpec[]>();
  for (const spec of named) {
    const key = spec.near ?? command.near ?? "";
    groups.set(key, [...(groups.get(key) ?? []), spec]);
  }

  let occupied = [...snapshot.elements];
  const settled = new Map<string, ElementSpec>();
  const asScene = (spec: ElementSpec): SceneElement[] =>
    (spec.x === undefined || spec.y === undefined ? [] : [{
      id: spec.id ?? "",
      type: spec.type,
      x: spec.x,
      y: spec.y,
      width: spec.width ?? 0,
      height: spec.height ?? 0,
      author: "agent" as const,
    }]);

  // An anchor created in this same call is placed before the group that names it.
  const pending = [...groups.entries()];
  while (pending.length > 0) {
    const next = pending.findIndex(([key]) => key === "" || onBoard(key) !== undefined || settled.has(key));
    const [key, group] = pending.splice(next < 0 ? 0 : next, 1)[0]!;
    const anchorSpec = settled.get(key);
    const anchor = next < 0 ? undefined : onBoard(key) ?? (anchorSpec ? asScene(anchorSpec)[0] : undefined);
    const result = planPlacement(group, occupied, {
      viewport: snapshot.viewport,
      gap,
      ...(anchor ? { near: anchor } : {}),
    });
    for (const spec of result) if (spec.id) settled.set(spec.id, spec);
    occupied = [...occupied, ...result.flatMap(asScene)];
  }
  const placed = named.map((spec) => (spec.id ? settled.get(spec.id) ?? spec : spec));

  const boxes = new Map<string, Box>(snapshot.elements.map((element) => [element.id, element]));
  for (const spec of placed) {
    if (spec.id === undefined || spec.x === undefined || spec.y === undefined) continue;
    boxes.set(spec.id, { x: spec.x, y: spec.y, width: spec.width ?? 0, height: spec.height ?? 0 });
  }
  const wanted = placed.flatMap((spec) => {
    if (spec.type !== "arrow" && spec.type !== "line") return [];
    if (!spec.id || !spec.from || !spec.to || !spec.text) return [];
    return [{ id: spec.id, from: spec.from, to: spec.to, needed: gap }];
  });
  const problem = tooClose(wanted, boxes);
  if (problem) return { ok: false, error: gapError(problem) };

  let built;
  try {
    built = buildElements(placed, live);
  } catch (error) {
    if (error instanceof BuildError) return { ok: false, error: error.message };
    throw error;
  }

  const created = new Map(built.elements.map((element) => [element.id, element]));
  const bound = new Map<string, { id: string; type: "arrow" }[]>();
  for (const arrow of built.arrows) {
    const patch = (id: string, key: "startBinding" | "endBinding") => {
      const element = created.get(arrow.id);
      if (!element) return;
      created.set(arrow.id, withPatch(element, { [key]: { elementId: id, focus: 0, gap: 6 } }));
      bound.set(id, [...(bound.get(id) ?? []), { id: arrow.id, type: "arrow" }]);
    };
    patch(arrow.from, "startBinding");
    patch(arrow.to, "endBinding");
  }

  const withBindings = [...all, ...created.values()].map((element) => {
    const links = bound.get(element.id);
    return links
      ? withPatch(element, { boundElements: [...(element.boundElements ?? []), ...links] })
      : element;
  });
  commit(api, withBindings);

  return {
    ok: true,
    kind: "elements",
    elements: [...created.values()].map((element) => ({
      id: element.id,
      x: Math.round(element.x),
      y: Math.round(element.y),
      width: Math.round(element.width),
      height: Math.round(element.height),
    })),
  };
}

function patchOf(update: ElementUpdate): Patch {
  const patch: Patch = {};
  for (const key of ["x", "y", "width", "height", "strokeColor", "backgroundColor", "fillStyle", "strokeStyle"] as const) {
    if (update[key] !== undefined) patch[key] = update[key];
  }
  return patch;
}

function update(api: ExcalidrawImperativeAPI, updates: readonly ElementUpdate[]): CanvasResult {
  const all = api.getSceneElementsIncludingDeleted();
  const byId = new Map(all.map((element) => [element.id, element]));
  const missing = updates.filter((entry) => !byId.has(entry.id) || byId.get(entry.id)!.isDeleted);
  if (missing.length > 0) {
    return { ok: false, error: `These ids are not on the board any more: ${missing.map((entry) => entry.id).join(", ")}. The person may have deleted them. Call get_scene.` };
  }

  const patches = new Map<string, Patch>();
  const merge = (id: string, patch: Patch) => patches.set(id, { ...(patches.get(id) ?? {}), ...patch });

  for (const entry of updates) {
    const element = byId.get(entry.id)!;
    const patch = patchOf(entry);
    const label = element.boundElements?.find((bound) => bound.type === "text");
    const child = label ? byId.get(label.id) : undefined;

    if (entry.text !== undefined) {
      if (element.type === "text") {
        Object.assign(patch, { text: entry.text, originalText: entry.text });
      } else if (child) {
        const fontSize = "fontSize" in child ? child.fontSize : 20;
        const box = fitLabel(entry.text, {
          measure: measureLabel,
          fontSize,
          width: entry.width ?? element.width,
          height: entry.height ?? element.height,
        });
        Object.assign(patch, { width: box.width, height: box.height });
        merge(child.id, { text: box.text, originalText: box.text, width: box.width - 16, height: box.height - 16 });
      } else {
        return { ok: false, error: `Element "${entry.id}" has no text to change. Add a text element beside it instead.` };
      }
    }
    merge(entry.id, patch);

    const after = { ...element, ...patches.get(entry.id) } as unknown as Box;
    if (child) {
      merge(child.id, {
        x: after.x + (after.width - (Number(patches.get(child.id)?.width) || child.width)) / 2,
        y: after.y + (after.height - (Number(patches.get(child.id)?.height) || child.height)) / 2,
      });
    }
  }

  const boxes = new Map<string, Box>(liveElements(all).map((element) => {
    const patch = patches.get(element.id);
    return [element.id, { ...element, ...patch } as unknown as Box];
  }));
  const moved = new Set(updates.map((entry) => entry.id));
  const affected = labelledArrows(all).filter((arrow) => moved.has(arrow.from) || moved.has(arrow.to));
  const problem = tooClose(affected, boxes);
  if (problem) return { ok: false, error: gapError(problem) };

  commit(api, all.map((element) => {
    const patch = patches.get(element.id);
    return patch ? withPatch(element, patch) : element;
  }));
  return { ok: true, kind: "ids", ids: updates.map((entry) => entry.id) };
}

function remove(api: ExcalidrawImperativeAPI, ids: readonly string[]): CanvasResult {
  const all = api.getSceneElementsIncludingDeleted();
  const live = new Set(liveElements(all).map((element) => element.id));
  const missing = ids.filter((id) => !live.has(id));
  if (missing.length > 0) return { ok: false, error: `These ids are not on the board: ${missing.join(", ")}.` };
  const doomed = new Set(ids);
  for (const element of all) {
    if (!doomed.has(element.id)) continue;
    for (const bound of element.boundElements ?? []) doomed.add(bound.id);
  }
  commit(api, all.map((element) => (doomed.has(element.id) ? withPatch(element, { isDeleted: true }) : element)));
  return { ok: true, kind: "ids", ids: [...ids] };
}

function focus(api: ExcalidrawImperativeAPI, ids: readonly string[]): CanvasResult {
  const live = liveElements(api.getSceneElements());
  const targets = live.filter((element) => ids.includes(element.id));
  if (targets.length === 0) return { ok: false, error: `None of these ids are on the board: ${ids.join(", ")}.` };
  api.scrollToContent(targets, { fitToContent: true, animate: false });
  return { ok: true, kind: "ids", ids: targets.map((element) => element.id) };
}

export async function applyCommand(api: ExcalidrawImperativeAPI, command: CanvasCommand): Promise<CanvasResult> {
  await fontsReady();
  switch (command.kind) {
    case "get_scene":
      return { ok: true, kind: "scene", scene: summariseScene(snapshotScene(api.getSceneElements(), api.getAppState())) };
    case "view_canvas":
      return await render(api, command);
    case "add_elements":
      return add(api, command);
    case "update_elements":
      return update(api, command.updates);
    case "delete_elements":
      return remove(api, command.ids);
    case "arrange": {
      const snapshot = snapshotScene(api.getSceneElements(), api.getAppState());
      const chosen = new Set(command.ids);
      const needed = labelledArrows(api.getSceneElementsIncludingDeleted())
        .filter((arrow) => chosen.has(arrow.from) && chosen.has(arrow.to))
        .map((arrow) => arrow.needed);
      const gap = Math.max(command.gap ?? DEFAULT_GAP, ...needed);
      const moves = arrangeBoxes(snapshot.elements, command.ids, command.layout, gap);
      if (moves.length === 0) return { ok: false, error: `None of these ids are on the board: ${command.ids.join(", ")}.` };
      return update(api, moves);
    }
    case "focus":
      return focus(api, command.ids);
  }
}
