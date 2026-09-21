import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";
import type { HarnessEvent } from "reins";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { AttachedImage, Board, BoardSummary, EngineChoice, EngineDiscovery } from "../shared/app";
import { easel } from "./bridge";
import { applyCommand } from "./canvas/apply";
import { BoardCanvas, type SavedScene } from "./canvas/BoardCanvas";
import { fitToTurn, viewSignature } from "./canvas/fit";
import { Chat } from "./chat/Chat";
import { Composer } from "./chat/Composer";
import {
  drainTouched, reduceEvent, reduceEvents, sortEntries, toolLabel, turnTools,
  type Entry, type TouchedTool,
} from "./chat/turns";
import { Sidebar } from "./sidebar/Sidebar";
import { TopBar } from "./TopBar";
import { isBoolean, isWidth, useStored } from "./useStored";
import { useTheme } from "./useTheme";

const SUGGESTIONS = [
  "Sketch a system architecture for a photo sharing app",
  "Turn my rough boxes into a clean flowchart",
  "Draw a user journey for a first time visitor",
];

const PANEL = { min: 300, max: 640, initial: 380 } as const;
const SIDEBAR = { min: 200, max: 320, initial: 232 } as const;
/** The sheet keeps at least this much width; the side regions give way first. */
const SHEET_MIN = 320;

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(min, max), Math.max(min, value));

const TOUCHING = new Set(["add_elements", "update_elements", "arrange", "delete_elements"]);
const OUTLINE_RELEASE_MS = 600;
const FOCUS_REFRESH_MS = 60_000;
const MENU_REFRESH_MS = 20_000;

function firstChoice(engines: EngineDiscovery[]): EngineChoice | null {
  const engine = engines.find((candidate) => candidate.profile.status === "available") ?? engines[0];
  if (!engine) return null;
  const models = engine.models.status === "available" ? engine.models.value : null;
  const model = models?.defaultModelId ?? models?.models[0]?.id;
  return { adapterId: engine.adapterId, ...(model ? { model } : {}) };
}

function userEntries(board: Board): Entry[] {
  return board.messages.map((message) => ({
    kind: "user" as const,
    id: message.id,
    at: message.at,
    text: message.text,
    selection: message.selection ?? [],
    images: message.hasImage ? 1 : 0,
  }));
}

/**
 * Excalidraw's dark theme inverts the canvas, so the scene carries a light
 * colour in both themes and the dark one is chosen for what it inverts to.
 */
const SHEET = { light: "#fffdf8", dark: "#f4efe4" } as const;

