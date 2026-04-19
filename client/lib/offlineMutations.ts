import type {
  Appointment,
  AppointmentInput,
  NotificationItem,
  QueueEntry,
  UserDashboard,
  VisitHistoryItem,
} from "@shared/api";
import type { Query, QueryClient } from "@tanstack/react-query";
import { accountQueryKeys } from "@/lib/accountQueryKeys";
import { networkApi } from "@/lib/apiCore";
import type { OfflineMutation, OfflineMutationKind, OfflineMutationPayloadMap } from "@/lib/offlineTypes";

function nowIso() {
  return new Date().toISOString();
}

function tempId() {
  return -Math.floor(Date.now() + Math.random() * 1000);
}

function matchRoot(query: Query, root: string) {
  return query.queryKey[0] === root;
}

function setQueriesData<T>(queryClient: QueryClient, root: string, updater: (current: T | undefined) => T | undefined) {
  queryClient.setQueriesData({ predicate: (query) => matchRoot(query, root) }, updater);
}

function patchBusinessLike<T extends { id: number; isFavorite?: boolean; isSaved?: boolean }>(
  current: T | undefined,
  businessId: number,
  patch: Partial<Pick<T, "isFavorite" | "isSaved">>,
) {
  if (!current || current.id !== businessId) return current;
  return { ...current, ...patch };
}

function patchBusinessCollections(queryClient: QueryClient, businessId: number, patch: { isFavorite?: boolean; isSaved?: boolean }) {
  setQueriesData<{ businesses: Array<{ id: number; isFavorite: boolean; isSaved: boolean }> }>(queryClient, "businesses", (current) => {
    if (!current) return current;
    return {
      ...current,
      businesses: current.businesses.map((business) => (business.id === businessId ? { ...business, ...patch } : business)),
    };
  });

  setQueriesData<{ business: { id: number; isFavorite: boolean; isSaved: boolean } }>(queryClient, "business", (current) => {
    if (!current) return current;
    return {
      ...current,
      business: patchBusinessLike(current.business, businessId, patch) ?? current.business,
    };
  });
}

function appendSavedPlace(queryClient: QueryClient, businessId: number, note: string) {
  setQueriesData<UserDashboard>(queryClient, "user-dashboard", (current) => {
    if (!current) return current;
    const existing = current.savedPlaces.find((place) => place.businessId === businessId);
    if (existing) return current;

    const businessName = queryClient.getQueryData<{ business: { id: number; name: string } }>(["business", businessId])?.business.name ??
      (current.recommendation?.businessId === businessId ? current.recommendation.title : "Saved business");

    return {
      ...current,
      savedPlaces: [
        {
          id: tempId(),
          businessId,
          businessName,
          note: note || null,
          createdAt: nowIso(),
        },
        ...current.savedPlaces,
      ],
    };
  });
}

function removeSavedPlace(queryClient: QueryClient, businessId: number) {
  setQueriesData<UserDashboard>(queryClient, "user-dashboard", (current) => {
    if (!current) return current;
    return {
      ...current,
      savedPlaces: current.savedPlaces.filter((place) => place.businessId !== businessId),
    };
  });
}

function getAppointmentBusinessName(queryClient: QueryClient, businessId: number) {
  const business = queryClient.getQueryData<{ business: { name: string } }>(["business", businessId]);
  return business?.business.name ?? "Scheduled business";
}

function getAppointmentServiceName(queryClient: QueryClient, businessId: number, serviceId: number) {
  const business = queryClient.getQueryData<{ business: { services: Array<{ id: number; name: string }> } }>(["business", businessId]);
  return business?.business.services.find((service) => service.id === serviceId)?.name ?? "General service";
}

function addOptimisticAppointment(queryClient: QueryClient, input: AppointmentInput) {
  const optimisticAppointment: Appointment = {
    id: tempId(),
    businessId: input.businessId,
    businessName: getAppointmentBusinessName(queryClient, input.businessId),
    userId: 0,
    userName: "You",
    scheduledFor: input.scheduledFor,
    status: "pending",
    notes: input.notes || null,
    createdAt: nowIso(),
    serviceId: input.serviceId,
    serviceName: getAppointmentServiceName(queryClient, input.businessId, input.serviceId),
  };

  setQueriesData<{ appointments: Appointment[] }>(queryClient, "my-appointments", (current) => {
    if (!current) return { appointments: [optimisticAppointment] };
    return { ...current, appointments: [optimisticAppointment, ...current.appointments] };
  });

  setQueriesData<UserDashboard>(queryClient, "user-dashboard", (current) => {
    if (!current) return current;
    return {
      ...current,
      upcomingAppointments: [optimisticAppointment, ...current.upcomingAppointments],
    };
  });
}

