import { integer, real, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const businessCategories = sqliteTable("business_categories", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  slug: text("slug").notNull().unique(),
  label: text("label").notNull(),
});

export const businesses = sqliteTable("businesses", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  categoryId: integer("category_id").notNull().references(() => businessCategories.id),
  description: text("description").notNull(),
  address: text("address").notNull(),
  phone: text("phone").notNull(),
  email: text("email").notNull(),
  latitude: real("latitude").notNull(),
  longitude: real("longitude").notNull(),
  rating: real("rating").notNull().default(0),
  reviewsCount: integer("reviews_count").notNull().default(0),
  imageUrl: text("image_url").notNull(),
  websiteUrl: text("website_url"),
  tagsJson: text("tags_json").notNull().default("[]"),
  source: text("source").notNull().default("local"),
  externalProvider: text("external_provider"),
  externalPlaceId: text("external_place_id"),
  averageServiceMinutes: integer("average_service_minutes").notNull().default(15),
  maxSkips: integer("max_skips").notNull().default(2),
  maxReschedules: integer("max_reschedules").notNull().default(2),
  pauseLimitMinutes: integer("pause_limit_minutes").notNull().default(30),
  bookingHorizonDays: integer("booking_horizon_days").notNull().default(14),
  isQueueOpen: integer("is_queue_open", { mode: "boolean" }).notNull().default(false),
  supportsReceipts: integer("supports_receipts", { mode: "boolean" }).notNull().default(false),
  recordStatus: text("record_status").notNull().default("active"),
  moderationReason: text("moderation_reason"),
  moderatedAt: text("moderated_at"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const businessHours = sqliteTable("business_hours", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  businessId: integer("business_id").notNull().references(() => businesses.id),
  dayOfWeek: integer("day_of_week").notNull(),
  openTime: text("open_time").notNull(),
  closeTime: text("close_time").notNull(),
  isClosed: integer("is_closed", { mode: "boolean" }).notNull().default(false),
});

export const businessServices = sqliteTable("business_services", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  businessId: integer("business_id").notNull().references(() => businesses.id),
  name: text("name").notNull(),
  description: text("description").notNull(),
  averageServiceMinutes: integer("average_service_minutes").notNull(),
  maxActiveQueue: integer("max_active_queue").notNull().default(20),
  supportsAppointments: integer("supports_appointments", { mode: "boolean" }).notNull().default(true),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  createdAt: text("created_at").notNull(),
});

export const serviceCounters = sqliteTable("service_counters", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  businessId: integer("business_id").notNull().references(() => businesses.id),
  name: text("name").notNull(),
  status: text("status").notNull(),
  activeServiceIdsJson: text("active_service_ids_json").notNull().default("[]"),
  assignedStaffName: text("assigned_staff_name"),
  createdAt: text("created_at").notNull(),
});

export const staffMembers = sqliteTable("staff_members", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  businessId: integer("business_id").notNull().references(() => businesses.id),
  name: text("name").notNull(),
  roleLabel: text("role_label").notNull(),
  status: text("status").notNull(),
  activeCounterId: integer("active_counter_id").references(() => serviceCounters.id),
  createdAt: text("created_at").notNull(),
});

export const users = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  passwordHash: text("password_hash").notNull(),
  passwordResetTokenHash: text("password_reset_token_hash"),
  passwordResetExpiresAt: text("password_reset_expires_at"),
  role: text("role").notNull(),
  businessId: integer("business_id").references(() => businesses.id),
  phone: text("phone"),
  bio: text("bio"),
  avatarUrl: text("avatar_url"),
  location: text("location"),
  accountStatus: text("account_status").notNull().default("active"),
  moderationReason: text("moderation_reason"),
  moderatedAt: text("moderated_at"),
  lastSignInAt: text("last_sign_in_at"),
  createdAt: text("created_at").notNull(),
});

