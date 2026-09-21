import {
  HarnessAdapterInterruptedError,
  type HarnessAdapter,
  type HarnessAdapterEvent,
  type HarnessAdapterRunRequest,
  type HarnessCapabilities,
} from "reins";
import { createScriptedAdapter, scriptedCapabilities } from "reins/testing";
import { sceneFor } from "./offline-scenes";

export const OFFLINE_ENGINE = "easel:offline";

const capabilities: HarnessCapabilities = {
  ...scriptedCapabilities,
  images: { support: "stable" },
  steering: { support: "stable", strategies: ["same-turn"], preferred: "same-turn" },
};

/** The pause after each tool call. The effort level sets it, so the effort button does something offline. */
const PACE_MS: Record<string, number> = { low: 450, medium: 900, high: 1500 };

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function promptOf(request: HarnessAdapterRunRequest): string {
  return request.input.flatMap((part) => (part.type === "text" ? [part.text] : [])).join(" ");
}

interface Steering {
  text: string | null;
}

async function* script(request: HarnessAdapterRunRequest, steering: Steering): AsyncIterable<HarnessAdapterEvent> {
  const stop = () => {
    if (request.signal.aborted) throw new HarnessAdapterInterruptedError();
  };
  let calls = 0;
  const call = async function* (name: string, input: unknown, title: string) {
    calls += 1;
    const toolId = `${request.turnId}:${calls}:${name}`;
    yield { kind: "tool-started", toolId, toolKind: name, title } as HarnessAdapterEvent;
    const result = await request.tools.call(name, input);
    const text = result.content.flatMap((part) => (part.type === "text" ? [part.text] : [])).join("\n");
    yield {
      kind: "tool-completed",
      toolId,
      toolKind: name,
      title,
      status: result.isError ? "failed" : "completed",
      outputAppend: text,
    } as HarnessAdapterEvent;
  };

  const prompt = promptOf(request);
  const pace = PACE_MS[request.effort ?? "medium"] ?? PACE_MS.medium!;
  const scene = sceneFor(prompt, request.turnId);
  yield { kind: "thinking", text: `Offline engine. Prompt: ${prompt || "(empty)"}` };
  yield { kind: "assistant-text", text: scene.opening };
  yield* call("get_scene", {}, "Read the board");
  stop();
  await wait(pace);

  for (const step of scene.steps) {
    if (step.say) yield { kind: "assistant-text", text: step.say };
    if (step.tool === "add_elements") yield* call(step.tool, { elements: step.elements }, step.title);
    else if (step.tool === "update_elements") yield* call(step.tool, { updates: step.updates }, step.title);
    else if (step.tool === "view_canvas") yield* call(step.tool, { region: "viewport" }, step.title);
    else yield* call(step.tool, { ids: step.ids }, step.title);
    stop();
    await wait(pace);

    if (steering.text && step.tool === "add_elements") {
      yield { kind: "assistant-text", text: `You asked for "${steering.text}", so I recoloured the boxes. ` };
      yield* call("update_elements", {
        updates: scene.steerable.map((id) => ({ id, backgroundColor: "#b2f2bb" })),
      }, `Recolour ${scene.steerable.length} elements`);
      steering.text = null;
      stop();
    }
  }

  yield { kind: "assistant-text", text: scene.closing };
  yield { kind: "usage", usage: { inputTokens: 120, outputTokens: 64, totalTokens: 184 } };
}

/**
 * A development engine that costs nothing and never reaches a provider. It
 * exercises the same tool host, context sources and streaming path as a real
 * engine, so the interface can be built and tested without an account.
 */
export function createOfflineEngine(): HarnessAdapter {
  const steering: Steering = { text: null };
  const { adapter } = createScriptedAdapter({
    id: OFFLINE_ENGINE,
    capabilities,
    script: (request) => script(request, steering),
  });
  return {
    ...adapter,
    profile: () => ({
      status: "available",
      value: {
        id: OFFLINE_ENGINE,
        label: "Offline",
        description: "A scripted engine for development. It never contacts a provider.",
        modelSelection: "optional",
        permissions: {
          kind: "execution-policy",
          selectable: false,
          defaultModeId: "app-tools-only",
          modes: [{ id: "app-tools-only", label: "Application tools only", posture: "restricted" }],
        },
        inputPolicy: { modalities: { text: { support: "stable" }, image: { support: "stable" } } },
      },
    }),
    models: () => ({
      status: "available",
      value: {
        selection: "optional",
        defaultModelId: "scripted",
        models: [{
          id: "scripted",
          label: "Scripted",
          effort: {
            defaultOptionId: "medium",
            options: [
              { id: "low", label: "Low", description: "Short pauses between tool calls" },
              { id: "medium", label: "Medium" },
              { id: "high", label: "High", description: "Long pauses between tool calls" },
            ],
          },
        }],
      },
    }),
    limits: () => ({ status: "unsupported", message: "The offline engine has no account." }),
    async open(request) {
      const session = await adapter.open(request);
      return {
        ...session,
        steer: async (followUp) => {
          steering.text = followUp.input
            .flatMap((part) => (part.type === "text" ? [part.text] : []))
            .join(" ");
        },
      };
    },
  };
}
