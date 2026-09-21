import { useEffect, useState } from "react";
import type { BoardSummary } from "../../shared/app";
import { PanelLeft, Pencil, Plus, Trash } from "../icons";
import { relativeTime } from "./time";

interface Props {
  boards: BoardSummary[];
  activeId: string;
  onOpen(id: string): void;
  onCreate(): void;
  onRename(id: string, title: string): void;
  onDelete(id: string): void;
  onCollapse(): void;
  onResize(event: React.PointerEvent<HTMLDivElement>): void;
}

function Rename({ board, onDone }: { board: BoardSummary; onDone(title: string | null): void }) {
  const [title, setTitle] = useState(board.title);
  return (
    <input
      className="rename"
      value={title}
      autoFocus
      aria-label={`Rename ${board.title}`}
      onFocus={(event) => event.currentTarget.select()}
      onChange={(event) => setTitle(event.target.value)}
      onBlur={() => onDone(title)}
      onKeyDown={(event) => {
        if (event.key === "Enter") event.currentTarget.blur();
        if (event.key === "Escape") {
          event.stopPropagation();
          onDone(null);
        }
      }}
    />
  );
}

export function Sidebar(props: Props) {
  const { boards, activeId } = props;
  const [renaming, setRenaming] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => setNow(Date.now()), [boards]);

  return (
    <nav className="sidebar" aria-label="Boards">
      <header className="sidebar-head">
        <button type="button" className="icon on" onClick={props.onCollapse} title="Hide boards (⌘B)" aria-label="Hide boards">
          <PanelLeft />
        </button>
        <span className="drag" />
        <button type="button" className="icon new" onClick={props.onCreate} title="New board" aria-label="New board">
          <Plus />
        </button>
      </header>

      <p className="sidebar-label">Boards</p>
      <ul className="boardlist">
        {boards.map((board) => {
          const active = board.id === activeId;
          if (renaming === board.id) {
            return (
              <li key={board.id} className={active ? "boardrow on editing" : "boardrow editing"}>
                <Rename
                  board={board}
                  onDone={(title) => {
                    setRenaming(null);
                    const next = title?.trim() ?? "";
                    if (next !== "" && next !== board.title) props.onRename(board.id, next);
                  }}
                />
              </li>
            );
          }
          return (
            <li key={board.id} className={active ? "boardrow on" : "boardrow"}>
              <button
                type="button"
                className="pick"
                aria-current={active ? "page" : undefined}
                title={board.title}
                onClick={() => props.onOpen(board.id)}
                onDoubleClick={() => setRenaming(board.id)}
              >
                <span className="name">{board.title}</span>
                <span className="when">{relativeTime(board.updatedAt, now)}</span>
              </button>
              <span className="acts">
                <button type="button" aria-label={`Rename ${board.title}`} title="Rename" onClick={() => setRenaming(board.id)}>
                  <Pencil />
                </button>
                <button
                  type="button"
                  className="drop"
                  aria-label={`Delete ${board.title}`}
                  title="Delete"
                  onClick={() => {
                    if (confirm(`Delete “${board.title}”? The board and its chat are removed.`)) props.onDelete(board.id);
                  }}
                >
                  <Trash />
                </button>
              </span>
            </li>
          );
        })}
      </ul>

      <div className="grip" onPointerDown={props.onResize} role="separator" aria-label="Resize the boards list" />
    </nav>
  );
}
