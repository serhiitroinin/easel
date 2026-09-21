import { execFileSync } from "node:child_process";
import { mkdtempSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import { capture, evaluate, launch, resize, TYPE_AND_SEND, waitFor } from "./drive";

/**
 * Writes the live pictures into docs/screenshots: one drawing turn on a real
 * engine, captured in both themes. It uses your account, and the drawing
 * differs on each run.
 *
 *   bun run screenshots:live                     Claude Code, Sonnet
 *   bun run screenshots:live "Codex" "GPT-5.5"   another engine and model
 *
 * The engine menu is never captured here. It shows account limits.
 */
const SHOTS = new URL("../docs/screenshots/", import.meta.url).pathname;
const WIDTH = 1420;
const HEIGHT = 900;
const [engine = "Claude Code", model = "Sonnet", tag = "claude"] = process.argv.slice(2);

const settled = 'document.querySelectorAll(".activityline").length === 0';

async function setTheme(want: "light" | "dark"): Promise<void> {
  for (let attempt = 0; attempt < 4; attempt += 1) {
    if (await evaluate<string>("document.documentElement.dataset.theme") === want) return;
    await evaluate('[...document.querySelectorAll(".topbar .icon")].find((node) => node.title.startsWith("Theme")).click()');
    await sleep(300);
  }
  throw new Error(`could not switch to the ${want} theme`);
}

async function rename(title: string): Promise<void> {
  await evaluate(`(() => {
    const field = document.querySelector(".topbar .title");
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
    field.focus();
    setter.call(field, ${JSON.stringify(title)});
    field.dispatchEvent(new Event("input", { bubbles: true }));
    field.blur();
    return true;
  })()`);
  await sleep(500);
}

async function choose(): Promise<void> {
  await evaluate('document.querySelector(".composer .control.lead").click()');
  await waitFor("the engine marks", `[...document.querySelectorAll(".menu.engines .mark")].some((node) => node.textContent === ${JSON.stringify(engine)})`);
  await evaluate(`[...document.querySelectorAll(".menu.engines .mark")].find((node) => node.textContent === ${JSON.stringify(engine)}).click()`);
  await waitFor(`the ${model} model`, `[...document.querySelectorAll(".menu.engines .row .name")].some((node) => node.textContent === ${JSON.stringify(model)})`);
  await evaluate(`[...document.querySelectorAll(".menu.engines .row .name")].find((node) => node.textContent === ${JSON.stringify(model)}).click()`);
  await sleep(300);
  if (await evaluate<boolean>('!!document.querySelector(".menu.engines")')) await evaluate('document.querySelector(".composer .control.lead").click()');
  console.log("engine:", await evaluate<string>('document.querySelector(".composer .control.lead").textContent'));
}

async function shoot(name: string): Promise<void> {
  const path = `${SHOTS}${name}.png`;
  await capture(path, `${WIDTH}x${HEIGHT}`);
  execFileSync("sips", ["--resampleWidth", String(WIDTH), path], { stdio: "ignore" });
  const shrink: [string, string[]][] = [
    ["pngquant", ["--force", "--skip-if-larger", "--quality", "70-95", "--output", path, path]],
    ["magick", [path, "-dither", "None", "-colors", "255", "-define", "png:compression-level=9", `PNG8:${path}`]],
  ];
  for (const [command, args] of shrink) {
    try {
      execFileSync(command, args, { stdio: "ignore" });
      break;
    } catch {
      // The tool is not installed. Without either tool the picture is larger.
    }
  }
  console.log(`${name}.png ${Math.round(statSync(path).size / 1024)} KB`);
}

const child = await launch({ EASEL_DATA_DIR: mkdtempSync(join(tmpdir(), "easel-live-shots-")) });

try {
  await waitFor("the composer", '!!document.querySelector(".composer textarea")');
  await resize(WIDTH, HEIGHT);
  await sleep(800);
  await setTheme("dark");
  await rename("Photo app architecture");
  await choose();

  await evaluate(TYPE_AND_SEND("Draw a three tier web architecture with labelled arrows"));
  await waitFor("the turn to start", 'document.querySelectorAll(".activityline").length > 0');
  await waitFor("the turn to settle", settled, 300_000);
  await evaluate('document.querySelectorAll(".toolgroup .more").forEach((node) => node.click()); true');
  // The board fits the drawing after a turn. A small drawing is fitted again, closer.
  await evaluate('window.__easel.api.scrollToContent(window.__easel.api.getSceneElements(), { fitToViewport: true, viewportZoomFactor: 0.8, animate: false }); true');
  await sleep(1600);
  await shoot(`live-${tag}-dark`);

  await setTheme("light");
  await sleep(600);
  await shoot(`live-${tag}-light`);
  console.log("live screenshots written");
} finally {
  child.kill();
}
