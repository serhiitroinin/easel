export interface Frame {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

interface Props {
  frames: Frame[];
  active: boolean;
}

/**
 * The agent's presence: one vermilion cursor that glides to the element it
 * just drew, and an outline around everything it touched this turn.
 */
export function AgentPen({ frames, active }: Props) {
  const last = frames.at(-1);
  return (
    <div className="pen" aria-hidden="true">
      <svg className="outlines">
        {frames.map((frame) => (
          <rect key={frame.id} x={frame.x} y={frame.y} width={frame.width} height={frame.height} rx={8} />
        ))}
      </svg>
      {last && active && (
        <div
          className="cursor"
          style={{ transform: `translate(${Math.round(last.x + last.width / 2)}px, ${Math.round(last.y + last.height / 2)}px)` }}
        >
          <svg viewBox="0 0 12 14" width="12" height="14" focusable="false">
            <path d="M1 1l9.2 5.1-4 .9-1.5 3.9z" />
          </svg>
          <span>Agent</span>
        </div>
      )}
    </div>
  );
}
