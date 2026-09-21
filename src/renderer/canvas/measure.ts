import type { Measure } from "../../shared/label";

/** The hand-drawn face Excalidraw draws with, and the ones it falls back to. */
const FACE = '"Excalifont", "Virgil", "Segoe UI Emoji"';

let ready: Promise<void> | undefined;

/**
 * Excalidraw measures label text when it converts a skeleton. Before the
 * hand-drawn face has loaded it measures a much narrower fallback, and the
 * label then overflows its container. Every canvas command waits for the face.
 */
export function fontsReady(): Promise<void> {
  ready ??= (async () => {
    await Promise.all([
      document.fonts.load('20px "Excalifont"'),
      document.fonts.load('20px "Virgil"'),
    ].map((work) => work.catch(() => [])));
    await document.fonts.ready;
  })();
  return ready;
}

let context: CanvasRenderingContext2D | null = null;

export const measureLabel: Measure = (text, fontSize) => {
  context ??= document.createElement("canvas").getContext("2d");
  if (!context) throw new Error("The renderer has no 2D context to measure text with.");
  context.font = `${fontSize}px ${FACE}`;
  return context.measureText(text).width;
};