export const sessions = sqliteTable("sessions", {
  id: text("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  expiresAt: text("expires_at").notNull(),
  createdAt: text("created_at").notNull(),
});

export const userPreferences = sqliteTable("user_preferences", {
  userId: integer("user_id").primaryKey().references(() => users.id),
  emailSummaries: integer("email_summaries", { mode: "boolean" }).notNull().default(true),
  desktopNotifications: integer("desktop_notifications", { mode: "boolean" }).notNull().default(true),
  aiAssistant: integer("ai_assistant", { mode: "boolean" }).notNull().default(true),
  travelTips: integer("travel_tips", { mode: "boolean" }).notNull().default(true),
  updatedAt: text("updated_at").notNull(),
});

export const queueEntries = sqliteTable("queue_entries", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  businessId: integer("business_id").notNull().references(() => businesses.id),
  userId: integer("user_id").notNull().references(() => users.id),
  serviceId: integer("service_id").references(() => businessServices.id),
  counterId: integer("counter_id").references(() => serviceCounters.id),
  staffName: text("staff_name"),
  status: text("status").notNull(),
  queueNumber: text("queue_number").notNull(),
  queueOrderKey: text("queue_order_key").notNull().default(""),
  joinedAt: text("joined_at").notNull(),
  calledAt: text("called_at"),
  completedAt: text("completed_at"),
  cancelledAt: text("cancelled_at"),
  pauseStartedAt: text("pause_started_at"),
  totalPausedSeconds: integer("total_paused_seconds").notNull().default(0),
  skipsUsed: integer("skips_used").notNull().default(0),
  reschedulesUsed: integer("reschedules_used").notNull().default(0),
  estimatedWaitMinutes: integer("estimated_wait_minutes").notNull().default(0),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const queueEvents = sqliteTable("queue_events", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  queueEntryId: integer("queue_entry_id").notNull().references(() => queueEntries.id),
  eventType: text("event_type").notNull(),
  label: text("label").notNull(),
  createdAt: text("created_at").notNull(),
});

export const conversations = sqliteTable("conversations", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  businessId: integer("business_id").notNull().references(() => businesses.id),
  userId: integer("user_id").notNull().references(() => users.id),
  ownerId: integer("owner_id").references(() => users.id),
  status: text("status").notNull().default("active"),
  visitType: text("visit_type").notNull().default("pre_visit"),
  queueEntryId: integer("queue_entry_id").references(() => queueEntries.id),
  appointmentId: integer("appointment_id").references(() => appointments.id),
  contextLabel: text("context_label"),
  closeReason: text("close_reason"),
  closedAt: text("closed_at"),
  archivedAt: text("archived_at"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const messages = sqliteTable("messages", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  conversationId: integer("conversation_id").notNull().references(() => conversations.id),
  businessId: integer("business_id").notNull().references(() => businesses.id),
  senderRole: text("sender_role").notNull(),
  senderId: integer("sender_id").notNull().references(() => users.id),
  body: text("body").notNull(),
  createdAt: text("created_at").notNull(),
  readAt: text("read_at"),
});

export const assistantThreads = sqliteTable(
  "assistant_threads",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    scope: text("scope").notNull(),
    ownerUserId: integer("owner_user_id").notNull().references(() => users.id),
    businessId: integer("business_id").references(() => businesses.id),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => ({
    assistantThreadOwnerScopeIdx: uniqueIndex("assistant_threads_owner_scope_idx").on(table.scope, table.ownerUserId),
  }),
);

export const assistantMessages = sqliteTable("assistant_messages", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  threadId: integer("thread_id").notNull().references(() => assistantThreads.id),
  role: text("role").notNull(),
  kind: text("kind").notNull(),
  body: text("body").notNull(),
  resolutionState: text("resolution_state"),
  canRate: integer("can_rate", { mode: "boolean" }).notNull().default(false),
  createdAt: text("created_at").notNull(),
});

export const assistantFeedback = sqliteTable(
  "assistant_feedback",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    role: text("role").notNull(),
    ownerUserId: integer("owner_user_id").notNull().references(() => users.id),
    threadId: integer("thread_id").notNull().references(() => assistantThreads.id),
    assistantMessageId: integer("assistant_message_id").notNull().references(() => assistantMessages.id),
    rating: integer("rating").notNull(),
    comment: text("comment"),
    resolutionState: text("resolution_state").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (table) => ({
    assistantFeedbackMessageIdx: uniqueIndex("assistant_feedback_message_idx").on(table.assistantMessageId),
  }),
);

export const supportConversations = sqliteTable("support_conversations", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  requesterUserId: integer("requester_user_id").notNull().references(() => users.id),
  assignedAdminId: integer("assigned_admin_id").references(() => users.id),
  subject: text("subject").notNull(),
  status: text("status").notNull().default("active"),
  priority: text("priority").notNull().default("medium"),
  category: text("category").notNull().default("general"),
  internalNotes: text("internal_notes"),
  resolvedAt: text("resolved_at"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const supportMessages = sqliteTable("support_messages", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  conversationId: integer("conversation_id").notNull().references(() => supportConversations.id),
  senderRole: text("sender_role").notNull(),
  senderId: integer("sender_id").notNull().references(() => users.id),
  body: text("body").notNull(),
  createdAt: text("created_at").notNull(),
  readAt: text("read_at"),
});

export const appointments = sqliteTable("appointments", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  businessId: integer("business_id").notNull().references(() => businesses.id),
  userId: integer("user_id").notNull().references(() => users.id),
  serviceId: integer("service_id").references(() => businessServices.id),
  scheduledFor: text("scheduled_for").notNull(),
  status: text("status").notNull(),
  notes: text("notes"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const visitFeedback = sqliteTable("visit_feedback", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  businessId: integer("business_id").notNull().references(() => businesses.id),
  userId: integer("user_id").notNull().references(() => users.id),
  queueEntryId: integer("queue_entry_id").references(() => queueEntries.id),
  appointmentId: integer("appointment_id").references(() => appointments.id),
  rating: integer("rating").notNull(),
  comment: text("comment").notNull(),
  ownerReply: text("owner_reply"),
  createdAt: text("created_at").notNull(),
});

export const visitReceipts = sqliteTable("visit_receipts", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  businessId: integer("business_id").notNull().references(() => businesses.id),
  userId: integer("user_id").notNull().references(() => users.id),
  ownerId: integer("owner_id").notNull().references(() => users.id),
  queueEntryId: integer("queue_entry_id").references(() => queueEntries.id),
  appointmentId: integer("appointment_id").references(() => appointments.id),
  visitType: text("visit_type").notNull(),
  referenceNumber: text("reference_number").notNull(),
  status: text("status").notNull().default("issued"),
  ownerNote: text("owner_note"),
  lineItemLabel: text("line_item_label"),
  amountCents: integer("amount_cents"),
  totalCents: integer("total_cents"),
  paymentNote: text("payment_note"),
  downloadToken: text("download_token").notNull(),
  issuedAt: text("issued_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const businessNotices = sqliteTable("business_notices", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  businessId: integer("business_id").notNull().references(() => businesses.id),
  title: text("title").notNull(),
  message: text("message").notNull(),
  severity: text("severity").notNull(),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  createdAt: text("created_at").notNull(),
});

export const favorites = sqliteTable(
  "favorites",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: integer("user_id").notNull().references(() => users.id),
    businessId: integer("business_id").notNull().references(() => businesses.id),
    createdAt: text("created_at").notNull(),
  },
  (table) => ({
    favoriteUnique: uniqueIndex("favorites_user_business_idx").on(table.userId, table.businessId),
  }),
);

export const savedPlaces = sqliteTable(
  "saved_places",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: integer("user_id").notNull().references(() => users.id),
    businessId: integer("business_id").notNull().references(() => businesses.id),
    note: text("note"),
    createdAt: text("created_at").notNull(),
  },
  (table) => ({
    savedPlaceUnique: uniqueIndex("saved_places_user_business_idx").on(table.userId, table.businessId),
  }),
);

export const notifications = sqliteTable("notifications", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id").notNull().references(() => users.id),
  type: text("type").notNull(),
  severity: text("severity").notNull().default("info"),
  category: text("category"),
  title: text("title").notNull(),
  message: text("message").notNull(),
  isRead: integer("is_read", { mode: "boolean" }).notNull().default(false),
  readAt: text("read_at"),
  createdAt: text("created_at").notNull(),
});

