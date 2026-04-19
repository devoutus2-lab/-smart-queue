const { contextBridge } = require("electron");

const desktopBridge = {
  isDesktop: true,
  platform: process.platform,
  electronVersion: process.versions.electron,
};

contextBridge.exposeInMainWorld("qtechDesktop", desktopBridge);
contextBridge.exposeInMainWorld("smartQueueDesktop", desktopBridge);
