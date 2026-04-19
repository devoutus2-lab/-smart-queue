import type {
  AppointmentInput,
  AssistantActionExecuteInput,
  AssistantFeedbackInput,
  AssistantRequest,
  BusinessClaimInput,
  BusinessListQuery,
  BusinessSubscriptionUpdate,
  ChangePasswordInput,
  CreateConversationInput,
  DeleteAccountInput,
  FeedbackInput,
  ForgotPasswordInput,
  LoginInput,
  OwnerBusinessHoursInput,
  OwnerBusinessProfileInput,
  OwnerCounterInput,
  OwnerFeedbackReplyInput,
  OwnerNoticeInput,
  OwnerQueueAssignment,
  OwnerReceiptInput,
  OwnerReceiptSettingsInput,
  OwnerServiceInput,
  ProfileUpdateInput,
  ResetPasswordInput,
  SendMessageInput,
  SupportConversationCreateInput,
  SupportConversationTriageInput,
  SupportMessageInput,
  UserPreferencesUpdateInput,
  AdminAssignBusinessOwnerInput,
  AdminBusinessInput,
  AdminBusinessUpdateInput,
  AdminClaimReviewInput,
  AdminOwnerTransferInput,
  AdminRegisterInput,
  AdminAccountStatusInput,
  BusinessImportInput,
  CreateOwnerInput,
  OwnerRegisterInput,
  RegisterInput,
  AdminAnnouncementInput,
} from "@shared/api";

type ApiEnvelope<T> = {
  data?: T;
  error?: {
    message: string;
    code?: string;
  };
};

export async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    ...init,
  });
  const json = (await response.json()) as ApiEnvelope<T>;
  if (!response.ok || json.error) {
    throw new Error(json.error?.message ?? "Request failed");
  }
  return json.data as T;
}

export function buildQuery(params: Record<string, string | number | boolean | undefined>) {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== "") search.set(key, String(value));
  });
  return search.toString();
}

