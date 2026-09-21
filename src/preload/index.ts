import { contextBridge, ipcRenderer } from "electron";
import type { HarnessEvent } from "reins";
import {
  CHANNELS,
  type CanvasRequest,
  type EaselBridge,
  type EngineChoice,
  type StartRequest,
} from "../shared/app";
import type { CanvasResult } from "../shared/canvas";

const offline = process.argv.includes("--easel-offline=1");
const control = process.argv.includes("--easel-control=1");

function subscribe<T>(channel: string, listener: (payload: T) => void): () => void {
  const handler = (_event: unknown, payload: T) => listener(payload);
  ipcRenderer.on(channel, handler);
  return () => {
    ipcRenderer.off(channel, handler);
  };
}

const bridge: EaselBridge = {
  offline,
  control,
  boards: {
    list: () => ipcRenderer.invoke(CHANNELS.boardsList),
    open: (id: string) => ipcRenderer.invoke(CHANNELS.boardsOpen, id),
    create: () => ipcRenderer.invoke(CHANNELS.boardsCreate),
    rename: (id: string, title: string) => ipcRenderer.invoke(CHANNELS.boardsRename, id, title),
    remove: (id: string) => ipcRenderer.invoke(CHANNELS.boardsRemove, id),
    saveScene: (id: string, scene: unknown) => ipcRenderer.invoke(CHANNELS.boardsSaveScene, id, scene),
    setEngine: (id: string, engine: EngineChoice) => ipcRenderer.invoke(CHANNELS.boardsSetEngine, id, engine),
  },
  engines: () => ipcRenderer.invoke(CHANNELS.engines),
  run: {
    start: (request: StartRequest) => ipcRenderer.invoke(CHANNELS.runStart, request),
    followUp: (boardId: string, text: string) => ipcRenderer.invoke(CHANNELS.runFollowUp, boardId, text),
    cancel: (boardId: string) => ipcRenderer.invoke(CHANNELS.runCancel, boardId),
  },
  onEvent: (listener: (event: HarnessEvent) => void) => subscribe(CHANNELS.event, listener),
  onRunEnded: (listener) => subscribe(CHANNELS.runEnded, listener),
  onCanvasRequest: (handler: (request: CanvasRequest) => Promise<CanvasResult>) => {
    ipcRenderer.on(CHANNELS.canvasRequest, (_event, request: CanvasRequest) => {
      void handler(request)
        .catch((error: unknown): CanvasResult => ({
          ok: false,
          error: error instanceof Error ? error.message : String(error),
        }))
        .then((result) => ipcRenderer.send(CHANNELS.canvasResult, { requestId: request.requestId, result }));
    });
  },
};

contextBridge.exposeInMainWorld("easel", bridge);
