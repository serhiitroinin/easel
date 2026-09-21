import { useEffect, useRef, useState, type ReactElement, type SVGProps } from "react";
import {
  Align, Ban, Check, ChevronDown, ChevronRight, Cross, Eye, Pencil, Rows, ShapePlus, Target, Trash, Wrench,
} from "../icons";
import { Markdown } from "./Markdown";
import {
  toolFailed, toolLabel,
  type AgentEntry, type Entry, type ToolActivity, type UserEntry,
} from "./turns";

interface Props {
  entries: Entry[];
  onHighlight(ids: string[]): void;
  onFocus(ids: string[]): void;
}

const VISIBLE_ROWS = 3;
const COLLAPSE_ABOVE = 4;

/** What a call did, as a picture. How it went is a separate mark at the end of the row. */
const TOOL_ICONS: Record<string, (props: SVGProps<SVGSVGElement>) => ReactElement> = {
  get_scene: Rows,
  view_canvas: Eye,
  add_elements: ShapePlus,
  update_elements: Pencil,
  delete_elements: Trash,
  arrange: Align,
  focus: Target,
};

function ToolStatus({ status }: { status: ToolActivity["status"] }) {
  if (status === "running") return <span className="status"><span className="spin" /></span>;
  if (status === "completed") return <span className="status done" title="Done"><Check /></span>;
  if (status === "failed") return <span className="status failed" title="Failed"><Cross /></span>;
  return (
    <span className="status refused" title={status === "declined" ? "Refused" : "Cancelled"}><Ban /></span>
  );
}

function usageLine(entry: AgentEntry): string | null {
  const usage = entry.usage;
  if (!usage) return null;
  const parts: string[] = [];
  if (usage.totalTokens !== undefined) parts.push(`${usage.totalTokens.toLocaleString()} tokens`);
  else if (usage.outputTokens !== undefined) parts.push(`${usage.outputTokens.toLocaleString()} out`);
  if (usage.durationMs !== undefined) parts.push(`${Math.round(usage.durationMs / 100) / 10}s`);
  return parts.length > 0 ? parts.join(" · ") : null;
}

function thoughtFor(entry: AgentEntry): string {
  if (!entry.thinkingFrom || !entry.thinkingTo) return "Thinking";
  const seconds = Math.max(1, Math.round((Date.parse(entry.thinkingTo) - Date.parse(entry.thinkingFrom)) / 1000));
  return `Thought for ${seconds}s`;
}

function ToolRow({ tool, onHighlight, onFocus }: {
  tool: ToolActivity;
  onHighlight(ids: string[]): void;
  onFocus(ids: string[]): void;
}) {
  const [open, setOpen] = useState(false);
  const failed = toolFailed(tool.status);
  const reason = tool.error ?? tool.hostError;
  const Icon = TOOL_ICONS[tool.name] ?? Wrench;
  return (
    <div className="toolline">
      <button
        type="button"
        className={`toolrow ${tool.status}`}
        data-tool={tool.name}
        onMouseEnter={() => onHighlight(tool.ids)}
        onMouseLeave={() => onHighlight([])}
        onClick={() => (failed ? setOpen(!open) : onFocus(tool.ids))}
        disabled={failed ? reason === undefined : tool.ids.length === 0}
      >
        <Icon className="glyph" />
        <span className="say">{toolLabel(tool.name, tool.ids, tool.status)}</span>
        <ToolStatus status={tool.status} />
        {failed && reason !== undefined && <span className="why">{open ? "hide" : "why"}</span>}
      </button>
      {open && reason !== undefined && <pre className="reason">{reason}</pre>}
    </div>
  );
}

function ToolGroup({ tools, onHighlight, onFocus }: {
  tools: ToolActivity[];
  onHighlight(ids: string[]): void;
  onFocus(ids: string[]): void;
}) {
  const [open, setOpen] = useState(false);
  const hidden = tools.length > COLLAPSE_ABOVE ? tools.length - VISIBLE_ROWS : 0;
  const shown = open || hidden <= 0 ? tools : tools.slice(0, VISIBLE_ROWS);
  return (
    <div className="toolgroup">
      {shown.map((tool) => (
        <ToolRow key={tool.toolId} tool={tool} onHighlight={onHighlight} onFocus={onFocus} />
      ))}
      {hidden > 0 && (
        <button type="button" className="more" onClick={() => setOpen(!open)} aria-expanded={open}>
          {open ? <ChevronDown /> : <ChevronRight />}
          {open ? "Fewer steps" : `${hidden} more step${hidden === 1 ? "" : "s"}`}
        </button>
      )}
    </div>
  );
}

function Thinking({ entry }: { entry: AgentEntry }) {
  const [open, setOpen] = useState(false);
  if (entry.thinking.trim() === "") return null;
  return (
    <div className="thinking">
      <button type="button" onClick={() => setOpen(!open)} aria-expanded={open}>
        {open ? <ChevronDown /> : <ChevronRight />}
        {thoughtFor(entry)}
      </button>
      {open && <pre>{entry.thinking}</pre>}
    </div>
  );
}

function User({ entry }: { entry: UserEntry }) {
  return (
    <li className="turn user">
      <div className="bubble">
        <p>{entry.text}</p>
        {(entry.selection.length > 0 || entry.images > 0) && (
          <p className="carried">
            {entry.selection.length > 0 && `◇ ${entry.selection.length} element${entry.selection.length === 1 ? "" : "s"}`}
            {entry.selection.length > 0 && entry.images > 0 && "   "}
            {entry.images > 0 && `${entry.images} image${entry.images === 1 ? "" : "s"}`}
          </p>
        )}
      </div>
    </li>
  );
}

function Agent({ entry, onHighlight, onFocus }: {
  entry: AgentEntry;
  onHighlight(ids: string[]): void;
  onFocus(ids: string[]): void;
}) {
  const usage = usageLine(entry);
  return (
    <li className="turn agent">
      <Thinking entry={entry} />
      {entry.blocks.map((block, index) => (block.kind === "tools"
        ? <ToolGroup key={index} tools={block.tools} onHighlight={onHighlight} onFocus={onFocus} />
        : <Markdown key={index} text={block.text} />))}
      {entry.error && <p className="failure">{entry.error}</p>}
      {entry.status === "interrupted" && <p className="quiet">Stopped.</p>}
      {usage && <p className="usage">{usage}</p>}
    </li>
  );
}

export function Chat({ entries, onHighlight, onFocus }: Props) {
  const scroller = useRef<HTMLDivElement>(null);
  const latched = useRef(true);

  useEffect(() => {
    const node = scroller.current;
    if (node && latched.current) node.scrollTop = node.scrollHeight;
  });

  if (entries.length === 0) return <div className="chat empty" />;

  return (
    <div
      className="chat"
      ref={scroller}
      onScroll={(event) => {
        const node = event.currentTarget;
        latched.current = node.scrollHeight - node.scrollTop - node.clientHeight < 40;
      }}
    >
      <ul>
        {entries.map((entry) => (entry.kind === "user"
          ? <User key={entry.id} entry={entry} />
          : <Agent key={entry.id} entry={entry} onHighlight={onHighlight} onFocus={onFocus} />))}
      </ul>
    </div>
  );
}
