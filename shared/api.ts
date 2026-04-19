import { z } from "zod";

export const roleSchema = z.enum(["user", "owner", "admin"]);
export type Role = z.infer<typeof roleSchema>;

export const queueStatusSchema = z.enum([
  "waiting",
  "called",
  "in_service",
  "paused",
  "completed",
  "cancelled",
  "no_show",
  "transferred",
  "delayed",
]);
export type QueueStatus = z.infer<typeof queueStatusSchema>;

export const appointmentStatusSchema = z.enum([
  "pending",
  "approved",
  "rejected",
  "converted",
  "expired",
  "cancelled",
  "completed",
]);
export type AppointmentStatus = z.infer<typeof appointmentStatusSchema>;

export const businessCategorySchema = z.enum([
  "restaurant",
  "bank",
  "hospital",
  "government",
  "salon",
  "retail",
]);
export type BusinessCategory = z.infer<typeof businessCategorySchema>;

export const businessSourceSchema = z.enum(["local", "imported", "external"]);
export type BusinessSource = z.infer<typeof businessSourceSchema>;

export const subscriptionIntervalSchema = z.enum(["monthly", "yearly"]);
export type SubscriptionInterval = z.infer<typeof subscriptionIntervalSchema>;

export const subscriptionStatusSchema = z.enum(["trial", "active", "cancelled", "expired", "past_due"]);
export type SubscriptionStatus = z.infer<typeof subscriptionStatusSchema>;

export const subscriptionPlanSchema = z.enum(["starter", "growth", "premium"]);
export type SubscriptionPlan = z.infer<typeof subscriptionPlanSchema>;

export const adminRecordStatusSchema = z.enum(["active", "suspended"]);
export type AdminRecordStatus = z.infer<typeof adminRecordStatusSchema>;

export const apiErrorSchema = z.object({
  message: z.string(),
  code: z.string().optional(),
  fieldErrors: z.record(z.string()).optional(),
});
export type ApiError = z.infer<typeof apiErrorSchema>;
export type ApiResponse<T> = { data?: T; error?: ApiError };

export const authUserSchema = z.object({
  id: z.number(),
  email: z.string().email(),
  name: z.string(),
  role: roleSchema,
  businessId: z.number().nullable(),
});
export type AuthUser = z.infer<typeof authUserSchema>;

export const userProfileSchema = z.object({
  id: z.number(),
  email: z.string().email(),
  name: z.string(),
  role: roleSchema,
  businessId: z.number().nullable(),
  phone: z.string().nullable(),
  bio: z.string().nullable(),
  avatarUrl: z.string().nullable(),
  location: z.string().nullable(),
});
export type UserProfile = z.infer<typeof userProfileSchema>;

export const userPreferencesSchema = z.object({
  emailSummaries: z.boolean().default(true),
  desktopNotifications: z.boolean().default(true),
  aiAssistant: z.boolean().default(true),
  travelTips: z.boolean().default(true),
});
export type UserPreferences = z.infer<typeof userPreferencesSchema>;

export const userPreferencesUpdateInputSchema = userPreferencesSchema;
export type UserPreferencesUpdateInput = z.infer<typeof userPreferencesUpdateInputSchema>;

export const authPayloadSchema = z.object({
  user: authUserSchema.nullable(),
});
export type AuthPayload = z.infer<typeof authPayloadSchema>;

export interface DemoResponse {
  message: string;
}

export const loginInputSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});
export type LoginInput = z.infer<typeof loginInputSchema>;

export const registerInputSchema = z.object({
  email: z.string().email(),
  name: z.string().min(2).max(80),
  password: z.string().min(6).max(128),
});
export type RegisterInput = z.infer<typeof registerInputSchema>;

export const ownerSignupBusinessSearchItemSchema = z.object({
  id: z.number().int().positive(),
  name: z.string(),
  category: businessCategorySchema,
  address: z.string(),
  subscriptionStatus: subscriptionStatusSchema.nullable(),
  subscriptionPlan: subscriptionPlanSchema.nullable(),
  hasActiveSubscription: z.boolean(),
});
export type OwnerSignupBusinessSearchItem = z.infer<typeof ownerSignupBusinessSearchItemSchema>;

export const ownerRegisterExistingBusinessTargetSchema = z.object({
  mode: z.literal("existing"),
  businessId: z.number().int().positive(),
  subscriptionPlan: subscriptionPlanSchema.nullable().optional(),
  subscriptionInterval: subscriptionIntervalSchema.nullable().optional(),
});
export type OwnerRegisterExistingBusinessTarget = z.infer<typeof ownerRegisterExistingBusinessTargetSchema>;

export const ownerRegisterNewBusinessTargetSchema = z.object({
  mode: z.literal("new"),
  businessName: z.string().min(2).max(120),
  category: businessCategorySchema,
  description: z.string().min(10).max(500),
  address: z.string().min(5).max(160),
  phone: z.string().min(7).max(40),
  businessEmail: z.string().email(),
  websiteUrl: z.string().trim().url().optional().or(z.literal("")).default(""),
  subscriptionPlan: subscriptionPlanSchema,
  subscriptionInterval: subscriptionIntervalSchema,
});
export type OwnerRegisterNewBusinessTarget = z.infer<typeof ownerRegisterNewBusinessTargetSchema>;

export const ownerRegisterTargetSchema = z.discriminatedUnion("mode", [
  ownerRegisterExistingBusinessTargetSchema,
  ownerRegisterNewBusinessTargetSchema,
]);
export type OwnerRegisterTarget = z.infer<typeof ownerRegisterTargetSchema>;

export const ownerRegisterInputSchema = z.object({
  email: z.string().email(),
  name: z.string().min(2).max(80),
  password: z.string().min(6).max(128),
  target: ownerRegisterTargetSchema,
});
export type OwnerRegisterInput = z.infer<typeof ownerRegisterInputSchema>;

export const adminRegisterInputSchema = z.object({
  email: z.string().email(),
  name: z.string().min(2).max(80),
  password: z.string().min(6).max(128),
  adminSecret: z.string().trim().min(6).max(120),
});
export type AdminRegisterInput = z.infer<typeof adminRegisterInputSchema>;

export const createOwnerInputSchema = z.object({
  email: z.string().email(),
  name: z.string().min(2).max(80),
  password: z.string().min(6).max(128),
  businessId: z.number().int().positive().nullable().optional(),
});
export type CreateOwnerInput = z.infer<typeof createOwnerInputSchema>;

export const forgotPasswordInputSchema = z.object({
  email: z.string().email(),
});
export type ForgotPasswordInput = z.infer<typeof forgotPasswordInputSchema>;

export const resetPasswordInputSchema = z.object({
  token: z.string().trim().min(20).max(200),
  password: z.string().min(6).max(128),
});
export type ResetPasswordInput = z.infer<typeof resetPasswordInputSchema>;

