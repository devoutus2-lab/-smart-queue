import type { AuthPayload } from "@shared/api";

type SessionUser = AuthPayload["user"];

export const accountScopedQueryRoots = new Set([
  "notifications",
  "conversations",
  "conversation",
  "user-dashboard",
  "owner-dashboard",
  "profile",
  "user-preferences",
  "my-queue",
  "my-appointments",
  "visit-history",
  "receipts",
  "owner-receipts",
  "assistant-thread",
  "support-conversations",
  "support-conversation",
  "account-businesses",
  "account-business-markers",
]);

export function getAccountScope(user: SessionUser) {
  if (!user) {
    return {
      userId: "anon",
      role: "guest",
      ownerBusinessId: "no-business",
    } as const;
  }

  return {
    userId: String(user.id),
    role: user.role,
    ownerBusinessId: user.businessId != null ? String(user.businessId) : "no-business",
  } as const;
}

export const accountQueryKeys = {
  profile: (userId: string) => ["profile", userId] as const,
  userPreferences: (userId: string) => ["user-preferences", userId] as const,
  notifications: (role: string, userId: string) => ["notifications", role, userId] as const,
  userDashboard: (userId: string) => ["user-dashboard", userId] as const,
  ownerDashboard: (businessId: string) => ["owner-dashboard", businessId] as const,
  conversations: (role: string, scopeId: string, view: string) => ["conversations", role, scopeId, view] as const,
  conversation: (role: string, scopeId: string, conversationId: number | null) =>
    ["conversation", role, scopeId, conversationId ?? "none"] as const,
  myQueue: (userId: string) => ["my-queue", userId] as const,
  myAppointments: (userId: string) => ["my-appointments", userId] as const,
  visitHistory: (userId: string) => ["visit-history", userId] as const,
  receipts: (userId: string) => ["receipts", userId] as const,
  ownerReceipts: (businessId: string) => ["owner-receipts", businessId] as const,
  assistantThread: (role: string, scopeId: string) => ["assistant-thread", role, scopeId] as const,
  supportConversations: (role: string, scopeId: string) => ["support-conversations", role, scopeId] as const,
  supportConversation: (role: string, scopeId: string, conversationId: number | null) =>
    ["support-conversation", role, scopeId, conversationId ?? "none"] as const,
  accountBusinesses: (userId: string, query: unknown) => ["account-businesses", userId, query] as const,
  accountBusinessMarkers: (userId: string, query: unknown) => ["account-business-markers", userId, query] as const,
  scheduleBusinesses: (userId: string) => ["businesses", "schedule", userId] as const,
};
