import { cpSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";

const here = (path: string) => fileURLToPath(new URL(path, import.meta.url));

/** Excalidraw loads its hand-drawn fonts from a CDN unless the host ships them. */
function excalidrawFonts(): Plugin {
  return {
    name: "easel:excalidraw-fonts",
    closeBundle() {
      cpSync(
        here("node_modules/@excalidraw/excalidraw/dist/prod/fonts"),
        here(".build/renderer/fonts"),
        { recursive: true },
      );
    },
  };
}

export default defineConfig({
  root: "src/renderer",
  base: "./",
  plugins: [react(), excalidrawFonts()],
  define: {
    "process.env.IS_PREACT": JSON.stringify("false"),
  },
  build: {
    outDir: "../../.build/renderer",
    emptyOutDir: true,
    target: "chrome130",
    chunkSizeWarningLimit: 2400,
  },
});