export const changePasswordInputSchema = z.object({
  currentPassword: z.string().min(6).max(128),
  newPassword: z.string().min(6).max(128),
});
export type ChangePasswordInput = z.infer<typeof changePasswordInputSchema>;

export const deleteAccountInputSchema = z.object({
  password: z.string().min(6).max(128),
  confirmation: z.string().trim().min(6).max(40),
});
export type DeleteAccountInput = z.infer<typeof deleteAccountInputSchema>;

export const profileUpdateInputSchema = z.object({
  name: z.string().min(2).max(80),
  email: z.string().email(),
  phone: z.string().trim().max(40).optional().default(""),
  bio: z.string().trim().max(240).optional().default(""),
  avatarUrl: z.string().trim().url().optional().or(z.literal("")).default(""),
  location: z.string().trim().max(120).optional().default(""),
});
export type ProfileUpdateInput = z.infer<typeof profileUpdateInputSchema>;

export const businessHourSchema = z.object({
  dayOfWeek: z.number().min(0).max(6),
  openTime: z.string(),
  closeTime: z.string(),
  isClosed: z.boolean(),
});
export type BusinessHour = z.infer<typeof businessHourSchema>;

export const queueSettingsSchema = z.object({
  averageServiceMinutes: z.number().int().min(1),
  maxSkips: z.number().int().min(0),
  maxReschedules: z.number().int().min(0),
  pauseLimitMinutes: z.number().int().min(0),
  bookingHorizonDays: z.number().int().min(1),
  isQueueOpen: z.boolean(),
});
export type QueueSettings = z.infer<typeof queueSettingsSchema>;

export const businessCapabilitySchema = z.object({
  supportsRemoteQueue: z.boolean(),
  supportsAppointments: z.boolean(),
  supportsReceipts: z.boolean(),
  isClaimable: z.boolean(),
});
export type BusinessCapability = z.infer<typeof businessCapabilitySchema>;

export const externalProviderSchema = z.object({
  provider: z.string(),
  placeId: z.string(),
});
export type ExternalProviderRef = z.infer<typeof externalProviderSchema>;

export const businessSubscriptionSchema = z.object({
  businessId: z.number(),
  plan: subscriptionPlanSchema,
  interval: subscriptionIntervalSchema,
  status: subscriptionStatusSchema,
  startedAt: z.string(),
  nextBillingAt: z.string().nullable(),
  endsAt: z.string().nullable(),
});
export type BusinessSubscription = z.infer<typeof businessSubscriptionSchema>;

export const subscriptionPlanOptionSchema = z.object({
  plan: subscriptionPlanSchema,
  name: z.string(),
  description: z.string(),
  monthlyLabel: z.string(),
  yearlyLabel: z.string(),
  highlights: z.array(z.string()),
});
export type SubscriptionPlanOption = z.infer<typeof subscriptionPlanOptionSchema>;

export const businessServiceSchema = z.object({
  id: z.number(),
  businessId: z.number(),
  name: z.string(),
  description: z.string(),
  averageServiceMinutes: z.number().int(),
  maxActiveQueue: z.number().int(),
  currentActiveQueue: z.number().int(),
  isAtCapacity: z.boolean(),
  supportsAppointments: z.boolean(),
  isActive: z.boolean(),
  estimatedWaitMinutes: z.number().int(),
});
export type BusinessService = z.infer<typeof businessServiceSchema>;

export const serviceCounterSchema = z.object({
  id: z.number(),
  businessId: z.number(),
  name: z.string(),
  status: z.enum(["open", "busy", "offline"]),
  activeServiceIds: z.array(z.number()),
  assignedStaffName: z.string().nullable(),
});
export type ServiceCounter = z.infer<typeof serviceCounterSchema>;

export const staffMemberSchema = z.object({
  id: z.number(),
  businessId: z.number(),
  name: z.string(),
  roleLabel: z.string(),
  status: z.enum(["available", "busy", "offline"]),
  activeCounterId: z.number().nullable(),
});
export type StaffMember = z.infer<typeof staffMemberSchema>;

export const businessNoticeSchema = z.object({
  id: z.number(),
  businessId: z.number(),
  title: z.string(),
  message: z.string(),
  severity: z.enum(["info", "warning", "urgent"]),
  isActive: z.boolean(),
  createdAt: z.string(),
});
export type BusinessNotice = z.infer<typeof businessNoticeSchema>;

export const feedbackSchema = z.object({
  id: z.number(),
  businessId: z.number(),
  userName: z.string(),
  rating: z.number().min(1).max(5),
  comment: z.string(),
  ownerReply: z.string().nullable(),
  createdAt: z.string(),
  visitLabel: z.string(),
});
export type FeedbackItem = z.infer<typeof feedbackSchema>;

export const trustSummarySchema = z.object({
  averageRating: z.number(),
  totalReviews: z.number().int(),
  recentFeedback: z.array(feedbackSchema),
});
export type TrustSummary = z.infer<typeof trustSummarySchema>;

export const bestTimeWindowSchema = z.object({
  label: z.string(),
  averageWaitMinutes: z.number().int(),
});
export type BestTimeWindow = z.infer<typeof bestTimeWindowSchema>;

export const businessSummarySchema = z.object({
  id: z.number(),
  slug: z.string(),
  name: z.string(),
  category: businessCategorySchema,
  description: z.string(),
  address: z.string(),
  phone: z.string().nullable(),
  email: z.string().nullable(),
  latitude: z.number(),
  longitude: z.number(),
  rating: z.number(),
  reviewsCount: z.number().int(),
  imageUrl: z.string().url(),
  websiteUrl: z.string().nullable().default(null),
  tags: z.array(z.string()),
  source: businessSourceSchema.default("local"),
  externalProvider: externalProviderSchema.nullable().default(null),
  linkedBusinessId: z.number().nullable().default(null),
  capabilities: businessCapabilitySchema,
  isOpenNow: z.boolean(),
  distanceKm: z.number().nullable(),
  favoritesCount: z.number().int(),
  activeQueueCount: z.number().int(),
  estimatedWaitMinutes: z.number().int(),
  isFavorite: z.boolean(),
  isSaved: z.boolean(),
  queueSettings: queueSettingsSchema,
  serviceHighlights: z.array(businessServiceSchema).default([]),
  trustSummary: trustSummarySchema,
});
export type BusinessSummary = z.infer<typeof businessSummarySchema>;

export const businessDetailSchema = businessSummarySchema.extend({
  hours: z.array(businessHourSchema),
  currentServingQueueEntryId: z.number().nullable(),
  services: z.array(businessServiceSchema),
  counters: z.array(serviceCounterSchema),
  notices: z.array(businessNoticeSchema),
  bestTimeWindows: z.array(bestTimeWindowSchema),
  recommendedDepartureMinutes: z.number().int().nullable(),
  subscription: businessSubscriptionSchema.nullable().default(null),
});
export type BusinessDetail = z.infer<typeof businessDetailSchema>;

