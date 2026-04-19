import type { QueryClient } from "@tanstack/react-query";
import { applyOptimisticOfflineMutation, invalidateQueriesForMutation, replayOfflineMutation } from "@/lib/offlineMutations";
import { getMeta, getOutboxItems, putOutboxItem, removeOutboxItem, setMeta, updateOutboxItem } from "@/lib/offlineDb";
import type { OfflineMutation, OfflineMutationKind, OfflineMutationPayloadMap, OfflineStatusSnapshot } from "@/lib/offlineTypes";

const LAST_SYNC_META_KEY = "offline-last-sync-at";
const SYNC_STATE_META_KEY = "offline-syncing";
const OUTBOX_EVENT = "smart-queue-offline-outbox-change";

function emitOutboxChange() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(OUTBOX_EVENT));
  }
}

function makeMutationId() {
  return `${Date.now()}-${Math.round(Math.random() * 1_000_000)}`;
}

export function subscribeToOutboxChanges(listener: () => void) {
  if (typeof window === "undefined") {
    return () => {};
  }

  window.addEventListener(OUTBOX_EVENT, listener);
  return () => window.removeEventListener(OUTBOX_EVENT, listener);
}

export async function getOfflineStatusSnapshot(): Promise<OfflineStatusSnapshot> {
  const [items, lastSyncAt, syncing] = await Promise.all([
    getOutboxItems(),
    getMeta<string | null>(LAST_SYNC_META_KEY),
    getMeta<boolean>(SYNC_STATE_META_KEY),
  ]);

  return {
    pendingCount: items.filter((item) => item.status === "pending").length,
    failedCount: items.filter((item) => item.status === "failed").length,
    lastSyncAt: lastSyncAt ?? null,
    syncing: Boolean(syncing),
  };
}

export async function enqueueOfflineMutation<K extends OfflineMutationKind>(
  queryClient: QueryClient,
  kind: K,
  payload: OfflineMutationPayloadMap[K],
  options?: { id?: string },
) {
  const mutation: OfflineMutation<K> = {
    id: options?.id ?? makeMutationId(),
    kind,
    payload,
    createdAt: new Date().toISOString(),
    status: "pending",
  };

  applyOptimisticOfflineMutation(queryClient, mutation);
  await putOutboxItem(mutation);
  emitOutboxChange();
  return mutation;
}

async function setSyncing(syncing: boolean) {
  await setMeta(SYNC_STATE_META_KEY, syncing);
  emitOutboxChange();
}

export async function replayOfflineOutbox(queryClient: QueryClient) {
  if (typeof navigator !== "undefined" && !navigator.onLine) return;

  const items = await getOutboxItems();
  if (!items.length) {
    await setSyncing(false);
    return;
  }

  await setSyncing(true);

  for (const item of items) {
    try {
      await replayOfflineMutation(item);
      await removeOutboxItem(item.id);
      await setMeta(LAST_SYNC_META_KEY, new Date().toISOString());
      invalidateQueriesForMutation(queryClient, item.kind);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Sync failed";
      await updateOutboxItem(item.id, (current) => ({
        ...current,
        status: "failed",
        errorMessage,
      }));
    } finally {
      emitOutboxChange();
    }
  }

  await setSyncing(false);
}
