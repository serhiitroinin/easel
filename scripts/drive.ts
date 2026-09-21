import { execFileSync, spawn, type ChildProcess } from "node:child_process";
import { randomBytes } from "node:crypto";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";

const PORT = Number(process.env.EASEL_CONTROL_PORT ?? 39217);
const BASE = `http://127.0.0.1:${PORT}`;
const TOKEN = process.env.EASEL_CONTROL_TOKEN ?? randomBytes(24).toString("hex");
const AUTH = { "x-easel-control-token": TOKEN };

/** Check scripts write their captures here, never into the repository. */
export function outputDir(): string {
  return `${process.env.EASEL_SHOTS_DIR ?? mkdtempSync(join(tmpdir(), "easel-captures-"))}/`;
}

export async function evaluate<T>(code: string): Promise<T> {
  const response = await fetch(`${BASE}/eval`, { method: "POST", body: code, headers: AUTH });
  const payload = await response.json() as { value?: T; error?: string };
  if (payload.error) throw new Error(payload.error);
  return payload.value as T;
}

export async function resize(width: number, height: number): Promise<number[]> {
  const response = await fetch(`${BASE}/size?width=${width}&height=${height}`, { headers: AUTH });
  return await response.json() as number[];
}

async function pngSize(path: string): Promise<string> {
  const bytes = new DataView((await Bun.file(path).arrayBuffer()));
  return `${bytes.getUint32(16)}x${bytes.getUint32(20)}`;
}

/** A tiling window manager fights setContentSize, so the capture is retried. */
export async function capture(path: string, size = "1420x900"): Promise<void> {
  const [width, height] = size.split("x");
  const want = `${Number(width) * 2}x${Number(height) * 2}`;
  // Two painted frames, so the capture never holds the state before the last click.
  await evaluate("new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(() => done(true))))");
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const response = await fetch(`${BASE}/capture?path=${encodeURIComponent(path)}&width=${width}&height=${height}`, { headers: AUTH });
    if (!response.ok) throw new Error(await response.text());
    if (await pngSize(path) === want) return;
    floatWindow();
    await sleep(400);
  }
  throw new Error(`${path} could not be captured at ${size}`);
}

export async function waitFor<T>(what: string, code: string, ms = 30_000): Promise<T> {
  const until = Date.now() + ms;
  for (;;) {
    const value = await evaluate<T>(code).catch(() => undefined);
    if (value) return value;
    if (Date.now() > until) throw new Error(`Timed out waiting for ${what}`);
    await sleep(250);
  }
}

export async function launch(extra: Record<string, string> = {}): Promise<ChildProcess> {
  const env: Record<string, string | undefined> = { ...process.env, EASEL_CONTROL_PORT: String(PORT), EASEL_CONTROL_TOKEN: TOKEN, ...extra };
  // An inherited ELECTRON_RUN_AS_NODE turns the Electron binary into plain Node.
  delete env.ELECTRON_RUN_AS_NODE;
  const child = spawn("bunx", ["--bun", "electron", "."], {
    cwd: new URL("..", import.meta.url).pathname,
    env,
    stdio: ["ignore", "inherit", "inherit"],
  });
  const until = Date.now() + 40_000;
  for (;;) {
    const alive = await fetch(`${BASE}/eval`, { method: "POST", body: "1", headers: AUTH }).then((response) => response.ok).catch(() => false);
    if (alive) {
      await sleep(1500);
      floatWindow();
      return child;
    }
    if (Date.now() > until) {
      child.kill();
      throw new Error("Easel did not open its control port.");
    }
    await sleep(300);
  }
}

/**
 * AeroSpace tiles new windows, which would resize every screenshot. Only the
 * window of the process that owns the control port is floated.
 */
function floatWindow(): void {
  try {
    const pid = execFileSync("lsof", ["-ti", `tcp:${PORT}`, "-sTCP:LISTEN"], { encoding: "utf8" }).trim().split("\n")[0];
    const windows = execFileSync("aerospace", ["list-windows", "--all", "--format", "%{window-id} %{app-pid}"], { encoding: "utf8" });
    for (const line of windows.trim().split("\n")) {
      const [windowId, appPid] = line.trim().split(/\s+/);
      if (appPid !== pid || !windowId) continue;
      try {
        execFileSync("aerospace", ["layout", "floating", "--window-id", windowId], { stdio: "ignore" });
      } catch {
        // An older AeroSpace floats only the focused window.
        execFileSync("aerospace", ["focus", "--window-id", windowId], { stdio: "ignore" });
        execFileSync("aerospace", ["layout", "floating"], { stdio: "ignore" });
      }
    }
  } catch {
    // No tiling window manager here; the window keeps the size Electron gives it.
  }
}

export const TYPE_AND_SEND = (text: string) => `(() => {
  const field = document.querySelector(".composer textarea");
  const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value").set;
  setter.call(field, ${JSON.stringify(text)});
  field.dispatchEvent(new Event("input", { bubbles: true }));
  document.querySelector(".composer .go").click();
  return true;
})()`;

/** Drags the chat panel's edge until the panel is `width` wide, as a person would. */
export const SET_PANEL_WIDTH = (width: number) => `(() => {
  const grip = document.querySelector(".panel .grip");
  grip.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, clientX: 0, pointerId: 1 }));
  window.dispatchEvent(new PointerEvent("pointermove", { clientX: window.innerWidth - ${width} }));
  window.dispatchEvent(new PointerEvent("pointerup", {}));
  return true;
})()`;

export interface ComposerFit {
  panel: number;
  clipped: string[];
  sendVisible: boolean;
}

/**
 * Everything in the composer's footer must lie inside the composer, and the
 * composer inside the window. Anything that does not is named.
 */
export const COMPOSER_FIT = `(() => {
  const box = document.querySelector(".composer").getBoundingClientRect();
  const inside = (rect) => rect.width > 0 && rect.left >= box.left - 0.5 && rect.right <= box.right + 0.5
    && rect.top >= box.top - 0.5 && rect.bottom <= box.bottom + 0.5;
  const clipped = [...document.querySelectorAll(".composer .footer button")]
    .filter((node) => !inside(node.getBoundingClientRect()))
    .map((node) => node.getAttribute("aria-label") || node.className);
  if (box.right > window.innerWidth || box.bottom > window.innerHeight) clipped.push("composer");
  const footer = document.querySelector(".composer .footer");
  if (footer.scrollWidth > footer.clientWidth + 1) clipped.push("footer overflows");
  const send = document.querySelector(".composer .go");
  return {
    panel: Math.round(document.querySelector(".panel").getBoundingClientRect().width),
    clipped,
    sendVisible: !!send && inside(send.getBoundingClientRect()),
  };
})()`;