export const externalDiscoveryQuerySchema = z.object({
  q: z.string().min(2),
  lat: z.coerce.number().optional(),
  lng: z.coerce.number().optional(),
});
export type ExternalDiscoveryQuery = z.infer<typeof externalDiscoveryQuerySchema>;

export const externalBusinessSummarySchema = businessSummarySchema.extend({
  id: z.number().default(0),
  slug: z.string(),
  source: businessSourceSchema.default("external"),
  externalProvider: externalProviderSchema,
  activeQueueCount: z.number().int().default(0),
  favoritesCount: z.number().int().default(0),
  isFavorite: z.boolean().default(false),
  isSaved: z.boolean().default(false),
  queueSettings: queueSettingsSchema,
  serviceHighlights: z.array(businessServiceSchema).default([]),
  trustSummary: trustSummarySchema,
});
export type ExternalBusinessSummary = z.infer<typeof externalBusinessSummarySchema>;

export const externalBusinessDetailSchema = businessDetailSchema.extend({
  source: businessSourceSchema.default("external"),
  externalProvider: externalProviderSchema,
});
export type ExternalBusinessDetail = z.infer<typeof externalBusinessDetailSchema>;

export const businessImportInputSchema = z.object({
  provider: z.string(),
  placeId: z.string(),
  name: z.string().min(2),
  category: businessCategorySchema,
  description: z.string().min(10),
  address: z.string().min(5),
  phone: z.string().optional().default(""),
  email: z.string().optional().default(""),
  websiteUrl: z.string().optional().default(""),
  latitude: z.number(),
  longitude: z.number(),
  imageUrl: z.string().url(),
  rating: z.number().min(0).max(5).default(0),
  reviewsCount: z.number().int().min(0).default(0),
  tags: z.array(z.string()).default([]),
});
export type BusinessImportInput = z.infer<typeof businessImportInputSchema>;

export const claimRequestStatusSchema = z.enum(["pending", "imported", "dismissed"]);
export type ClaimRequestStatus = z.infer<typeof claimRequestStatusSchema>;

export const businessClaimRequestSchema = z.object({
  id: z.number(),
  provider: z.string(),
  placeId: z.string(),
  businessName: z.string(),
  category: businessCategorySchema,
  address: z.string(),
  phone: z.string().nullable(),
  email: z.string().nullable(),
  websiteUrl: z.string().nullable(),
  latitude: z.number(),
  longitude: z.number(),
  imageUrl: z.string().url(),
  requestedByUserId: z.number(),
  requestedByName: z.string(),
  requestedByEmail: z.string().email(),
  status: claimRequestStatusSchema,
  reviewNotes: z.string().nullable().default(null),
  reviewedByAdminId: z.number().nullable().default(null),
  reviewedByAdminName: z.string().nullable().default(null),
  reviewedAt: z.string().nullable().default(null),
  createdAt: z.string(),
});
export type BusinessClaimRequest = z.infer<typeof businessClaimRequestSchema>;

export const businessClaimInputSchema = z.object({
  provider: z.string(),
  placeId: z.string(),
  businessName: z.string().min(2),
  category: businessCategorySchema,
  address: z.string().min(5),
  phone: z.string().optional().default(""),
  email: z.string().optional().default(""),
  websiteUrl: z.string().optional().default(""),
  latitude: z.number(),
  longitude: z.number(),
  imageUrl: z.string().url(),
});
export type BusinessClaimInput = z.infer<typeof businessClaimInputSchema>;

export const businessSubscriptionUpdateSchema = z.object({
  plan: subscriptionPlanSchema,
  interval: subscriptionIntervalSchema,
  status: subscriptionStatusSchema.optional(),
});
export type BusinessSubscriptionUpdate = z.infer<typeof businessSubscriptionUpdateSchema>;

export const businessListQuerySchema = z.object({
  q: z.string().optional(),
  category: businessCategorySchema.optional(),
  serviceId: z.coerce.number().optional(),
  openNow: z
    .union([z.literal("true"), z.literal("false")])
    .optional()
    .transform((value) => value === "true"),
  favoritesOnly: z
    .union([z.literal("true"), z.literal("false")])
    .optional()
    .transform((value) => value === "true"),
  savedOnly: z
    .union([z.literal("true"), z.literal("false")])
    .optional()
    .transform((value) => value === "true"),
  sort: z.enum(["recommended", "distance", "rating", "wait"]).optional(),
  lat: z.coerce.number().optional(),
  lng: z.coerce.number().optional(),
});
export type BusinessListQuery = z.infer<typeof businessListQuerySchema>;

export const businessMapMarkerSchema = z.object({
  id: z.number(),
  slug: z.string(),
  name: z.string(),
  category: businessCategorySchema,
  latitude: z.number(),
  longitude: z.number(),
  isOpenNow: z.boolean(),
  estimatedWaitMinutes: z.number().int(),
});
export type BusinessMapMarker = z.infer<typeof businessMapMarkerSchema>;

export const queueEventSchema = z.object({
  id: z.number(),
  queueEntryId: z.number(),
  eventType: z.string(),
  label: z.string(),
  createdAt: z.string(),
});
export type QueueEvent = z.infer<typeof queueEventSchema>;

export const queueActionAvailabilitySchema = z.object({
  allowed: z.boolean(),
  reason: z.string().nullable().default(null),
});
export type QueueActionAvailability = z.infer<typeof queueActionAvailabilitySchema>;

export const queueGuestActionAvailabilitySchema = z.object({
  canPause: queueActionAvailabilitySchema,
  canResume: queueActionAvailabilitySchema,
  canSkip: queueActionAvailabilitySchema,
  canReschedule: queueActionAvailabilitySchema,
  canCancel: queueActionAvailabilitySchema,
});
export type QueueGuestActionAvailability = z.infer<typeof queueGuestActionAvailabilitySchema>;

export const queueOwnerActionAvailabilitySchema = z.object({
  canCall: queueActionAvailabilitySchema,
  canStartService: queueActionAvailabilitySchema,
  canComplete: queueActionAvailabilitySchema,
  canDelay: queueActionAvailabilitySchema,
  canNoShow: queueActionAvailabilitySchema,
  canAssign: queueActionAvailabilitySchema,
});
export type QueueOwnerActionAvailability = z.infer<typeof queueOwnerActionAvailabilitySchema>;

export const queueRealtimeEventSchema = z.object({
  entryId: z.number().nullable(),
  businessId: z.number(),
  userId: z.number().nullable(),
  status: queueStatusSchema.nullable(),
  action: z.string(),
  changedAt: z.string(),
  message: z.string(),
  queueOrderChanged: z.boolean(),
  needsAssignmentAttention: z.boolean(),
  affectsJoinAvailability: z.boolean().default(false),
});
export type QueueRealtimeEvent = z.infer<typeof queueRealtimeEventSchema>;

export const receiptVisitTypeSchema = z.enum(["queue", "appointment"]);
export type ReceiptVisitType = z.infer<typeof receiptVisitTypeSchema>;

