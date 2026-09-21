import { randomUUID } from "node:crypto";
import type { CanvasCommand, CanvasResult } from "../shared/canvas";
import type { CanvasRequest } from "../shared/app";

const TIMEOUT_MS = 20_000;

/**
 * The renderer owns the live scene, so every canvas tool is a request to it.
 * A tool must never hang a provider turn, so each request has a deadline.
 */
export class CanvasBridge {
  private readonly pending = new Map<string, (result: CanvasResult) => void>();
  private send: ((request: CanvasRequest) => void) | null = null;

  attach(send: (request: CanvasRequest) => void): void {
    this.send = send;
  }

  detach(): void {
    this.send = null;
    for (const resolve of this.pending.values()) resolve({ ok: false, error: "The canvas window closed." });
    this.pending.clear();
  }

  settle(requestId: string, result: CanvasResult): void {
    this.pending.get(requestId)?.(result);
  }

  request(command: CanvasCommand, timeoutMs = TIMEOUT_MS): Promise<CanvasResult> {
    const send = this.send;
    if (!send) return Promise.resolve({ ok: false, error: "The canvas is not open." });
    const requestId = randomUUID();
    return new Promise<CanvasResult>((resolve) => {
      const timer = setTimeout(() => {
        this.pending.delete(requestId);
        resolve({ ok: false, error: "The canvas did not answer in time. Try a smaller change." });
      }, timeoutMs);
      this.pending.set(requestId, (result) => {
        clearTimeout(timer);
        this.pending.delete(requestId);
        resolve(result);
      });
      send({ requestId, command });
    });
  }
}
