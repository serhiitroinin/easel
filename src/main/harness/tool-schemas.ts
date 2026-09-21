import type { JsonSchema } from "reins";

const object = (properties: Record<string, unknown>, required: string[] = []): JsonSchema => ({
  type: "object",
  additionalProperties: false,
  properties,
  ...(required.length > 0 ? { required } : {}),
});

const number = { type: "number" };
const string = { type: "string" };
const ids = { type: "array", items: string, minItems: 1 };

export const elementSpecSchema: JsonSchema = object({
  id: { ...string, description: "Stable id you choose so later calls can address this element." },
  type: { type: "string", enum: ["rectangle", "ellipse", "diamond", "text", "arrow", "line", "frame"] },
  x: number,
  y: number,
  width: number,
  height: number,
  text: { ...string, description: "Label inside a shape, or the content of a text element." },
  strokeColor: { ...string, description: "CSS hex colour such as #1e1e1e." },
  backgroundColor: { ...string, description: "CSS hex colour, or transparent." },
  fillStyle: { type: "string", enum: ["solid", "hachure", "cross-hatch"] },
  strokeStyle: { type: "string", enum: ["solid", "dashed", "dotted"] },
  fontSize: number,
  from: { ...string, description: "Arrow or line start: the id of an element to bind to." },
  to: { ...string, description: "Arrow or line end: the id of an element to bind to." },
  children: { ...ids, description: "Frame only: the ids of existing elements the frame holds." },
  name: { ...string, description: "Frame only: the frame name." },
  near: {
    ...string,
    description: "Id of an existing element. This element is placed beside it, and this wins over the call's `near`.",
  },
}, ["type"]);

export const elementUpdateSchema: JsonSchema = object({
  id: string,
  x: number,
  y: number,
  width: number,
  height: number,
  text: string,
  strokeColor: string,
  backgroundColor: string,
  fillStyle: { type: "string", enum: ["solid", "hachure", "cross-hatch"] },
  strokeStyle: { type: "string", enum: ["solid", "dashed", "dotted"] },
}, ["id"]);

export const schemas = {
  get_scene: object({}),
  view_canvas: object({
    region: {
      type: "string",
      enum: ["viewport", "selection", "all"],
      description: "What to render. Defaults to the part of the board the person can see.",
    },
  }),
  add_elements: object({
    elements: { type: "array", items: elementSpecSchema, minItems: 1 },
    near: {
      ...string,
      description: "Id of an existing element. Elements without their own `near` are placed beside it.",
    },
  }, ["elements"]),
  update_elements: object({
    updates: { type: "array", items: elementUpdateSchema, minItems: 1 },
  }, ["updates"]),
  delete_elements: object({ ids }, ["ids"]),
  arrange: object({
    ids,
    layout: {
      type: "string",
      enum: ["row", "column", "grid", "align-left", "align-top", "align-center-x", "align-center-y"],
    },
    gap: number,
  }, ["ids", "layout"]),
  focus: object({ ids }, ["ids"]),
} satisfies Record<string, JsonSchema>;
