import { useEffect, useState } from "react";
import type { Board } from "../shared/app";
import { PanelLeft, PanelRight } from "./icons";
import type { ThemeChoice } from "./useTheme";

interface Props {
  board: Board;
  sidebarOpen: boolean;
  panelOpen: boolean;
  themeChoice: ThemeChoice;
  onRename(title: string): void;
  onSidebar(open: boolean): void;
  onPanel(open: boolean): void;
  onTheme(choice: ThemeChoice): void;
}

const NEXT_THEME: Record<ThemeChoice, ThemeChoice> = { system: "light", light: "dark", dark: "system" };

export function TopBar(props: Props) {
  const { board, sidebarOpen, panelOpen, themeChoice } = props;
  const [title, setTitle] = useState(board.title);

  useEffect(() => setTitle(board.title), [board.id, board.title]);

  return (
    <header className="topbar">
      {!sidebarOpen && (
        <button type="button" className="icon" onClick={() => props.onSidebar(true)} title="Show boards (⌘B)" aria-label="Show boards">
          <PanelLeft />
        </button>
      )}

      {/* The box takes the width of its mirrored text, so the input is as wide as the title. */}
      <span className="titlebox" data-value={title === "" ? " " : title}>
        <input
          className="title"
          size={1}
          value={title}
          aria-label="Board title"
          onChange={(event) => setTitle(event.target.value)}
          onBlur={() => {
            const next = title.trim();
            if (next === "") setTitle(board.title);
            else if (next !== board.title) props.onRename(next);
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") event.currentTarget.blur();
          }}
        />
      </span>

      <span className="drag" />

      <button
        type="button"
        className="icon"
        onClick={() => props.onTheme(NEXT_THEME[themeChoice])}
        title={`Theme: ${themeChoice}`}
        aria-label={`Theme: ${themeChoice}`}
      >
        <span className="themedot" data-choice={themeChoice} />
      </button>
      <button
        type="button"
        className={panelOpen ? "icon on" : "icon"}
        onClick={() => props.onPanel(!panelOpen)}
        title="Chat (⌘\\)"
        aria-label="Chat"
      >
        <PanelRight />
      </button>
    </header>
  );
}
