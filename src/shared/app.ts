import type { CanvasCommand, CanvasResult } from "./canvas";
import type {
  HarnessControlValue,
  HarnessDiscovery,
  HarnessEngineProfile,
  HarnessEvent,
  HarnessLimitSnapshot,
  HarnessModelCatalog,
} from "reins";

export interface EngineChoice {
  adapterId: string;
  model?: string;
  effort?: string;
  controls?: Record<string, HarnessControlValue>;
}

export interface BoardSummary {
  id: string;
  title: string;
  updatedAt: string;
}

export interface UserMessage {
  id: string;
  at: string;
  text: string;
  selection?: string[];
  hasImage?: boolean;
}

export interface Board extends BoardSummary {
  createdAt: string;
  engine: EngineChoice | null;
  scene: unknown;
  messages: UserMessage[];
}

export interface BoardState {
  board: Board;
  events: HarnessEvent[];
}

export interface EngineDiscovery {
  adapterId: string;
  profile: HarnessDiscovery<HarnessEngineProfile>;
  models: HarnessDiscovery<HarnessModelCatalog>;
  limits: HarnessDiscovery<HarnessLimitSnapshot>;
}

export interface AttachedImage {
  mediaType: string;
  /** Base64 without a data-URL prefix. IPC does not carry typed arrays well. */
  data: string;
  name?: string;
}

export interface StartRequest {
  boardId: string;
  text: string;
  engine: EngineChoice;
  selection: string[];
  selectionLabel?: string;
  images: AttachedImage[];
}

export type RunAck = { ok: true; runId: string; turnId: string } | { ok: false; error: string };

export interface CanvasRequest {
  requestId: string;
  command: CanvasCommand;
}

export interface EaselBridge {
  offline: boolean;
  /** True only when a verification script drives the window. */
  control: boolean;
  boards: {
    list(): Promise<BoardSummary[]>;
    open(id: string): Promise<BoardState>;
    create(): Promise<BoardSummary>;
    rename(id: string, title: string): Promise<void>;
    remove(id: string): Promise<void>;
    saveScene(id: string, scene: unknown): Promise<void>;
    setEngine(id: string, engine: EngineChoice): Promise<void>;
  };
  engines(): Promise<EngineDiscovery[]>;
  run: {
    start(request: StartRequest): Promise<RunAck>;
    followUp(boardId: string, text: string): Promise<RunAck>;
    cancel(boardId: string): Promise<void>;
  };
  onEvent(listener: (event: HarnessEvent) => void): () => void;
  onRunEnded(listener: (detail: { boardId: string; status: string }) => void): () => void;
  onCanvasRequest(handler: (request: CanvasRequest) => Promise<CanvasResult>): void;
}

export const CHANNELS = {
  boardsList: "boards:list",
  boardsOpen: "boards:open",
  boardsCreate: "boards:create",
  boardsRename: "boards:rename",
  boardsRemove: "boards:remove",
  boardsSaveScene: "boards:save-scene",
  boardsSetEngine: "boards:set-engine",
  engines: "engines:list",
  runStart: "run:start",
  runFollowUp: "run:follow-up",
  runCancel: "run:cancel",
  event: "harness:event",
  runEnded: "run:ended",
  canvasRequest: "canvas:request",
  canvasResult: "canvas:result",
} as const;
