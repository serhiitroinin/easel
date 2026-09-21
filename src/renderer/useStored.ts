import { useEffect, useState } from "react";

type Update<T> = T | ((current: T) => T);

/** Layout the person chose survives a restart. A stored value that fails `valid` is ignored. */
export function useStored<T>(
  key: string,
  fallback: T,
  valid: (value: unknown) => value is T,
): [T, (next: Update<T>) => void] {
  const [value, setValue] = useState<T>(() => {
    try {
      const parsed: unknown = JSON.parse(window.localStorage.getItem(key) ?? "null");
      return valid(parsed) ? parsed : fallback;
    } catch {
      return fallback;
    }
  });

  useEffect(() => {
    window.localStorage.setItem(key, JSON.stringify(value));
  }, [key, value]);

  return [value, setValue];
}

export const isBoolean = (value: unknown): value is boolean => typeof value === "boolean";

export const isWidth = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value) && value > 0;
