import type {
  AdminActivityLogItem,
  AdminAccountRecord,
  AdminAnalytics,
  AdminAnnouncement,
  AdminAnnouncementInput,
  AdminAssignBusinessOwnerInput,
  AdminBusinessInput,
  AdminBusinessRecord,
  AdminBusinessUpdateInput,
  AdminClaimReviewInput,
  AdminCommandCenter,
  AdminForcedResetResult,
  AdminOverview,
  AdminOwnerTransferInput,
  AdminPlatformSettings,
  AdminRegisterInput,
  AdminSubscriptionRecord,
  AdminAccountStatusInput,
  Appointment,
  AppointmentInput,
  AppointmentUpdate,
  AssistantActionExecuteInput,
  AssistantFeedback,
  AssistantFeedbackInput,
  AssistantRequest,
  AssistantResponse,
  AdminAssistantAnalytics,
  AssistantThread,
  AuthPayload,
  BusinessClaimInput,
  BusinessClaimRequest,
  BusinessDetail,
  BusinessImportInput,
  BusinessListQuery,
  BusinessMapMarker,
  BusinessSubscription,
  BusinessSubscriptionUpdate,
  BusinessSummary,
  ChangePasswordInput,
  ConversationDetail,
  ConversationSummary,
  CreateConversationInput,
  CreateOwnerInput,
  DeleteAccountInput,
  ExternalBusinessDetail,
  ExternalBusinessSummary,
  FeedbackInput,
  ForgotPasswordInput,
  LoginInput,
  NotificationItem,
  OwnerRegisterInput,
  OwnerSignupBusinessSearchItem,
  OwnerBusinessHoursInput,
  OwnerBusinessProfileInput,
  OwnerCounterInput,
  OwnerDashboard,
  OwnerFeedbackReplyInput,
  OwnerNoticeInput,
  OwnerQueueAssignment,
  OwnerReceiptInput,
  OwnerReceiptSettingsInput,
  OwnerServiceInput,
  ProfileUpdateInput,
  QueueEntry,
  ReceiptItem,
  RegisterInput,
  ResetPasswordInput,
  SavedPlace,
  SendMessageInput,
  SupportConversationCreateInput,
  SupportConversationDetail,
  SupportConversationSummary,
  SupportConversationTriageInput,
  SupportMessageInput,
  SubscriptionPlanOption,
  UserProfile,
  UserPreferences,
  UserPreferencesUpdateInput,
  UserDashboard,
  VisitHistoryItem,
  OwnerEligibleReceiptVisit,
} from "@shared/api";
import { networkApi } from "@/lib/apiCore";
import { enqueueOfflineMutation } from "@/lib/offlineQueue";
import { queryClient } from "@/lib/queryClient";

function isOfflineLikeError(error: unknown) {
  if (typeof navigator !== "undefined" && !navigator.onLine) return true;
  return error instanceof TypeError;
}

async function queueWhenOffline<T>(options: {
  kind:
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
  payload: Record<string, unknown>;
  runOnline: () => Promise<T>;
  optimisticResult: (queuedMutationId: string) => T;
}) {
  try {
    return await options.runOnline();
  } catch (error) {
    if (!isOfflineLikeError(error)) {
      throw error;
    }

    const queuedMutationId = `${Date.now()}-${Math.round(Math.random() * 1_000_000)}`;
    await enqueueOfflineMutation(queryClient, options.kind as never, options.payload as never, { id: queuedMutationId });
    return options.optimisticResult(queuedMutationId);
  }
}