export const receiptStatusSchema = z.enum(["issued"]);
export type ReceiptStatus = z.infer<typeof receiptStatusSchema>;

export const queueEntrySchema = z.object({
  id: z.number(),
  businessId: z.number(),
  businessName: z.string(),
  userId: z.number(),
  userName: z.string(),
  status: queueStatusSchema,
  queueNumber: z.string(),
  position: z.number().int().min(1).nullable(),
  estimatedWaitMinutes: z.number().int(),
  joinedAt: z.string(),
  calledAt: z.string().nullable(),
  skipsUsed: z.number().int(),
  reschedulesUsed: z.number().int(),
  pauseLimitMinutes: z.number().int(),
  pauseStartedAt: z.string().nullable(),
  pauseExpiresAt: z.string().nullable(),
  totalPausedSeconds: z.number().int(),
  serviceId: z.number().nullable(),
  serviceName: z.string().nullable(),
  counterId: z.number().nullable(),
  counterName: z.string().nullable(),
  staffName: z.string().nullable(),
  statusLabel: z.string(),
  statusDescription: z.string(),
  availableGuestActions: queueGuestActionAvailabilitySchema,
  availableOwnerActions: queueOwnerActionAvailabilitySchema,
  timeline: z.array(queueEventSchema),
});
export type QueueEntry = z.infer<typeof queueEntrySchema>;

export const queueJoinInputSchema = z.object({
  businessId: z.number().int().positive(),
  serviceId: z.number().int().positive(),
});
export type QueueJoinInput = z.infer<typeof queueJoinInputSchema>;

export const appointmentSchema = z.object({
  id: z.number(),
  businessId: z.number(),
  businessName: z.string(),
  userId: z.number(),
  userName: z.string(),
  scheduledFor: z.string(),
  status: appointmentStatusSchema,
  notes: z.string().nullable(),
  createdAt: z.string(),
  serviceId: z.number().nullable(),
  serviceName: z.string().nullable(),
});
export type Appointment = z.infer<typeof appointmentSchema>;

export const appointmentInputSchema = z.object({
  businessId: z.number().int().positive(),
  serviceId: z.number().int().positive(),
  scheduledFor: z.string(),
  notes: z.string().trim().max(240).optional().default(""),
});
export type AppointmentInput = z.infer<typeof appointmentInputSchema>;

export const appointmentUpdateSchema = z.object({
  status: z.enum(["approved", "rejected", "cancelled", "completed"]),
});
export type AppointmentUpdate = z.infer<typeof appointmentUpdateSchema>;

export const notificationSchema = z.object({
  id: z.number(),
  type: z.string(),
  severity: z.enum(["success", "info", "warning", "error"]).default("info"),
  category: z.string().nullable().default(null),
  title: z.string(),
  message: z.string(),
  isRead: z.boolean(),
  readAt: z.string().nullable(),
  createdAt: z.string(),
  actionHref: z.string().nullable().default(null),
  actionLabel: z.string().nullable().default(null),
});
export type NotificationItem = z.infer<typeof notificationSchema>;

export const conversationStatusSchema = z.enum(["active", "closed", "archived"]);
export type ConversationStatus = z.infer<typeof conversationStatusSchema>;

export const conversationCloseReasonSchema = z.enum([
  "completed",
  "cancelled",
  "expired",
  "manual",
  "no_show",
  "transferred",
]);
export type ConversationCloseReason = z.infer<typeof conversationCloseReasonSchema>;

export const conversationVisitTypeSchema = z.enum(["pre_visit", "queue", "appointment"]);
export type ConversationVisitType = z.infer<typeof conversationVisitTypeSchema>;

export const conversationSummarySchema = z.object({
  id: z.number(),
  businessId: z.number(),
  businessName: z.string(),
  userId: z.number(),
  userName: z.string(),
  status: conversationStatusSchema,
  visitType: conversationVisitTypeSchema,
  queueEntryId: z.number().nullable(),
  appointmentId: z.number().nullable(),
  latestMessage: z.string().nullable(),
  latestMessageAt: z.string().nullable(),
  unreadCount: z.number().int(),
  contextLabel: z.string().nullable(),
  closeReason: conversationCloseReasonSchema.nullable(),
  closedAt: z.string().nullable(),
  archivedAt: z.string().nullable(),
});
export type ConversationSummary = z.infer<typeof conversationSummarySchema>;

export const messageSchema = z.object({
  id: z.number(),
  conversationId: z.number(),
  businessId: z.number(),
  senderRole: roleSchema,
  senderId: z.number(),
  senderName: z.string(),
  body: z.string(),
  createdAt: z.string(),
  readAt: z.string().nullable(),
});
export type ChatMessage = z.infer<typeof messageSchema>;

export const supportConversationStatusSchema = z.enum(["active", "in_progress", "resolved", "escalated"]);
export type SupportConversationStatus = z.infer<typeof supportConversationStatusSchema>;

export const supportConversationPrioritySchema = z.enum(["low", "medium", "high", "urgent"]);
export type SupportConversationPriority = z.infer<typeof supportConversationPrioritySchema>;

export const supportConversationCategorySchema = z.enum([
  "general",
  "bug",
  "technical",
  "account_access",
  "subscription",
  "data_issue",
  "onboarding",
  "business_setup",
]);
export type SupportConversationCategory = z.infer<typeof supportConversationCategorySchema>;

export const supportMessageSchema = z.object({
  id: z.number(),
  conversationId: z.number(),
  senderRole: roleSchema,
  senderId: z.number(),
  senderName: z.string(),
  body: z.string(),
  createdAt: z.string(),
  readAt: z.string().nullable(),
});
export type SupportMessage = z.infer<typeof supportMessageSchema>;

