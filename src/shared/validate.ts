import type { ArrangeLayout, ElementSpec, ElementUpdate, SpecType, ViewRegion } from "./canvas";

export type Validated<T> = { ok: true; value: T } | { ok: false; error: string };

export class InvalidInput extends Error {}

const SPEC_TYPES: SpecType[] = ["rectangle", "ellipse", "diamond", "text", "arrow", "line", "frame"];
const FILL_STYLES = ["solid", "hachure", "cross-hatch"];
const STROKE_STYLES = ["solid", "dashed", "dotted"];
const LAYOUTS: ArrangeLayout[] = ["row", "column", "grid", "align-left", "align-top", "align-center-x", "align-center-y"];
const REGIONS: ViewRegion[] = ["viewport", "selection", "all"];

const SPEC_KEYS = new Set([
  "id", "type", "x", "y", "width", "height", "text", "strokeColor", "backgroundColor",
  "fillStyle", "strokeStyle", "fontSize", "from", "to", "children", "name", "near",
]);
const UPDATE_KEYS = new Set([
  "id", "x", "y", "width", "height", "text", "strokeColor", "backgroundColor", "fillStyle", "strokeStyle",
]);

function record(value: unknown, what: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new InvalidInput(`${what} must be an object.`);
  }
  return value as Record<string, unknown>;
}

function noExtraKeys(value: Record<string, unknown>, allowed: Set<string>, what: string): void {
  const extra = Object.keys(value).filter((key) => !allowed.has(key));
  if (extra.length > 0) {
    throw new InvalidInput(`${what} has unknown properties: ${extra.join(", ")}. Allowed: ${[...allowed].join(", ")}.`);
  }
}

function optionalNumber(value: unknown, what: string): number | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== "number" || !Number.isFinite(value)) throw new InvalidInput(`${what} must be a finite number.`);
  return value;
}

function optionalString(value: unknown, what: string): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== "string") throw new InvalidInput(`${what} must be a string.`);
  return value;
}

function optionalEnum<T extends string>(value: unknown, allowed: readonly T[], what: string): T | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== "string" || !allowed.includes(value as T)) {
    throw new InvalidInput(`${what} must be one of: ${allowed.join(", ")}.`);
  }
  return value as T;
}

function idList(value: unknown, what: string): string[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new InvalidInput(`${what} must be a non-empty array of element ids.`);
  }
  return value.map((entry, index) => {
    if (typeof entry !== "string" || entry.trim() === "") {
      throw new InvalidInput(`${what}[${index}] must be a non-empty element id string.`);
    }
    return entry;
  });
}

function spec(value: unknown, index: number): ElementSpec {
  const raw = record(value, `elements[${index}]`);
  noExtraKeys(raw, SPEC_KEYS, `elements[${index}]`);
  const type = optionalEnum(raw.type, SPEC_TYPES, `elements[${index}].type`);
  if (!type) throw new InvalidInput(`elements[${index}].type is required. Use one of: ${SPEC_TYPES.join(", ")}.`);
  const text = optionalString(raw.text, `elements[${index}].text`);
  if (type === "text" && (text === undefined || text === "")) {
    throw new InvalidInput(`elements[${index}] is a text element, so "text" is required.`);
  }
  const bound = typeof raw.from === "string" && typeof raw.to === "string";
  const positioned = typeof raw.x === "number" && typeof raw.y === "number";
  if ((type === "arrow" || type === "line") && !bound && !positioned) {
    throw new InvalidInput(
      `elements[${index}] is an ${type}, so it needs either "from" and "to" element ids, or "x", "y", "width" and "height".`,
    );
  }
  const children = raw.children === undefined ? undefined : idList(raw.children, `elements[${index}].children`);
  if (type === "frame" && children === undefined) {
    throw new InvalidInput(`elements[${index}] is a frame, so "children" with existing element ids is required.`);
  }
  const result: ElementSpec = { type };
  const assign = <K extends keyof ElementSpec>(key: K, value: ElementSpec[K]) => {
    if (value !== undefined) result[key] = value;
  };
  assign("id", optionalString(raw.id, `elements[${index}].id`));
  assign("x", optionalNumber(raw.x, `elements[${index}].x`));
  assign("y", optionalNumber(raw.y, `elements[${index}].y`));
  assign("width", optionalNumber(raw.width, `elements[${index}].width`));
  assign("height", optionalNumber(raw.height, `elements[${index}].height`));
  assign("text", text);
  assign("strokeColor", optionalString(raw.strokeColor, `elements[${index}].strokeColor`));
  assign("backgroundColor", optionalString(raw.backgroundColor, `elements[${index}].backgroundColor`));
  assign("fillStyle", optionalEnum(raw.fillStyle, FILL_STYLES, `elements[${index}].fillStyle`) as ElementSpec["fillStyle"]);
  assign("strokeStyle", optionalEnum(raw.strokeStyle, STROKE_STYLES, `elements[${index}].strokeStyle`) as ElementSpec["strokeStyle"]);
  assign("fontSize", optionalNumber(raw.fontSize, `elements[${index}].fontSize`));
  assign("from", optionalString(raw.from, `elements[${index}].from`));
  assign("to", optionalString(raw.to, `elements[${index}].to`));
  assign("children", children);
  assign("name", optionalString(raw.name, `elements[${index}].name`));
  assign("near", optionalString(raw.near, `elements[${index}].near`));
  return result;
}

