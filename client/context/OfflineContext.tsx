import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { getOfflineStatusSnapshot, replayOfflineOutbox, subscribeToOutboxChanges } from "@/lib/offlineQueue";

type OfflineContextValue = {
  isOnline: boolean;
  pendingCount: number;
  failedCount: number;
  syncing: boolean;
  lastSyncAt: string | null;
  syncNow: () => Promise<void>;
};

const OfflineContext = createContext<OfflineContextValue | undefined>(undefined);

export function OfflineProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [isOnline, setIsOnline] = useState(() => (typeof navigator === "undefined" ? true : navigator.onLine));
  const [pendingCount, setPendingCount] = useState(0);
  const [failedCount, setFailedCount] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const refreshSnapshot = async () => {
      const snapshot = await getOfflineStatusSnapshot();
      if (cancelled) return;
      setPendingCount(snapshot.pendingCount);
      setFailedCount(snapshot.failedCount);
      setSyncing(snapshot.syncing);
      setLastSyncAt(snapshot.lastSyncAt);
    };

    const syncNow = async () => {
      await replayOfflineOutbox(queryClient);
      await refreshSnapshot();
    };

    const handleOnline = () => {
      setIsOnline(true);
      void syncNow();
    };

    const handleOffline = () => setIsOnline(false);

    void refreshSnapshot();
    const unsubscribe = subscribeToOutboxChanges(() => {
      void refreshSnapshot();
    });

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    if (typeof navigator !== "undefined" && navigator.onLine) {
      void syncNow();
    }

    return () => {
      cancelled = true;
      unsubscribe();
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [queryClient]);

  const value = useMemo(
    () => ({
      isOnline,
      pendingCount,
      failedCount,
      syncing,
      lastSyncAt,
      syncNow: async () => {
        await replayOfflineOutbox(queryClient);
        const snapshot = await getOfflineStatusSnapshot();
        setPendingCount(snapshot.pendingCount);
        setFailedCount(snapshot.failedCount);
        setSyncing(snapshot.syncing);
        setLastSyncAt(snapshot.lastSyncAt);
      },
    }),
    [failedCount, isOnline, lastSyncAt, pendingCount, queryClient, syncing],
  );

  return <OfflineContext.Provider value={value}>{children}</OfflineContext.Provider>;
}

export function useOffline() {
  const context = useContext(OfflineContext);
  if (!context) {
    throw new Error("useOffline must be used within OfflineProvider");
  }
  return context;
}