export const supportConversationSummarySchema = z.object({
  id: z.number(),
  requesterUserId: z.number(),
  requesterName: z.string(),
  requesterRole: roleSchema,
  assignedAdminId: z.number().nullable(),
  assignedAdminName: z.string().nullable(),
  subject: z.string(),
  status: supportConversationStatusSchema,
  priority: supportConversationPrioritySchema,
  category: supportConversationCategorySchema,
  latestMessage: z.string().nullable(),
  latestMessageAt: z.string().nullable(),
  unreadCount: z.number().int(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type SupportConversationSummary = z.infer<typeof supportConversationSummarySchema>;

export const supportConversationDetailSchema = supportConversationSummarySchema.extend({
  internalNotes: z.string().nullable().default(null),
  resolvedAt: z.string().nullable().default(null),
  messages: z.array(supportMessageSchema),
});
export type SupportConversationDetail = z.infer<typeof supportConversationDetailSchema>;

export const supportConversationCreateInputSchema = z.object({
  subject: z.string().trim().min(2).max(120).optional().default("Technical support"),
});
export type SupportConversationCreateInput = z.infer<typeof supportConversationCreateInputSchema>;

export const supportMessageInputSchema = z.object({
  body: z.string().trim().min(1).max(1200),
});
export type SupportMessageInput = z.infer<typeof supportMessageInputSchema>;

export const supportConversationTriageInputSchema = z.object({
  status: supportConversationStatusSchema,
  priority: supportConversationPrioritySchema,
  category: supportConversationCategorySchema,
  assignedAdminId: z.number().int().positive().nullable().optional(),
  internalNotes: z.string().trim().max(1200).optional().default(""),
});
export type SupportConversationTriageInput = z.infer<typeof supportConversationTriageInputSchema>;

export const conversationDetailSchema = conversationSummarySchema.extend({
  messages: z.array(messageSchema),
});
export type ConversationDetail = z.infer<typeof conversationDetailSchema>;

export const createConversationInputSchema = z.object({
  businessId: z.number().int().positive(),
});
export type CreateConversationInput = z.infer<typeof createConversationInputSchema>;

export const sendMessageInputSchema = z.object({
  body: z.string().trim().min(1).max(1000),
});
export type SendMessageInput = z.infer<typeof sendMessageInputSchema>;

export const assistantRequestSchema = z.object({
  businessId: z.number().int().positive().nullable().optional(),
  conversationId: z.number().int().positive().nullable().optional(),
  queueEntryId: z.number().int().positive().nullable().optional(),
  appointmentId: z.number().int().positive().nullable().optional(),
  pageContext: z
    .object({
      label: z.string().trim().min(1).max(120),
      path: z.string().trim().min(1).max(240),
    })
    .nullable()
    .optional(),
  prompt: z.string().trim().min(2).max(1500),
});
export type AssistantRequest = z.infer<typeof assistantRequestSchema>;

export const assistantStatusSchema = z.enum(["answered", "refused", "needs_confirmation", "action_result"]);
export type AssistantStatus = z.infer<typeof assistantStatusSchema>;

export const assistantResolutionStateSchema = z.enum(["resolved", "unresolved", "escalated", "needs_confirmation"]);
export type AssistantResolutionState = z.infer<typeof assistantResolutionStateSchema>;

export const assistantActionTypeSchema = z.enum([
  "join_queue",
  "create_appointment",
  "cancel_appointment",
  "queue_action",
  "toggle_favorite",
  "toggle_saved_place",
]);
export type AssistantActionType = z.infer<typeof assistantActionTypeSchema>;

export const assistantQueueActionSchema = z.enum(["pause", "resume", "skip", "reschedule", "cancel"]);
export type AssistantQueueAction = z.infer<typeof assistantQueueActionSchema>;

export const assistantActionProposalSchema = z.object({
  type: assistantActionTypeSchema,
  label: z.string(),
  confirmationMessage: z.string(),
  businessId: z.number().int().positive().nullable().optional(),
  serviceId: z.number().int().positive().nullable().optional(),
  appointmentId: z.number().int().positive().nullable().optional(),
  queueEntryId: z.number().int().positive().nullable().optional(),
  queueAction: assistantQueueActionSchema.nullable().optional(),
  scheduledFor: z.string().nullable().optional(),
  note: z.string().nullable().optional(),
  enable: z.boolean().nullable().optional(),
});
export type AssistantActionProposal = z.infer<typeof assistantActionProposalSchema>;

export const assistantActionExecuteInputSchema = assistantActionProposalSchema;
export type AssistantActionExecuteInput = z.infer<typeof assistantActionExecuteInputSchema>;

export const assistantActionResultSchema = z.object({
  type: assistantActionTypeSchema,
  success: z.boolean(),
  message: z.string(),
});
export type AssistantActionResult = z.infer<typeof assistantActionResultSchema>;

export const assistantThreadScopeSchema = roleSchema;
export type AssistantThreadScope = z.infer<typeof assistantThreadScopeSchema>;

export const assistantThreadMessageRoleSchema = z.enum(["user", "assistant"]);
export type AssistantThreadMessageRole = z.infer<typeof assistantThreadMessageRoleSchema>;

export const assistantThreadMessageKindSchema = z.enum(["prompt", "answer", "support_referral", "action_result"]);
export type AssistantThreadMessageKind = z.infer<typeof assistantThreadMessageKindSchema>;

export const assistantThreadMessageSchema = z.object({
  id: z.number(),
  threadId: z.number(),
  role: assistantThreadMessageRoleSchema,
  kind: assistantThreadMessageKindSchema,
  body: z.string(),
  resolutionState: assistantResolutionStateSchema.nullable().default(null),
  canRate: z.boolean().default(false),
  feedbackRating: z.number().int().min(1).max(5).nullable().default(null),
  feedbackComment: z.string().nullable().default(null),
  createdAt: z.string(),
});
export type AssistantThreadMessage = z.infer<typeof assistantThreadMessageSchema>;

export const assistantThreadSchema = z.object({
  id: z.number(),
  scope: assistantThreadScopeSchema,
  ownerUserId: z.number(),
  businessId: z.number().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
  messages: z.array(assistantThreadMessageSchema).default([]),
});
export type AssistantThread = z.infer<typeof assistantThreadSchema>;

export const assistantResponseSchema = z.object({
  status: assistantStatusSchema.default("answered"),
  message: z.string(),
  resolutionState: assistantResolutionStateSchema.default("unresolved"),
  canRate: z.boolean().default(false),
  suggestedReply: z.string().nullable().optional(),
  nextSteps: z.array(z.string()).default([]),
  recommendedBusinessAction: z.string().nullable().optional(),
  refusalReason: z.string().nullable().optional(),
  actionProposal: assistantActionProposalSchema.nullable().optional(),
  actionResult: assistantActionResultSchema.nullable().optional(),
  thread: assistantThreadSchema.nullable().optional(),
});
export type AssistantResponse = z.infer<typeof assistantResponseSchema>;

export const assistantFeedbackInputSchema = z.object({
  threadId: z.number().int().positive(),
  assistantMessageId: z.number().int().positive(),
  rating: z.number().int().min(1).max(5),
  comment: z.string().trim().max(240).optional().default(""),
});
export type AssistantFeedbackInput = z.infer<typeof assistantFeedbackInputSchema>;

export const assistantFeedbackSchema = z.object({
  id: z.number(),
  role: z.enum(["user", "owner"]),
  ownerUserId: z.number().int().positive(),
  threadId: z.number().int().positive(),
  assistantMessageId: z.number().int().positive(),
  rating: z.number().int().min(1).max(5),
  comment: z.string().nullable(),
  resolutionState: assistantResolutionStateSchema,
  createdAt: z.string(),
});
export type AssistantFeedback = z.infer<typeof assistantFeedbackSchema>;

export const savedPlaceSchema = z.object({
  id: z.number(),
  businessId: z.number(),
  businessName: z.string(),
  note: z.string().nullable(),
  createdAt: z.string(),
});
export type SavedPlace = z.infer<typeof savedPlaceSchema>;

export const receiptItemSchema = z.object({
  id: z.number(),
  businessId: z.number(),
  businessName: z.string(),
  userId: z.number(),
  userName: z.string(),
  ownerId: z.number(),
  visitType: receiptVisitTypeSchema,
  queueEntryId: z.number().nullable(),
  appointmentId: z.number().nullable(),
  serviceName: z.string().nullable(),
  referenceNumber: z.string(),
  status: receiptStatusSchema,
  ownerNote: z.string().nullable(),
  lineItemLabel: z.string().nullable(),
  amountCents: z.number().int().nullable(),
  totalCents: z.number().int().nullable(),
  paymentNote: z.string().nullable(),
  issuedAt: z.string(),
  completedAt: z.string().nullable(),
  scheduledFor: z.string().nullable(),
  downloadToken: z.string(),
});
export type ReceiptItem = z.infer<typeof receiptItemSchema>;

export const ownerEligibleReceiptVisitSchema = z.object({
  id: z.number(),
  businessId: z.number(),
  userId: z.number(),
  userName: z.string(),
  visitType: receiptVisitTypeSchema,
  serviceName: z.string().nullable(),
  status: z.string(),
  completedAt: z.string().nullable(),
  scheduledFor: z.string().nullable(),
  existingReceiptId: z.number().nullable(),
  existingReferenceNumber: z.string().nullable(),
});
export type OwnerEligibleReceiptVisit = z.infer<typeof ownerEligibleReceiptVisitSchema>;

export const visitHistoryItemSchema = z.object({
  id: z.number(),
  businessId: z.number(),
  businessName: z.string(),
  visitType: receiptVisitTypeSchema,
  serviceId: z.number().nullable(),
  serviceName: z.string().nullable(),
  status: z.string(),
  completedAt: z.string().nullable(),
  scheduledFor: z.string().nullable(),
  canRebook: z.boolean(),
  canReview: z.boolean(),
  receiptId: z.number().nullable(),
  canViewReceipt: z.boolean(),
});
export type VisitHistoryItem = z.infer<typeof visitHistoryItemSchema>;

export const userDashboardSchema = z.object({
  activeEntries: z.array(queueEntrySchema),
  upcomingAppointments: z.array(appointmentSchema),
  notifications: z.array(notificationSchema),
  savedPlaces: z.array(savedPlaceSchema),
  recentVisits: z.array(visitHistoryItemSchema),
  conversations: z.array(conversationSummarySchema).default([]),
  recommendation: z.object({
    kind: z.enum(["queue", "appointment", "messages", "discovery"]),
    title: z.string(),
    message: z.string(),
    primaryActionLabel: z.string(),
    primaryActionHref: z.string(),
    secondaryActionLabel: z.string().nullable().default(null),
    secondaryActionHref: z.string().nullable().default(null),
    businessId: z.number().nullable().default(null),
  }).nullable(),
});
export type UserDashboard = z.infer<typeof userDashboardSchema>;

export const ownerServiceInputSchema = z.object({
  name: z.string().trim().min(3).max(80),
  description: z.string().trim().min(8).max(240),
  averageServiceMinutes: z.number().int().min(5).max(240),
  maxActiveQueue: z.number().int().min(1).max(500),
  supportsAppointments: z.boolean(),
  isActive: z.boolean(),
});
export type OwnerServiceInput = z.infer<typeof ownerServiceInputSchema>;

export const ownerCounterInputSchema = z.object({
  name: z.string().trim().min(2).max(80),
  status: z.enum(["open", "busy", "offline"]),
  activeServiceIds: z.array(z.number().int().positive()),
  assignedStaffName: z.string().trim().max(80).optional().default(""),
}).superRefine((value, ctx) => {
  if (value.status !== "offline" && value.activeServiceIds.length === 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Active counters must support at least one service.",
      path: ["activeServiceIds"],
    });
  }
});
export type OwnerCounterInput = z.infer<typeof ownerCounterInputSchema>;

export const ownerNoticeInputSchema = z.object({
  title: z.string().trim().min(2).max(120),
  message: z.string().trim().min(8).max(240),
  severity: z.enum(["info", "warning", "urgent"]),
  isActive: z.boolean(),
});
export type OwnerNoticeInput = z.infer<typeof ownerNoticeInputSchema>;

export const ownerQueueAssignmentSchema = z.object({
  counterId: z.number().int().positive().nullable(),
  serviceId: z.number().int().positive().nullable(),
  staffName: z.string().trim().max(80).optional().default(""),
});
export type OwnerQueueAssignment = z.infer<typeof ownerQueueAssignmentSchema>;

export const feedbackInputSchema = z.object({
  businessId: z.number().int().positive(),
  visitId: z.number().int().positive(),
  rating: z.number().int().min(1).max(5),
  comment: z.string().trim().min(2).max(240),
});
export type FeedbackInput = z.infer<typeof feedbackInputSchema>;

export const ownerFeedbackReplySchema = z.object({
  reply: z.string().trim().min(2).max(240),
});
export type OwnerFeedbackReplyInput = z.infer<typeof ownerFeedbackReplySchema>;

export const ownerBusinessHoursInputSchema = z.object({
  hours: z.array(businessHourSchema).length(7),
}).superRefine((value, ctx) => {
  const seenDays = new Set<number>();
  value.hours.forEach((hour, index) => {
    if (seenDays.has(hour.dayOfWeek)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Each day can only be configured once.",
        path: ["hours", index, "dayOfWeek"],
      });
    }
    seenDays.add(hour.dayOfWeek);
    if (!hour.isClosed && hour.openTime >= hour.closeTime) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Open time must be earlier than close time.",
        path: ["hours", index, "closeTime"],
      });
    }
  });
});
export type OwnerBusinessHoursInput = z.infer<typeof ownerBusinessHoursInputSchema>;

