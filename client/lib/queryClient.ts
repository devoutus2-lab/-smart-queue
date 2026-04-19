import { QueryCache, QueryClient, dehydrate, hydrate } from "@tanstack/react-query";
import { getMeta, setMeta } from "@/lib/offlineDb";

const QUERY_CACHE_META_KEY = "react-query-cache";
const MAX_CACHE_AGE_MS = 1000 * 60 * 60 * 24;

const PERSISTED_QUERY_ROOTS = new Set([
  "session",
  "profile",
  "user-preferences",
  "businesses",
  "business-markers",
  "business",
  "user-dashboard",
  "my-queue",
  "my-appointments",
  "visit-history",
  "receipts",
  "notifications",
  "account-businesses",
  "account-business-markers",
]);

let persistTimeout: number | null = null;

export const queryClient = new QueryClient({
  queryCache: new QueryCache(),
  defaultOptions: {
    queries: {
      retry: 2,
      retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 8000),
      refetchOnWindowFocus: true,
      refetchOnReconnect: true,
      staleTime: 15_000,
    },
    mutations: {
      retry: 1,
      retryDelay: 1500,
    },
  },
});

function shouldPersistQuery(queryKey: readonly unknown[]) {
  const root = queryKey[0];
  return typeof root === "string" && PERSISTED_QUERY_ROOTS.has(root);
}

async function persistQueryCache() {
  const snapshot = dehydrate(queryClient, {
    shouldDehydrateQuery: (query) => shouldPersistQuery(query.queryKey),
  });

  await setMeta(QUERY_CACHE_META_KEY, {
    savedAt: Date.now(),
    snapshot,
  });
}

export async function restorePersistedQueryCache() {
  const stored = await getMeta<{ savedAt: number; snapshot: unknown }>(QUERY_CACHE_META_KEY);
  if (!stored) return;
  if (Date.now() - stored.savedAt > MAX_CACHE_AGE_MS) return;

  hydrate(queryClient, stored.snapshot);
}

export function startPersistingQueryCache() {
  queryClient.getQueryCache().subscribe(() => {
    if (typeof window === "undefined") return;
    if (persistTimeout != null) {
      window.clearTimeout(persistTimeout);
    }

    persistTimeout = window.setTimeout(() => {
      void persistQueryCache();
      persistTimeout = null;
    }, 350);
  });
}