function guard<T>(run: () => T): Validated<T> {
  try {
    return { ok: true, value: run() };
  } catch (error) {
    if (error instanceof InvalidInput) return { ok: false, error: error.message };
    throw error;
  }
}

export function validateAddElements(input: unknown): Validated<{ elements: ElementSpec[]; near?: string }> {
  return guard(() => {
    const raw = record(input, "input");
    noExtraKeys(raw, new Set(["elements", "near"]), "input");
    if (!Array.isArray(raw.elements) || raw.elements.length === 0) {
      throw new InvalidInput('"elements" must be a non-empty array of element specifications.');
    }
    const elements = raw.elements.map(spec);
    const near = optionalString(raw.near, '"near"');
    return near === undefined ? { elements } : { elements, near };
  });
}

export function validateUpdateElements(input: unknown): Validated<{ updates: ElementUpdate[] }> {
  return guard(() => {
    const raw = record(input, "input");
    noExtraKeys(raw, new Set(["updates"]), "input");
    if (!Array.isArray(raw.updates) || raw.updates.length === 0) {
      throw new InvalidInput('"updates" must be a non-empty array of { id, ...changes } objects.');
    }
    const updates = raw.updates.map((value, index) => {
      const entry = record(value, `updates[${index}]`);
      noExtraKeys(entry, UPDATE_KEYS, `updates[${index}]`);
      const id = optionalString(entry.id, `updates[${index}].id`);
      if (!id) throw new InvalidInput(`updates[${index}].id is required.`);
      if (Object.keys(entry).length < 2) throw new InvalidInput(`updates[${index}] changes nothing.`);
      const update: ElementUpdate = { id };
      const assign = <K extends keyof ElementUpdate>(key: K, value: ElementUpdate[K]) => {
        if (value !== undefined) update[key] = value;
      };
      assign("x", optionalNumber(entry.x, `updates[${index}].x`));
      assign("y", optionalNumber(entry.y, `updates[${index}].y`));
      assign("width", optionalNumber(entry.width, `updates[${index}].width`));
      assign("height", optionalNumber(entry.height, `updates[${index}].height`));
      assign("text", optionalString(entry.text, `updates[${index}].text`));
      assign("strokeColor", optionalString(entry.strokeColor, `updates[${index}].strokeColor`));
      assign("backgroundColor", optionalString(entry.backgroundColor, `updates[${index}].backgroundColor`));
      assign("fillStyle", optionalEnum(entry.fillStyle, FILL_STYLES, `updates[${index}].fillStyle`) as ElementUpdate["fillStyle"]);
      assign("strokeStyle", optionalEnum(entry.strokeStyle, STROKE_STYLES, `updates[${index}].strokeStyle`) as ElementUpdate["strokeStyle"]);
      return update;
    });
    return { updates };
  });
}

export function validateIds(input: unknown): Validated<{ ids: string[] }> {
  return guard(() => {
    const raw = record(input, "input");
    noExtraKeys(raw, new Set(["ids"]), "input");
    return { ids: idList(raw.ids, '"ids"') };
  });
}

export function validateArrange(input: unknown): Validated<{ ids: string[]; layout: ArrangeLayout; gap?: number }> {
  return guard(() => {
    const raw = record(input, "input");
    noExtraKeys(raw, new Set(["ids", "layout", "gap"]), "input");
    const ids = idList(raw.ids, '"ids"');
    const layout = optionalEnum(raw.layout, LAYOUTS, '"layout"');
    if (!layout) throw new InvalidInput(`"layout" is required. Use one of: ${LAYOUTS.join(", ")}.`);
    const gap = optionalNumber(raw.gap, '"gap"');
    return gap === undefined ? { ids, layout } : { ids, layout, gap };
  });
}

export function validateView(input: unknown): Validated<{ region: ViewRegion }> {
  return guard(() => {
    const raw = record(input ?? {}, "input");
    noExtraKeys(raw, new Set(["region"]), "input");
    return { region: optionalEnum(raw.region, REGIONS, '"region"') ?? "viewport" };
  });
}

export function validateEmpty(input: unknown): Validated<Record<string, never>> {
  return guard(() => {
    noExtraKeys(record(input ?? {}, "input"), new Set(), "input");
    return {} as Record<string, never>;
  });
}
