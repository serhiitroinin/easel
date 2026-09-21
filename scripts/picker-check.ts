import { setTimeout as sleep } from "node:timers/promises";
import { capture, outputDir, evaluate, launch, resize, waitFor } from "./drive";

const SHOTS = outputDir();
const child = await launch({ EASEL_DATA_DIR: `${process.env.TMPDIR ?? "/tmp"}/easel-picker-${Date.now()}` });

try {
  await waitFor("the model picker", '!!document.querySelector(".composer .control.lead")');
  await resize(1420, 900);
  await sleep(900);
  if (await evaluate<boolean>('!!document.querySelector(".topbar .control, .topbar .pill")')) {
    throw new Error("The top bar still offers an engine picker; the composer is the one place for it.");
  }
  console.log("picker:", await evaluate<string>('document.querySelector(".composer .control.lead").textContent'));
  await evaluate('document.querySelector(".composer .control.lead").click()');
  await sleep(600);
  const shown = await evaluate<Record<string, string[]>>(`({
    engines: [...document.querySelectorAll(".mark")].map((node) => node.textContent),
    models: [...document.querySelectorAll(".menu.engines .row .name")].map((node) => node.textContent),
    fields: [...document.querySelectorAll(".menu.engines .key")].map((node) => node.textContent),
    notes: [...document.querySelectorAll(".menu.engines .limitline, .menu.engines .plain")].map((node) => node.textContent),
    footer: [...document.querySelectorAll(".composer .control")].map((node) => node.getAttribute("aria-label")),
  })`);
  console.log(JSON.stringify(shown, null, 1));
  await capture(`${SHOTS}04-picker-claude.png`);

  await evaluate('[...document.querySelectorAll(".mark")].find((node) => node.textContent === "Codex").click()');
  await sleep(1200);
  console.log("codex:", JSON.stringify(await evaluate(`({
    models: [...document.querySelectorAll(".menu.engines .row .name")].map((node) => node.textContent),
    fields: [...document.querySelectorAll(".menu.engines .key")].map((node) => node.textContent),
    notes: [...document.querySelectorAll(".menu.engines .limitline, .menu.engines .plain")].map((node) => node.textContent),
    footer: [...document.querySelectorAll(".composer .control")].map((node) => node.getAttribute("aria-label")),
    picker: document.querySelector(".composer .control.lead").textContent,
  })`)));
  await capture(`${SHOTS}05-picker-codex.png`);
} finally {
  child.kill();
}
