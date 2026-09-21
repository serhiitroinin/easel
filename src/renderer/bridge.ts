import type { EaselBridge } from "../shared/app";

declare global {
  interface Window {
    easel: EaselBridge;
  }
}

export const easel: EaselBridge = window.easel;
