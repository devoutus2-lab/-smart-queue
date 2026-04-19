import { createRoot } from "react-dom/client";
import { App } from "./App";
import { restorePersistedQueryCache, startPersistingQueryCache } from "@/lib/queryClient";

async function bootstrap() {
  await restorePersistedQueryCache();
  startPersistingQueryCache();

  if ("serviceWorker" in navigator) {
    try {
      await navigator.serviceWorker.register("/service-worker.js");
    } catch {}
  }

  createRoot(document.getElementById("root")!).render(<App />);
}

void bootstrap();
