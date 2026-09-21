import { setTimeout as sleep } from "node:timers/promises";
import {
  capture, outputDir, COMPOSER_FIT, evaluate, launch, resize, SET_PANEL_WIDTH, TYPE_AND_SEND, waitFor, type ComposerFit,
} from "./drive";

/**
 * The shell's screenshots: sidebar open and collapsed, the composer at the
 * narrowest panel, the model menu, and a turn with every kind of tool row.
 * `bun scripts/layout-check.ts live` uses the real engines for discovery only (no turn
 * is run), so the footer shows effort and speed; the default is the offline engine.
 */
const live = process.argv[2] === "live";
const SHOTS = outputDir();
const tag = live ? "live-" : "";

async function setTheme(want: "light" | "dark"): Promise<void> {
  for (let attempt = 0; attempt < 4; attempt += 1) {
    if (await evaluate<string>("document.documentElement.dataset.theme") === want) return;
    await evaluate('[...document.querySelectorAll(".topbar .icon")].find((node) => node.title.startsWith("Theme")).click()');
    await sleep(250);
  }
  throw new Error(`could not switch to the ${want} theme`);
}

/** Tool rows no offline turn produces: every kind, and each way a call can end. */
const SYNTHETIC = `(() => {
  const turnId = "layout-synthetic";
  let sequence = 0;
  const event = (payload) => ({
    schemaVersion: 1, eventId: turnId + sequence, sequence: sequence++, timestamp: new Date().toISOString(),
    session: { applicationId: "easel", sessionId: "layout" }, runId: "layout", turnId, adapterId: "offline", payload,
  });
  const tool = (name, status, ids, error) => [
    event({ kind: "tool-started", toolId: name + sequence, toolKind: name, title: name }),
    event({
      kind: "tool-completed", toolId: name + (sequence - 1), toolKind: name, title: name, status,
      outputAppend: JSON.stringify({ ids }), ...(error ? { error } : {}),
    }),
  ];
  window.__easelReplay([
    event({ kind: "thinking", text: "The boxes overlap, so they need a column before the arrows are drawn." }),
    event({ kind: "assistant-text", text: "I’ll tidy the layout, then remove the stray note." }),
    ...tool("get_scene", "completed", []),
    ...tool("view_canvas", "completed", []),
    ...tool("add_elements", "completed", ["a", "b", "c"]),
    ...tool("update_elements", "completed", ["a", "b"]),
    ...tool("arrange", "completed", ["a", "b", "c"]),
    ...tool("delete_elements", "completed", ["d"]),
    ...tool("focus", "completed", ["a", "b", "c"]),
    ...tool("update_elements", "failed", [], "No element has the id “ghost”."),
    ...tool("delete_elements", "declined", []),
    event({ kind: "tool-started", toolId: "running", toolKind: "view_canvas", title: "view_canvas" }),
  ]);
  return true;
})()`;

const child = await launch({
  ...(live ? {} : { EASEL_OFFLINE: "1" }),
  EASEL_DATA_DIR: `${process.env.TMPDIR ?? "/tmp"}/easel-layout-${Date.now()}`,
});

try {
  await waitFor("the composer", '!!document.querySelector(".composer textarea")');
  await resize(1420, 900);
  await sleep(800);

  if (!live) {
    // Three boards, so the sidebar has a list, an active row and ages to show.
    await evaluate('document.querySelector(".sidebar .new").click()');
    await sleep(500);
    await evaluate('document.querySelector(".sidebar .new").click()');
    await sleep(500);
    await evaluate(TYPE_AND_SEND("Draw the flow for a photo upload"));
    await waitFor("the turn to start", 'document.querySelectorAll(".activityline").length > 0');
    await evaluate(TYPE_AND_SEND("make them green"));
    await waitFor("the turn to settle", 'document.querySelectorAll(".activityline").length === 0', 90_000);
    await sleep(900);
  }

  for (const theme of ["light", "dark"] as const) {
    await setTheme(theme);
    await evaluate(SET_PANEL_WIDTH(380));
    await sleep(300);
    await capture(`${SHOTS}${tag}${theme}-a-sidebar-open.png`);

    await evaluate('window.dispatchEvent(new KeyboardEvent("keydown", { key: "b", metaKey: true }))');
    await sleep(300);
    if (await evaluate<boolean>('!!document.querySelector(".sidebar")')) throw new Error("⌘B did not hide the boards.");
    await capture(`${SHOTS}${tag}${theme}-b-sidebar-collapsed.png`);
    await evaluate('window.dispatchEvent(new KeyboardEvent("keydown", { key: "b", metaKey: true }))');
    await sleep(300);

    for (const width of [300, 320, 400, 560]) {
      await evaluate(SET_PANEL_WIDTH(width));
      await sleep(300);
      const fit = await evaluate<ComposerFit>(COMPOSER_FIT);
      console.log(theme, "composer at", width, JSON.stringify(fit));
      if (fit.clipped.length > 0 || !fit.sendVisible) throw new Error(`The composer clips at ${width} px.`);
      if (width === 300) await capture(`${SHOTS}${tag}${theme}-c-panel-minimum.png`);
    }

    await evaluate(SET_PANEL_WIDTH(380));
    await sleep(300);
    await evaluate('document.querySelector(".composer .control.lead").click()');
    await sleep(500);
    await capture(`${SHOTS}${tag}${theme}-d-model-menu.png`);
    await evaluate('document.querySelector(".composer .control.lead").click()');
    await sleep(300);

    if (live) {
      // The engine with the most footer controls is the hard case for a narrow panel.
      await evaluate('document.querySelector(".composer .control.lead").click()');
      await sleep(300);
      await evaluate('[...document.querySelectorAll(".mark")].at(-1).click()');
      await sleep(1200);
      await evaluate('document.querySelector(".composer .control.lead").click()');
      for (const width of [300, 320, 400, 560, 380]) {
        await evaluate(SET_PANEL_WIDTH(width));
        await sleep(300);
        const fit = await evaluate<ComposerFit>(COMPOSER_FIT);
        console.log(theme, "last engine, composer at", width, JSON.stringify(fit));
        if (fit.clipped.length > 0 || !fit.sendVisible) throw new Error(`The composer clips at ${width} px.`);
        if (width !== 320) await capture(`${SHOTS}${tag}${theme}-f-controls-${width}.png`);
      }
      await evaluate(`document.querySelector('.composer .control[data-control="effort"]')?.click()`);
      await sleep(400);
      await capture(`${SHOTS}${tag}${theme}-g-effort-menu.png`);
      await evaluate(`document.querySelector('.composer .control[data-control="effort"]')?.click()`);
      continue;
    }
    if (theme === "light") await evaluate(SYNTHETIC);
    await sleep(300);
    await evaluate('[...document.querySelectorAll(".toolgroup .more")].forEach((node) => node.getAttribute("aria-expanded") === "false" && node.click())');
    await evaluate('document.querySelector(".toolrow.failed")?.click()');
    await sleep(400);
    await evaluate('(() => { const chat = document.querySelector(".chat"); chat.scrollTop = chat.scrollHeight; return true; })()');
    await sleep(300);
    await capture(`${SHOTS}${tag}${theme}-e-tool-rows.png`);
    await evaluate('document.querySelector(".toolrow.failed")?.click()');
  }
  console.log(`layout checks passed; captures are in ${SHOTS}`);
} finally {
  child.kill();
}
