import { expect, test } from "bun:test";
import { relativeTime } from "../src/renderer/sidebar/time";

const NOW = Date.parse("2026-09-18T12:00:00.000Z");
const ago = (ms: number) => new Date(NOW - ms).toISOString();

test("a board's age is written in the fewest characters", () => {
  expect(relativeTime(ago(20_000), NOW)).toBe("now");
  expect(relativeTime(ago(5 * 60_000), NOW)).toBe("5m");
  expect(relativeTime(ago(3 * 3_600_000), NOW)).toBe("3h");
  expect(relativeTime(ago(2 * 86_400_000), NOW)).toBe("2d");
});

test("an older board shows its date, with the year once it differs", () => {
  expect(relativeTime("2026-09-03T12:00:00.000Z", NOW)).toBe("Sep 3");
  expect(relativeTime("2025-03-09T12:00:00.000Z", NOW)).toBe("Mar 9, 2025");
});

test("a clock that runs behind or a broken stamp never shows a negative age", () => {
  expect(relativeTime(ago(-60_000), NOW)).toBe("now");
  expect(relativeTime("not a date", NOW)).toBe("");
});