export const ownerBusinessProfileInputSchema = z.object({
  name: z.string().trim().min(2).max(120),
  phone: z.string().trim().min(7).max(40),
  email: z.string().trim().email(),
  address: z.string().trim().min(5).max(160),
  websiteUrl: z.string().trim().url().optional().or(z.literal("")).default(""),
});
export type OwnerBusinessProfileInput = z.infer<typeof ownerBusinessProfileInputSchema>;

export const ownerReceiptInputSchema = z.object({
  visitType: receiptVisitTypeSchema,
  visitId: z.number().int().positive(),
  ownerNote: z.string().trim().max(240).optional().or(z.literal("")).default(""),
  lineItemLabel: z.string().trim().max(120).optional().or(z.literal("")).default(""),
  amountCents: z.number().int().min(0).nullable().optional().default(null),
  totalCents: z.number().int().min(0).nullable().optional().default(null),
  paymentNote: z.string().trim().max(120).optional().or(z.literal("")).default(""),
}).superRefine((value, ctx) => {
  if (value.amountCents != null && value.totalCents != null && value.totalCents < value.amountCents) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Total amount cannot be lower than the line item amount.",
      path: ["totalCents"],
    });
  }
});
export type OwnerReceiptInput = z.infer<typeof ownerReceiptInputSchema>;

