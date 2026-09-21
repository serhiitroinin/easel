import { setTimeout as sleep } from "node:timers/promises";
import { capture, outputDir, evaluate, launch, resize, TYPE_AND_SEND, waitFor } from "./drive";

const SHOTS = outputDir();
const PROMPT = "Draw one rectangle labelled Hi. Then stop.";

const OPEN_MENU = 'document.querySelector(".composer .control.lead").click()';
const menuOpen = '!!document.querySelector(".menu.engines")';
const click = (selector: string, label: string) =>
  `[...document.querySelectorAll(${JSON.stringify(selector)})].find((node) => node.textContent === ${JSON.stringify(label)}).click()`;

const menu = () => evaluate<Record<string, unknown>>(`({
  models: [...document.querySelectorAll(".menu.engines .row")].map((node) => node.textContent),
  effort: document.querySelector('.composer .control[data-control="effort"]')?.getAttribute("aria-label") ?? null,
  settingsInMenu: document.querySelectorAll(".menu.engines .segmented, .menu.engines .setting").length,
  limits: [...document.querySelectorAll(".menu.engines .limitline .meterline, .menu.engines p.limitline")].map((node) => node.textContent),
  plan: document.querySelector(".menu.engines .plan")?.textContent ?? null,
})`);

const settled = (turns: number) =>
  `document.querySelectorAll(".activityline").length === 0 && document.querySelectorAll(".turn.agent").length >= ${turns}`;

async function turn(engine: string, model: string, tag: string, turns: number): Promise<void> {
  if (!await evaluate<boolean>(menuOpen)) await evaluate(OPEN_MENU);
  await sleep(400);
  await evaluate(click(".mark", engine));
  await waitFor(`${engine} models`, `[...document.querySelectorAll(".menu.engines .row .name")].some((node) => node.textContent === ${JSON.stringify(model)})`);
  console.log(`${tag} before the turn:`, JSON.stringify(await menu(), null, 1));
  await capture(`${SHOTS}${tag}-models.png`);
  await evaluate(click(".menu.engines .row .name", model));
  await sleep(300);
  await evaluate(OPEN_MENU);
  await evaluate(TYPE_AND_SEND(PROMPT));
  await waitFor(`the ${engine} turn`, settled(turns), 240_000);
  await sleep(4000);
  await evaluate(OPEN_MENU);
  await sleep(2500);
  console.log(`${tag} after the turn:`, JSON.stringify(await menu(), null, 1));
  console.log(`${tag} failures:`, await evaluate<string[]>('[...document.querySelectorAll(".failure")].map((node) => node.textContent)'));
  await capture(`${SHOTS}${tag}-limits-after-turn.png`);
}

const child = await launch({ EASEL_DATA_DIR: `${process.env.TMPDIR ?? "/tmp"}/easel-discovery-${Date.now()}` });

try {
  await waitFor("the model picker", '!!document.querySelector(".composer .control.lead")');
  await resize(1420, 900);
  await waitFor("live discovery", 'document.querySelector(".composer .control.lead").textContent !== "No engine"', 40_000);
  console.log("picker:", await evaluate<string>('document.querySelector(".composer .control.lead").textContent'));
  await evaluate(OPEN_MENU);
  await sleep(600);
  await evaluate(click(".menu.engines .row .name", "Sonnet"));
  await sleep(400);
  await capture(`${SHOTS}01-claude-models-effort.png`);
  console.log("claude with Sonnet chosen:", JSON.stringify(await menu(), null, 1));
  await turn("Claude Code", "Haiku", "02-claude", 1);
  await turn("Codex", process.argv[2] ?? "GPT-5.5", "03-codex", 2);
} finally {
  child.kill();
}
