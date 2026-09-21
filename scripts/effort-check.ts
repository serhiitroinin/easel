import { setTimeout as sleep } from "node:timers/promises";
import { capture, outputDir, COMPOSER_FIT, evaluate, launch, resize, SET_PANEL_WIDTH, waitFor, type ComposerFit } from "./drive";

/**
 * The effort button, from pixels and from the DOM, against the real engines'
 * discovery (no turn is run): its menu for a Claude model and a Codex model, the
 * engine menu without an effort row, and the footer at the narrowest panel.
 * `bun scripts/effort-check.ts [claude model] [codex model]`
 */
const SHOTS = outputDir();
const CLAUDE_MODEL = process.argv[2] ?? "Sonnet";
const CODEX_MODEL = process.argv[3];

const LEAD = 'document.querySelector(".composer .control.lead")';
const EFFORT = 'document.querySelector(\'.composer .control[data-control="effort"]\')';
const click = (selector: string, label: string) =>
  `[...document.querySelectorAll(${JSON.stringify(selector)})].find((node) => node.textContent === ${JSON.stringify(label)}).click()`;
const key = (name: string) =>
  `document.activeElement.dispatchEvent(new KeyboardEvent("keydown", { key: ${JSON.stringify(name)}, bubbles: true }))`;

interface EffortMenu {
  button: string | null;
  rows: string[];
  checked: string[];
  focused: string | null;
  left: number;
  buttonLeft: number;
  right: number;
  composerRight: number;
}

const effortMenu = () => evaluate<EffortMenu>(`(() => {
  const menu = document.querySelector(".menu.options");
  const button = ${EFFORT};
  return {
    button: button?.getAttribute("aria-label") ?? null,
    rows: [...menu.querySelectorAll(".row .name")].map((node) => node.textContent),
    checked: [...menu.querySelectorAll('.row[aria-checked="true"] .name')].map((node) => node.textContent),
    focused: document.activeElement?.querySelector?.(".name")?.textContent ?? null,
    left: Math.round(menu.getBoundingClientRect().left),
    buttonLeft: Math.round(button.getBoundingClientRect().left),
    right: Math.round(menu.getBoundingClientRect().right),
    composerRight: Math.round(document.querySelector(".composer").getBoundingClientRect().right),
  };
})()`);

