import { describe, expect, test } from "bun:test";
import type { HarnessToolContext, HarnessToolDefinition } from "reins";
import type { CanvasCommand, CanvasResult } from "../src/shared/canvas";
import { CanvasBridge } from "../src/main/canvas-bridge";
import { createCanvasTools } from "../src/main/harness/tools";

function fakeBridge(answer: (command: CanvasCommand) => CanvasResult) {
  const seen: CanvasCommand[] = [];
  const bridge = new CanvasBridge();
  bridge.attach((request) => {
    seen.push(request.command);
    bridge.settle(request.requestId, answer(request.command));
  });
  return { bridge, seen };
}

const context = { signal: new AbortController().signal } as HarnessToolContext;

function tool(tools: HarnessToolDefinition[], name: string): HarnessToolDefinition {
  const found = tools.find((definition) => definition.name === name);
  if (!found) throw new Error(`missing tool ${name}`);
  return found;
}

describe("canvas tool host", () => {
  test("publishes the whole canvas surface and nothing else", () => {
    const { bridge } = fakeBridge(() => ({ ok: false, error: "unused" }));
    expect(createCanvasTools(bridge).map((definition) => definition.name).sort()).toEqual([
      "add_elements", "arrange", "delete_elements", "focus", "get_scene", "update_elements", "view_canvas",
    ]);
  });

  test("every tool declares a closed input schema", () => {
    const { bridge } = fakeBridge(() => ({ ok: false, error: "unused" }));
    for (const definition of createCanvasTools(bridge)) {
      expect(definition.inputSchema).toMatchObject({ type: "object", additionalProperties: false });
      expect(definition.description.length).toBeGreaterThan(40);
    }
  });

  test("returns the invalid input to the model instead of reaching the canvas", async () => {
    const { bridge, seen } = fakeBridge(() => ({ ok: false, error: "unused" }));
    const result = await tool(createCanvasTools(bridge), "add_elements")
      .execute({ elements: [{ type: "hexagon" }] }, context);
    expect(result.isError).toBe(true);
    expect(result.content[0]).toMatchObject({ type: "text" });
    expect(JSON.stringify(result.content)).toContain("rectangle");
    expect(seen).toEqual([]);
  });

  test("passes a valid call to the canvas and reports the created ids", async () => {
    const { bridge, seen } = fakeBridge(() => ({
      ok: true,
      kind: "elements",
      elements: [{ id: "api", x: 10, y: 20, width: 200, height: 110 }],
    }));
    const result = await tool(createCanvasTools(bridge), "add_elements")
      .execute({ elements: [{ id: "api", type: "rectangle", text: "API" }] }, context);
    expect(result.isError).toBeUndefined();
    expect(seen[0]).toEqual({ kind: "add_elements", elements: [{ type: "rectangle", id: "api", text: "API" }] });
    expect(JSON.parse((result.content[0] as { text: string }).text)).toMatchObject({ ids: ["api"] });
  });

  test("turns a canvas refusal into a tool error the model can act on", async () => {
    const { bridge } = fakeBridge(() => ({ ok: false, error: "These ids are not on the board: api." }));
    const result = await tool(createCanvasTools(bridge), "update_elements")
      .execute({ updates: [{ id: "api", x: 1 }] }, context);
    expect(result.isError).toBe(true);
    expect((result.content[0] as { text: string }).text).toContain("not on the board");
  });

  test("returns a picture of the board as an image part", async () => {
    const { bridge, seen } = fakeBridge(() => ({
      ok: true, kind: "image", mediaType: "image/png", data: "QUJD", width: 800, height: 600,
    }));
    const result = await tool(createCanvasTools(bridge), "view_canvas").execute({ region: "selection" }, context);
    expect(seen[0]).toEqual({ kind: "view_canvas", region: "selection" });
    expect(result.content[1]).toEqual({ type: "image", mediaType: "image/png", data: "QUJD" });
  });

  test("reports a closed window rather than hanging the turn", async () => {
    const bridge = new CanvasBridge();
    const result = await tool(createCanvasTools(bridge), "get_scene").execute({}, context);
    expect(result.isError).toBe(true);
    expect((result.content[0] as { text: string }).text).toContain("not open");
  });
});
