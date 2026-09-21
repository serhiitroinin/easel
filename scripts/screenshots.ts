import { execFileSync } from "node:child_process";
import { mkdtempSync, readdirSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import { capture, evaluate, launch, resize, TYPE_AND_SEND, waitFor } from "./drive";

/**
 * Writes the README screenshots into docs/screenshots. The offline engine draws
 * every board, so the pictures are repeatable and show no account data.
 *
 * Each picture is captured at 2x and then scaled to the window size.
 */
const SHOTS = new URL("../docs/screenshots/", import.meta.url).pathname;
const WIDTH = 1420;
const HEIGHT = 900;

const settled = 'document.querySelectorAll(".activityline").length === 0';

async function setTheme(want: "light" | "dark"): Promise<void> {
  for (let attempt = 0; attempt < 4; attempt += 1) {
    if (await evaluate<string>("document.documentElement.dataset.theme") === want) return;
    await evaluate('[...document.querySelectorAll(".topbar .icon")].find((node) => node.title.startsWith("Theme")).click()');
    await sleep(300);
  }
  throw new Error(`could not switch to the ${want} theme`);
}

async function newBoard(title: string): Promise<void> {
  await evaluate('document.querySelector(".sidebar .new").click()');
  await sleep(700);
  await rename(title);
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

async function draw(prompt: string): Promise<void> {
  await evaluate(TYPE_AND_SEND(prompt));
  await waitFor("the turn to start", 'document.querySelectorAll(".activityline").length > 0');
  await waitFor("the turn to settle", settled, 120_000);
  // The board fits itself to the drawing, and the outline of new elements fades.
  await sleep(1600);
}

async function shoot(name: string): Promise<void> {
  const path = `${SHOTS}${name}.png`;
  await capture(path, `${WIDTH}x${HEIGHT}`);
  execFileSync("sips", ["--resampleWidth", String(WIDTH), path], { stdio: "ignore" });
  // A palette keeps each picture small. The interface has few colours, so little is lost.
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

for (const name of readdirSync(SHOTS)) {
  if (name.endsWith(".png")) rmSync(join(SHOTS, name));
}

const child = await launch({ EASEL_OFFLINE: "1", EASEL_DATA_DIR: mkdtempSync(join(tmpdir(), "easel-screenshots-")) });

try {
  await waitFor("the composer", '!!document.querySelector(".composer textarea")');
  await resize(WIDTH, HEIGHT);
  await sleep(800);
  await setTheme("light");

  await rename("Photo upload flow");
  await evaluate(TYPE_AND_SEND("Draw the flow for a photo upload"));
  await waitFor("the agent pen", 'document.querySelectorAll(".pen rect").length > 0 && document.querySelectorAll(".activityline").length > 0');
  await evaluate(TYPE_AND_SEND("Make the three boxes green"));
  await waitFor("the recolour", '[...document.querySelectorAll(".toolrow")].length >= 4');
  await sleep(250);
  await shoot("steering");
  await waitFor("the turn to settle", settled, 120_000);

  await newBoard("Self-attention explainer");
  await draw("Explain how attention works in a transformer");
  await shoot("attention-explainer");

  await newBoard("Onboarding journey");
  await evaluate('document.querySelector(".composer .control.lead").click()');
  await sleep(600);
  await shoot("engine-menu");
  await evaluate('document.querySelector(".composer .control.lead").click()');
  await sleep(300);

  await newBoard("Photo app architecture");
  await draw("Sketch a system architecture for a photo sharing app");
  await shoot("hero-light");

  await setTheme("dark");
  await sleep(600);
  await shoot("hero-dark");
  console.log("screenshots written");
} finally {
  child.kill();
}