export const networkApi = {
  me: () => request("/api/auth/me"),
  getProfile: () => request("/api/profile/me"),
  updateProfile: (input: ProfileUpdateInput) => request("/api/profile/me", { method: "PATCH", body: JSON.stringify(input) }),
  getUserPreferences: () => request("/api/profile/preferences"),
  updateUserPreferences: (input: UserPreferencesUpdateInput) => request("/api/profile/preferences", { method: "PATCH", body: JSON.stringify(input) }),
  register: (input: RegisterInput) => request("/api/auth/register", { method: "POST", body: JSON.stringify(input) }),
  registerOwner: (input: OwnerRegisterInput) => request("/api/auth/register-owner", { method: "POST", body: JSON.stringify(input) }),
  registerAdmin: (input: AdminRegisterInput) => request("/api/auth/register-admin", { method: "POST", body: JSON.stringify(input) }),
  login: (input: LoginInput) => request("/api/auth/login", { method: "POST", body: JSON.stringify(input) }),
  logout: () => request("/api/auth/logout", { method: "POST" }),
  searchOwnerSignupBusinesses: (query: string) => request(`/api/auth/business-signup-search?${buildQuery({ q: query })}`),
  getOwnerSignupOptions: () => request("/api/auth/business-signup-options"),
  forgotPassword: (input: ForgotPasswordInput) => request("/api/auth/forgot-password", { method: "POST", body: JSON.stringify(input) }),
  resetPassword: (input: ResetPasswordInput) => request("/api/auth/reset-password", { method: "POST", body: JSON.stringify(input) }),
  changePassword: (input: ChangePasswordInput) => request("/api/auth/change-password", { method: "POST", body: JSON.stringify(input) }),
  deleteAccount: (input: DeleteAccountInput) => request("/api/auth/account", { method: "DELETE", body: JSON.stringify(input) }),
  getBusinesses: (query: Partial<BusinessListQuery> = {}) =>
    request(`/api/businesses?${buildQuery(query as Record<string, string | number | boolean | undefined>)}`),
  searchExternalBusinesses: (query: { q: string; lat?: number; lng?: number }) =>
    request(`/api/discovery/external?${buildQuery(query as Record<string, string | number | boolean | undefined>)}`),
  getExternalBusiness: (provider: string, placeId: string) => request(`/api/discovery/external/${provider}/${placeId}`),
  createBusinessClaim: (input: BusinessClaimInput) => request("/api/discovery/claims", { method: "POST", body: JSON.stringify(input) }),
  getBusiness: (id: number) => request(`/api/businesses/${id}`),
  getBusinessMarkers: (query: Partial<BusinessListQuery> = {}) =>
    request(`/api/businesses/map?${buildQuery(query as Record<string, string | number | boolean | undefined>)}`),
  favoriteBusiness: (id: number) => request(`/api/businesses/${id}/favorite`, { method: "POST" }),
  unfavoriteBusiness: (id: number) => request(`/api/businesses/${id}/favorite`, { method: "DELETE" }),
  savePlace: (businessId: number, note = "") => request(`/api/saved-places/${businessId}`, { method: "POST", body: JSON.stringify({ note }) }),
  removeSavedPlace: (businessId: number) => request(`/api/saved-places/${businessId}`, { method: "DELETE" }),
  getUserDashboard: () => request("/api/user/dashboard"),
  getVisitHistory: () => request("/api/user/history"),
  getReceipts: () => request("/api/user/receipts"),
  getConversations: (view: "active" | "archive" | "all" = "active") => request(`/api/chat/conversations?${buildQuery({ view })}`),
  getConversation: (id: number) => request(`/api/chat/conversations/${id}`),
  createConversation: (input: CreateConversationInput) => request("/api/chat/conversations", { method: "POST", body: JSON.stringify(input) }),
  sendMessage: (id: number, input: SendMessageInput) => request(`/api/chat/conversations/${id}/messages`, { method: "POST", body: JSON.stringify(input) }),
  markConversationRead: (id: number) => request(`/api/chat/conversations/${id}/read`, { method: "POST" }),
  getAssistantThread: () => request("/api/ai/thread"),
  getSupportConversations: () => request("/api/support/conversations"),
  getSupportConversation: (id: number) => request(`/api/support/conversations/${id}`),
  createSupportConversation: (input: SupportConversationCreateInput) => request("/api/support/conversations", { method: "POST", body: JSON.stringify(input) }),
  sendSupportMessage: (id: number, input: SupportMessageInput) => request(`/api/support/conversations/${id}/messages`, { method: "POST", body: JSON.stringify(input) }),
  markSupportConversationRead: (id: number) => request(`/api/support/conversations/${id}/read`, { method: "POST" }),
  askUserAssistant: (input: AssistantRequest) => request("/api/ai/user-assistant", { method: "POST", body: JSON.stringify(input) }),
  askOwnerAssistant: (input: AssistantRequest) => request("/api/ai/owner-assistant", { method: "POST", body: JSON.stringify(input) }),
  askAdminAssistant: (input: AssistantRequest) => request("/api/ai/admin-assistant", { method: "POST", body: JSON.stringify(input) }),
  submitAssistantFeedback: (input: AssistantFeedbackInput) => request("/api/ai/feedback", { method: "POST", body: JSON.stringify(input) }),
  executeAssistantAction: (input: AssistantActionExecuteInput) => request("/api/ai/execute-action", { method: "POST", body: JSON.stringify(input) }),
  joinQueue: (businessId: number, serviceId: number) => request("/api/queue/join", { method: "POST", body: JSON.stringify({ businessId, serviceId }) }),
  getMyQueue: () => request("/api/queue/my-active"),
  queueAction: (entryId: number, action: "pause" | "resume" | "skip" | "reschedule" | "cancel") => request(`/api/queue/${entryId}/${action}`, { method: "POST" }),
  getAppointments: () => request("/api/appointments/me"),
  createAppointment: (input: AppointmentInput) => request("/api/appointments", { method: "POST", body: JSON.stringify(input) }),
  cancelAppointment: (id: number) => request(`/api/appointments/${id}/cancel`, { method: "PATCH" }),
  submitFeedback: (input: FeedbackInput) => request("/api/feedback", { method: "POST", body: JSON.stringify(input) }),
  getNotifications: () => request("/api/notifications"),
  markNotificationRead: (id: number) => request(`/api/notifications/${id}/read`, { method: "POST" }),
  markAllNotificationsRead: () => request("/api/notifications/read-all", { method: "POST" }),
  deleteNotification: (id: number) => request(`/api/notifications/${id}`, { method: "DELETE" }),
  deleteNotifications: (ids: number[]) => request("/api/notifications/delete-batch", { method: "POST", body: JSON.stringify({ ids }) }),
  getOwnerDashboard: () => request("/api/owner/dashboard"),
  getOwnerReceipts: () => request("/api/owner/receipts"),
  createOwnerReceipt: (input: OwnerReceiptInput) => request("/api/owner/receipts", { method: "POST", body: JSON.stringify(input) }),
  updateOwnerReceiptSettings: (input: OwnerReceiptSettingsInput) => request("/api/owner/receipt-settings", { method: "PATCH", body: JSON.stringify(input) }),
  getOwnerSubscription: () => request("/api/owner/subscription"),
  updateOwnerSubscription: (input: BusinessSubscriptionUpdate) => request("/api/owner/subscription", { method: "PATCH", body: JSON.stringify(input) }),
  getOwnerQueue: () => request("/api/owner/queue"),
  updateOwnerQueueOpenState: (open: boolean) => request("/api/owner/queue/open-state", { method: "PATCH", body: JSON.stringify({ open }) }),
  ownerQueueAction: (entryId: number, action: "called" | "in_service" | "delayed" | "completed" | "no_show") =>
    request(`/api/owner/queue/${entryId}/${action}`, { method: "POST" }),
  assignOwnerQueueEntry: (entryId: number, input: OwnerQueueAssignment) => request(`/api/owner/queue/${entryId}/assign`, { method: "POST", body: JSON.stringify(input) }),
  updateOwnerAppointment: (id: number, input: { status: "approved" | "rejected" | "cancelled" | "completed" }) =>
    request(`/api/owner/appointments/${id}`, { method: "PATCH", body: JSON.stringify(input) }),
  createOwnerService: (input: OwnerServiceInput) => request("/api/owner/services", { method: "POST", body: JSON.stringify(input) }),
  updateOwnerService: (id: number, input: Partial<OwnerServiceInput>) => request(`/api/owner/services/${id}`, { method: "PATCH", body: JSON.stringify(input) }),
  createOwnerCounter: (input: OwnerCounterInput) => request("/api/owner/counters", { method: "POST", body: JSON.stringify(input) }),
  updateOwnerCounter: (id: number, input: Partial<OwnerCounterInput>) => request(`/api/owner/counters/${id}`, { method: "PATCH", body: JSON.stringify(input) }),
  createOwnerNotice: (input: OwnerNoticeInput) => request("/api/owner/notices", { method: "POST", body: JSON.stringify(input) }),
  updateOwnerNotice: (id: number, input: Partial<OwnerNoticeInput>) => request(`/api/owner/notices/${id}`, { method: "PATCH", body: JSON.stringify(input) }),
  updateOwnerHours: (input: OwnerBusinessHoursInput) => request("/api/owner/hours", { method: "PATCH", body: JSON.stringify(input) }),
  updateOwnerBusinessProfile: (input: OwnerBusinessProfileInput) => request("/api/owner/business-profile", { method: "PATCH", body: JSON.stringify(input) }),
  replyToOwnerFeedback: (id: number, input: OwnerFeedbackReplyInput) => request(`/api/owner/feedback/${id}/reply`, { method: "POST", body: JSON.stringify(input) }),
  getReceipt: (id: number) => request(`/api/receipts/${id}`),
  getReceiptDownload: async (id: number) => {
    const response = await fetch(`/api/receipts/${id}/download`, { credentials: "include" });
    if (!response.ok) {
      throw new Error("Download failed");
    }
    return response.blob();
  },
  getAdminOverview: () => request("/api/admin/overview"),
  getAdminAnalytics: () => request("/api/admin/analytics"),
  getAdminAssistantAnalytics: () => request("/api/admin/assistant-analytics"),
  getAdminCommandCenter: () => request("/api/admin/command-center"),
  getAdminBusinesses: () => request("/api/admin/businesses"),
  getAdminBusiness: (id: number) => request(`/api/admin/businesses/${id}`),
  updateAdminBusiness: (id: number, input: AdminBusinessUpdateInput) => request(`/api/admin/businesses/${id}`, { method: "PATCH", body: JSON.stringify(input) }),
  deleteAdminBusiness: (id: number, input: { confirmation: string }) => request(`/api/admin/businesses/${id}`, { method: "DELETE", body: JSON.stringify(input) }),
  assignAdminBusinessOwner: (id: number, input: AdminAssignBusinessOwnerInput) => request(`/api/admin/businesses/${id}/assign-owner`, { method: "POST", body: JSON.stringify(input) }),
  getAdminSubscriptions: () => request("/api/admin/subscriptions"),
  updateAdminSubscription: (businessId: number, input: BusinessSubscriptionUpdate) => request(`/api/admin/subscriptions/${businessId}`, { method: "PATCH", body: JSON.stringify(input) }),
  getAdminClaimRequests: () => request("/api/admin/claim-requests"),
  reviewAdminClaim: (id: number, input: AdminClaimReviewInput) => request(`/api/admin/claim-requests/${id}`, { method: "PATCH", body: JSON.stringify(input) }),
  importAdminBusiness: (input: BusinessImportInput) => request("/api/admin/import-business", { method: "POST", body: JSON.stringify(input) }),
  createAdminBusiness: (input: AdminBusinessInput) => request("/api/admin/businesses", { method: "POST", body: JSON.stringify(input) }),
  getAdminUsers: () => request("/api/admin/users"),
  getAdminAccounts: () => request("/api/admin/accounts"),
  updateAdminAccountStatus: (id: number, input: AdminAccountStatusInput) => request(`/api/admin/accounts/${id}/status`, { method: "PATCH", body: JSON.stringify(input) }),
  deleteAdminAccount: (id: number, input: { confirmation: string }) => request(`/api/admin/accounts/${id}`, { method: "DELETE", body: JSON.stringify(input) }),
  forceResetAdminAccount: (id: number) => request(`/api/admin/accounts/${id}/force-reset`, { method: "POST" }),
  createAdminOwner: (input: CreateOwnerInput) => request("/api/admin/owners", { method: "POST", body: JSON.stringify(input) }),
  transferAdminOwnerBusiness: (id: number, input: AdminOwnerTransferInput) => request(`/api/admin/owners/${id}/transfer-business`, { method: "POST", body: JSON.stringify(input) }),
  triageAdminSupportConversation: (id: number, input: SupportConversationTriageInput) =>
    request(`/api/admin/support/conversations/${id}/triage`, { method: "PATCH", body: JSON.stringify(input) }),
  getAdminActivityLog: () => request("/api/admin/activity-log"),
  getAdminAnnouncements: () => request("/api/admin/announcements"),
  createAdminAnnouncement: (input: AdminAnnouncementInput) => request("/api/admin/announcements", { method: "POST", body: JSON.stringify(input) }),
  updateAdminAnnouncement: (id: number, input: AdminAnnouncementInput) => request(`/api/admin/announcements/${id}`, { method: "PATCH", body: JSON.stringify(input) }),
  getAdminPlatformSettings: () => request("/api/admin/platform-settings"),
  updateAdminPlatformSettings: (input: Record<string, unknown>) => request("/api/admin/platform-settings", { method: "PUT", body: JSON.stringify(input) }),
};
