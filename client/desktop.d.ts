export {};

declare global {
  interface SmartQueueDesktopBridge {
    isDesktop: true;
    platform: NodeJS.Platform;
    electronVersion: string;
  }

  interface Window {
    qtechDesktop?: SmartQueueDesktopBridge;
    smartQueueDesktop?: SmartQueueDesktopBridge;
  }
}
