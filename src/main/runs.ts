import type {
  HarnessEvent,
  HarnessInlineContext,
  HarnessInput,
  HarnessRun,
  HarnessRuntime,
  HarnessSessionKey,
} from "reins";
import type { RunAck, StartRequest } from "../shared/app";
import type { CanvasBridge } from "./canvas-bridge";
import type { SceneMemory } from "./harness/context";

const TENANT = "easel";
const ACTOR = "local";

export function sessionKey(boardId: string): HarnessSessionKey {
  return { tenantId: TENANT, actorId: ACTOR, threadId: boardId };
}

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function buildInput(request: StartRequest): { input: HarnessInput[]; inlineContext?: HarnessInlineContext } {
  const input: HarnessInput[] = [];
  if (request.text.trim() !== "") input.push({ type: "text", text: request.text });
  request.images.forEach((image, index) => {
    input.push({
      type: "image",
      id: `image-${index}`,
      mediaType: image.mediaType,
      data: Uint8Array.from(Buffer.from(image.data, "base64")),
      ...(image.name ? { name: image.name } : {}),
    });
  });
  if (request.selection.length === 0) return { input };

  const contextId = "easel:selection";
  input.push({ type: "context-reference", contextId });
  return {
    input,
    inlineContext: {
      version: 1,
      records: [{
        version: 1,
        id: contextId,
        kind: "easel:selection",
        label: `${request.selection.length} selected element${request.selection.length === 1 ? "" : "s"}`,
        payload: {
          ids: request.selection,
          description: request.selectionLabel ?? "",
        },
      }],
    },
  };
}

export interface RunManagerOptions {
  runtime: HarnessRuntime;
  bridge: CanvasBridge;
  memory: SceneMemory;
  onEvent(event: HarnessEvent): void;
  onEnded(boardId: string, status: string): void;
}

/** One board runs one turn at a time. Steering joins the turn that is running. */
export class RunManager {
  private readonly active = new Map<string, HarnessRun>();

  constructor(private readonly options: RunManagerOptions) {}

  isActive(boardId: string): boolean {
    return this.active.has(boardId);
  }

  start(request: StartRequest): RunAck {
    if (this.active.has(request.boardId)) {
      return { ok: false, error: "This board already has a turn running." };
    }
    const { input, inlineContext } = buildInput(request);
    if (input.length === 0) return { ok: false, error: "Send some text or an image." };

    const { engine } = request;
    try {
      const run = this.options.runtime.start({
        session: sessionKey(request.boardId),
        adapterId: engine.adapterId,
        input,
        ...(inlineContext ? { inlineContext } : {}),
        ...(engine.model ? { model: engine.model } : {}),
        ...(engine.effort ? { effort: engine.effort } : {}),
        ...(engine.controls ? { settings: { controls: engine.controls } } : {}),
      });
      this.active.set(request.boardId, run);
      void this.consume(request.boardId, run);
      return { ok: true, runId: run.runId, turnId: run.turnId };
    } catch (error) {
      return { ok: false, error: message(error) };
    }
  }

  async followUp(boardId: string, text: string): Promise<RunAck> {
    const run = this.active.get(boardId);
    if (!run) return { ok: false, error: "No turn is running on this board." };
    try {
      const result = await run.followUp({
        expectedTurnId: run.turnId,
        input: [{ type: "text", text }],
      });
      if (result.run !== run) {
        this.active.set(boardId, result.run);
        void this.consume(boardId, result.run);
      }
      return { ok: true, runId: result.run.runId, turnId: result.run.turnId };
    } catch (error) {
      return { ok: false, error: message(error) };
    }
  }

  async cancel(boardId: string): Promise<void> {
    await this.active.get(boardId)?.cancel();
  }

  private async consume(boardId: string, run: HarnessRun): Promise<void> {
    try {
      for await (const event of run.events) this.options.onEvent(event);
    } catch (error) {
      this.options.onEvent(errorEvent(boardId, run, message(error)));
    }
    const status = await run.done.catch(() => "error" as const);
    if (this.active.get(boardId) === run) {
      this.active.delete(boardId);
      await this.rememberScene(boardId);
    }
    this.options.onEnded(boardId, status);
  }

  private async rememberScene(boardId: string): Promise<void> {
    const result = await this.options.bridge.request({ kind: "get_scene" });
    if (result.ok && result.kind === "scene") this.options.memory.record(boardId, result.scene);
  }
}

function errorEvent(boardId: string, run: HarnessRun, text: string): HarnessEvent {
  return {
    schemaVersion: 1,
    eventId: `local-${run.runId}-error`,
    sequence: Number.MAX_SAFE_INTEGER,
    timestamp: new Date().toISOString(),
    session: sessionKey(boardId),
    runId: run.runId,
    turnId: run.turnId,
    adapterId: "easel",
    payload: { kind: "error", code: "RUN_FAILED", message: text },
  };
}
