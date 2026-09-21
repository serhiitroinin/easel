import { setTimeout as sleep } from "node:timers/promises";
import { capture, outputDir, evaluate, launch, resize, TYPE_AND_SEND, waitFor } from "./drive";

const SHOTS = outputDir();
const [engine = "Claude Code", model = "Sonnet", tag = "claude"] = process.argv.slice(2);

const EXPAND = `(() => {
  document.querySelectorAll(".toolgroup .more").forEach((node) => node.click());
  document.querySelectorAll(".toolrow.failed:not(:disabled)").forEach((node) => node.click());
  return true;
})()`;

const report = async () => ({
  activities: await evaluate<string[]>('[...document.querySelectorAll(".toolrow")].map((node) => node.textContent)'),
  reasons: await evaluate<string[]>('[...document.querySelectorAll(".reason")].map((node) => node.textContent)'),
  text: await evaluate<string>('[...document.querySelectorAll(".turn.agent .prose")].map((node) => node.textContent).join(" ⏎ ")'),
  failures: await evaluate<string[]>('[...document.querySelectorAll(".failure")].map((node) => node.textContent)'),
  elements: await evaluate<number>("window.__easel.api.getSceneElements().length"),
});

const settled = (turns: number) =>
  `document.querySelectorAll(".activityline").length === 0 && document.querySelectorAll(".turn.agent").length >= ${turns}`;

const child = await launch({ EASEL_DATA_DIR: `${process.env.TMPDIR ?? "/tmp"}/easel-live-${tag}-${Date.now()}` });

try {
  await waitFor("the engine control", '!!document.querySelector(".composer .control.lead")');
  await resize(1420, 900);
  await evaluate('document.querySelector(".composer .control.lead").click()');
  await waitFor("the engine marks", `[...document.querySelectorAll(".menu.engines .mark")].some((node) => node.textContent === ${JSON.stringify(engine)})`);
  await evaluate(`[...document.querySelectorAll(".menu.engines .mark")].find((node) => node.textContent === ${JSON.stringify(engine)}).click()`);
  await waitFor(`the ${model} model`, `[...document.querySelectorAll(".menu.engines .row .name")].some((node) => node.textContent === ${JSON.stringify(model)})`);
  await evaluate(`[...document.querySelectorAll(".menu.engines .row .name")].find((node) => node.textContent === ${JSON.stringify(model)}).click()`);
  await sleep(300);
  if (await evaluate<boolean>('!!document.querySelector(".menu.engines")')) await evaluate('document.querySelector(".composer .control.lead").click()');
  console.log("engine:", await evaluate<string>('document.querySelector(".composer .control.lead").textContent'));

  await evaluate(TYPE_AND_SEND("Draw a three tier web architecture with labelled arrows."));
  await waitFor("the first turn", settled(1), 240_000);
  await evaluate(EXPAND);
  await sleep(1000);
  await capture(`${SHOTS}live-${tag}-1.png`);
  console.log("turn 1:", JSON.stringify(await report(), null, 1));

  const ids = await evaluate<string[]>(`(() => {
    const shapes = window.__easel.api.getSceneElements().filter((element) => element.type === "rectangle");
    const chosen = shapes.slice(0, 2).map((element) => element.id);
    window.__easel.api.updateScene({
      appState: { selectedElementIds: Object.fromEntries(chosen.map((id) => [id, true])) },
    });
    return chosen;
  })()`);
  await sleep(800);
  console.log("selected:", ids, "chip:", await evaluate<string>('document.querySelector(".chip")?.textContent ?? "none"'));

  await evaluate(TYPE_AND_SEND("Make these two green and connect them with an arrow."));
  await waitFor("the second turn", settled(2), 240_000);
  await evaluate(EXPAND);
  await sleep(1000);
  await capture(`${SHOTS}live-${tag}-2.png`);
  console.log("turn 2:", JSON.stringify(await report(), null, 1));
} finally {
  child.kill();
}