export function App() {
  const { theme, choice: themeChoice, setChoice: setThemeChoice } = useTheme();
  const api = useRef<ExcalidrawImperativeAPI | null>(null);
  const release = useRef<ReturnType<typeof setTimeout> | null>(null);
  const touched = useRef<TouchedTool[]>([]);
  const expectedView = useRef("");
  const userMovedView = useRef(false);
  const turnIds = useRef<string[]>([]);
  const removed = useRef(new Set<string>());
  const discovering = useRef(false);
  const discoveredAt = useRef(0);
  const [boards, setBoards] = useState<BoardSummary[]>([]);
  const [board, setBoard] = useState<Board | null>(null);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [engines, setEngines] = useState<EngineDiscovery[]>([]);
  const [choice, setChoice] = useState<EngineChoice | null>(null);
  const [running, setRunning] = useState(false);
  const [startedAt, setStartedAt] = useState(0);
  const [selection, setSelection] = useState<string[]>([]);
  const [highlight, setHighlight] = useState<string[]>([]);
  const [draft, setDraft] = useState("");
  const [panel, setPanel] = useStored("easel:panel-width", PANEL.initial, isWidth);
  const [panelOpen, setPanelOpen] = useStored("easel:panel-open", true, isBoolean);
  const [sidebar, setSidebar] = useStored("easel:sidebar-width", SIDEBAR.initial, isWidth);
  const [sidebarOpen, setSidebarOpen] = useStored("easel:sidebar-open", true, isBoolean);
  const [windowWidth, setWindowWidth] = useState(() => window.innerWidth);

  const open = useCallback(async (id: string) => {
    const state = await easel.boards.open(id);
    setBoard(state.board);
    setEntries(sortEntries(reduceEvents(userEntries(state.board), state.events)));
    setRunning(false);
    setHighlight([]);
    setDraft("");
    if (state.board.engine) setChoice(state.board.engine);
  }, []);

  const refresh = useCallback(async () => setBoards(await easel.boards.list()), []);

  /** Discovery is cached in the main process, so asking again is cheap. */
  const refreshEngines = useCallback(async (olderThanMs: number) => {
    if (discovering.current || Date.now() - discoveredAt.current < olderThanMs) return;
    discovering.current = true;
    try {
      const found = await easel.engines();
      discoveredAt.current = Date.now();
      setEngines(found);
      setChoice((current) => current ?? firstChoice(found));
    } finally {
      discovering.current = false;
    }
  }, []);

  useEffect(() => {
    void (async () => {
      const list = await easel.boards.list();
      setBoards(list);
      if (list[0]) await open(list[0].id);
      await refreshEngines(0);
    })();
  }, [open, refreshEngines]);

  const refreshForMenu = useCallback(() => void refreshEngines(MENU_REFRESH_MS), [refreshEngines]);

  useEffect(() => {
    const focused = () => void refreshEngines(FOCUS_REFRESH_MS);
    window.addEventListener("focus", focused);
    return () => window.removeEventListener("focus", focused);
  }, [refreshEngines]);

  useEffect(() => easel.onEvent((event) =>
    setEntries((current) => drainTouched(reduceEvent(current, event), touched.current))), []);

  // A verification script may feed the transcript events no offline turn produces.
  useEffect(() => {
    if (!easel.control) return;
    Object.assign(window, {
      __easelReplay: (events: HarnessEvent[]) => setEntries((current) => reduceEvents(current, events)),
    });
  }, []);

  useEffect(() => easel.onRunEnded(() => {
    setRunning(false);
    void refresh();
    void refreshEngines(0);
    if (!userMovedView.current) {
      const animate = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (fitToTurn(api.current, turnIds.current, { animate })) {
        setTimeout(() => { expectedView.current = viewSignature(api.current); }, 320);
      }
    }
    release.current = setTimeout(() => setHighlight([]), OUTLINE_RELEASE_MS);
  }), [refresh, refreshEngines]);

  useEffect(() => {
    easel.onCanvasRequest(async ({ command }) => {
      const instance = api.current;
      if (!instance) return { ok: false, error: "The board is not ready." };
      const result = await applyCommand(instance, command);
      if (!result.ok) {
        touched.current.push({ name: command.kind, ids: [], error: result.error });
        setEntries((current) => drainTouched(current, touched.current));
        return result;
      }
      const ids = result.kind === "elements"
        ? result.elements.map((element) => element.id)
        : result.kind === "ids" ? result.ids : [];
      if (command.kind === "focus") expectedView.current = viewSignature(instance);
      if (ids.length > 0) touched.current.push({ name: command.kind, ids });
      if (TOUCHING.has(command.kind)) turnIds.current = [...new Set([...turnIds.current, ...ids])];
      setEntries((current) => drainTouched(current, touched.current));
      if (TOUCHING.has(command.kind)) {
        if (release.current) clearTimeout(release.current);
        setHighlight((current) => [...new Set([...current, ...ids])]);
      }
      return result;
    });
  }, []);

  useEffect(() => {
    if (board && choice) void easel.boards.setEngine(board.id, choice);
  }, [board, choice]);

  useEffect(() => {
    const keys = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key === "\\") {
        event.preventDefault();
        setPanelOpen((open) => !open);
      }
      if ((event.metaKey || event.ctrlKey) && !event.shiftKey && !event.altKey && event.key.toLowerCase() === "b") {
        event.preventDefault();
        setSidebarOpen((open) => !open);
      }
    };
    // Capturing keeps the shortcuts working while the canvas holds the focus.
    window.addEventListener("keydown", keys, true);
    return () => window.removeEventListener("keydown", keys, true);
  }, [setPanelOpen, setSidebarOpen]);

  useEffect(() => {
    const resized = () => setWindowWidth(window.innerWidth);
    window.addEventListener("resize", resized);
    return () => window.removeEventListener("resize", resized);
  }, []);

  const saveScene = useCallback((scene: SavedScene) => {
    // The canvas saves on a delay, which may fall after its board was deleted.
    if (board && !removed.current.has(board.id)) void easel.boards.saveScene(board.id, scene);
  }, [board]);

  const captureView = useCallback(async (): Promise<AttachedImage | null> => {
    const instance = api.current;
    if (!instance) return null;
    const result = await applyCommand(instance, { kind: "view_canvas", region: "viewport" });
    return result.ok && result.kind === "image" ? { mediaType: result.mediaType, data: result.data } : null;
  }, []);

  const send = useCallback(async (text: string, images: AttachedImage[]) => {
    if (!board || !choice) return;
    const at = new Date().toISOString();
    setEntries((current) => [...current, {
      kind: "user", id: `local-${at}`, at, text, selection, images: images.length,
    }]);
    const ack = running
      ? await easel.run.followUp(board.id, text)
      : await easel.run.start({
          boardId: board.id,
          text,
          engine: choice,
          selection,
          selectionLabel: `${selection.length} selected`,
          images,
        });
    if (ack.ok) {
      touched.current = [];
      turnIds.current = [];
      userMovedView.current = false;
      expectedView.current = viewSignature(api.current);
      setRunning(true);
      setStartedAt(Date.now());
    } else {
      setEntries((current) => [...current, {
        kind: "agent", id: `failed-${at}`, at, adapterId: choice.adapterId,
        blocks: [], thinking: "", error: ack.error,
      }]);
    }
  }, [board, choice, running, selection]);

  const noteView = useCallback((signature: string) => {
    if (signature !== expectedView.current) userMovedView.current = true;
  }, []);

  const focusOn = useCallback((ids: string[]) => {
    const instance = api.current;
    if (instance && ids.length > 0) void applyCommand(instance, { kind: "focus", ids });
  }, []);

  // A stored width is a wish; what is drawn always leaves the sheet its minimum.
  const sidebarWidth = sidebarOpen ? clamp(sidebar, SIDEBAR.min, SIDEBAR.max) : 0;
  const panelWidth = panelOpen
    ? clamp(panel, PANEL.min, Math.min(PANEL.max, windowWidth - sidebarWidth - SHEET_MIN))
    : 0;

  const dragEdge = useCallback((
    event: React.PointerEvent<HTMLDivElement>,
    width: (pointerX: number) => void,
  ) => {
    event.preventDefault();
    const move = (moved: PointerEvent) => width(moved.clientX);
    const stop = () => {
      document.body.classList.remove("resizing");
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", stop);
    };
    document.body.classList.add("resizing");
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", stop);
  }, []);

  const dragPanel = useCallback((event: React.PointerEvent<HTMLDivElement>) => dragEdge(event, (x) =>
    setPanel(clamp(window.innerWidth - x, PANEL.min, Math.min(PANEL.max, window.innerWidth - sidebarWidth - SHEET_MIN)))),
  [dragEdge, setPanel, sidebarWidth]);

  const dragSidebar = useCallback((event: React.PointerEvent<HTMLDivElement>) => dragEdge(event, (x) =>
    setSidebar(clamp(x, SIDEBAR.min, SIDEBAR.max))), [dragEdge, setSidebar]);

  const activity = useMemo(() => {
    if (!running) return null;
    const last = [...entries].reverse().find((entry) => entry.kind === "agent");
    const tool = last?.kind === "agent" ? turnTools(last).at(-1) : undefined;
    const label = tool && tool.status === "running" ? toolLabel(tool.name, tool.ids) : "Thinking";
    return { label, startedAt };
  }, [entries, running, startedAt]);

  if (!board) return <div className="loading">Easel</div>;

  const create = async () => {
    const created = await easel.boards.create();
    await refresh();
    await open(created.id);
  };

  const rename = async (id: string, title: string) => {
    await easel.boards.rename(id, title);
    if (id === board.id) setBoard({ ...board, title });
    await refresh();
  };

  const remove = async (id: string) => {
    removed.current.add(id);
    await easel.boards.remove(id);
    const list = await easel.boards.list();
    setBoards(list);
    if (id !== board.id) return;
    const next = list[0]?.id ?? (await easel.boards.create()).id;
    await refresh();
    await open(next);
  };

  return (
    <div
      className="app"
      data-panel={panelOpen ? "open" : "closed"}
      data-sidebar={sidebarOpen ? "open" : "closed"}
      style={{ "--panel-width": `${panelWidth}px`, "--sidebar-width": `${sidebarWidth}px` } as React.CSSProperties}
    >
      {sidebarOpen && (
        <Sidebar
          boards={boards}
          activeId={board.id}
          onOpen={(id) => { if (id !== board.id) void open(id); }}
          onCreate={() => void create()}
          onRename={(id, title) => void rename(id, title)}
          onDelete={(id) => void remove(id)}
          onCollapse={() => setSidebarOpen(false)}
          onResize={dragSidebar}
        />
      )}

      <TopBar
        board={board}
        sidebarOpen={sidebarOpen}
        panelOpen={panelOpen}
        themeChoice={themeChoice}
        onRename={(title) => void rename(board.id, title)}
        onSidebar={setSidebarOpen}
        onPanel={setPanelOpen}
        onTheme={setThemeChoice}
      />

      <BoardCanvas
        key={board.id}
        theme={theme}
        sheetColor={SHEET[theme]}
        initial={board.scene as SavedScene | null}
        highlight={highlight}
        penActive={running}
        empty={entries.length === 0}
        suggestions={SUGGESTIONS}
        onSuggest={setDraft}
        onReady={(instance) => {
          api.current = instance;
          if (easel.control) Object.assign(window, { __easel: { api: instance } });
        }}
        onSelection={setSelection}
        onView={noteView}
        onScene={saveScene}
      />

      {panelOpen && (
        <aside className="panel">
          <div className="grip" onPointerDown={dragPanel} role="separator" aria-label="Resize the chat" />
          <Chat
            entries={entries}
            onHighlight={setHighlight}
            onFocus={focusOn}
          />
          <Composer
            selection={selection}
            running={running}
            engines={engines}
            choice={choice}
            activity={activity}
            draft={draft}
            onDraft={setDraft}
            onEngine={setChoice}
            onEngineMenu={refreshForMenu}
            onSend={(text, images) => void send(text, images)}
            onStop={() => void easel.run.cancel(board.id)}
            captureView={captureView}
          />
        </aside>
      )}
    </div>
  );
}
