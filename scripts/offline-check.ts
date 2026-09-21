import { setTimeout as sleep } from "node:timers/promises";
import {
  capture, outputDir, COMPOSER_FIT, evaluate, launch, resize, SET_PANEL_WIDTH, TYPE_AND_SEND, waitFor, type ComposerFit,
} from "./drive";

const SHOTS = outputDir();

const data = `${process.env.TMPDIR ?? "/tmp"}/easel-offline-${Date.now()}`;
const child = await launch({ EASEL_OFFLINE: "1", EASEL_DATA_DIR: data });

try {
  await waitFor("the composer", '!!document.querySelector(".composer textarea")');
  console.log("window:", await resize(1420, 900));
  await sleep(600);
  await sleep(1200);
  await capture(`${SHOTS}01-empty.png`);

  await evaluate(TYPE_AND_SEND("Draw the flow for a photo upload"));
  await waitFor("the first tool activity", 'document.querySelectorAll(".toolrow").length > 0');
  await sleep(900);
  await capture(`${SHOTS}02-drawing.png`);

  await waitFor("the turn to settle", 'document.querySelectorAll(".activityline").length === 0', 90_000);
  await evaluate('document.querySelector(".toolgroup .more")?.click()');
  const drawn = await evaluate<number>("window.__easel.api.getSceneElements().length");
  await sleep(1500);
  await capture(`${SHOTS}03-done.png`);

  const text = await evaluate<string>('document.querySelector(".turn.agent .prose")?.textContent ?? ""');
  const activities = await evaluate<string[]>('[...document.querySelectorAll(".toolrow")].map((node) => node.textContent)');

  console.log("tool activities:", activities.join(" | "));
  console.log("assistant text:", text);
  console.log("elements on the board:", drawn);
  if (drawn < 5) throw new Error("The offline turn did not reach the canvas.");

  const beside = await evaluate<{ gap: number; overlapsY: boolean } | null>(`(() => {
    const elements = window.__easel.api.getSceneElements();
    const find = (needle) => elements.find((element) => element.id.startsWith(needle));
    const store = find("store-");
    const cache = find("cache-");
    if (!store || !cache) return null;
    return {
      gap: Math.round(cache.x - (store.x + store.width)),
      overlapsY: cache.y < store.y + store.height && cache.y + cache.height > store.y,
    };
  })()`);
  console.log("element-level near:", JSON.stringify(beside));
  if (!beside) throw new Error("The element that named a sibling with `near` was not drawn.");
  if (beside.gap < 0) throw new Error("The element placed with `near` overlaps its anchor.");
  if (!activities.some((entry) => entry.includes("Drew"))) throw new Error("No element was drawn.");
  const labels = await evaluate<{ text: string; width: number; needed: number; lines: number }[]>(`(() => {
    const api = window.__easel.api;
    const elements = api.getSceneElements();
    const byId = new Map(elements.map((element) => [element.id, element]));
    const context = document.createElement("canvas").getContext("2d");
    return elements.flatMap((element) => {
      if (element.type !== "arrow" && element.type !== "line") return [];
      const bound = (element.boundElements || []).find((entry) => entry.type === "text");
      const label = bound ? byId.get(bound.id) : undefined;
      if (!label) return [];
      context.font = label.fontSize + 'px "Excalifont", "Virgil", "Segoe UI Emoji"';
      const needed = Math.max(...label.text.split("\\n").map((line) => context.measureText(line).width));
      return [{ text: label.text, width: Math.round(label.width), needed: Math.ceil(needed), lines: label.text.split("\\n").length }];
    });
  })()`);

  console.log("arrow labels:", JSON.stringify(labels));
  if (labels.length < 2) throw new Error("The offline turn drew no labelled arrows.");
  for (const label of labels) {
    if (label.width < label.needed) {
      throw new Error(`The label "${label.text}" is ${label.width} px wide but its text needs ${label.needed} px.`);
    }
    if (label.lines > 2) throw new Error(`The label "${label.text}" wrapped onto ${label.lines} lines.`);
  }
  const drawnText = labels.map((label) => label.text.replace(/\n/g, " ")).sort();
  if (drawnText.join("|") !== ["HTTP Request / Response", "SQL Query / Result"].sort().join("|")) {
    throw new Error(`The labels on the board are not the ones the agent asked for: ${drawnText.join(" | ")}`);
  }

  const kinds = await evaluate<string[]>('[...document.querySelectorAll(".toolrow")].map((node) => node.dataset.tool)');
  const icons = await evaluate<string[]>('[...document.querySelectorAll(".toolrow .glyph")].map((node) => node.innerHTML)');
  if (new Set(icons).size < new Set(kinds).size) throw new Error("Two kinds of tool call share one icon.");

  for (const width of [300, 320, 400, 560]) {
    await evaluate(SET_PANEL_WIDTH(width));
    await sleep(250);
    const fit = await evaluate<ComposerFit>(COMPOSER_FIT);
    console.log("composer at", width, JSON.stringify(fit));
    if (fit.clipped.length > 0 || !fit.sendVisible) {
      throw new Error(`The composer clips at a ${width} px panel: ${fit.clipped.join(", ")}`);
    }
  }

  console.log("offline end-to-end check: pass");
} finally {
  child.kill();
}
