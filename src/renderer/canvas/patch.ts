import { newElementWith } from "@excalidraw/excalidraw";
import type { ExcalidrawElement } from "@excalidraw/excalidraw/element/types";

export type Patch = Record<string, unknown>;

export function withPatch<T extends ExcalidrawElement>(element: T, patch: Patch): T {
  return newElementWith(element, patch as unknown as Partial<T>) as T;
}