export const businessSubscriptions = sqliteTable("business_subscriptions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  businessId: integer("business_id").notNull().references(() => businesses.id),
  plan: text("plan").notNull(),
  interval: text("interval").notNull(),
  status: text("status").notNull(),
  startedAt: text("started_at").notNull(),
  nextBillingAt: text("next_billing_at"),
  endsAt: text("ends_at"),
  updatedAt: text("updated_at").notNull(),
});

export const businessClaimRequests = sqliteTable("business_claim_requests", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  provider: text("provider").notNull(),
  placeId: text("place_id").notNull(),
  businessName: text("business_name").notNull(),
  category: text("category").notNull(),
  address: text("address").notNull(),
  phone: text("phone"),
  email: text("email"),
  websiteUrl: text("website_url"),
  latitude: real("latitude").notNull(),
  longitude: real("longitude").notNull(),
  imageUrl: text("image_url").notNull(),
  requestedByUserId: integer("requested_by_user_id").notNull().references(() => users.id),
  status: text("status").notNull().default("pending"),
  reviewNotes: text("review_notes"),
  reviewedByAdminId: integer("reviewed_by_admin_id").references(() => users.id),
  reviewedAt: text("reviewed_at"),
  createdAt: text("created_at").notNull(),
});

export const adminActivityLogs = sqliteTable("admin_activity_logs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  adminUserId: integer("admin_user_id").references(() => users.id),
  actionType: text("action_type").notNull(),
  targetType: text("target_type").notNull(),
  targetId: integer("target_id"),
  summary: text("summary").notNull(),
  createdAt: text("created_at").notNull(),
});

export const platformAnnouncements = sqliteTable("platform_announcements", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  title: text("title").notNull(),
  message: text("message").notNull(),
  audience: text("audience").notNull(),
  status: text("status").notNull().default("draft"),
  createdByAdminId: integer("created_by_admin_id").references(() => users.id),
  publishedAt: text("published_at"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const platformSettings = sqliteTable("platform_settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: text("updated_at").notNull(),
});
