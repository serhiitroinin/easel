import { createServer, type Server } from "node:http";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import type { BrowserWindow } from "electron";

async function body(request: NodeJS.ReadableStream): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks).toString("utf8");
}

export interface ControlSettings {
  port: number;
  token: string;
}

export const CONTROL_TOKEN_HEADER = "x-easel-control-token";

/**
 * The control port is for the verification scripts only. It is on only when
 * EASEL_CONTROL_PORT and EASEL_CONTROL_TOKEN are both set. A normal launch sets
 * neither, so it has no listener.
 */
export function controlSettings(env: Record<string, string | undefined>): ControlSettings | null {
  const port = Number(env.EASEL_CONTROL_PORT ?? "");
  const token = env.EASEL_CONTROL_TOKEN ?? "";
  if (!Number.isInteger(port) || port < 1024 || port > 65_535) return null;
  if (token.length < 16) return null;
  return { port, token };
}

/**
 * Starts the control server when the environment asks for it. The server
 * listens on 127.0.0.1 only. Each request must carry the token in a custom
 * header, which a web page in a browser cannot send without a CORS preflight.
 */
export function registerControl(
  window: BrowserWindow,
  env: Record<string, string | undefined> = process.env,
): Server | null {
  const settings = controlSettings(env);
  if (!settings) return null;

  window.webContents.on("console-message", (event) => {
    process.stderr.write(`[renderer:${event.level}] ${event.message}\n`);
  });
  window.webContents.on("did-fail-load", (_event, code, description) => {
    process.stderr.write(`[renderer] load failed ${code}: ${description}\n`);
  });

  const server = createServer((request, response) => {
    void (async () => {
      try {
        if (request.headers[CONTROL_TOKEN_HEADER] !== settings.token) {
          response.writeHead(403).end("forbidden");
          return;
        }
        const url = new URL(request.url ?? "/", "http://127.0.0.1");
        if (url.pathname === "/size") {
          const width = Number(url.searchParams.get("width"));
          const height = Number(url.searchParams.get("height"));
          window.setResizable(true);
          window.unmaximize();
          window.setContentSize(width, height);
          window.center();
          response.writeHead(200, { "content-type": "application/json" })
            .end(JSON.stringify(window.getContentSize()));
          return;
        }
        if (url.pathname === "/capture") {
          const target = resolve(url.searchParams.get("path") ?? "");
          const width = Number(url.searchParams.get("width"));
          const height = Number(url.searchParams.get("height"));
          if (width > 0 && height > 0) {
            window.setContentSize(width, height);
            await new Promise((done) => setTimeout(done, 120));
            // The first frame after a resize can still hold the old layout.
            await window.webContents.capturePage();
            await new Promise((done) => setTimeout(done, 120));
          }
          const image = await window.webContents.capturePage();
          await mkdir(dirname(target), { recursive: true });
          await writeFile(target, image.toPNG());
          response.writeHead(200, { "content-type": "text/plain" }).end(target);
          return;
        }
        if (url.pathname === "/eval") {
          const value: unknown = await window.webContents.executeJavaScript(await body(request), true);
          response.writeHead(200, { "content-type": "application/json" }).end(JSON.stringify({ value }));
          return;
        }
        response.writeHead(404).end("unknown");
      } catch (error) {
        response.writeHead(500, { "content-type": "application/json" })
          .end(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }));
      }
    })();
  });
  server.listen(settings.port, "127.0.0.1");
  window.on("closed", () => server.close());
  return server;
}
