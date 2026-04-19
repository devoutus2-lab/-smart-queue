import { CloudOff, RefreshCw, TriangleAlert, Wifi } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useOffline } from "@/context/OfflineContext";

function formatSyncTime(value: string | null) {
  if (!value) return "No sync completed yet";
  return `Last sync ${new Date(value).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`;
}

export function OfflineStatusBanner() {
  const { failedCount, isOnline, lastSyncAt, pendingCount, syncNow, syncing } = useOffline();

  if (isOnline && !pendingCount && !failedCount && !syncing) {
    return null;
  }

  return (
    <div className="pointer-events-none fixed inset-x-0 top-20 z-[79] flex justify-center px-4">
      <div className="pointer-events-auto flex w-full max-w-4xl flex-wrap items-center gap-3 rounded-2xl border border-blue-200/80 bg-white/95 px-4 py-3 shadow-luxury dark:border-slate-800 dark:bg-slate-950/95">
        <div className="flex items-center gap-3 text-sm font-semibold text-slate-900 dark:text-slate-100">
          {isOnline ? <Wifi className="h-5 w-5 text-emerald-500" /> : <CloudOff className="h-5 w-5 text-amber-500" />}
          {isOnline ? "Offline sync is active" : "You are offline"}
        </div>
        <div className="min-w-0 flex-1 text-xs leading-5 text-slate-600 dark:text-slate-300">
          {!isOnline
            ? "Cached data is still available, and supported actions will sync later."
            : syncing
              ? "Replaying saved actions and refreshing live data."
              : pendingCount
                ? `${pendingCount} action${pendingCount === 1 ? "" : "s"} waiting to sync.`
                : failedCount
                  ? `${failedCount} action${failedCount === 1 ? "" : "s"} need attention before they can sync.`
                  : "You're back online and cached data can refresh in the background."}
          {" "}
          {formatSyncTime(lastSyncAt)}.
        </div>
        {failedCount ? <TriangleAlert className="h-5 w-5 text-amber-500" /> : null}
        <Button className="pointer-events-auto" disabled={!isOnline || syncing} size="sm" variant="outline" onClick={() => void syncNow()}>
          <RefreshCw className={`mr-2 h-4 w-4 ${syncing ? "animate-spin" : ""}`} />
          {syncing ? "Syncing" : "Sync now"}
        </Button>
      </div>
    </div>
  );
}