export const ownerReceiptSettingsSchema = z.object({
  supportsReceipts: z.boolean(),
});
export type OwnerReceiptSettingsInput = z.infer<typeof ownerReceiptSettingsSchema>;

const ownerOperationsSummarySchema = z.object({
  kind: z.enum(["queue_attention", "appointments", "setup", "messages", "feedback", "steady"]),
  title: z.string(),
  message: z.string(),
  primaryActionLabel: z.string(),
  primaryActionHref: z.string(),
  secondaryActionLabel: z.string().nullable().default(null),
  secondaryActionHref: z.string().nullable().default(null),
});

export const ownerDashboardSchema = z.object({
  business: businessDetailSchema,
  subscription: businessSubscriptionSchema,
  subscriptionPlans: z.array(subscriptionPlanOptionSchema),
  operationsSummary: ownerOperationsSummarySchema,
  setupWarnings: z.array(z.string()).default([]),
  queueAttention: z.object({
    unassignedCount: z.number().int(),
    delayedCount: z.number().int(),
    blockedReadyCount: z.number().int(),
    activeCounterCount: z.number().int(),
    activeServiceCount: z.number().int(),
    canOperateSmoothly: z.boolean(),
  }),
  appointmentCounts: z.object({
    pending: z.number().int(),
    upcoming: z.number().int(),
    completed: z.number().int(),
    cancelled: z.number().int(),
  }),
  queueOpen: z.boolean(),
  activeCount: z.number().int(),
  waitingCount: z.number().int(),
  pausedCount: z.number().int(),
  calledCount: z.number().int(),
  averageWaitMinutes: z.number().int(),
  todayAppointments: z.number().int(),
  pendingAppointments: z.array(appointmentSchema),
  upcomingAppointments: z.array(appointmentSchema),
  recentAppointments: z.array(appointmentSchema),
  queueEntries: z.array(queueEntrySchema),
  conversations: z.array(conversationSummarySchema).default([]),
  services: z.array(businessServiceSchema),
  counters: z.array(serviceCounterSchema),
  staffMembers: z.array(staffMemberSchema),
  notices: z.array(businessNoticeSchema),
  feedback: z.array(feedbackSchema),
  analytics: z.object({
    last7Days: z.array(
      z.object({
        date: z.string(),
        label: z.string(),
        servedCount: z.number().int(),
        appointmentCount: z.number().int(),
        averageWaitMinutes: z.number().int(),
      }),
    ),
    servicePerformance: z.array(
      z.object({
        serviceId: z.number(),
        serviceName: z.string(),
        averageWaitMinutes: z.number().int(),
        throughputToday: z.number().int(),
      }),
    ),
    noShowCount: z.number().int(),
    appointmentConversionRate: z.number(),
    busiestWindows: z.array(bestTimeWindowSchema),
  }),
});
export type OwnerDashboard = z.infer<typeof ownerDashboardSchema>;

export const adminOverviewSchema = z.object({
  usersCount: z.number().int(),
  ownersCount: z.number().int(),
  businessesCount: z.number().int(),
  activeQueuesCount: z.number().int(),
  pendingAppointmentsCount: z.number().int(),
  servicesCount: z.number().int(),
  countersCount: z.number().int(),
  activeSubscriptionsCount: z.number().int(),
  pendingClaimsCount: z.number().int(),
});
export type AdminOverview = z.infer<typeof adminOverviewSchema>;

export const adminAnalyticsSchema = z.object({
  summary: adminOverviewSchema,
  hero: z.object({
    queueCompletionRate: z.number().int(),
    activeAccounts: z.number().int(),
    platformGrowth: z.number().int(),
    monthlyTargetProgress: z.number().int(),
    monthlyCompletedQueues: z.number().int(),
    monthlyTargetCount: z.number().int(),
  }),
  roleDistribution: z.object({
    users: z.number().int(),
    owners: z.number().int(),
    businesses: z.number().int(),
    total: z.number().int(),
  }),
  last7Days: z.array(
    z.object({
      date: z.string(),
      label: z.string(),
      completedQueues: z.number().int(),
    }),
  ),
  insights: z.object({
    bestDayLabel: z.string(),
    bestDayCount: z.number().int(),
    topSubscriptionPlan: subscriptionPlanSchema.nullable(),
    supportLoad: z.number().int(),
  }),
});
export type AdminAnalytics = z.infer<typeof adminAnalyticsSchema>;

export const adminAssistantAnalyticsLowRatedItemSchema = z.object({
  feedbackId: z.number(),
  role: z.enum(["user", "owner"]),
  ownerUserId: z.number(),
  ownerName: z.string(),
  threadId: z.number(),
  assistantMessageId: z.number(),
  rating: z.number().int().min(1).max(5),
  comment: z.string().nullable(),
  assistantMessage: z.string(),
  createdAt: z.string(),
});
export type AdminAssistantAnalyticsLowRatedItem = z.infer<typeof adminAssistantAnalyticsLowRatedItemSchema>;

export const adminAssistantAnalyticsSchema = z.object({
  totalAssistantSessions: z.number().int(),
  totalResolvedSessions: z.number().int(),
  resolvedRate: z.number(),
  totalEscalations: z.number().int(),
  escalationRate: z.number(),
  averageRating: z.number(),
  totalRatings: z.number().int(),
  ratingDistribution: z.object({
    1: z.number().int(),
    2: z.number().int(),
    3: z.number().int(),
    4: z.number().int(),
    5: z.number().int(),
  }),
  recentLowRatedSessions: z.array(adminAssistantAnalyticsLowRatedItemSchema),
});
export type AdminAssistantAnalytics = z.infer<typeof adminAssistantAnalyticsSchema>;

export const adminActivityLogItemSchema = z.object({
  id: z.number(),
  adminUserId: z.number().nullable(),
  adminName: z.string().nullable(),
  actionType: z.string(),
  targetType: z.string(),
  targetId: z.number().nullable(),
  summary: z.string(),
  createdAt: z.string(),
});
export type AdminActivityLogItem = z.infer<typeof adminActivityLogItemSchema>;

export const adminBusinessRecordSchema = businessDetailSchema.extend({
  recordStatus: adminRecordStatusSchema,
  moderationReason: z.string().nullable(),
  moderatedAt: z.string().nullable(),
  ownerId: z.number().nullable(),
  ownerName: z.string().nullable(),
  ownerEmail: z.string().nullable(),
  activeSupportConversationCount: z.number().int(),
  pendingClaimCount: z.number().int(),
  healthFlags: z.object({
    missingOwnerAssignment: z.boolean(),
    missingContactDetails: z.boolean(),
    highSupportLoad: z.boolean(),
    needsModerationNote: z.boolean(),
  }),
});
export type AdminBusinessRecord = z.infer<typeof adminBusinessRecordSchema>;

