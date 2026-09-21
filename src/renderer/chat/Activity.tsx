import { useEffect, useState } from "react";
import { Stop } from "../icons";

interface Props {
  label: string;
  startedAt: number;
  onStop(): void;
}

/** Status lives in one place: this line, above the composer, while a turn runs. */
export function Activity({ label, startedAt, onStop }: Props) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const seconds = Math.max(0, Math.round((now - startedAt) / 1000));
  return (
    <div className="activityline">
      <span className="pulse" aria-hidden="true" />
      <span className="what">{label}</span>
      <span className="elapsed">{seconds}s</span>
      <button type="button" className="stop" onClick={onStop} title="Stop (Esc)">
        <Stop />
        <span>Stop</span>
      </button>
    </div>
  );
}
