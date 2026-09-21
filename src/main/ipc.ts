import type { BrowserWindow } from "electron";
import { ipcMain } from "./electron";
import type { HarnessEvent } from "reins";
import { CHANNELS, type Board, type EngineChoice, type EngineDiscovery, type StartRequest } from "../shared/app";
import type { CanvasResult } from "../shared/canvas";
import type { BoardStore } from "./boards";
import type { CanvasBridge } from "./canvas-bridge";
import type { EaselHarness } from "./harness/host";
import { RunManager, sessionKey } from "./runs";

export interface WiringOptions {
  window: BrowserWindow;
  boards: BoardStore;
  harness: EaselHarness;
  bridge: CanvasBridge;
}

function userMessage(request: StartRequest) {
  return {
    id: `user-${Date.now()}`,
    at: new Date().toISOString(),
    text: request.text,
    ...(request.selection.length > 0 ? { selection: request.selection } : {}),
    ...(request.images.length > 0 ? { hasImage: true } : {}),
  };
}

async function discover(harness: EaselHarness, adapterId: string): Promise<EngineDiscovery> {
  const attempt = async <T>(read: () => Promise<T>, label: string): Promise<T | { status: "unavailable"; message: string }> => {
    try {
      return await read();
    } catch (error) {
      return { status: "unavailable", message: `${label} failed: ${error instanceof Error ? error.message : String(error)}` };
    }
  };
  const [profile, models, limits] = await Promise.all([
    attempt(() => harness.runtime.profile(adapterId), "Profile"),
    attempt(() => harness.runtime.models(adapterId), "Model discovery"),
    attempt(() => harness.runtime.limits(adapterId), "Limit discovery"),
  ]);
  return { adapterId, profile, models, limits } as EngineDiscovery;
}

export function wire(options: WiringOptions): RunManager {
  const { window, boards, harness, bridge } = options;
  const send = (channel: string, payload: unknown) => {
    if (!window.isDestroyed()) window.webContents.send(channel, payload);
  };

  bridge.attach((request) => send(CHANNELS.canvasRequest, request));
  window.on("closed", () => bridge.detach());

  const runs = new RunManager({
    runtime: harness.runtime,
    bridge,
    memory: harness.memory,
    onEvent: (event: HarnessEvent) => send(CHANNELS.event, event),
    onEnded: (boardId, status) => send(CHANNELS.runEnded, { boardId, status }),
  });

  ipcMain.on(CHANNELS.canvasResult, (_event, payload: { requestId: string; result: CanvasResult }) => {
    bridge.settle(payload.requestId, payload.result);
  });

  ipcMain.handle(CHANNELS.boardsList, () => boards.list());
  ipcMain.handle(CHANNELS.boardsCreate, async () => {
    const board = await boards.create();
    return { id: board.id, title: board.title, updatedAt: board.updatedAt };
  });
  ipcMain.handle(CHANNELS.boardsRename, (_event, id: string, title: string) =>
    boards.update(id, (board) => ({ ...board, title: title.trim() === "" ? board.title : title.trim() })).then(() => undefined));
  ipcMain.handle(CHANNELS.boardsRemove, async (_event, id: string) => {
    await runs.cancel(id);
    for (const adapterId of harness.engineIds) await harness.runtime.resetSession(sessionKey(id), adapterId);
    harness.memory.forget(id);
    await boards.remove(id);
  });
  ipcMain.handle(CHANNELS.boardsSaveScene, (_event, id: string, scene: unknown) =>
    boards.update(id, (board) => ({ ...board, scene })).then(() => undefined));
  ipcMain.handle(CHANNELS.boardsSetEngine, (_event, id: string, engine: EngineChoice) =>
    boards.update(id, (board) => ({ ...board, engine })).then(() => undefined));

  ipcMain.handle(CHANNELS.boardsOpen, async (_event, id: string) => {
    const board: Board = await boards.read(id);
    const session = sessionKey(id);
    const perEngine = await Promise.all(
      harness.engineIds.map((adapterId) => harness.persistence.events.list(session, adapterId)),
    );
    const events = perEngine.flat().sort((left, right) => left.timestamp.localeCompare(right.timestamp));
    return { board, events };
  });

  ipcMain.handle(CHANNELS.engines, () => Promise.all(harness.engineIds.map((id) => discover(harness, id))));

  ipcMain.handle(CHANNELS.runStart, async (_event, request: StartRequest) => {
    // Stamped before the turn starts, so the message never sorts after its own reply.
    const sent = userMessage(request);
    const ack = runs.start(request);
    if (ack.ok) {
      await boards.update(request.boardId, (board) => ({
        ...board,
        engine: request.engine,
        messages: [...board.messages, sent],
      }));
    }
    return ack;
  });
  ipcMain.handle(CHANNELS.runFollowUp, async (_event, boardId: string, text: string) => {
    const ack = await runs.followUp(boardId, text);
    if (ack.ok) {
      await boards.update(boardId, (board) => ({
        ...board,
        messages: [...board.messages, { id: `user-${Date.now()}`, at: new Date().toISOString(), text }],
      }));
    }
    return ack;
  });
  ipcMain.handle(CHANNELS.runCancel, (_event, boardId: string) => runs.cancel(boardId));

  return runs;
}
