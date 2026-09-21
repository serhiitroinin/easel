import electron from "electron";

/**
 * Electron's module is a native CommonJS binding, and an ES module entry point
 * cannot read named exports from it. One default import keeps the types.
 */
export const { BrowserWindow, app, ipcMain, nativeTheme, shell } = electron;
export type { BrowserWindow as BrowserWindowType } from "electron";
