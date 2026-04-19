import type {
  AppointmentInput,
  FeedbackInput,
} from "@shared/api";

export type OfflineMutationKind =
  | "favorite-business"
  | "unfavorite-business"
  | "save-place"
  | "remove-saved-place"
  | "join-queue"
  | "queue-action"
  | "create-appointment"
  | "cancel-appointment"
  | "submit-feedback"
  | "mark-notification-read"
  | "mark-all-notifications-read"
  | "delete-notification"
  | "delete-notifications";

export type OfflineMutationPayloadMap = {
  "favorite-business": { businessId: number };
  "unfavorite-business": { businessId: number };
  "save-place": { businessId: number; note: string };
  "remove-saved-place": { businessId: number };
  "join-queue": { businessId: number; serviceId: number; clientEntryId: number };
  "queue-action": { entryId: number; action: "pause" | "resume" | "skip" | "reschedule" | "cancel" };
  "create-appointment": AppointmentInput;
  "cancel-appointment": { appointmentId: number };
  "submit-feedback": FeedbackInput;
  "mark-notification-read": { notificationId: number };
  "mark-all-notifications-read": Record<string, never>;
  "delete-notification": { notificationId: number };
  "delete-notifications": { notificationIds: number[] };
};

export type OfflineMutation<K extends OfflineMutationKind = OfflineMutationKind> = {
  id: string;
  kind: K;
  payload: OfflineMutationPayloadMap[K];
  createdAt: string;
  status: "pending" | "failed";
  errorMessage?: string;
};

export type OfflineStatusSnapshot = {
  pendingCount: number;
  failedCount: number;
  lastSyncAt: string | null;
  syncing: boolean;
};
