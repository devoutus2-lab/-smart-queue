const fs = require("node:fs");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const { app, BrowserWindow, dialog, shell } = require("electron");
const dotenv = require("dotenv");

let mainWindow = null;
let desktopServer = null;
let isShuttingDownServer = false;

function getWindowIconPath() {
  const candidates = [
    path.join(app.getAppPath(), "build", "icon.png"),
    path.join(process.resourcesPath, "build", "icon.png"),
  ];

  for (const iconPath of candidates) {
    if (fs.existsSync(iconPath)) return iconPath;
  }

  return undefined;
}

function getDesktopDevServerUrl() {
  const rawUrl = process.env.QTECH_ELECTRON_DEV_SERVER_URL?.trim();
  if (!rawUrl) return null;

  try {
    return new URL(rawUrl).toString();
  } catch {
    throw new Error(`Invalid QTECH_ELECTRON_DEV_SERVER_URL: ${rawUrl}`);
  }
}

function loadDesktopEnv() {
  const candidates = [
    path.join(app.getAppPath(), ".env"),
    path.join(path.dirname(process.execPath), "smart-queue.env"),
    path.join(path.dirname(process.execPath), "qtech.env"),
    path.join(app.getPath("userData"), "smart-queue.env"),
    path.join(app.getPath("userData"), "qtech.env"),
  ];

  for (const envPath of candidates) {
    if (!fs.existsSync(envPath)) continue;
    dotenv.config({ path: envPath, override: false });
  }
}

function getPreloadPath() {
  return path.join(app.getAppPath(), "electron", "preload.cjs");
}

function getServerEntryPath() {
  return path.join(app.getAppPath(), "dist", "server", "node-build.mjs");
}

async function startDesktopServer() {
  const devServerUrl = getDesktopDevServerUrl();
  if (devServerUrl) {
    return {
      url: devServerUrl,
      close: async () => {},
    };
  }

  if (desktopServer) return desktopServer;

  process.env.QTECH_DATA_DIR = path.join(app.getPath("userData"), "data");
  process.env.PORT = process.env.PORT || "0";

  const serverEntryPath = getServerEntryPath();
  if (!fs.existsSync(serverEntryPath)) {
    throw new Error(`Missing desktop server bundle at ${serverEntryPath}. Run the desktop build first.`);
  }

  const serverModule = await import(pathToFileURL(serverEntryPath).href);
  desktopServer = await serverModule.startNodeServer({
    host: "127.0.0.1",
    port: 0,
    quiet: true,
  });

  return desktopServer;
}

async function shutdownDesktopServer() {
  if (!desktopServer) return;
  const activeServer = desktopServer;
  desktopServer = null;
  await activeServer.close().catch(() => {});
}

async function createMainWindow() {
  const { url } = await startDesktopServer();
  const allowedOrigin = new URL(url).origin;

  mainWindow = new BrowserWindow({
    width: 1480,
    height: 960,
    minWidth: 1180,
    minHeight: 760,
    show: false,
    autoHideMenuBar: true,
    backgroundColor: "#f3f6fb",
    title: "Smart Queue",
    icon: getWindowIconPath(),
    webPreferences: {
      preload: getPreloadPath(),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  mainWindow.webContents.setWindowOpenHandler(({ url: targetUrl }) => {
    shell.openExternal(targetUrl).catch(() => {});
    return { action: "deny" };
  });

  mainWindow.webContents.on("will-navigate", (event, targetUrl) => {
    const targetOrigin = new URL(targetUrl).origin;
    if (targetOrigin === allowedOrigin) return;

    event.preventDefault();
    shell.openExternal(targetUrl).catch(() => {});
  });

  mainWindow.once("ready-to-show", () => {
    if (mainWindow) mainWindow.show();
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });

  await mainWindow.loadURL(url);
}

async function bootDesktopApp() {
  try {
    loadDesktopEnv();
    await createMainWindow();
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown startup error";
    dialog.showErrorBox("Smart Queue failed to start", message);
    await shutdownDesktopServer();
    app.quit();
  }
}

app.setName("Smart Queue");
app.setAppUserModelId("com.smartqueue.desktop");

const singleInstance = app.requestSingleInstanceLock();
if (!singleInstance) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (!mainWindow) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  });

  app.whenReady().then(bootDesktopApp);

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      bootDesktopApp().catch(() => {});
    }
  });
}

app.on("before-quit", (event) => {
  if (isShuttingDownServer) return;
  if (!desktopServer) return;

  event.preventDefault();
  isShuttingDownServer = true;
  shutdownDesktopServer()
    .catch(() => {})
    .finally(() => {
      isShuttingDownServer = false;
      app.quit();
    });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