export const adminBusinessUpdateInputSchema = z.object({
  name: z.string().min(2).max(120),
  category: businessCategorySchema,
  description: z.string().min(10).max(500),
  address: z.string().min(5).max(160),
  phone: z.string().min(7).max(40),
  email: z.string().email(),
  websiteUrl: z.string().trim().url().optional().or(z.literal("")).default(""),
  recordStatus: adminRecordStatusSchema,
  moderationReason: z.string().trim().max(240).optional().default(""),
});
export type AdminBusinessUpdateInput = z.infer<typeof adminBusinessUpdateInputSchema>;

export const adminAssignBusinessOwnerInputSchema = z.object({
  ownerUserId: z.number().int().positive().nullable(),
});
export type AdminAssignBusinessOwnerInput = z.infer<typeof adminAssignBusinessOwnerInputSchema>;

export const adminAccountRecordSchema = z.object({
  id: z.number(),
  email: z.string().email(),
  name: z.string(),
  role: roleSchema,
  businessId: z.number().nullable(),
  businessName: z.string().nullable(),
  accountStatus: adminRecordStatusSchema,
  moderationReason: z.string().nullable(),
  moderatedAt: z.string().nullable(),
  createdAt: z.string(),
  lastSignInAt: z.string().nullable(),
  activeSessionCount: z.number().int(),
  queueCount: z.number().int(),
  appointmentCount: z.number().int(),
  conversationCount: z.number().int(),
  supportConversationCount: z.number().int(),
  savedPlaceCount: z.number().int(),
  healthFlags: z.object({
    needsModerationNote: z.boolean(),
    hasNoRecentSignIn: z.boolean(),
    highSupportLoad: z.boolean(),
    missingBusinessAssignment: z.boolean(),
  }),
});
export type AdminAccountRecord = z.infer<typeof adminAccountRecordSchema>;

export const adminAccountStatusInputSchema = z.object({
  accountStatus: adminRecordStatusSchema,
  moderationReason: z.string().trim().max(240).optional().default(""),
});
export type AdminAccountStatusInput = z.infer<typeof adminAccountStatusInputSchema>;

export const adminDeleteInputSchema = z.object({
  confirmation: z.string().trim().min(6).max(40),
});
export type AdminDeleteInput = z.infer<typeof adminDeleteInputSchema>;

export const adminOwnerTransferInputSchema = z.object({
  businessId: z.number().int().positive().nullable(),
});
export type AdminOwnerTransferInput = z.infer<typeof adminOwnerTransferInputSchema>;

export const adminForcedResetResultSchema = z.object({
  success: z.boolean(),
  resetLinkPreview: z.string().nullable(),
});
export type AdminForcedResetResult = z.infer<typeof adminForcedResetResultSchema>;

export const adminClaimReviewInputSchema = z.object({
  status: z.enum(["dismissed", "imported"]),
  reviewNotes: z.string().trim().max(240).optional().default(""),
});
export type AdminClaimReviewInput = z.infer<typeof adminClaimReviewInputSchema>;

export const adminSubscriptionRecordSchema = businessSubscriptionSchema.extend({
  businessName: z.string(),
  businessSlug: z.string(),
  recordStatus: adminRecordStatusSchema,
});
export type AdminSubscriptionRecord = z.infer<typeof adminSubscriptionRecordSchema>;

export const adminAnnouncementAudienceSchema = z.enum(["users", "owners", "all"]);
export type AdminAnnouncementAudience = z.infer<typeof adminAnnouncementAudienceSchema>;

export const adminAnnouncementStatusSchema = z.enum(["draft", "published", "archived"]);
export type AdminAnnouncementStatus = z.infer<typeof adminAnnouncementStatusSchema>;

export const adminAnnouncementSchema = z.object({
  id: z.number(),
  title: z.string(),
  message: z.string(),
  audience: adminAnnouncementAudienceSchema,
  status: adminAnnouncementStatusSchema,
  createdByAdminId: z.number().nullable(),
  createdByAdminName: z.string().nullable(),
  publishedAt: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type AdminAnnouncement = z.infer<typeof adminAnnouncementSchema>;

export const adminAnnouncementInputSchema = z.object({
  title: z.string().trim().min(2).max(120),
  message: z.string().trim().min(5).max(600),
  audience: adminAnnouncementAudienceSchema,
  status: adminAnnouncementStatusSchema.default("draft"),
});
export type AdminAnnouncementInput = z.infer<typeof adminAnnouncementInputSchema>;

export const adminPlatformSettingsSchema = z.object({
  assistantSupportEscalationEnabled: z.boolean(),
  supportAutoAssignEnabled: z.boolean(),
  defaultQueuePauseLimitMinutes: z.number().int().min(0).max(240),
  defaultBookingHorizonDays: z.number().int().min(1).max(90),
  claimsRequireManualReview: z.boolean(),
});
export type AdminPlatformSettings = z.infer<typeof adminPlatformSettingsSchema>;

export const adminCommandCenterSchema = z.object({
  operationsSummary: z.object({
    kind: z.enum(["support", "claims", "moderation", "subscriptions", "growth", "steady"]),
    title: z.string(),
    message: z.string(),
    primaryActionLabel: z.string(),
    primaryActionHref: z.string(),
    secondaryActionLabel: z.string().nullable().default(null),
    secondaryActionHref: z.string().nullable().default(null),
  }),
  unresolvedSupportCount: z.number().int(),
  pendingClaimsCount: z.number().int(),
  suspendedBusinessesCount: z.number().int(),
  suspendedAccountsCount: z.number().int(),
  expiringSubscriptionsCount: z.number().int(),
  supportQueue: z.object({
    activeCount: z.number().int(),
    inProgressCount: z.number().int(),
    escalatedCount: z.number().int(),
    unassignedCount: z.number().int(),
    staleCount: z.number().int(),
  }),
  claimsQueue: z.object({
    stalePendingCount: z.number().int(),
    importReadyCount: z.number().int(),
  }),
  moderationQueue: z.object({
    businessesMissingReasonCount: z.number().int(),
    accountsMissingReasonCount: z.number().int(),
  }),
  recentOwnerSignups: z.array(adminAccountRecordSchema).default([]),
  recentActivity: z.array(adminActivityLogItemSchema).default([]),
});
export type AdminCommandCenter = z.infer<typeof adminCommandCenterSchema>;

export const adminBusinessInputSchema = z.object({
  slug: z.string().min(2).max(80),
  name: z.string().min(2).max(120),
  category: businessCategorySchema,
  description: z.string().min(10).max(500),
  address: z.string().min(5).max(160),
  phone: z.string().min(7).max(40),
  email: z.string().email(),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  rating: z.number().min(0).max(5),
  reviewsCount: z.number().int().min(0),
  imageUrl: z.string().url(),
  tags: z.array(z.string()).min(1),
  queueSettings: queueSettingsSchema,
  hours: z.array(businessHourSchema).length(7),
  services: z.array(ownerServiceInputSchema).min(1),
  counters: z.array(ownerCounterInputSchema).default([]),
});
export type AdminBusinessInput = z.infer<typeof adminBusinessInputSchema>;
