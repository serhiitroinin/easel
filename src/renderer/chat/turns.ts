import type { HarnessEvent, HarnessUsage } from "reins";

export interface ToolActivity {
  toolId: string;
  name: string;
  status: "running" | "completed" | "failed" | "declined" | "cancelled";
  ids: string[];
  /** The exact message the provider reported for a failed call. */
  error?: string;
  /** The exact message this application returned to the model. */
  hostError?: string;
}

export type TurnBlock =
  | { kind: "text"; text: string }
  | { kind: "tools"; tools: ToolActivity[] };

export interface UserEntry {
  kind: "user";
  id: string;
  at: string;
  text: string;
  selection: string[];
  images: number;
}

export interface AgentEntry {
  kind: "agent";
  id: string;
  at: string;
  adapterId: string;
  model?: string;
  /** Prose and tool groups in the order the agent produced them. */
  blocks: TurnBlock[];
  thinking: string;
  thinkingFrom?: string;
  thinkingTo?: string;
  usage?: HarnessUsage;
  error?: string;
  status?: string;
}

export type Entry = UserEntry | AgentEntry;

const LABELS: Record<string, (count: number) => string> = {
  get_scene: () => "Read the board",
  view_canvas: () => "Looked at the board",
  add_elements: (count) => `Drew ${count} element${count === 1 ? "" : "s"}`,
  update_elements: (count) => `Changed ${count} element${count === 1 ? "" : "s"}`,
  delete_elements: (count) => `Removed ${count} element${count === 1 ? "" : "s"}`,
  arrange: (count) => `Arranged ${count} element${count === 1 ? "" : "s"}`,
  focus: (count) => `Pointed at ${count} element${count === 1 ? "" : "s"}`,
};

const REFUSED: Record<string, (what: string) => string> = {
  get_scene: () => "Could not read the board",
  view_canvas: () => "Could not look at the board",
  add_elements: (what) => `Could not draw ${what}`,
  update_elements: (what) => `Could not change ${what}`,
  delete_elements: (what) => `Could not remove ${what}`,
  arrange: (what) => `Could not arrange ${what}`,
  focus: (what) => `Could not point at ${what}`,
};

export function toolFailed(status: ToolActivity["status"]): boolean {
  return status === "failed" || status === "declined" || status === "cancelled";
}

export function toolName(kind: string, title: string): string {
  for (const raw of [kind, title]) {
    const tail = (raw.split("__").at(-1) ?? raw).trim();
    if (tail in LABELS) return tail;
  }
  return title.trim() === "" ? kind : title;
}

export function toolLabel(name: string, ids: string[], status: ToolActivity["status"] = "completed"): string {
  if (toolFailed(status)) {
    const refused = REFUSED[name];
    const what = ids.length > 0 ? `${ids.length} element${ids.length === 1 ? "" : "s"}` : "those elements";
    return refused ? refused(what) : `Could not run ${name.replace(/_/g, " ")}`;
  }
  const label = LABELS[name];
  return label ? label(ids.length) : name.replace(/_/g, " ");
}

/**
 * Adapters wrap a tool result differently, so the ids are found by their own
 * key rather than by assuming the whole output is this application's JSON.
 */
