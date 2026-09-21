import { Return } from "../icons";

interface Props {
  suggestions: string[];
  onSuggest(text: string): void;
}

/** The empty state teaches on the sheet itself, where the work will appear. */
export function EmptyBoard({ suggestions, onSuggest }: Props) {
  return (
    <div className="emptyboard">
      <div className="welcome">
        <h1>Draw with someone who can <em>see</em> it.</h1>
        <ul>
          {suggestions.map((suggestion) => (
            <li key={suggestion}>
              <button type="button" onClick={() => onSuggest(suggestion)}>
                <span>{suggestion}</span>
                <Return />
              </button>
            </li>
          ))}
        </ul>
        <p className="teach">Select shapes to talk about them. <kbd>⌘K</kbd> picks the engine.</p>
      </div>
    </div>
  );
}
