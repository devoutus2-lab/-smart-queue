import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { QueueRealtimeEvent } from "@shared/api";
import { useSession } from "@/context/SessionContext";
import { accountQueryKeys, getAccountScope } from "@/lib/accountQueryKeys";

export function useRealtimeInvalidation(onQueueEvent?: (event: QueueRealtimeEvent) => void) {
  const queryClient = useQueryClient();
  const { user } = useSession();
  const scope = getAccountScope(user);

  useEffect(() => {
    const invalidateAll = () => {
      queryClient.invalidateQueries({ queryKey: ["businesses"] });
      queryClient.invalidateQueries({ queryKey: ["business-markers"] });
      queryClient.invalidateQueries({ queryKey: accountQueryKeys.myQueue(scope.userId) });
      queryClient.invalidateQueries({ queryKey: accountQueryKeys.myAppointments(scope.userId) });
      queryClient.invalidateQueries({ queryKey: accountQueryKeys.notifications(scope.role, scope.userId) });
      queryClient.invalidateQueries({ queryKey: accountQueryKeys.userDashboard(scope.userId) });
      queryClient.invalidateQueries({ queryKey: accountQueryKeys.ownerDashboard(scope.ownerBusinessId) });
      queryClient.invalidateQueries({ queryKey: accountQueryKeys.receipts(scope.userId) });
      queryClient.invalidateQueries({ queryKey: accountQueryKeys.ownerReceipts(scope.ownerBusinessId) });
      queryClient.invalidateQueries({ queryKey: accountQueryKeys.visitHistory(scope.userId) });
      queryClient.invalidateQueries({ queryKey: ["conversations", scope.role] });
      queryClient.invalidateQueries({ queryKey: ["conversation", scope.role] });
      queryClient.invalidateQueries({ queryKey: ["support-conversations", scope.role] });
      queryClient.invalidateQueries({ queryKey: ["support-conversation", scope.role] });
    };
    let source: EventSource | null = null;

    const handleQueueUpdate = (rawEvent: Event) => {
      const event = rawEvent as MessageEvent<string>;
      try {
        const payload = JSON.parse(event.data) as QueueRealtimeEvent;
        onQueueEvent?.(payload);
        queryClient.invalidateQueries({ queryKey: accountQueryKeys.myQueue(scope.userId) });
        queryClient.invalidateQueries({ queryKey: accountQueryKeys.userDashboard(scope.userId) });
        queryClient.invalidateQueries({ queryKey: accountQueryKeys.ownerDashboard(scope.ownerBusinessId) });
        queryClient.invalidateQueries({ queryKey: accountQueryKeys.notifications(scope.role, scope.userId) });
        queryClient.invalidateQueries({ queryKey: ["conversations", scope.role] });
        queryClient.invalidateQueries({ queryKey: ["conversation", scope.role] });
        if (payload.affectsJoinAvailability) {
          queryClient.invalidateQueries({ queryKey: ["businesses"] });
          queryClient.invalidateQueries({ queryKey: ["business-markers"] });
        }
      } catch {
        invalidateAll();
      }
    };

    const connect = () => {
      if (typeof navigator !== "undefined" && !navigator.onLine) return;
      source?.close();
      source = new EventSource("/api/events", { withCredentials: true });
      source.addEventListener("queue:update", handleQueueUpdate as EventListener);
      source.addEventListener("chat:new-message", invalidateAll as EventListener);
      source.addEventListener("chat:conversation-updated", invalidateAll as EventListener);
      source.addEventListener("chat:read-state", invalidateAll as EventListener);
      source.addEventListener("notifications:update", invalidateAll as EventListener);
      source.addEventListener("ai:assistant-response", invalidateAll as EventListener);
      source.addEventListener("support:new-message", invalidateAll as EventListener);
      source.addEventListener("support:conversation-updated", invalidateAll as EventListener);
      source.addEventListener("support:read-state", invalidateAll as EventListener);
      source.onerror = () => {};
    };

    const handleReconnect = () => {
      invalidateAll();
      connect();
    };

    connect();
    window.addEventListener("online", handleReconnect);

    return () => {
      window.removeEventListener("online", handleReconnect);
      source?.close();
    };
  }, [onQueueEvent, queryClient, scope.ownerBusinessId, scope.role, scope.userId]);
}
