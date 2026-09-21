import { describe, expect, test } from "bun:test";
import type { HarnessEvent, HarnessEventPayload } from "reins";
import {
  drainTouched, reduceEvent, reduceEvents, sortEntries, toolLabel, turnText, turnTools,
  type AgentEntry, type Entry,
} from "../src/renderer/chat/turns";

let sequence = 0;

function event(payload: HarnessEventPayload, turnId = "turn-1"): HarnessEvent {
  sequence += 1;
  return {
    schemaVersion: 1,
    eventId: `event-${sequence}`,
    sequence,
    timestamp: new Date(1_700_000_000_000 + sequence * 1000).toISOString(),
    session: { tenantId: "easel", actorId: "local", threadId: "board" },
    runId: "run-1",
    turnId,
    adapterId: "easel:claude",
    payload,
  };
}

function agent(entries: Entry[]): AgentEntry {
  const found = entries.find((entry) => entry.kind === "agent");
  if (found?.kind !== "agent") throw new Error("no agent turn");
  return found;
}

describe("reducing harness events into a turn", () => {
  test("joins streamed text and keeps the tool order", () => {
    const entries = reduceEvents([], [
      event({ kind: "turn-started", model: "sonnet" }),
      event({ kind: "assistant-text", text: "Drawing " }),
      event({ kind: "tool-started", toolId: "t1", toolKind: "mcp__reins__add_elements", title: "add_elements" }),
      event({ kind: "assistant-text", text: "three boxes." }),
      event({ kind: "tool-completed", toolId: "t1", toolKind: "mcp__reins__add_elements", title: "add_elements", status: "completed", outputAppend: '{"ids":["a","b","c"]}' }),
      event({ kind: "turn-completed", status: "completed", usage: { totalTokens: 900 } }),
    ]);
    const turn = agent(entries);
    expect(turnText(turn)).toBe("Drawing\n\nthree boxes.");
    expect(turn.model).toBe("sonnet");
    expect(turn.status).toBe("completed");
    expect(turn.usage?.totalTokens).toBe(900);
    expect(turnTools(turn)).toHaveLength(1);
    expect(turnTools(turn)[0]).toMatchObject({ name: "add_elements", status: "completed", ids: ["a", "b", "c"] });
  });

  test("reads the ids out of a wrapped tool output", () => {
    const entries = reduceEvents([], [
      event({ kind: "tool-completed", toolId: "t1", toolKind: "focus", title: "focus", status: "completed", outputAppend: '[{"type":"text","text":"{\\"ids\\":[\\"x\\"]}"}]' }),
    ]);
    expect(turnTools(agent(entries))[0]?.ids).toEqual(["x"]);
  });

  test("starts a new paragraph when text resumes after a tool call", () => {
    const entries = reduceEvents([], [
      event({ kind: "assistant-text", text: "Now let me arrange them and connect with arrows." }),
      event({ kind: "tool-started", toolId: "t1", toolKind: "arrange", title: "arrange" }),
      event({ kind: "tool-completed", toolId: "t1", toolKind: "arrange", title: "arrange", status: "completed" }),
      event({ kind: "assistant-text", text: "I drew a three-tier web architecture." }),
    ]);
    expect(turnText(agent(entries))).toBe(
      "Now let me arrange them and connect with arrows.\n\nI drew a three-tier web architecture.",
    );
  });

  test("does not break a paragraph that is still streaming", () => {
    const entries = reduceEvents([], [
      event({ kind: "assistant-text", text: "One " }),
      event({ kind: "assistant-text", text: "sentence." }),
    ]);
    expect(turnText(agent(entries))).toBe("One sentence.");
  });

  test("keeps a turn open per turn id", () => {
    const entries = reduceEvents([], [
      event({ kind: "assistant-text", text: "one" }, "turn-1"),
      event({ kind: "assistant-text", text: "two" }, "turn-2"),
    ]);
    expect(entries).toHaveLength(2);
  });

  test("records an error without losing the turn", () => {
    const entries = reduceEvents([], [
      event({ kind: "assistant-text", text: "partial" }),
      event({ kind: "error", code: "PROVIDER_FAILED", message: "the provider stopped" }),
    ]);
    expect(agent(entries).error).toBe("PROVIDER_FAILED: the provider stopped");
    expect(turnText(agent(entries))).toBe("partial");
  });

  test("ignores an unknown event kind", () => {
    const before: Entry[] = [];
    expect(reduceEvent(before, event({ kind: "extension", namespace: "x", name: "y", payload: {} }))).toBe(before);
  });
});