function expect(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

async function setTheme(want: "light" | "dark"): Promise<void> {
  for (let attempt = 0; attempt < 4; attempt += 1) {
    if (await evaluate<string>("document.documentElement.dataset.theme") === want) return;
    await evaluate('[...document.querySelectorAll(".topbar .icon")].find((node) => node.title.startsWith("Theme")).click()');
    await sleep(250);
  }
  throw new Error(`could not switch to the ${want} theme`);
}

async function pickModel(engine: string, model: string | undefined): Promise<void> {
  await evaluate(`${LEAD}.click()`);
  await sleep(300);
  await evaluate(click(".mark", engine));
  await waitFor(`${engine} models`, 'document.querySelectorAll(".menu.engines .row").length > 0');
  if (model) await evaluate(click(".menu.engines .row .name", model));
  await sleep(300);
  if (await evaluate<boolean>('!!document.querySelector(".menu.engines")')) await evaluate(`${LEAD}.click()`);
  await sleep(300);
}

const child = await launch({ EASEL_DATA_DIR: `${process.env.TMPDIR ?? "/tmp"}/easel-effort-${Date.now()}` });

try {
  await waitFor("the model picker", `!!${LEAD}`);
  await resize(1420, 900);
  await waitFor("live discovery", `${LEAD}.textContent !== "No engine"`, 40_000);

  for (const theme of ["light", "dark"] as const) {
    await setTheme(theme);
    await evaluate(SET_PANEL_WIDTH(380));
    const suffix = theme === "light" ? "" : "-dark";

    // Claude names no default effort: the button says Default until a level is picked.
    await pickModel("Claude Code", CLAUDE_MODEL);
    await evaluate(`${LEAD}.click()`);
    await sleep(500);
    const inMenu = await evaluate<number>('document.querySelectorAll(".menu.engines .segmented, .menu.engines .setting").length');
    expect(inMenu === 0, "The engine menu still holds a settings row.");
    await capture(`${SHOTS}01-claude-models-effort${suffix}.png`);
    await evaluate(`${LEAD}.click()`);
    await sleep(300);

    await evaluate(`${EFFORT}.click()`);
    await sleep(400);
    let seen = await effortMenu();
    console.log(theme, "claude effort:", JSON.stringify(seen));
    expect(seen.rows[0] === "Default" && seen.checked.join() === "Default", "Claude's effort does not start on Default.");
    expect(seen.button === "Effort: Default", `The button says ${seen.button}.`);
    expect(seen.focused === "Default", "The checked row does not hold focus.");
    expect(seen.left === seen.buttonLeft, "The menu is not under its button.");
    await capture(`${SHOTS}live-${theme}-g-effort-menu-claude.png`);

    // Arrows and Enter pick a level, Escape closes, and Default clears it again.
    await evaluate(key("ArrowDown"));
    await evaluate(key("ArrowDown"));
    const moved = await evaluate<string>('document.activeElement.querySelector(".name").textContent');
    await evaluate("document.activeElement.click()");
    await sleep(300);
    expect(await evaluate<string>(`${EFFORT}.getAttribute("aria-label")`) === `Effort: ${moved}`, "Enter did not pick the focused level.");
    expect(!await evaluate<boolean>('!!document.querySelector(".menu.options")'), "Picking did not close the menu.");
    await evaluate(`${EFFORT}.click()`);
    await sleep(300);
    await evaluate('document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }))');
    await sleep(300);
    expect(!await evaluate<boolean>('!!document.querySelector(".menu.options")'), "Escape did not close the menu.");
    await evaluate(`${EFFORT}.click()`);
    await sleep(300);
    await evaluate(click(".menu.options .row .name", "Default"));
    await sleep(300);
    expect(await evaluate<string>(`${EFFORT}.getAttribute("aria-label")`) === "Effort: Default", "Default did not clear the level.");
    await evaluate(`${EFFORT}.click()`);
    await sleep(200);
    await evaluate('document.querySelector(".chat, .panel").dispatchEvent(new MouseEvent("mousedown", { bubbles: true }))');
    await sleep(300);
    expect(!await evaluate<boolean>('!!document.querySelector(".menu.options")'), "A click elsewhere did not close the menu.");

    // A model without effort has no button.
    await pickModel("Claude Code", "Haiku");
    expect(!await evaluate<boolean>(`!!${EFFORT}`), "Haiku offers no effort, yet the button shows.");
    await pickModel("Claude Code", CLAUDE_MODEL);

    for (const width of [300, 320, 400, 560]) {
      await evaluate(SET_PANEL_WIDTH(width));
      await sleep(300);
      const fit = await evaluate<ComposerFit>(COMPOSER_FIT);
      console.log(theme, "claude, composer at", width, JSON.stringify(fit));
      expect(fit.clipped.length === 0 && fit.sendVisible, `The composer clips at ${width} px.`);
      if (width === 300) {
        await capture(`${SHOTS}live-${theme}-h-footer-300-claude.png`);
        await evaluate(`${EFFORT}.click()`);
        await sleep(400);
        seen = await effortMenu();
        expect(seen.right <= seen.composerRight + 1, "The menu leaves the panel at 300 px.");
        await capture(`${SHOTS}live-${theme}-h-footer-300-claude-menu.png`);
        await evaluate(`${EFFORT}.click()`);
      }
    }

    // Codex names its default, so there is no Default row and that level is checked.
    await evaluate(SET_PANEL_WIDTH(380));
    await pickModel("Codex", CODEX_MODEL);
    await evaluate(`${EFFORT}.click()`);
    await sleep(400);
    seen = await effortMenu();
    console.log(theme, "codex effort:", JSON.stringify(seen));
    expect(!seen.rows.includes("Default") && seen.checked.length === 1, "Codex's own default is not the checked row.");
    expect(seen.right <= seen.composerRight + 1, "The menu leaves the panel.");
    await capture(`${SHOTS}live-${theme}-g-effort-menu.png`);
    await evaluate(`${EFFORT}.click()`);
    await evaluate(SET_PANEL_WIDTH(300));
    await sleep(300);
    const fit = await evaluate<ComposerFit>(COMPOSER_FIT);
    expect(fit.clipped.length === 0 && fit.sendVisible, "The composer clips at 300 px with Codex.");
    await capture(`${SHOTS}live-${theme}-h-footer-300-codex.png`);
  }
  console.log("effort check passed");
} finally {
  child.kill();
}
