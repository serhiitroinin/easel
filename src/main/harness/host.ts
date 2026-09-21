import { join } from "node:path";
import {
  createHarness,
  createToolHost,
  type HarnessAdapter,
  type HarnessPersistence,
  type HarnessRuntime,
} from "reins";
import { createFilePersistence } from "reins/persistence/file";
import type { CanvasBridge } from "../canvas-bridge";
import { createContextSources, SceneMemory } from "./context";
import { CLAUDE_ENGINE, CODEX_ENGINE, createEngines } from "./engines";
import { SYSTEM_PROMPT } from "./guide";
import { createOfflineEngine, OFFLINE_ENGINE } from "./offline";
import { createCanvasTools } from "./tools";

export { CLAUDE_ENGINE, CODEX_ENGINE, OFFLINE_ENGINE };

export interface EaselHarnessOptions {
  appName: string;
  appVersion: string;
  dataDir: string;
  bridge: CanvasBridge;
  offline: boolean;
  onStderr?(engine: string, text: string): void;
}

export interface EaselHarness {
  runtime: HarnessRuntime;
  persistence: HarnessPersistence;
  engineIds: string[];
  memory: SceneMemory;
  close(): Promise<void>;
}

export function createEaselHarness(options: EaselHarnessOptions): EaselHarness {
  const memory = new SceneMemory();
  const adapters: HarnessAdapter[] = createEngines({
    appName: options.appName,
    appVersion: options.appVersion,
    workspace: join(options.dataDir, "workspace"),
    dataDir: options.dataDir,
    systemPrompt: SYSTEM_PROMPT,
    ...(options.onStderr ? { onStderr: options.onStderr } : {}),
  });
  if (options.offline) adapters.unshift(createOfflineEngine());

  const persistence = createFilePersistence({ directory: join(options.dataDir, "harness") });
  const runtime = createHarness({
    adapters,
    persistence,
    tools: createToolHost(createCanvasTools(options.bridge)),
    contextSources: createContextSources(options.bridge, memory),
  });

  return {
    runtime,
    persistence,
    engineIds: adapters.map((adapter) => adapter.id),
    memory,
    close: () => runtime.close(),
  };
}
