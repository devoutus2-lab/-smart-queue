import { useQuery } from "@tanstack/react-query";
import type { HealthResponse } from "@shared/api";
import { AlertTriangle } from "lucide-react";

async function fetchHealth(): Promise<HealthResponse> {
  const response = await fetch("/api/health", {
    credentials: "include",
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error("Health check failed");
  }

  return (await response.json()) as HealthResponse;
}

type HostedStorageNoticeProps = {
  className?: string;
  compact?: boolean;
};

export default function HostedStorageNotice({ className = "", compact = false }: HostedStorageNoticeProps) {
  const healthQuery = useQuery({
    queryKey: ["app-health-storage-notice"],
    queryFn: fetchHealth,
    refetchInterval: 60_000,
    staleTime: 30_000,
    retry: 1,
  });

  const storageWarning = healthQuery.data?.runtime?.storageWarning;
  if (!storageWarning) return null;

  return (
    <div
      className={`rounded-[1.4rem] border border-amber-200 bg-amber-50/95 px-4 py-4 text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/35 dark:text-amber-100 ${className}`.trim()}
    >
      <div className={`flex items-start gap-3 ${compact ? "text-sm" : "text-sm leading-6"}`}>
        <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
        <div>
          <div className="font-semibold">Temporary hosted storage detected</div>
          <div className={compact ? "mt-1" : "mt-2"}>{storageWarning}</div>
        </div>
      </div>
    </div>
  );
}
