import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, RefreshCw } from "lucide-react";

type HealthPayload = {
  status: "ok" | "degraded";
  database: "ok" | "error";
  serverTime: string;
  runtime?: {
    provider: string;
    location: string;
    cloudDatabaseConfigured: boolean;
    demoSeedingEnabled: boolean;
    appUrl: string | null;
    trustProxy: boolean | number;
    nodeEnv: string;
  };
};

async function fetchHealth(): Promise<HealthPayload> {
  const response = await fetch("/api/health", {
    credentials: "include",
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error("Health check failed");
  }

  return (await response.json()) as HealthPayload;
}

export default function AppHealthMonitor() {
  const healthQuery = useQuery({
    queryKey: ["app-health"],
    queryFn: fetchHealth,
    refetchInterval: 60_000,
    refetchIntervalInBackground: true,
    retry: 1,
    staleTime: 30_000,
  });

  const offline = typeof navigator !== "undefined" && !navigator.onLine;
  const degraded = offline || healthQuery.isError || healthQuery.data?.status === "degraded";

  if (!degraded && !healthQuery.isFetching) {
    return null;
  }

  return (
    <div className="pointer-events-none fixed inset-x-0 top-4 z-[80] flex justify-center px-4">
      <div className="pointer-events-auto flex w-full max-w-3xl items-center gap-3 rounded-2xl border border-amber-200/80 bg-white/95 px-4 py-3 shadow-luxury dark:border-amber-900/60 dark:bg-slate-950/95">
        {degraded ? (
          <AlertTriangle className="h-5 w-5 shrink-0 text-amber-500" />
        ) : (
          <RefreshCw className="h-5 w-5 shrink-0 animate-spin text-blue-500" />
        )}
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            {degraded ? "Connection check needs attention" : "Refreshing app health"}
          </div>
          <div className="text-xs leading-5 text-slate-600 dark:text-slate-300">
            {offline
              ? "Your device appears offline. The app will retry automatically."
              : healthQuery.isError
                ? "The app could not confirm backend health. Automatic retries are active."
                : healthQuery.data?.database === "error"
                  ? "The server responded, but database checks need attention."
                  : "The app is checking backend health in the background."}
          </div>
        </div>
        {!degraded && healthQuery.isFetching ? <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-500" /> : null}
      </div>
    </div>
  );
}