export function touchedIds(output: string | undefined): string[] {
  if (!output) return [];
  const found = /\\?"ids\\?"\s*:\s*(\[[^\]]*\])/.exec(output);
  if (!found?.[1]) return [];
  for (const candidate of [found[1], found[1].replace(/\\"/g, '"')]) {
    try {
      const parsed: unknown = JSON.parse(candidate);
      if (Array.isArray(parsed)) return parsed.filter((id): id is string => typeof id === "string");
    } catch {
      continue;
    }
  }
  return [];
}

export function turnTools(entry: AgentEntry): ToolActivity[] {
  return entry.blocks.flatMap((block) => (block.kind === "tools" ? block.tools : []));
}

export function turnText(entry: AgentEntry): string {
  return entry.blocks.flatMap((block) => (block.kind === "text" ? [block.text] : [])).join("\n\n");
}

function withTurn(entries: Entry[], event: HarnessEvent, change: (turn: AgentEntry) => AgentEntry): Entry[] {
  const index = entries.findIndex((entry) => entry.kind === "agent" && entry.id === event.turnId);
  if (index < 0) {
    const fresh: AgentEntry = {
      kind: "agent",
      id: event.turnId,
      at: event.timestamp,
      adapterId: event.adapterId,
      blocks: [],
      thinking: "",
    };
    return [...entries, change(fresh)];
  }
  return entries.map((entry, position) =>
    position === index && entry.kind === "agent" ? change(entry) : entry);
}

/** Prose after a tool call begins a new paragraph, so the turn reads in order. */
function appendText(turn: AgentEntry, text: string): AgentEntry {
  const last = turn.blocks.at(-1);
  if (last?.kind === "text") {
    return {
      ...turn,
      blocks: [...turn.blocks.slice(0, -1), { kind: "text", text: last.text + text }],
    };
  }
  const trimmed = turn.blocks.length === 0 ? text : text.replace(/^\s+/, "");
  if (trimmed === "") return turn;
  return { ...turn, blocks: [...turn.blocks, { kind: "text", text: trimmed }] };
}

function upsertTool(turn: AgentEntry, activity: ToolActivity): AgentEntry {
  const settle = (tool: ToolActivity): ToolActivity => {
    const merged = { ...tool, ...activity };
    // A refused call touched nothing, whichever side reported it first.
    if (toolFailed(merged.status)) return { ...merged, ids: [] };
    return { ...merged, ids: activity.ids.length > 0 ? activity.ids : tool.ids };
  };

  const known = turn.blocks.some((block) =>
    block.kind === "tools" && block.tools.some((tool) => tool.toolId === activity.toolId));
  if (known) {
    return {
      ...turn,
      blocks: turn.blocks.map((block) => (block.kind === "tools"
        ? {
            kind: "tools",
            tools: block.tools.map((tool) => (tool.toolId === activity.toolId ? settle(tool) : tool)),
          }
        : block)),
    };
  }

  const last = turn.blocks.at(-1);
  if (last?.kind === "tools") {
    return {
      ...turn,
      blocks: [...turn.blocks.slice(0, -1), { kind: "tools", tools: [...last.tools, activity] }],
    };
  }
  const sealed: TurnBlock[] = last?.kind === "text"
    ? [...turn.blocks.slice(0, -1), { kind: "text", text: last.text.replace(/\s+$/, "") }]
    : [...turn.blocks];
  return { ...turn, blocks: [...sealed, { kind: "tools", tools: [activity] }] };
}

/** One reducer builds the chat, both from a live stream and from replayed events. */
export function reduceEvent(entries: Entry[], event: HarnessEvent): Entry[] {
  const payload = event.payload;
  switch (payload.kind) {
    case "turn-started":
      return withTurn(entries, event, (turn) => (payload.model ? { ...turn, model: payload.model } : turn));
    case "assistant-text":
      return withTurn(entries, event, (turn) => appendText(turn, payload.text));
    case "thinking":
      return withTurn(entries, event, (turn) => ({
        ...turn,
        thinking: turn.thinking + payload.text,
        thinkingFrom: turn.thinkingFrom ?? event.timestamp,
        thinkingTo: event.timestamp,
      }));
    case "tool-started":
      return withTurn(entries, event, (turn) => upsertTool(turn, {
        toolId: payload.toolId,
        name: toolName(payload.toolKind, payload.title),
        status: "running",
        ids: [],
      }));
    case "tool-completed":
      return withTurn(entries, event, (turn) => upsertTool(turn, {
        toolId: payload.toolId,
        name: toolName(payload.toolKind, payload.title),
        status: payload.status,
        ids: payload.status === "completed" ? touchedIds(payload.outputAppend) : [],
        ...(payload.error ? { error: payload.error } : {}),
        ...(payload.error === undefined && payload.status !== "completed" && payload.outputAppend
          ? { error: payload.outputAppend }
          : {}),
      }));
    case "usage":
      return withTurn(entries, event, (turn) => ({ ...turn, usage: payload.usage }));
    case "error":
      return withTurn(entries, event, (turn) => ({ ...turn, error: `${payload.code}: ${payload.message}` }));
    case "turn-completed":
      return withTurn(entries, event, (turn) => ({
        ...turn,
        status: payload.status,
        ...(payload.usage ? { usage: payload.usage } : {}),
      }));
    default:
      return entries;
  }
}

export function reduceEvents(entries: Entry[], events: readonly HarnessEvent[]): Entry[] {
  return events.reduce(reduceEvent, entries);
}

/** A turn's first event and the message that caused it are stamped this close together. */
const SAME_SEND_MS = 1_000;

/**
 * Entries read in the order they happened. A message used to be stamped just
 * after its turn had started, so a stored reply may be a few milliseconds older
 * than its prompt; such a pair is put back in the order it was written.
 */
export function sortEntries(entries: Entry[]): Entry[] {
  const sorted = [...entries].sort((left, right) => left.at.localeCompare(right.at));
  for (let index = 0; index < sorted.length - 1; index += 1) {
    const reply = sorted[index]!;
    const prompt = sorted[index + 1]!;
    if (reply.kind !== "agent" || prompt.kind !== "user") continue;
    const gap = Date.parse(prompt.at) - Date.parse(reply.at);
    if (gap >= 0 && gap < SAME_SEND_MS) {
      sorted[index] = prompt;
      sorted[index + 1] = reply;
      index += 1;
    }
  }
  return sorted;
}

export interface TouchedTool {
  name: string;
  ids: string[];
  /** Present when this application refused the call. */
  error?: string;
}

/**
 * An adapter may not echo a tool result, so the host keeps what each canvas
 * call touched and fills the rows in order as they stream in. Drained entries
 * are removed from `pending`.
 */
export function drainTouched(entries: Entry[], pending: TouchedTool[]): Entry[] {
  if (pending.length === 0) return entries;
  const index = entries.findLastIndex((entry) => entry.kind === "agent");
  const turn = entries[index];
  if (index < 0 || turn?.kind !== "agent") return entries;

  let changed = false;
  const fill = (tool: ToolActivity): ToolActivity => {
    if (tool.ids.length > 0 || tool.hostError !== undefined) return tool;
    const refused = toolFailed(tool.status);
    const at = pending.findIndex((touched) =>
      touched.name === tool.name && (touched.error !== undefined) === refused);
    if (at < 0) return tool;
    const [touched] = pending.splice(at, 1);
    changed = true;
    return refused ? { ...tool, hostError: touched!.error } : { ...tool, ids: touched!.ids };
  };

  const blocks = turn.blocks.map((block) =>
    (block.kind === "tools" ? { kind: "tools" as const, tools: block.tools.map(fill) } : block));
  return changed ? entries.map((entry, position) => (position === index ? { ...turn, blocks } : entry)) : entries;
}
