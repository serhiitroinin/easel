import { join } from "node:path";
import { fileURLToPath } from "node:url";
import type { BrowserWindow } from "electron";
import { BrowserWindow as Window, app, nativeTheme, shell } from "./electron";
import { BoardStore } from "./boards";
import { CanvasBridge } from "./canvas-bridge";
import { adoptLoginShellPath } from "./env";
import { createEaselHarness, type EaselHarness } from "./harness/host";
import { wire } from "./ipc";
import { controlSettings, registerControl } from "./control";

const root = join(fileURLToPath(new URL(".", import.meta.url)), "..", "..");
const offline = process.env.EASEL_OFFLINE === "1";
const icon = join(root, "resources", "icon.png");

let harness: EaselHarness | null = null;

function createWindow(): BrowserWindow {
  const window = new Window({
    width: 1440,
    height: 940,
    minWidth: 960,
    minHeight: 640,
    show: false,
    title: "Easel",
    icon,
    titleBarStyle: "hiddenInset",
    // The --paper token of each theme, so the window does not flash on launch.
    backgroundColor: nativeTheme.shouldUseDarkColors ? "#181614" : "#f6f2e9",
    webPreferences: {
      preload: join(root, ".build", "preload", "index.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      additionalArguments: [
        `--easel-offline=${offline ? "1" : "0"}`,
        `--easel-control=${controlSettings(process.env) ? "1" : "0"}`,
      ],
    },
  });
  window.once("ready-to-show", () => {
    window.setContentSize(1440, 920);
    window.center();
    window.show();
  });
  window.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url);
    return { action: "deny" };
  });
  return window;
}

async function start(): Promise<void> {
  adoptLoginShellPath();
  // Windows and Linux read the window icon. macOS shows the Dock icon.
  app.dock?.setIcon(icon);
  const dataDir = app.getPath("userData");
  const bridge = new CanvasBridge();
  harness = createEaselHarness({
    appName: "Easel",
    appVersion: app.getVersion(),
    dataDir,
    bridge,
    offline,
    onStderr: (engine, text) => process.stderr.write(`[${engine}] ${text}`),
  });

  const boards = new BoardStore(join(dataDir, "boards"));
  await boards.firstOrCreate();

  const window = createWindow();
  wire({ window, boards, harness, bridge });
  registerControl(window);
  await window.loadFile(join(root, ".build", "renderer", "index.html"));
}

if (process.env.EASEL_DATA_DIR) app.setPath("userData", process.env.EASEL_DATA_DIR);

app.whenReady().then(start).catch((error: unknown) => {
  process.stderr.write(`Easel failed to start: ${String(error)}\n`);
  app.exit(1);
});

app.on("window-all-closed", () => app.quit());

app.on("before-quit", () => {
  void harness?.close();
});
