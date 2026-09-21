import type { HarnessToolDefinition, HarnessToolResult } from "reins";
import type { CanvasCommand, CanvasResult } from "../../shared/canvas";
import type { Validated } from "../../shared/validate";
import {
  validateAddElements,
  validateArrange,
  validateEmpty,
  validateIds,
  validateUpdateElements,
  validateView,
} from "../../shared/validate";
import type { CanvasBridge } from "../canvas-bridge";
import { schemas } from "./tool-schemas";

const fail = (text: string): HarnessToolResult => ({
  content: [{ type: "text", text }],
  isError: true,
  code: "CANVAS_REFUSED",
});

const say = (value: unknown): HarnessToolResult => ({
  content: [{ type: "text", text: JSON.stringify(value) }],
});

function reply(result: CanvasResult, done: (result: Extract<CanvasResult, { ok: true }>) => HarnessToolResult) {
  return result.ok ? done(result) : fail(result.error);
}

function canvasTool<T>(
  bridge: CanvasBridge,
  name: keyof typeof schemas,
  description: string,
  validate: (input: unknown) => Validated<T>,
  command: (input: T) => CanvasCommand,
): HarnessToolDefinition {
  return {
    name,
    description,
    inputSchema: schemas[name],
    async execute(input) {
      const checked = validate(input);
      if (!checked.ok) return fail(checked.error);
      const result = await bridge.request(command(checked.value));
      return reply(result, (value) => {
        if (value.kind === "scene") return say(value.scene);
        if (value.kind === "image") {
          return {
            content: [
              { type: "text", text: `A ${value.width} by ${value.height} render of the board follows.` },
              { type: "image", mediaType: value.mediaType, data: value.data },
            ],
          };
        }
        if (value.kind === "note") return say({ note: value.text });
        if (value.kind === "elements") {
          return say({ ids: value.elements.map((element) => element.id), elements: value.elements });
        }
        return say({ ids: value.ids });
      });
    },
  };
}

export function createCanvasTools(bridge: CanvasBridge): HarnessToolDefinition[] {
  return [
    canvasTool(bridge, "get_scene",
      "Read the board as structured data: every element with its id, type, position, size, text, colours and author,"
      + " plus the visible area and the person's current selection. Call this before you change anything.",
      validateEmpty, () => ({ kind: "get_scene" })),

    canvasTool(bridge, "view_canvas",
      "Look at the board as a picture. Use this when the person drew freehand, when layout or overlap matters,"
      + " or to check your own work after drawing. get_scene gives ids; this gives sight.",
      validateView, ({ region }) => ({ kind: "view_canvas", region })),

    canvasTool(bridge, "add_elements",
      "Draw new elements on the board. Give each element a short id you can reuse. Omit x and y to let Easel place"
      + " the group in free space. `near` takes the id of an existing element to place beside, and you may set it"
      + " on the call for the whole batch or on a single element, which wins. Bind an arrow with `from` and `to`"
      + " element ids instead of computing coordinates.",
      validateAddElements, (value) => ({ kind: "add_elements", ...value })),

    canvasTool(bridge, "update_elements",
      "Change existing elements by id: move, resize, recolour or retext them. Only the fields you send change.",
      validateUpdateElements, ({ updates }) => ({ kind: "update_elements", updates })),

    canvasTool(bridge, "delete_elements",
      "Remove elements by id. Delete only what the person asked you to remove.",
      validateIds, ({ ids }) => ({ kind: "delete_elements", ids })),

    canvasTool(bridge, "arrange",
      "Lay out existing elements so you do not have to do pixel arithmetic: a row, a column, a grid, or an alignment.",
      validateArrange, (value) => ({ kind: "arrange", ...value })),

    canvasTool(bridge, "focus",
      "Scroll and zoom the person's view to these elements. Use it to point at what you are talking about.",
      validateIds, ({ ids }) => ({ kind: "focus", ids })),
  ];
}