describe("filling tool rows from the host", () => {
  const rows = () => reduceEvents([], [
    event({ kind: "tool-started", toolId: "t1", toolKind: "add_elements", title: "add_elements" }),
    event({ kind: "tool-started", toolId: "t2", toolKind: "add_elements", title: "add_elements" }),
  ]);

  test("fills rows of the same tool in arrival order", () => {
    const pending = [{ name: "add_elements", ids: ["a"] }, { name: "add_elements", ids: ["b", "c"] }];
    const filled = drainTouched(rows(), pending);
    expect(turnTools(agent(filled)).map((tool) => tool.ids)).toEqual([["a"], ["b", "c"]]);
    expect(pending).toEqual([]);
  });

  test("waits for a row that has not streamed in yet", () => {
    const pending = [{ name: "add_elements", ids: ["a", "b"] }];
    const empty = drainTouched([], pending);
    expect(empty).toEqual([]);
    expect(pending).toHaveLength(1);
    const filled = drainTouched(rows(), pending);
    expect(turnTools(agent(filled))[0]?.ids).toEqual(["a", "b"]);
    expect(pending).toEqual([]);
  });

  test("leaves a row alone when nothing matches and keeps the entries", () => {
    const pending = [{ name: "delete_elements", ids: ["a"] }];
    const before = rows();
    expect(drainTouched(before, pending)).toBe(before);
    expect(pending).toHaveLength(1);
  });

  test("never overwrites ids a row already has", () => {
    const filled = drainTouched(rows(), [{ name: "add_elements", ids: ["a"] }]);
    const again = drainTouched(filled, [{ name: "add_elements", ids: ["z"] }]);
    expect(turnTools(agent(again))[0]?.ids).toEqual(["a"]);
    expect(turnTools(agent(again))[1]?.ids).toEqual(["z"]);
  });
});

describe("a refused tool call", () => {
  const refused = (outputAppend?: string, error?: string) => reduceEvents([], [
    event({ kind: "tool-started", toolId: "t1", toolKind: "add_elements", title: "add_elements" }),
    event({
      kind: "tool-completed", toolId: "t1", toolKind: "add_elements", title: "add_elements", status: "failed",
      ...(outputAppend !== undefined ? { outputAppend } : {}),
      ...(error !== undefined ? { error } : {}),
    }),
  ]);

  test("never claims success in its label", () => {
    expect(toolLabel("add_elements", [], "failed")).toBe("Could not draw those elements");
    expect(toolLabel("update_elements", ["a", "b"], "failed")).toBe("Could not change 2 elements");
    expect(toolLabel("view_canvas", [], "declined")).toBe("Could not look at the board");
  });

  test("keeps the provider error", () => {
    expect(turnTools(agent(refused(undefined, "the provider refused")))[0]?.error).toBe("the provider refused");
  });

  test("falls back to the output the model saw", () => {
    expect(turnTools(agent(refused('elements[0] has unknown properties: colour.')))[0]?.error)
      .toBe("elements[0] has unknown properties: colour.");
  });

  test("carries no element ids", () => {
    expect(turnTools(agent(refused('{"ids":["a"]}')))[0]?.ids).toEqual([]);
  });

  test("takes the host message when the adapter reports nothing", () => {
    const entries = drainTouched(refused(), [{ name: "add_elements", ids: [], error: "The id \"api\" is already on the board." }]);
    expect(turnTools(agent(entries))[0]?.hostError).toBe('The id "api" is already on the board.');
  });

  test("is never given the ids of the call that followed it", () => {
    const entries = reduceEvents([], [
      event({ kind: "tool-started", toolId: "t1", toolKind: "add_elements", title: "add_elements" }),
      event({ kind: "tool-completed", toolId: "t1", toolKind: "add_elements", title: "add_elements", status: "failed" }),
      event({ kind: "tool-started", toolId: "t2", toolKind: "add_elements", title: "add_elements" }),
    ]);
    const pending = [
      { name: "add_elements", ids: [], error: "refused" },
      { name: "add_elements", ids: ["a", "b"] },
    ];
    const filled = drainTouched(entries, pending);
    expect(turnTools(agent(filled))[0]).toMatchObject({ status: "failed", ids: [], hostError: "refused" });
    expect(turnTools(agent(filled))[1]).toMatchObject({ ids: ["a", "b"] });
  });
});

describe("tool labels", () => {
  test("say what happened in the product's words", () => {
    expect(toolLabel("add_elements", ["a", "b"])).toBe("Drew 2 elements");
    expect(toolLabel("view_canvas", [])).toBe("Looked at the board");
    expect(toolLabel("focus", ["a"])).toBe("Pointed at 1 element");
  });

  test("fall back to the raw name for an unknown tool", () => {
    expect(toolLabel("some_other_tool", [])).toBe("some other tool");
  });
});