function markAppointmentCancelled(queryClient: QueryClient, appointmentId: number) {
  setQueriesData<{ appointments: Appointment[] }>(queryClient, "my-appointments", (current) => {
    if (!current) return current;
    return {
      ...current,
      appointments: current.appointments.map((appointment) =>
        appointment.id === appointmentId ? { ...appointment, status: "cancelled" } : appointment,
      ),
    };
  });

  setQueriesData<UserDashboard>(queryClient, "user-dashboard", (current) => {
    if (!current) return current;
    return {
      ...current,
      upcomingAppointments: current.upcomingAppointments.filter((appointment) => appointment.id !== appointmentId),
    };
  });
}

function addFeedbackPlaceholder(queryClient: QueryClient, input: OfflineMutationPayloadMap["submit-feedback"]) {
  setQueriesData<{ visits: VisitHistoryItem[] }>(queryClient, "visit-history", (current) => {
    if (!current) return current;
    return {
      ...current,
      visits: current.visits.map((visit) =>
        visit.id === input.visitId ? { ...visit, canReview: false } : visit,
      ),
    };
  });
}

function buildOptimisticQueueEntry(queryClient: QueryClient, businessId: number, serviceId: number, clientEntryId: number): QueueEntry {
  const business = queryClient.getQueryData<{ business: { name: string; queueSettings: { pauseLimitMinutes: number }; services: Array<{ id: number; name: string }> } }>([
    "business",
    businessId,
  ]);
  const serviceName = business?.business.services.find((service) => service.id === serviceId)?.name ?? "General service";

  return {
    id: clientEntryId,
    businessId,
    businessName: business?.business.name ?? "Queued business",
    userId: 0,
    userName: "You",
    status: "waiting",
    queueNumber: "Pending sync",
    position: null,
    estimatedWaitMinutes: 0,
    joinedAt: nowIso(),
    calledAt: null,
    skipsUsed: 0,
    reschedulesUsed: 0,
    pauseLimitMinutes: business?.business.queueSettings.pauseLimitMinutes ?? 10,
    pauseStartedAt: null,
    pauseExpiresAt: null,
    totalPausedSeconds: 0,
    serviceId,
    serviceName,
    counterId: null,
    counterName: null,
    staffName: null,
    statusLabel: "Pending sync",
    statusDescription: "This queue join will sync when your connection returns.",
    availableGuestActions: {
      canPause: { allowed: false, reason: "Available after the server confirms your place." },
      canResume: { allowed: false, reason: "Available after the server confirms your place." },
      canSkip: { allowed: false, reason: "Available after the server confirms your place." },
      canReschedule: { allowed: false, reason: "Available after the server confirms your place." },
      canCancel: { allowed: true, reason: null },
    },
    availableOwnerActions: {
      canCall: { allowed: false, reason: null },
      canStartService: { allowed: false, reason: null },
      canComplete: { allowed: false, reason: null },
      canDelay: { allowed: false, reason: null },
      canNoShow: { allowed: false, reason: null },
      canAssign: { allowed: false, reason: null },
    },
    timeline: [
      {
        id: tempId(),
        queueEntryId: clientEntryId,
        eventType: "joined",
        label: "Queued offline",
        createdAt: nowIso(),
      },
    ],
  };
}

function addOptimisticQueueEntry(queryClient: QueryClient, businessId: number, serviceId: number, clientEntryId: number) {
  const optimisticEntry = buildOptimisticQueueEntry(queryClient, businessId, serviceId, clientEntryId);

  setQueriesData<{ entries: QueueEntry[] }>(queryClient, "my-queue", (current) => {
    if (!current) return { entries: [optimisticEntry] };
    return {
      ...current,
      entries: [optimisticEntry, ...current.entries],
    };
  });

  setQueriesData<UserDashboard>(queryClient, "user-dashboard", (current) => {
    if (!current) return current;
    return {
      ...current,
      activeEntries: [optimisticEntry, ...current.activeEntries],
    };
  });
}

