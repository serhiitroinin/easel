import type { SceneElement } from "./canvas";

export interface SceneChanges {
  added: string[];
  removed: string[];
  moved: string[];
  resized: string[];
  retexted: string[];
  restyled: string[];
}

export const NO_CHANGES: SceneChanges = {
  added: [], removed: [], moved: [], resized: [], retexted: [], restyled: [],
};

const MOVE_THRESHOLD = 1;

export function diffScene(before: readonly SceneElement[], after: readonly SceneElement[]): SceneChanges {
  const previous = new Map(before.map((element) => [element.id, element]));
  const current = new Map(after.map((element) => [element.id, element]));
  const changes: SceneChanges = { added: [], removed: [], moved: [], resized: [], retexted: [], restyled: [] };

  for (const element of after) {
    const old = previous.get(element.id);
    if (!old) {
      changes.added.push(element.id);
      continue;
    }
    if (Math.abs(old.x - element.x) > MOVE_THRESHOLD || Math.abs(old.y - element.y) > MOVE_THRESHOLD) {
      changes.moved.push(element.id);
    }
    if (Math.abs(old.width - element.width) > MOVE_THRESHOLD || Math.abs(old.height - element.height) > MOVE_THRESHOLD) {
      changes.resized.push(element.id);
    }
    if ((old.text ?? "") !== (element.text ?? "")) changes.retexted.push(element.id);
    if (old.strokeColor !== element.strokeColor || old.backgroundColor !== element.backgroundColor) {
      changes.restyled.push(element.id);
    }
  }
  for (const element of before) if (!current.has(element.id)) changes.removed.push(element.id);
  return changes;
}

export function isEmptyChange(changes: SceneChanges): boolean {
  return Object.values(changes).every((ids) => ids.length === 0);
}

export function describeChanges(changes: SceneChanges): string {
  const parts: string[] = [];
  const add = (label: string, ids: string[]) => {
    if (ids.length > 0) parts.push(`${label}: ${ids.join(", ")}`);
  };
  add("added", changes.added);
  add("deleted", changes.removed);
  add("moved", changes.moved);
  add("resized", changes.resized);
  add("retexted", changes.retexted);
  add("restyled", changes.restyled);
  return parts.length === 0 ? "No change since your last turn." : parts.join("; ");
}
