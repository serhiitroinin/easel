import { setTimeout as sleep } from "node:timers/promises";
import { capture, outputDir, evaluate, launch, resize, TYPE_AND_SEND, waitFor } from "./drive";

const SHOTS = outputDir();
const child = await launch({ EASEL_DATA_DIR: `${process.env.TMPDIR ?? "/tmp"}/easel-sketch-${Date.now()}` });

const SCRIBBLE = `(() => {
  const api = window.__easel.api;
  const points = [];
  for (let step = 0; step <= 60; step += 1) {
    const angle = (step / 60) * Math.PI * 2;
    points.push([Math.cos(angle) * 120 + Math.sin(step) * 12, Math.sin(angle) * 90 + Math.cos(step) * 12]);
  }
  const origin = points[0];
  api.updateScene({
    elements: [...api.getSceneElements(), {
      id: "user-scribble", type: "freedraw", x: 420, y: 300,
      width: 260, height: 200, angle: 0, strokeColor: "#1e1e1e", backgroundColor: "transparent",
      fillStyle: "solid", strokeWidth: 2, strokeStyle: "solid", roughness: 1, opacity: 100,
      groupIds: [], frameId: null, roundness: null, seed: 12345, version: 1, versionNonce: 1,
      isDeleted: false, boundElements: null, updated: Date.now(), link: null, locked: false,
      points: points.map(([x, y]) => [x - origin[0], y - origin[1]]), pressures: [], simulatePressure: true, lastCommittedPoint: null,
    }],
  });
  return api.getSceneElements().length;
})()`;

try {
  await waitFor("the composer", '!!document.querySelector(".composer textarea")');
  await resize(1420, 900);
  console.log("elements after the sketch:", await evaluate<number>(SCRIBBLE));
  await sleep(600);
  await capture(`${SHOTS}live-sketch-1.png`);

  await evaluate(TYPE_AND_SEND("What did I just draw? Look at the board, then tidy it up next to my sketch."));
  await waitFor("the turn", 'document.querySelectorAll(".activityline").length === 0 && document.querySelectorAll(".turn.agent").length >= 1', 240_000);
  await sleep(1200);
  await capture(`${SHOTS}live-sketch-2.png`);
  console.log(JSON.stringify({
    rows: await evaluate<string[]>('[...document.querySelectorAll(".toolrow")].map((node) => node.textContent)'),
    text: await evaluate<string>('document.querySelector(".turn.agent .prose")?.textContent ?? ""'),
    elements: await evaluate<number>("window.__easel.api.getSceneElements().length"),
  }, null, 1));
} finally {
  child.kill();
}