function updateQueueStatus(
  queryClient: QueryClient,
  entryId: number,
  action: OfflineMutationPayloadMap["queue-action"]["action"],
) {
  const statusByAction: Record<OfflineMutationPayloadMap["queue-action"]["action"], QueueEntry["status"]> = {
    pause: "paused",
    resume: "waiting",
    skip: "waiting",
    reschedule: "waiting",
    cancel: "cancelled",
  };

  const statusLabelByAction: Record<OfflineMutationPayloadMap["queue-action"]["action"], string> = {
    pause: "Paused offline",
    resume: "Resume pending",
    skip: "Skip pending",
    reschedule: "Reschedule pending",
    cancel: "Cancelled offline",
  };

  setQueriesData<{ entries: QueueEntry[] }>(queryClient, "my-queue", (current) => {
    if (!current) return current;
    return {
      ...current,
      entries: current.entries.map((entry) =>
        entry.id === entryId
          ? {
              ...entry,
              status: statusByAction[action],
              statusLabel: statusLabelByAction[action],
              statusDescription: "This change will sync when you reconnect.",
            }
          : entry,
      ),
    };
  });
}

function updateNotifications(
  queryClient: QueryClient,
  updater: (notifications: NotificationItem[]) => NotificationItem[],
) {
  setQueriesData<{ notifications: NotificationItem[] }>(queryClient, "notifications", (current) => {
    if (!current) return current;
    return { ...current, notifications: updater(current.notifications) };
  });

  setQueriesData<UserDashboard>(queryClient, "user-dashboard", (current) => {
    if (!current) return current;
    return { ...current, notifications: updater(current.notifications) };
  });
}

function markAllNotificationsRead(queryClient: QueryClient) {
  updateNotifications(queryClient, (notifications) =>
    notifications.map((item) => ({
      ...item,
      isRead: true,
      readAt: item.readAt ?? nowIso(),
    })),
  );
}

export function applyOptimisticOfflineMutation(queryClient: QueryClient, mutation: OfflineMutation) {
  switch (mutation.kind) {
    case "favorite-business": {
      const payload = mutation.payload as OfflineMutationPayloadMap["favorite-business"];
      patchBusinessCollections(queryClient, payload.businessId, { isFavorite: true });
      return;
    }
    case "unfavorite-business": {
      const payload = mutation.payload as OfflineMutationPayloadMap["unfavorite-business"];
      patchBusinessCollections(queryClient, payload.businessId, { isFavorite: false });
      return;
    }
    case "save-place": {
      const payload = mutation.payload as OfflineMutationPayloadMap["save-place"];
      patchBusinessCollections(queryClient, payload.businessId, { isSaved: true });
      appendSavedPlace(queryClient, payload.businessId, payload.note);
      return;
    }
    case "remove-saved-place": {
      const payload = mutation.payload as OfflineMutationPayloadMap["remove-saved-place"];
      patchBusinessCollections(queryClient, payload.businessId, { isSaved: false });
      removeSavedPlace(queryClient, payload.businessId);
      return;
    }
    case "join-queue": {
      const payload = mutation.payload as OfflineMutationPayloadMap["join-queue"];
      addOptimisticQueueEntry(queryClient, payload.businessId, payload.serviceId, payload.clientEntryId);
      return;
    }
    case "queue-action": {
      const payload = mutation.payload as OfflineMutationPayloadMap["queue-action"];
      updateQueueStatus(queryClient, payload.entryId, payload.action);
      return;
    }
    case "create-appointment":
      addOptimisticAppointment(queryClient, mutation.payload as OfflineMutationPayloadMap["create-appointment"]);
      return;
    case "cancel-appointment": {
      const payload = mutation.payload as OfflineMutationPayloadMap["cancel-appointment"];
      markAppointmentCancelled(queryClient, payload.appointmentId);
      return;
    }
    case "submit-feedback":
      addFeedbackPlaceholder(queryClient, mutation.payload as OfflineMutationPayloadMap["submit-feedback"]);
      return;
    case "mark-notification-read": {
      const payload = mutation.payload as OfflineMutationPayloadMap["mark-notification-read"];
      updateNotifications(queryClient, (notifications) =>
        notifications.map((item) =>
          item.id === payload.notificationId ? { ...item, isRead: true, readAt: nowIso() } : item,
        ),
      );
      return;
    }
    case "mark-all-notifications-read":
      markAllNotificationsRead(queryClient);
      return;
    case "delete-notification": {
      const payload = mutation.payload as OfflineMutationPayloadMap["delete-notification"];
      updateNotifications(queryClient, (notifications) => notifications.filter((item) => item.id !== payload.notificationId));
      return;
    }
    case "delete-notifications": {
      const payload = mutation.payload as OfflineMutationPayloadMap["delete-notifications"];
      updateNotifications(queryClient, (notifications) => notifications.filter((item) => !payload.notificationIds.includes(item.id)));
      return;
    }
  }
}