describe("reconciling a row when the two sides disagree", () => {
  test("drops ids attached before the failure was reported", () => {
    const started = reduceEvents([], [
      event({ kind: "tool-started", toolId: "t1", toolKind: "add_elements", title: "add_elements" }),
    ]);
    const optimistic = drainTouched(started, [{ name: "add_elements", ids: ["a", "b"] }]);
    expect(turnTools(agent(optimistic))[0]?.ids).toEqual(["a", "b"]);

    const settled = reduceEvent(optimistic, event({
      kind: "tool-completed", toolId: "t1", toolKind: "add_elements", title: "add_elements", status: "failed",
    }));
    expect(turnTools(agent(settled))[0]).toMatchObject({ status: "failed", ids: [] });
    expect(toolLabel("add_elements", turnTools(agent(settled))[0]?.ids ?? [], "failed"))
      .toBe("Could not draw those elements");
  });

  test("never gives a failed row the ids of a later call", () => {
    const entries = reduceEvents([], [
      event({ kind: "tool-started", toolId: "t1", toolKind: "add_elements", title: "add_elements" }),
      event({ kind: "tool-completed", toolId: "t1", toolKind: "add_elements", title: "add_elements", status: "failed" }),
      event({ kind: "tool-started", toolId: "t2", toolKind: "add_elements", title: "add_elements" }),
    ]);
    const filled = drainTouched(entries, [{ name: "add_elements", ids: ["a", "b", "c"] }]);
    expect(turnTools(agent(filled))[0]?.ids).toEqual([]);
    expect(turnTools(agent(filled))[1]?.ids).toEqual(["a", "b", "c"]);
  });
});

describe("the order a turn reads in", () => {
  const story = () => reduceEvents([], [
    event({ kind: "assistant-text", text: "I'll draw the three tiers." }),
    event({ kind: "tool-started", toolId: "t1", toolKind: "add_elements", title: "add_elements" }),
    event({ kind: "tool-completed", toolId: "t1", toolKind: "add_elements", title: "add_elements", status: "completed", outputAppend: '{"ids":["a"]}' }),
    event({ kind: "tool-started", toolId: "t2", toolKind: "arrange", title: "arrange" }),
    event({ kind: "tool-completed", toolId: "t2", toolKind: "arrange", title: "arrange", status: "completed", outputAppend: '{"ids":["a"]}' }),
    event({ kind: "assistant-text", text: "Now the arrows." }),
    event({ kind: "tool-started", toolId: "t3", toolKind: "add_elements", title: "add_elements" }),
    event({ kind: "assistant-text", text: "That is the flow." }),
  ]);

  test("interleaves prose and the tool group that followed it", () => {
    expect(agent(story()).blocks.map((block) => block.kind)).toEqual(["text", "tools", "text", "tools", "text"]);
  });

  test("collapses consecutive calls into one group", () => {
    const blocks = agent(story()).blocks;
    expect(blocks[1]).toMatchObject({ kind: "tools" });
    expect(blocks[1]?.kind === "tools" && blocks[1].tools.map((tool) => tool.name))
      .toEqual(["add_elements", "arrange"]);
  });

  test("keeps every paragraph separate", () => {
    expect(turnText(agent(story()))).toBe(
      "I'll draw the three tiers.\n\nNow the arrows.\n\nThat is the flow.",
    );
  });

  test("updates a tool that finishes after later prose", () => {
    const later = reduceEvent(story(), event({
      kind: "tool-completed", toolId: "t3", toolKind: "add_elements", title: "add_elements",
      status: "completed", outputAppend: '{"ids":["b","c"]}',
    }));
    const tools = turnTools(agent(later));
    expect(tools).toHaveLength(3);
    expect(tools[2]).toMatchObject({ toolId: "t3", status: "completed", ids: ["b", "c"] });
    expect(agent(later).blocks.map((block) => block.kind)).toEqual(["text", "tools", "text", "tools", "text"]);
  });
});

describe("the order a stored transcript reads in", () => {
  const user = (id: string, at: string): Entry => ({ kind: "user", id, at, text: id, selection: [], images: 0 });
  const reply = (id: string, at: string): Entry => ({ kind: "agent", id, at, adapterId: "easel:codex", blocks: [], thinking: "" });
  const ids = (entries: Entry[]) => entries.map((entry) => entry.id);

  test("a reply stamped a moment before its own prompt still follows it", () => {
    const sorted = sortEntries([
      user("ask-1", "2026-09-18T10:00:00.004Z"),
      user("ask-2", "2026-09-18T10:05:00.009Z"),
      reply("reply-1", "2026-09-18T10:00:00.001Z"),
      reply("reply-2", "2026-09-18T10:05:00.002Z"),
    ]);
    expect(ids(sorted)).toEqual(["ask-1", "reply-1", "ask-2", "reply-2"]);
  });

  test("a prompt sent long after a reply began stays after that reply", () => {
    const sorted = sortEntries([
      user("ask-1", "2026-09-18T10:00:00.000Z"),
      reply("reply-1", "2026-09-18T10:00:00.003Z"),
      user("ask-2", "2026-09-18T10:02:00.000Z"),
    ]);
    expect(ids(sorted)).toEqual(["ask-1", "reply-1", "ask-2"]);
  });
});