export const api = {
  me: () => networkApi.me() as Promise<{ user: AuthPayload["user"] | null }>,
  getProfile: () => networkApi.getProfile() as Promise<{ profile: UserProfile }>,
  updateProfile: (input: ProfileUpdateInput) =>
    networkApi.updateProfile(input) as Promise<{ profile: UserProfile; user: AuthPayload["user"] }>,
  getUserPreferences: () => networkApi.getUserPreferences() as Promise<{ preferences: UserPreferences }>,
  updateUserPreferences: (input: UserPreferencesUpdateInput) =>
    networkApi.updateUserPreferences(input) as Promise<{ preferences: UserPreferences }>,
  register: (input: RegisterInput) => networkApi.register(input) as Promise<AuthPayload>,
  registerOwner: (input: OwnerRegisterInput) => networkApi.registerOwner(input) as Promise<AuthPayload>,
  registerAdmin: (input: AdminRegisterInput) => networkApi.registerAdmin(input) as Promise<AuthPayload>,
  login: (input: LoginInput) => networkApi.login(input) as Promise<AuthPayload>,
  logout: () => networkApi.logout() as Promise<{ success: boolean }>,
  searchOwnerSignupBusinesses: (query: string) =>
    networkApi.searchOwnerSignupBusinesses(query) as Promise<{ businesses: OwnerSignupBusinessSearchItem[] }>,
  getOwnerSignupOptions: () => networkApi.getOwnerSignupOptions() as Promise<{ plans: SubscriptionPlanOption[] }>,
  forgotPassword: (input: ForgotPasswordInput) =>
    networkApi.forgotPassword(input) as Promise<{ success: boolean; resetLinkPreview?: string | null }>,
  resetPassword: (input: ResetPasswordInput) => networkApi.resetPassword(input) as Promise<{ success: boolean }>,
  changePassword: (input: ChangePasswordInput) => networkApi.changePassword(input) as Promise<{ success: boolean }>,
  deleteAccount: (input: DeleteAccountInput) => networkApi.deleteAccount(input) as Promise<{ success: boolean }>,

  getBusinesses: (query: Partial<BusinessListQuery> = {}) => networkApi.getBusinesses(query) as Promise<{ businesses: BusinessSummary[] }>,
  searchExternalBusinesses: (query: { q: string; lat?: number; lng?: number }) =>
    networkApi.searchExternalBusinesses(query) as Promise<{ results: ExternalBusinessSummary[] }>,
  getExternalBusiness: (provider: string, placeId: string) =>
    networkApi.getExternalBusiness(provider, placeId) as Promise<{ business: ExternalBusinessDetail }>,
  createBusinessClaim: (input: BusinessClaimInput) => networkApi.createBusinessClaim(input) as Promise<{ success: boolean }>,
  getBusiness: (id: number) => networkApi.getBusiness(id) as Promise<{ business: BusinessDetail }>,
  getBusinessMarkers: (query: Partial<BusinessListQuery> = {}) =>
    networkApi.getBusinessMarkers(query) as Promise<{ markers: BusinessMapMarker[] }>,
  favoriteBusiness: (id: number) =>
    queueWhenOffline({
      kind: "favorite-business",
      payload: { businessId: id },
      runOnline: () => networkApi.favoriteBusiness(id) as Promise<{ success: boolean }>,
      optimisticResult: () => ({ success: true }),
    }),
  unfavoriteBusiness: (id: number) =>
    queueWhenOffline({
      kind: "unfavorite-business",
      payload: { businessId: id },
      runOnline: () => networkApi.unfavoriteBusiness(id) as Promise<{ success: boolean }>,
      optimisticResult: () => ({ success: true }),
    }),
  savePlace: (businessId: number, note = "") =>
    queueWhenOffline({
      kind: "save-place",
      payload: { businessId, note },
      runOnline: () => networkApi.savePlace(businessId, note) as Promise<{ savedPlaces: SavedPlace[] }>,
      optimisticResult: () => ({ savedPlaces: [] }),
    }),
  removeSavedPlace: (businessId: number) =>
    queueWhenOffline({
      kind: "remove-saved-place",
      payload: { businessId },
      runOnline: () => networkApi.removeSavedPlace(businessId) as Promise<{ savedPlaces: SavedPlace[] }>,
      optimisticResult: () => ({ savedPlaces: [] }),
    }),

  getUserDashboard: () => networkApi.getUserDashboard() as Promise<UserDashboard>,
  getVisitHistory: () => networkApi.getVisitHistory() as Promise<{ visits: VisitHistoryItem[] }>,
  getReceipts: () => networkApi.getReceipts() as Promise<{ receipts: ReceiptItem[] }>,
  getConversations: (view: "active" | "archive" | "all" = "active") =>
    networkApi.getConversations(view) as Promise<{ conversations: ConversationSummary[] }>,
  getConversation: (id: number) => networkApi.getConversation(id) as Promise<{ conversation: ConversationDetail }>,
  createConversation: (input: CreateConversationInput) =>
    networkApi.createConversation(input) as Promise<{ conversation: ConversationDetail }>,
  sendMessage: (id: number, input: SendMessageInput) =>
    networkApi.sendMessage(id, input) as Promise<{ conversation: ConversationDetail }>,
  markConversationRead: (id: number) => networkApi.markConversationRead(id) as Promise<{ success: boolean }>,
  getAssistantThread: () => networkApi.getAssistantThread() as Promise<{ thread: AssistantThread }>,
  getSupportConversations: () => networkApi.getSupportConversations() as Promise<{ conversations: SupportConversationSummary[] }>,
  getSupportConversation: (id: number) => networkApi.getSupportConversation(id) as Promise<{ conversation: SupportConversationDetail }>,
  createSupportConversation: (input: SupportConversationCreateInput) =>
    networkApi.createSupportConversation(input) as Promise<{ conversation: SupportConversationDetail }>,
  sendSupportMessage: (id: number, input: SupportMessageInput) =>
    networkApi.sendSupportMessage(id, input) as Promise<{ conversation: SupportConversationDetail }>,
  markSupportConversationRead: (id: number) => networkApi.markSupportConversationRead(id) as Promise<{ success: boolean }>,
  askUserAssistant: (input: AssistantRequest) => networkApi.askUserAssistant(input) as Promise<AssistantResponse>,
  askOwnerAssistant: (input: AssistantRequest) => networkApi.askOwnerAssistant(input) as Promise<AssistantResponse>,
  askAdminAssistant: (input: AssistantRequest) => networkApi.askAdminAssistant(input) as Promise<AssistantResponse>,
  submitAssistantFeedback: (input: AssistantFeedbackInput) =>
    networkApi.submitAssistantFeedback(input) as Promise<{ feedback: AssistantFeedback; thread: AssistantThread }>,
  executeAssistantAction: (input: AssistantActionExecuteInput) =>
    networkApi.executeAssistantAction(input) as Promise<AssistantResponse>,

  joinQueue: (businessId: number, serviceId: number) =>
    (() => {
      const clientEntryId = -Date.now();
      return queueWhenOffline({
      kind: "join-queue",
      payload: { businessId, serviceId, clientEntryId },
      runOnline: () => networkApi.joinQueue(businessId, serviceId) as Promise<{ entryId: number; entries: QueueEntry[] }>,
      optimisticResult: () => ({ entryId: clientEntryId, entries: [] }),
    });
    })(),
  getMyQueue: () => networkApi.getMyQueue() as Promise<{ entries: QueueEntry[] }>,
  queueAction: (entryId: number, action: "pause" | "resume" | "skip" | "reschedule" | "cancel") =>
    queueWhenOffline({
      kind: "queue-action",
      payload: { entryId, action },
      runOnline: () => networkApi.queueAction(entryId, action) as Promise<{ entries: QueueEntry[]; result: { entryId: number; action: string; status: string; message: string } }>,
      optimisticResult: () => ({
        entries: [],
        result: {
          entryId,
          action,
          status: "queued",
          message: "This queue update is saved offline and will sync when you're back online.",
        },
      }),
    }),

  getAppointments: () => networkApi.getAppointments() as Promise<{ appointments: Appointment[] }>,
  createAppointment: (input: AppointmentInput) =>
    queueWhenOffline({
      kind: "create-appointment",
      payload: input,
      runOnline: () => networkApi.createAppointment(input) as Promise<{ appointments: Appointment[] }>,
      optimisticResult: () => ({ appointments: [] }),
    }),
  cancelAppointment: (id: number) =>
    queueWhenOffline({
      kind: "cancel-appointment",
      payload: { appointmentId: id },
      runOnline: () => networkApi.cancelAppointment(id) as Promise<{ appointments: Appointment[] }>,
      optimisticResult: () => ({ appointments: [] }),
    }),

  submitFeedback: (input: FeedbackInput) =>
    queueWhenOffline({
      kind: "submit-feedback",
      payload: input,
      runOnline: () => networkApi.submitFeedback(input) as Promise<{ visits: VisitHistoryItem[] }>,
      optimisticResult: () => ({ visits: [] }),
    }),

  getNotifications: () => networkApi.getNotifications() as Promise<{ notifications: NotificationItem[] }>,
  markNotificationRead: (id: number) =>
    queueWhenOffline({
      kind: "mark-notification-read",
      payload: { notificationId: id },
      runOnline: () => networkApi.markNotificationRead(id) as Promise<{ success: boolean }>,
      optimisticResult: () => ({ success: true }),
    }),
  markAllNotificationsRead: () =>
    queueWhenOffline({
      kind: "mark-all-notifications-read",
      payload: {},
      runOnline: () => networkApi.markAllNotificationsRead() as Promise<{ success: boolean }>,
      optimisticResult: () => ({ success: true }),
    }),
  deleteNotification: (id: number) =>
    queueWhenOffline({
      kind: "delete-notification",
      payload: { notificationId: id },
      runOnline: () => networkApi.deleteNotification(id) as Promise<{ success: boolean }>,
      optimisticResult: () => ({ success: true }),
    }),
  deleteNotifications: (ids: number[]) =>
    queueWhenOffline({
      kind: "delete-notifications",
      payload: { notificationIds: ids },
      runOnline: () => networkApi.deleteNotifications(ids) as Promise<{ success: boolean }>,
      optimisticResult: () => ({ success: true }),
    }),

  getOwnerDashboard: () => networkApi.getOwnerDashboard() as Promise<OwnerDashboard>,
  getOwnerReceipts: () =>
    networkApi.getOwnerReceipts() as Promise<{ receipts: ReceiptItem[]; eligibleVisits: OwnerEligibleReceiptVisit[]; supportsReceipts: boolean }>,
  createOwnerReceipt: (input: OwnerReceiptInput) => networkApi.createOwnerReceipt(input) as Promise<{ receipt: ReceiptItem }>,
  updateOwnerReceiptSettings: (input: OwnerReceiptSettingsInput) =>
    networkApi.updateOwnerReceiptSettings(input) as Promise<{ supportsReceipts: boolean }>,
  getOwnerSubscription: () => networkApi.getOwnerSubscription() as Promise<{ subscription: BusinessSubscription; plans: SubscriptionPlanOption[] }>,
  updateOwnerSubscription: (input: BusinessSubscriptionUpdate) =>
    networkApi.updateOwnerSubscription(input) as Promise<{ subscription: BusinessSubscription; plans: SubscriptionPlanOption[] }>,
  getOwnerQueue: () => networkApi.getOwnerQueue() as Promise<{ entries: QueueEntry[] }>,
  updateOwnerQueueOpenState: (open: boolean) => networkApi.updateOwnerQueueOpenState(open) as Promise<{ success: boolean }>,
  setOwnerQueueOpen: (open: boolean) => networkApi.updateOwnerQueueOpenState(open) as Promise<{ success: boolean }>,
  ownerQueueAction: (
    entryId: number,
    action: "call-next" | "in-service" | "delay" | "complete" | "no-show" | "called" | "in_service" | "delayed" | "completed" | "no_show",
  ) => {
    const backendAction =
      action === "call-next"
        ? "called"
        : action === "in-service"
          ? "in_service"
          : action === "delay"
            ? "delayed"
            : action === "complete"
              ? "completed"
              : action === "no-show"
                ? "no_show"
                : action;
    return networkApi.ownerQueueAction(entryId, backendAction) as Promise<{ success: boolean }>;
  },
  assignOwnerQueue: (entryId: number, input: OwnerQueueAssignment) =>
    networkApi.assignOwnerQueueEntry(entryId, input) as Promise<{ success: boolean }>,
  assignOwnerQueueEntry: (entryId: number, input: OwnerQueueAssignment) =>
    networkApi.assignOwnerQueueEntry(entryId, input) as Promise<{ success: boolean }>,
  updateOwnerAppointment: (id: number, input: AppointmentUpdate) =>
    networkApi.updateOwnerAppointment(id, input as { status: "approved" | "rejected" | "cancelled" | "completed" }) as Promise<{ success: boolean }>,
  createOwnerService: (input: OwnerServiceInput) => networkApi.createOwnerService(input) as Promise<{ services: OwnerDashboard["services"] }>,
  updateOwnerService: (id: number, input: Partial<OwnerServiceInput>) => networkApi.updateOwnerService(id, input) as Promise<{ success: boolean }>,
  createOwnerCounter: (input: OwnerCounterInput) => networkApi.createOwnerCounter(input) as Promise<{ counters: OwnerDashboard["counters"] }>,
  updateOwnerCounter: (id: number, input: Partial<OwnerCounterInput>) => networkApi.updateOwnerCounter(id, input) as Promise<{ success: boolean }>,
  createOwnerNotice: (input: OwnerNoticeInput) => networkApi.createOwnerNotice(input) as Promise<{ notices: OwnerDashboard["notices"] }>,
  updateOwnerNotice: (id: number, input: Partial<OwnerNoticeInput>) => networkApi.updateOwnerNotice(id, input) as Promise<{ success: boolean }>,
  updateOwnerHours: (input: OwnerBusinessHoursInput) => networkApi.updateOwnerHours(input) as Promise<{ success: boolean }>,
  updateOwnerBusinessProfile: (input: OwnerBusinessProfileInput) => networkApi.updateOwnerBusinessProfile(input) as Promise<{ success: boolean }>,
  replyToFeedback: (id: number, input: OwnerFeedbackReplyInput) => networkApi.replyToOwnerFeedback(id, input) as Promise<{ success: boolean }>,
  replyToOwnerFeedback: (id: number, input: OwnerFeedbackReplyInput) => networkApi.replyToOwnerFeedback(id, input) as Promise<{ success: boolean }>,
  getReceipt: (id: number) => networkApi.getReceipt(id) as Promise<{ receipt: ReceiptItem }>,
  downloadReceipt: async (id: number) => {
    const blob = await networkApi.getReceiptDownload(id);
    return { blob, fileName: `smart-queue-receipt-${id}.txt` };
  },
  getReceiptDownload: async (id: number) => {
    const blob = await networkApi.getReceiptDownload(id);
    return { blob, fileName: `smart-queue-receipt-${id}.txt` };
  },

  getAdminOverview: () => networkApi.getAdminOverview() as Promise<AdminOverview>,
  getAdminAnalytics: () => networkApi.getAdminAnalytics() as Promise<AdminAnalytics>,
  getAdminAssistantAnalytics: () => networkApi.getAdminAssistantAnalytics() as Promise<AdminAssistantAnalytics>,
  getAdminCommandCenter: () => networkApi.getAdminCommandCenter() as Promise<AdminCommandCenter>,
  getAdminBusinesses: () => networkApi.getAdminBusinesses() as Promise<{ businesses: AdminBusinessRecord[] }>,
  getAdminBusiness: (id: number) => networkApi.getAdminBusiness(id) as Promise<{ business: AdminBusinessRecord }>,
  updateAdminBusiness: (id: number, input: AdminBusinessUpdateInput) => networkApi.updateAdminBusiness(id, input) as Promise<{ success: boolean }>,
  deleteAdminBusiness: (id: number, input: { confirmation: string }) => networkApi.deleteAdminBusiness(id, input) as Promise<{ success: boolean }>,
  assignAdminBusinessOwner: (id: number, input: AdminAssignBusinessOwnerInput) =>
    networkApi.assignAdminBusinessOwner(id, input) as Promise<{ success: boolean }>,
  getAdminSubscriptions: () => networkApi.getAdminSubscriptions() as Promise<{ subscriptions: AdminSubscriptionRecord[]; plans: SubscriptionPlanOption[] }>,
  updateAdminSubscription: (businessId: number, input: BusinessSubscriptionUpdate) =>
    networkApi.updateAdminSubscription(businessId, input) as Promise<{ success: boolean }>,
  getAdminClaimRequests: () => networkApi.getAdminClaimRequests() as Promise<{ claims: BusinessClaimRequest[] }>,
  reviewAdminClaim: (id: number, input: AdminClaimReviewInput) => networkApi.reviewAdminClaim(id, input) as Promise<{ success: boolean }>,
  reviewAdminClaimRequest: (id: number, input: AdminClaimReviewInput) => networkApi.reviewAdminClaim(id, input) as Promise<{ success: boolean }>,
  importAdminBusiness: (input: BusinessImportInput) => networkApi.importAdminBusiness(input) as Promise<{ id: number }>,
  createAdminBusiness: (input: AdminBusinessInput) => networkApi.createAdminBusiness(input) as Promise<{ id: number }>,
  getAdminUsers: () => networkApi.getAdminUsers() as Promise<{ users: AuthPayload["user"][] }>,
  getAdminAccounts: () => networkApi.getAdminAccounts() as Promise<{ accounts: AdminAccountRecord[] }>,
  updateAdminAccountStatus: (id: number, input: AdminAccountStatusInput) =>
    networkApi.updateAdminAccountStatus(id, input) as Promise<{ success: boolean }>,
  deleteAdminAccount: (id: number, input: { confirmation: string }) => networkApi.deleteAdminAccount(id, input) as Promise<{ success: boolean }>,
  forceAdminAccountReset: (id: number) => networkApi.forceResetAdminAccount(id) as Promise<AdminForcedResetResult>,
  forceResetAdminAccount: (id: number) => networkApi.forceResetAdminAccount(id) as Promise<AdminForcedResetResult>,
  createOwner: (input: CreateOwnerInput) => networkApi.createAdminOwner(input) as Promise<{ success: boolean }>,
  createAdminOwner: (input: CreateOwnerInput) => networkApi.createAdminOwner(input) as Promise<{ success: boolean }>,
  transferAdminOwnerBusiness: (id: number, input: AdminOwnerTransferInput) =>
    networkApi.transferAdminOwnerBusiness(id, input) as Promise<{ success: boolean }>,
  updateAdminSupportTriage: (id: number, input: SupportConversationTriageInput) =>
    networkApi.triageAdminSupportConversation(id, input) as Promise<{ conversation: SupportConversationDetail }>,
  triageAdminSupportConversation: (id: number, input: SupportConversationTriageInput) =>
    networkApi.triageAdminSupportConversation(id, input) as Promise<{ conversation: SupportConversationDetail }>,
  getAdminActivityLog: () => networkApi.getAdminActivityLog() as Promise<{ activity: AdminActivityLogItem[] }>,
  getAdminAnnouncements: () => networkApi.getAdminAnnouncements() as Promise<{ announcements: AdminAnnouncement[] }>,
  createAdminAnnouncement: (input: AdminAnnouncementInput) =>
    networkApi.createAdminAnnouncement(input) as Promise<{ announcement: AdminAnnouncement | undefined }>,
  updateAdminAnnouncement: (id: number, input: AdminAnnouncementInput) =>
    networkApi.updateAdminAnnouncement(id, input) as Promise<{ announcement: AdminAnnouncement | undefined }>,
  getAdminPlatformSettings: () => networkApi.getAdminPlatformSettings() as Promise<{ settings: AdminPlatformSettings }>,
  updateAdminPlatformSettings: (input: Record<string, unknown>) =>
    networkApi.updateAdminPlatformSettings(input) as Promise<{ settings: AdminPlatformSettings }>,
};