export async function replayOfflineMutation(mutation: OfflineMutation) {
  switch (mutation.kind) {
    case "favorite-business":
      return await networkApi.favoriteBusiness((mutation.payload as OfflineMutationPayloadMap["favorite-business"]).businessId);
    case "unfavorite-business":
      return await networkApi.unfavoriteBusiness((mutation.payload as OfflineMutationPayloadMap["unfavorite-business"]).businessId);
    case "save-place": {
      const payload = mutation.payload as OfflineMutationPayloadMap["save-place"];
      return await networkApi.savePlace(payload.businessId, payload.note);
    }
    case "remove-saved-place":
      return await networkApi.removeSavedPlace((mutation.payload as OfflineMutationPayloadMap["remove-saved-place"]).businessId);
    case "join-queue": {
      const payload = mutation.payload as OfflineMutationPayloadMap["join-queue"];
      return await networkApi.joinQueue(payload.businessId, payload.serviceId);
    }
    case "queue-action": {
      const payload = mutation.payload as OfflineMutationPayloadMap["queue-action"];
      return await networkApi.queueAction(payload.entryId, payload.action);
    }
    case "create-appointment":
      return await networkApi.createAppointment(mutation.payload as OfflineMutationPayloadMap["create-appointment"]);
    case "cancel-appointment":
      return await networkApi.cancelAppointment((mutation.payload as OfflineMutationPayloadMap["cancel-appointment"]).appointmentId);
    case "submit-feedback":
      return await networkApi.submitFeedback(mutation.payload as OfflineMutationPayloadMap["submit-feedback"]);
    case "mark-notification-read":
      return await networkApi.markNotificationRead((mutation.payload as OfflineMutationPayloadMap["mark-notification-read"]).notificationId);
    case "mark-all-notifications-read":
      return await networkApi.markAllNotificationsRead();
    case "delete-notification":
      return await networkApi.deleteNotification((mutation.payload as OfflineMutationPayloadMap["delete-notification"]).notificationId);
    case "delete-notifications":
      return await networkApi.deleteNotifications((mutation.payload as OfflineMutationPayloadMap["delete-notifications"]).notificationIds);
  }
}

export function invalidateQueriesForMutation(queryClient: QueryClient, kind: OfflineMutationKind) {
  switch (kind) {
    case "favorite-business":
    case "unfavorite-business":
    case "save-place":
    case "remove-saved-place":
      void queryClient.invalidateQueries({ queryKey: ["businesses"] });
      void queryClient.invalidateQueries({ queryKey: ["business"] });
      void queryClient.invalidateQueries({ queryKey: ["business-markers"] });
      void queryClient.invalidateQueries({ queryKey: ["user-dashboard"] });
      return;
    case "join-queue":
    case "queue-action":
      void queryClient.invalidateQueries({ queryKey: accountQueryKeys.myQueue("anon") });
      void queryClient.invalidateQueries({ queryKey: ["my-queue"] });
      void queryClient.invalidateQueries({ queryKey: ["user-dashboard"] });
      return;
    case "create-appointment":
    case "cancel-appointment":
      void queryClient.invalidateQueries({ queryKey: ["my-appointments"] });
      void queryClient.invalidateQueries({ queryKey: ["user-dashboard"] });
      return;
    case "submit-feedback":
      void queryClient.invalidateQueries({ queryKey: ["visit-history"] });
      void queryClient.invalidateQueries({ queryKey: ["business"] });
      void queryClient.invalidateQueries({ queryKey: ["user-dashboard"] });
      return;
    case "mark-notification-read":
    case "mark-all-notifications-read":
    case "delete-notification":
    case "delete-notifications":
      void queryClient.invalidateQueries({ queryKey: ["notifications"] });
      void queryClient.invalidateQueries({ queryKey: ["user-dashboard"] });
      return;
  }
}
