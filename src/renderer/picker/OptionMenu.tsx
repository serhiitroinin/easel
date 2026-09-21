import { useEffect, useLayoutEffect, useRef, type KeyboardEvent } from "react";
import { Check } from "../icons";

export interface Option {
  id: string;
  label: string;
  /** Said on hover, so every row stays one line high. */
  description?: string;
  /** A quiet word at the row's end. */
  hint?: string;
  disabled?: boolean;
}

interface Props {
  label: string;
  options: readonly Option[];
  value: string;
  /** Finds the footer button that opened the menu; the menu's left edge follows it. */
  anchor(): HTMLElement | null;
  onPick(id: string): void;
}

/**
 * One discovered setting as a short menu: the footer's effort and select
 * controls. The composer that opens it also closes it, on Escape or a click elsewhere.
 */
export function OptionMenu({ label, options, value, anchor, onPick }: Props) {
  const menu = useRef<HTMLDivElement>(null);

  // Under its button while there is room, else as far right as the composer allows.
  useLayoutEffect(() => {
    const node = menu.current;
    const frame = node?.offsetParent;
    const button = anchor();
    if (!node || !frame || !button) return;
    const place = () => {
      const wanted = button.getBoundingClientRect().left - frame.getBoundingClientRect().left - frame.clientLeft;
      const furthest = frame.clientWidth - node.offsetWidth + 1;
      node.style.left = `${Math.max(-1, Math.min(wanted, furthest))}px`;
    };
    place();
    const watcher = new ResizeObserver(place);
    watcher.observe(frame);
    return () => watcher.disconnect();
    // Placed once per opening: a menu belongs to the one button that opened it.
  }, []);

  useEffect(() => {
    const rows = menu.current?.querySelectorAll<HTMLButtonElement>(".row:not(:disabled)");
    const chosen = menu.current?.querySelector<HTMLButtonElement>(".row.on:not(:disabled)");
    (chosen ?? rows?.[0])?.focus();
  }, []);

  const keys = (event: KeyboardEvent<HTMLDivElement>) => {
    const rows = [...(menu.current?.querySelectorAll<HTMLButtonElement>(".row:not(:disabled)") ?? [])];
    if (rows.length === 0) return;
    const at = rows.indexOf(document.activeElement as HTMLButtonElement);
    const to = event.key === "ArrowDown" ? (at + 1) % rows.length
      : event.key === "ArrowUp" ? (at - 1 + rows.length) % rows.length
      : event.key === "Home" ? 0
      : event.key === "End" ? rows.length - 1
      : null;
    if (to === null) return;
    event.preventDefault();
    rows[to]?.focus();
  };

  return (
    <div ref={menu} className="menu options" role="menu" aria-label={label} onKeyDown={keys}>
      <p className="heading">{label}</p>
      <div className="rows">
        {options.map((option) => (
          <button
            key={option.id}
            type="button"
            role="menuitemradio"
            aria-checked={option.id === value}
            className={option.id === value ? "row on" : "row"}
            disabled={option.disabled === true}
            title={option.description}
            tabIndex={option.id === value ? 0 : -1}
            onClick={() => onPick(option.id)}
          >
            <span className="tick">{option.id === value && <Check />}</span>
            <span className="name">{option.label}</span>
            {option.hint && <span className="hint">{option.hint}</span>}
          </button>
        ))}
      </div>
    </div>
  );
}
