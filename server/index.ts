import "dotenv/config";
import crypto from "crypto";
import express from "express";
import cors from "cors";
import { compareSync, hashSync } from "bcryptjs";
import { and, desc, eq, inArray, ne, sql } from "drizzle-orm";
import {
  adminAnnouncementInputSchema,
  adminRegisterInputSchema,
  adminAccountStatusInputSchema,
  adminDeleteInputSchema,
  adminAssignBusinessOwnerInputSchema,
  adminBusinessUpdateInputSchema,
  adminClaimReviewInputSchema,
  adminOwnerTransferInputSchema,
  adminBusinessInputSchema,
  adminPlatformSettingsSchema,
  assistantFeedbackInputSchema,
  businessSubscriptionUpdateSchema,
  supportConversationTriageInputSchema,
  assistantActionExecuteInputSchema,
  assistantRequestSchema,
  supportConversationCreateInputSchema,
  supportMessageInputSchema,
  changePasswordInputSchema,
  businessClaimInputSchema,
  businessImportInputSchema,
  appointmentInputSchema,
  appointmentUpdateSchema,
  businessListQuerySchema,
  createConversationInputSchema,
  createOwnerInputSchema,
  deleteAccountInputSchema,
  externalDiscoveryQuerySchema,
  feedbackInputSchema,
  forgotPasswordInputSchema,
  loginInputSchema,
  ownerRegisterInputSchema,
  ownerBusinessHoursInputSchema,
  ownerBusinessProfileInputSchema,
  ownerCounterInputSchema,
  ownerFeedbackReplySchema,
  ownerNoticeInputSchema,
  ownerQueueAssignmentSchema,
  ownerReceiptInputSchema,
  ownerReceiptSettingsSchema,
  ownerServiceInputSchema,
  profileUpdateInputSchema,
  userPreferencesUpdateInputSchema,
  queueJoinInputSchema,
  registerInputSchema,
  resetPasswordInputSchema,
  sendMessageInputSchema,
} from "../shared/api";
import type {
  AdminAccountRecord,
  AdminAssistantAnalytics,
  AdminAnnouncement,
  AdminCommandCenter,
  AdminPlatformSettings,
  AdminSubscriptionRecord,
  ApiResponse,
  AssistantActionExecuteInput,
  AssistantActionProposal,
  AssistantRequest,
  AssistantResponse,
  AssistantResolutionState,
  AssistantFeedback,
  AssistantThread,
  AssistantThreadMessage,
  AssistantThreadScope,
  AuthUser,
  BusinessCategory,
  QueueRealtimeEvent,
  SupportConversationDetail,
  SupportConversationSummary,
  UserProfile,
} from "../shared/api";
import {
  db,
  getDatabaseHealthSnapshot,
  initializeDatabase,
  sqlite,
  verifyDatabaseConnection,
} from "./db";
import { insertAndReturnId, insertAndReturnRow } from "./db-write";
import {
  adminActivityLogs,
  assistantFeedback,
  assistantMessages,
  assistantThreads,
  appointments,
  businessCategories,
  businessClaimRequests,
  businessHours,
  businessNotices,
  businessSubscriptions,
  businesses,
  businessServices,
  conversations,
  favorites,
  messages,
  notifications,
  platformAnnouncements,
  platformSettings,
  queueEntries,
  queueEvents,
  savedPlaces,
  staffMembers,
  serviceCounters,
  sessions,
  supportConversations,
  supportMessages,
  userPreferences,
  users,
  visitFeedback,
  visitReceipts,
} from "./schema";
import {
  addQueueEvent,
  createDetailedNotification,
  createNotification,
  getAllBusinessSubscriptions,
  getAppointmentsForUser,
  getBusinessRows,
  getBusinessSubscription,
  getClaimRequests,
  getNotificationsForUser,
  getReceiptById,
  getReceiptsForBusiness,
  getReceiptsForUser,
  getUserPreferences,
  getConversationDetail,
  getConversationSummariesForBusiness,
  getConversationSummariesForUser,
  getOwnerDashboardData,
  getQueueEntriesForUser,
  getQueueActionAvailability,
  getSavedPlacesForUser,
  getUserById,
  getUserDashboard,
  getVisitHistoryForUser,
  getEligibleReceiptVisitsForBusiness,
  isBusinessOpen,
  revalidateQueueForBusiness,
  toBusinessDetail,
  toBusinessMapMarker,
  toBusinessSummary,
  FIXED_QUEUE_PAUSE_LIMIT_MINUTES,
  SUBSCRIPTION_PLANS,
} from "./utils";
import {
  buildOfflineAssistantResponse,
  callGroqAssistant,
  isGroqAssistantConfigured,
  SMART_QUEUE_KNOWLEDGE_PACK,
} from "./assistant";
import { broadcastEvent, registerEventClient, removeEventClient } from "./realtime";
import { getExternalBusinessDetail, searchExternalBusinesses } from "./externalDiscovery";
import { runtimeConfig } from "./runtime";
import {
  getConversationContextLabel,
  getGuestQueueActionCopy,
  getOwnerQueueTransitionCopy,
} from "../shared/queueCopy";

initializeDatabase();

const SESSION_COOKIE = "qless_session";
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 14;
const PASSWORD_RESET_TTL_MS = 1000 * 60 * 30;
const ADMIN_SIGNUP_SECRET = process.env.ADMIN_SIGNUP_SECRET?.trim() || "";
const APP_URL = runtimeConfig.appUrl;
const COOKIE_DOMAIN = process.env.SESSION_COOKIE_DOMAIN?.trim() || "";
const COOKIE_SAME_SITE = (process.env.SESSION_COOKIE_SAME_SITE?.trim().toLowerCase() ?? "lax") as "lax" | "strict" | "none";
const COOKIE_SECURE_MODE = process.env.SESSION_COOKIE_SECURE?.trim().toLowerCase() ?? "auto";
const CORS_ALLOWED_ORIGINS = (process.env.CORS_ALLOWED_ORIGINS ?? "")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);
const APP_ORIGIN = APP_URL ? new URL(APP_URL).origin : "";
const ACTIVE_QUEUE_STATUSES_SQL = "('waiting','called','paused','in_service','delayed')";

declare global {
  namespace Express {
    interface Request {
      currentUser?: AuthUser | null;
      sessionId?: string | null;
    }
  }
}

function ok<T>(res: express.Response, data: T) {
  return res.json({ data } satisfies ApiResponse<T>);
}

function fail(res: express.Response, status: number, message: string, code?: string) {
  return res.status(status).json({ error: { message, code } } satisfies ApiResponse<never>);
}

function parseCookies(cookieHeader?: string | null) {
  const parsed = new Map<string, string>();
  if (!cookieHeader) return parsed;
  for (const segment of cookieHeader.split(";")) {
    const [key, ...value] = segment.trim().split("=");
    if (key) parsed.set(key, decodeURIComponent(value.join("=")));
  }
  return parsed;
}

function shouldUseSecureCookie(req?: express.Request) {
  if (COOKIE_SECURE_MODE === "true") return true;
  if (COOKIE_SECURE_MODE === "false") return false;
  if (APP_URL.startsWith("https://")) return true;
  return Boolean(req?.secure || req?.headers["x-forwarded-proto"] === "https");
}

function buildSessionCookie(req: express.Request | undefined, value: string, maxAgeSeconds: number) {
  const attributes = [
    `${SESSION_COOKIE}=${encodeURIComponent(value)}`,
    "Path=/",
    "HttpOnly",
    `SameSite=${COOKIE_SAME_SITE.charAt(0).toUpperCase()}${COOKIE_SAME_SITE.slice(1)}`,
    `Max-Age=${maxAgeSeconds}`,
  ];

  if (COOKIE_DOMAIN) {
    attributes.push(`Domain=${COOKIE_DOMAIN}`);
  }

  if (shouldUseSecureCookie(req)) {
    attributes.push("Secure");
  }

  return attributes.join("; ");
}

function setSessionCookie(req: express.Request, res: express.Response, sessionId: string) {
  res.setHeader("Set-Cookie", buildSessionCookie(req, sessionId, Math.floor(SESSION_TTL_MS / 1000)));
}

function clearSessionCookie(req: express.Request, res: express.Response) {
  res.setHeader("Set-Cookie", buildSessionCookie(req, "", 0));
}

async function getCurrentUser(req: express.Request) {
  const cookies = parseCookies(req.headers.cookie);
  const sessionId = cookies.get(SESSION_COOKIE);
  if (!sessionId) return null;
  req.sessionId = sessionId;
  const session = db.select().from(sessions).where(eq(sessions.id, sessionId)).get();
  if (!session) return null;
  if (new Date(session.expiresAt).getTime() < Date.now()) {
    db.delete(sessions).where(eq(sessions.id, sessionId)).run();
    return null;
  }
  const current = db.select().from(users).where(eq(users.id, session.userId)).get();
  if (!current || current.accountStatus === "suspended") {
    db.delete(sessions).where(eq(sessions.id, sessionId)).run();
    return null;
  }
  return getUserById(session.userId);
}

function authRequired(role?: AuthUser["role"]) {
  return async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const user = req.currentUser ?? (await getCurrentUser(req));
    req.currentUser = user;
    if (!user) return fail(res, 401, "Authentication required", "UNAUTHORIZED");
    if (role && user.role !== role) return fail(res, 403, "Forbidden", "FORBIDDEN");
    next();
  };
}

function createSession(userId: number) {
  const id = crypto.randomUUID();
  const createdAt = new Date().toISOString();
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS).toISOString();
  db.insert(sessions).values({ id, userId, createdAt, expiresAt }).run();
  return id;
}

function createQueueOrderKey(timestamp = new Date().toISOString()) {
  return `${timestamp}#${crypto.randomUUID()}`;
}

function allocateActiveQueueEntry(input: {
  businessId: number;
  userId: number;
  serviceId: number;
  serviceName: string;
  averageServiceMinutes: number;
  maxActiveQueue?: number | null;
  joinedAt?: string;
  enforceCapacity?: boolean;
}) {
  return sqlite.transaction(() => {
    const duplicate = sqlite
      .prepare(`
        SELECT id
        FROM queue_entries
        WHERE business_id = ?
          AND user_id = ?
          AND service_id = ?
          AND status IN ${ACTIVE_QUEUE_STATUSES_SQL}
        LIMIT 1
      `)
      .get(input.businessId, input.userId, input.serviceId) as { id: number } | undefined;

    if (duplicate) {
      throw new Error("You already have an active queue entry for this service.");
    }

    const activeCount =
      (sqlite
        .prepare(`
          SELECT COUNT(*) as count
          FROM queue_entries
          WHERE business_id = ?
            AND service_id = ?
            AND status IN ${ACTIVE_QUEUE_STATUSES_SQL}
        `)
        .get(input.businessId, input.serviceId) as { count: number } | undefined)?.count ?? 0;

    if (input.enforceCapacity !== false && input.maxActiveQueue != null && activeCount >= input.maxActiveQueue) {
      throw new Error(`The ${input.serviceName} lane is already at capacity right now. Please try again later or pick another service.`);
    }

    const maxNumber =
      (sqlite
        .prepare(`
          SELECT COALESCE(MAX(CAST(SUBSTR(queue_number, 2) AS INTEGER)), 0) as maxNumber
          FROM queue_entries
          WHERE business_id = ?
            AND service_id = ?
            AND status IN ${ACTIVE_QUEUE_STATUSES_SQL}
        `)
        .get(input.businessId, input.serviceId) as { maxNumber: number } | undefined)?.maxNumber ?? 0;

    const joinedAt = input.joinedAt ?? new Date().toISOString();
    const queueOrderKey = createQueueOrderKey(joinedAt);
    const entryId = insertAndReturnId(db, queueEntries, {
      businessId: input.businessId,
      userId: input.userId,
      serviceId: input.serviceId,
      counterId: null,
      staffName: null,
      status: "waiting",
      queueNumber: `Q${String(maxNumber + 1).padStart(3, "0")}`,
      queueOrderKey,
      joinedAt,
      estimatedWaitMinutes: activeCount * input.averageServiceMinutes,
      createdAt: joinedAt,
      updatedAt: joinedAt,
    });

    return {
      entryId,
      activeCount,
    };
  })();
}

function hashResetToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function createPasswordResetLink(token: string) {
  const path = `/reset-password?token=${encodeURIComponent(token)}`;
  return APP_URL ? `${APP_URL}${path}` : path;
}

function isAllowedCorsOrigin(origin?: string) {
  if (!origin) return true;
  if (CORS_ALLOWED_ORIGINS.length) return CORS_ALLOWED_ORIGINS.includes(origin);
  if (APP_ORIGIN) return origin === APP_ORIGIN;
  return !runtimeConfig.isProduction;
}

const DEFAULT_PLATFORM_SETTINGS: AdminPlatformSettings = {
  assistantSupportEscalationEnabled: true,
  supportAutoAssignEnabled: true,
  defaultQueuePauseLimitMinutes: FIXED_QUEUE_PAUSE_LIMIT_MINUTES,
  defaultBookingHorizonDays: 14,
  claimsRequireManualReview: true,
};

function readPlatformSettings(): AdminPlatformSettings {
  const rows = db.select().from(platformSettings).all();
  const map = new Map(rows.map((row) => [row.key, row.value]));
  return {
    assistantSupportEscalationEnabled: map.get("assistantSupportEscalationEnabled")
      ? map.get("assistantSupportEscalationEnabled") === "true"
      : DEFAULT_PLATFORM_SETTINGS.assistantSupportEscalationEnabled,
    supportAutoAssignEnabled: map.get("supportAutoAssignEnabled")
      ? map.get("supportAutoAssignEnabled") === "true"
      : DEFAULT_PLATFORM_SETTINGS.supportAutoAssignEnabled,
    defaultQueuePauseLimitMinutes: map.get("defaultQueuePauseLimitMinutes")
      ? Number(map.get("defaultQueuePauseLimitMinutes"))
      : DEFAULT_PLATFORM_SETTINGS.defaultQueuePauseLimitMinutes,
    defaultBookingHorizonDays: map.get("defaultBookingHorizonDays")
      ? Number(map.get("defaultBookingHorizonDays"))
      : DEFAULT_PLATFORM_SETTINGS.defaultBookingHorizonDays,
    claimsRequireManualReview: map.get("claimsRequireManualReview")
      ? map.get("claimsRequireManualReview") === "true"
      : DEFAULT_PLATFORM_SETTINGS.claimsRequireManualReview,
  };
}

function writePlatformSettings(input: AdminPlatformSettings) {
  const now = new Date().toISOString();
  Object.entries(input).forEach(([key, value]) => {
    const existing = db.select().from(platformSettings).where(eq(platformSettings.key, key)).get();
    if (existing) {
      db.update(platformSettings).set({ value: String(value), updatedAt: now }).where(eq(platformSettings.key, key)).run();
    } else {
      db.insert(platformSettings).values({ key, value: String(value), updatedAt: now }).run();
    }
  });
}

function logAdminActivity(adminUserId: number | null, actionType: string, targetType: string, targetId: number | null, summary: string) {
  db.insert(adminActivityLogs).values({
    adminUserId,
    actionType,
    targetType,
    targetId,
    summary,
    createdAt: new Date().toISOString(),
  }).run();
}

function clearUserSessions(userId: number) {
  db.delete(sessions).where(eq(sessions.userId, userId)).run();
}

function setUserStatus(userId: number, status: "active" | "suspended", moderationReason: string | null = null) {
  const now = new Date().toISOString();
  db.update(users).set({
    accountStatus: status,
    moderationReason,
    moderatedAt: now,
  }).where(eq(users.id, userId)).run();
  if (status === "suspended") clearUserSessions(userId);
}

function setBusinessStatus(businessId: number, status: "active" | "suspended", moderationReason: string | null = null) {
  db.update(businesses).set({
    recordStatus: status,
    moderationReason,
    moderatedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }).where(eq(businesses.id, businessId)).run();
}

function getAdminActivityItems(limit = 40) {
  return db
    .select({
      id: adminActivityLogs.id,
      adminUserId: adminActivityLogs.adminUserId,
      adminName: users.name,
      actionType: adminActivityLogs.actionType,
      targetType: adminActivityLogs.targetType,
      targetId: adminActivityLogs.targetId,
      summary: adminActivityLogs.summary,
      createdAt: adminActivityLogs.createdAt,
    })
    .from(adminActivityLogs)
    .leftJoin(users, eq(adminActivityLogs.adminUserId, users.id))
    .orderBy(desc(adminActivityLogs.createdAt))
    .limit(limit)
    .all()
    .map((row) => ({
      ...row,
      adminName: row.adminName ?? null,
      targetId: row.targetId ?? null,
      adminUserId: row.adminUserId ?? null,
    }));
}

function getAdminSupportConversationSummary(record: typeof supportConversations.$inferSelect): SupportConversationSummary | null {
  return getSupportConversationSummary(record, "admin");
}

function getAdminAccountRecords(): AdminAccountRecord[] {
  const queueCounts = new Map(
    db.select({ userId: queueEntries.userId, count: sql<number>`count(*)` }).from(queueEntries).groupBy(queueEntries.userId).all().map((row) => [row.userId, row.count]),
  );
  const appointmentCounts = new Map(
    db.select({ userId: appointments.userId, count: sql<number>`count(*)` }).from(appointments).groupBy(appointments.userId).all().map((row) => [row.userId, row.count]),
  );
  const conversationCounts = new Map(
    db.select({ userId: conversations.userId, count: sql<number>`count(*)` }).from(conversations).groupBy(conversations.userId).all().map((row) => [row.userId, row.count]),
  );
  const supportCounts = new Map(
    db.select({ userId: supportConversations.requesterUserId, count: sql<number>`count(*)` }).from(supportConversations).groupBy(supportConversations.requesterUserId).all().map((row) => [row.userId, row.count]),
  );
  const savedPlaceCounts = new Map(
    db.select({ userId: savedPlaces.userId, count: sql<number>`count(*)` }).from(savedPlaces).groupBy(savedPlaces.userId).all().map((row) => [row.userId, row.count]),
  );
  const sessionCounts = new Map(
    db.select({ userId: sessions.userId, count: sql<number>`count(*)` }).from(sessions).groupBy(sessions.userId).all().map((row) => [row.userId, row.count]),
  );

  return db
    .select({
      id: users.id,
      email: users.email,
      name: users.name,
      role: users.role,
      businessId: users.businessId,
      businessName: businesses.name,
      accountStatus: users.accountStatus,
      moderationReason: users.moderationReason,
      moderatedAt: users.moderatedAt,
      createdAt: users.createdAt,
      lastSignInAt: users.lastSignInAt,
    })
    .from(users)
    .leftJoin(businesses, eq(users.businessId, businesses.id))
    .orderBy(desc(users.createdAt))
    .all()
    .map((row) => ({
      ...row,
      role: row.role as AdminAccountRecord["role"],
      businessName: row.businessName ?? null,
      businessId: row.businessId ?? null,
      accountStatus: (row.accountStatus as AdminAccountRecord["accountStatus"]) ?? "active",
      moderationReason: row.moderationReason ?? null,
      moderatedAt: row.moderatedAt ?? null,
      lastSignInAt: row.lastSignInAt ?? null,
      activeSessionCount: sessionCounts.get(row.id) ?? 0,
      queueCount: queueCounts.get(row.id) ?? 0,
      appointmentCount: appointmentCounts.get(row.id) ?? 0,
      conversationCount: conversationCounts.get(row.id) ?? 0,
      supportConversationCount: supportCounts.get(row.id) ?? 0,
      savedPlaceCount: savedPlaceCounts.get(row.id) ?? 0,
      healthFlags: {
        needsModerationNote: ((row.accountStatus as AdminAccountRecord["accountStatus"]) ?? "active") === "suspended" && !(row.moderationReason ?? "").trim(),
        hasNoRecentSignIn: !row.lastSignInAt || new Date(row.lastSignInAt).getTime() < Date.now() - 1000 * 60 * 60 * 24 * 45,
        highSupportLoad: (supportCounts.get(row.id) ?? 0) >= 3,
        missingBusinessAssignment: row.role === "owner" && row.businessId == null,
      },
    }));
}

function getAdminBusinessRecords() {
  const supportCounts = new Map<number, number>();
  db
    .select({
      businessId: users.businessId,
      count: sql<number>`count(*)`,
    })
    .from(supportConversations)
    .innerJoin(users, eq(supportConversations.requesterUserId, users.id))
    .where(eq(supportConversations.status, "active"))
    .groupBy(users.businessId)
    .all()
    .forEach((row) => {
      if (row.businessId != null) supportCounts.set(row.businessId, row.count);
    });

  const claimCounts = new Map(
    db
      .select({ businessName: businessClaimRequests.businessName, count: sql<number>`count(*)` })
      .from(businessClaimRequests)
      .where(eq(businessClaimRequests.status, "pending"))
      .groupBy(businessClaimRequests.businessName)
      .all()
      .map((row) => [row.businessName.toLowerCase(), row.count]),
  );

  return db
    .select({
      business: businesses,
      categoryLabel: businessCategories.slug,
      ownerId: users.id,
      ownerName: users.name,
      ownerEmail: users.email,
    })
    .from(businesses)
    .innerJoin(businessCategories, eq(businesses.categoryId, businessCategories.id))
    .leftJoin(users, and(eq(users.businessId, businesses.id), eq(users.role, "owner")))
    .all();
}

async function getAdminBusinessList() {
  const rows = await getBusinessRows(undefined);
  const joined = getAdminBusinessRecords();
  const joinedMap = new Map(joined.map((item) => [item.business.id, item]));

  return rows.map((row) => {
    const detail = toBusinessDetail(row);
    const joinedRecord = joinedMap.get(row.id);
    return {
      ...detail,
      recordStatus: (joinedRecord?.business.recordStatus as "active" | "suspended") ?? "active",
      moderationReason: joinedRecord?.business.moderationReason ?? null,
      moderatedAt: joinedRecord?.business.moderatedAt ?? null,
      ownerId: joinedRecord?.ownerId ?? null,
      ownerName: joinedRecord?.ownerName ?? null,
      ownerEmail: joinedRecord?.ownerEmail ?? null,
      activeSupportConversationCount: joinedRecord ? 0 : 0,
      pendingClaimCount: joinedRecord ? 0 : 0,
      healthFlags: {
        missingOwnerAssignment: false,
        missingContactDetails: false,
        highSupportLoad: false,
        needsModerationNote: false,
      },
    };
  }).map((item) => ({
    ...item,
    activeSupportConversationCount:
      db
        .select({ count: sql<number>`count(*)` })
        .from(supportConversations)
        .innerJoin(users, eq(supportConversations.requesterUserId, users.id))
        .where(
          and(
            eq(users.businessId, item.id),
            inArray(supportConversations.status, ["active", "in_progress", "escalated"]),
          ),
        )
        .get()?.count ?? 0,
    pendingClaimCount:
      db
        .select({ count: sql<number>`count(*)` })
        .from(businessClaimRequests)
        .where(and(eq(businessClaimRequests.status, "pending"), eq(sql`lower(${businessClaimRequests.businessName})`, item.name.toLowerCase())))
        .get()?.count ?? 0,
    healthFlags: {
      missingOwnerAssignment: item.ownerId == null,
      missingContactDetails: !item.phone?.trim() || !item.email?.trim(),
      highSupportLoad:
        (db
          .select({ count: sql<number>`count(*)` })
          .from(supportConversations)
          .innerJoin(users, eq(supportConversations.requesterUserId, users.id))
          .where(
            and(
              eq(users.businessId, item.id),
              inArray(supportConversations.status, ["active", "in_progress", "escalated"]),
            ),
          )
          .get()?.count ?? 0) >= 3,
      needsModerationNote: item.recordStatus === "suspended" && !(item.moderationReason ?? "").trim(),
    },
  }));
}

function getAdminSubscriptionRecords(): AdminSubscriptionRecord[] {
  return db
    .select({
      subscription: businessSubscriptions,
      businessName: businesses.name,
      businessSlug: businesses.slug,
      recordStatus: businesses.recordStatus,
    })
    .from(businessSubscriptions)
    .innerJoin(businesses, eq(businessSubscriptions.businessId, businesses.id))
    .orderBy(desc(businessSubscriptions.updatedAt))
    .all()
    .map(({ subscription, businessName, businessSlug, recordStatus }) => ({
      businessId: subscription.businessId,
      plan: subscription.plan as AdminSubscriptionRecord["plan"],
      interval: subscription.interval as AdminSubscriptionRecord["interval"],
      status: subscription.status as AdminSubscriptionRecord["status"],
      startedAt: subscription.startedAt,
      nextBillingAt: subscription.nextBillingAt ?? null,
      endsAt: subscription.endsAt ?? null,
      businessName,
      businessSlug,
      recordStatus: recordStatus as AdminSubscriptionRecord["recordStatus"],
    }));
}

function getAdminAnnouncements(): AdminAnnouncement[] {
  return db
    .select({
      announcement: platformAnnouncements,
      adminName: users.name,
    })
    .from(platformAnnouncements)
    .leftJoin(users, eq(platformAnnouncements.createdByAdminId, users.id))
    .orderBy(desc(platformAnnouncements.updatedAt))
    .all()
    .map(({ announcement, adminName }) => ({
      id: announcement.id,
      title: announcement.title,
      message: announcement.message,
      audience: announcement.audience as AdminAnnouncement["audience"],
      status: announcement.status as AdminAnnouncement["status"],
      createdByAdminId: announcement.createdByAdminId ?? null,
      createdByAdminName: adminName ?? null,
      publishedAt: announcement.publishedAt ?? null,
      createdAt: announcement.createdAt,
      updatedAt: announcement.updatedAt,
    }));
}

function getAdminCommandCenter(): AdminCommandCenter {
  const supportRows = db.select().from(supportConversations).all();
  const claimRows = db.select().from(businessClaimRequests).all();
  const recentOwnerSignups = getAdminAccountRecords().filter((item) => item.role === "owner").slice(0, 5);
  const unresolvedSupportCount = supportRows.filter((row) => ["active", "in_progress", "escalated"].includes(row.status)).length;
  const pendingClaimsCount = db
    .select({ count: sql<number>`count(*)` })
    .from(businessClaimRequests)
    .where(eq(businessClaimRequests.status, "pending"))
    .get()?.count ?? 0;
  const suspendedBusinessesCount = db
    .select({ count: sql<number>`count(*)` })
    .from(businesses)
    .where(eq(businesses.recordStatus, "suspended"))
    .get()?.count ?? 0;
  const suspendedAccountsCount = db
    .select({ count: sql<number>`count(*)` })
    .from(users)
    .where(eq(users.accountStatus, "suspended"))
    .get()?.count ?? 0;
  const expiringSubscriptionsCount = db
    .select({ count: sql<number>`count(*)` })
    .from(businessSubscriptions)
    .where(
      and(
        eq(businessSubscriptions.status, "active"),
        sql`${businessSubscriptions.nextBillingAt} is not null`,
        sql`${businessSubscriptions.nextBillingAt} <= ${new Date(Date.now() + 1000 * 60 * 60 * 24 * 7).toISOString()}`,
      ),
    )
    .get()?.count ?? 0;
  const activeSupportCount = supportRows.filter((row) => row.status === "active").length;
  const inProgressSupportCount = supportRows.filter((row) => row.status === "in_progress").length;
  const escalatedSupportCount = supportRows.filter((row) => row.status === "escalated").length;
  const unassignedSupportCount = supportRows.filter((row) => row.assignedAdminId == null && ["active", "in_progress", "escalated"].includes(row.status)).length;
  const staleSupportCount = supportRows.filter((row) => ["active", "in_progress", "escalated"].includes(row.status) && new Date(row.updatedAt).getTime() < Date.now() - 1000 * 60 * 60 * 24 * 2).length;
  const stalePendingClaimsCount = claimRows.filter((row) => row.status === "pending" && new Date(row.createdAt).getTime() < Date.now() - 1000 * 60 * 60 * 24 * 3).length;
  const importReadyClaimsCount = claimRows.filter((row) => row.status === "pending" && !!row.placeId && !!row.address?.trim()).length;
  const businessesMissingReasonCount = db
    .select({ count: sql<number>`count(*)` })
    .from(businesses)
    .where(and(eq(businesses.recordStatus, "suspended"), sql`(${businesses.moderationReason} is null or trim(${businesses.moderationReason}) = '')`))
    .get()?.count ?? 0;
  const accountsMissingReasonCount = db
    .select({ count: sql<number>`count(*)` })
    .from(users)
    .where(and(eq(users.accountStatus, "suspended"), sql`(${users.moderationReason} is null or trim(${users.moderationReason}) = '')`))
    .get()?.count ?? 0;
  const operationsSummary =
    escalatedSupportCount > 0
      ? {
          kind: "support" as const,
          title: "Escalated support needs attention",
          message: `${escalatedSupportCount} escalated support ${escalatedSupportCount === 1 ? "case is" : "cases are"} still waiting for admin follow-up.`,
          primaryActionLabel: "Open support triage",
          primaryActionHref: "/admin-panel/support",
          secondaryActionLabel: "Review activity",
          secondaryActionHref: "/admin-panel/activity",
        }
      : stalePendingClaimsCount > 0
        ? {
            kind: "claims" as const,
            title: "Claims are aging in the review queue",
            message: `${stalePendingClaimsCount} pending ${stalePendingClaimsCount === 1 ? "claim is" : "claims are"} more than three days old.`,
            primaryActionLabel: "Review claims",
            primaryActionHref: "/admin-panel/claims",
            secondaryActionLabel: "Open businesses",
            secondaryActionHref: "/admin-panel/businesses",
          }
        : suspendedBusinessesCount + suspendedAccountsCount > 0
          ? {
              kind: "moderation" as const,
              title: "Suspended records still need follow-up",
              message: `${suspendedBusinessesCount + suspendedAccountsCount} suspended ${suspendedBusinessesCount + suspendedAccountsCount === 1 ? "record still needs" : "records still need"} admin review or cleanup.`,
              primaryActionLabel: "Open moderation",
              primaryActionHref: "/admin-panel/moderation",
              secondaryActionLabel: "Review accounts",
              secondaryActionHref: "/admin-panel/accounts",
            }
          : expiringSubscriptionsCount > 0
            ? {
                kind: "subscriptions" as const,
                title: "Subscriptions are approaching renewal",
                message: `${expiringSubscriptionsCount} business subscription ${expiringSubscriptionsCount === 1 ? "is" : "are"} inside the next billing window.`,
                primaryActionLabel: "Review subscriptions",
                primaryActionHref: "/admin-panel/subscriptions",
                secondaryActionLabel: "Open businesses",
                secondaryActionHref: "/admin-panel/businesses",
              }
            : recentOwnerSignups.some((item) => item.healthFlags.missingBusinessAssignment)
              ? {
                  kind: "growth" as const,
                  title: "Recent owners still need business assignment",
                  message: "Some new owner accounts are active but not yet connected to a business record.",
                  primaryActionLabel: "Open owners",
                  primaryActionHref: "/admin-panel/owners",
                  secondaryActionLabel: "Open businesses",
                  secondaryActionHref: "/admin-panel/businesses",
                }
              : {
                  kind: "steady" as const,
                  title: "Admin operations are steady",
                  message: "No single admin queue is currently outpacing the rest of the workload.",
                  primaryActionLabel: "Open overview",
                  primaryActionHref: "/admin-panel",
                  secondaryActionLabel: "Review analytics",
                  secondaryActionHref: "/admin-panel/analytics",
                };

  return {
    operationsSummary,
    unresolvedSupportCount,
    pendingClaimsCount,
    suspendedBusinessesCount,
    suspendedAccountsCount,
    expiringSubscriptionsCount,
    supportQueue: {
      activeCount: activeSupportCount,
      inProgressCount: inProgressSupportCount,
      escalatedCount: escalatedSupportCount,
      unassignedCount: unassignedSupportCount,
      staleCount: staleSupportCount,
    },
    claimsQueue: {
      stalePendingCount: stalePendingClaimsCount,
      importReadyCount: importReadyClaimsCount,
    },
    moderationQueue: {
      businessesMissingReasonCount,
      accountsMissingReasonCount,
    },
    recentOwnerSignups,
    recentActivity: getAdminActivityItems(8),
  };
}

function sanitizeUser(user: typeof users.$inferSelect): AuthUser {
  return { id: user.id, email: user.email, name: user.name, role: user.role as AuthUser["role"], businessId: user.businessId ?? null };
}

function toUserProfile(user: typeof users.$inferSelect): UserProfile {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role as UserProfile["role"],
    businessId: user.businessId ?? null,
    phone: user.phone ?? null,
    bio: user.bio ?? null,
    avatarUrl: user.avatarUrl ?? null,
    location: user.location ?? null,
  };
}

function upsertUserPreferences(userId: number, input: {
  emailSummaries: boolean;
  desktopNotifications: boolean;
  aiAssistant: boolean;
  travelTips: boolean;
}) {
  const existing = db.select().from(userPreferences).where(eq(userPreferences.userId, userId)).get();
  const next = {
    userId,
    emailSummaries: input.emailSummaries,
    desktopNotifications: input.desktopNotifications,
    aiAssistant: input.aiAssistant,
    travelTips: input.travelTips,
    updatedAt: new Date().toISOString(),
  };

  if (existing) {
    db.update(userPreferences).set(next).where(eq(userPreferences.userId, userId)).run();
  } else {
    db.insert(userPreferences).values(next).run();
  }
}

function startOfUtcDay(input = new Date()) {
  const date = new Date(input);
  date.setUTCHours(0, 0, 0, 0);
  return date;
}

function addUtcDays(input: Date, days: number) {
  const next = new Date(input);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function isoDateOnly(input: Date) {
  return input.toISOString().slice(0, 10);
}

const SHORT_WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

function shortDayLabel(input: Date) {
  return SHORT_WEEKDAY_LABELS[input.getUTCDay()];
}

function getAdminAnalyticsSnapshot() {
  const usersCount = db.select({ count: sql<number>`count(*)` }).from(users).where(eq(users.role, "user")).get()?.count ?? 0;
  const ownersCount = db.select({ count: sql<number>`count(*)` }).from(users).where(eq(users.role, "owner")).get()?.count ?? 0;
  const businessesCount = db.select({ count: sql<number>`count(*)` }).from(businesses).get()?.count ?? 0;
  const activeQueuesCount = db
    .select({ count: sql<number>`count(*)` })
    .from(queueEntries)
    .where(inArray(queueEntries.status, ["waiting", "called", "paused", "in_service", "delayed"]))
    .get()?.count ?? 0;
  const pendingAppointmentsCount = db.select({ count: sql<number>`count(*)` }).from(appointments).where(eq(appointments.status, "pending")).get()?.count ?? 0;
  const servicesCount = db.select({ count: sql<number>`count(*)` }).from(businessServices).get()?.count ?? 0;
  const countersCount = db.select({ count: sql<number>`count(*)` }).from(serviceCounters).get()?.count ?? 0;
  const activeSubscriptionsCount = db
    .select({ count: sql<number>`count(*)` })
    .from(businessSubscriptions)
    .where(eq(businessSubscriptions.status, "active"))
    .get()?.count ?? 0;
  const pendingClaimsCount = db
    .select({ count: sql<number>`count(*)` })
    .from(businessClaimRequests)
    .where(eq(businessClaimRequests.status, "pending"))
    .get()?.count ?? 0;

  const summary = {
    usersCount,
    ownersCount,
    businessesCount,
    activeQueuesCount,
    pendingAppointmentsCount,
    servicesCount,
    countersCount,
    activeSubscriptionsCount,
    pendingClaimsCount,
  };

  const now = new Date();
  const todayStart = startOfUtcDay(now);
  const tomorrowStart = addUtcDays(todayStart, 1);
  const last7Start = addUtcDays(todayStart, -6);
  const current30Start = addUtcDays(todayStart, -29);
  const previous30Start = addUtcDays(current30Start, -30);
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));

  const completedStatuses = ["completed"];
  const attemptedStatuses = ["completed", "cancelled", "no_show", "transferred"];

  const last7CompletedRows = db
    .select({
      day: sql<string>`substr(${queueEntries.completedAt}, 1, 10)`,
      count: sql<number>`count(*)`,
    })
    .from(queueEntries)
    .where(
      and(
        inArray(queueEntries.status, completedStatuses),
        sql`${queueEntries.completedAt} is not null`,
        sql`${queueEntries.completedAt} >= ${last7Start.toISOString()}`,
        sql`${queueEntries.completedAt} < ${tomorrowStart.toISOString()}`,
      ),
    )
    .groupBy(sql`substr(${queueEntries.completedAt}, 1, 10)`)
    .all();

  const last7CountMap = new Map(last7CompletedRows.map((row) => [row.day, row.count]));
  const last7Days = Array.from({ length: 7 }, (_, index) => {
    const date = addUtcDays(last7Start, index);
    const dateKey = isoDateOnly(date);
    return {
      date: dateKey,
      label: shortDayLabel(date),
      completedQueues: last7CountMap.get(dateKey) ?? 0,
    };
  });

  const completedLast30 = db
    .select({ count: sql<number>`count(*)` })
    .from(queueEntries)
    .where(
      and(
        inArray(queueEntries.status, completedStatuses),
        sql`${queueEntries.completedAt} is not null`,
        sql`${queueEntries.completedAt} >= ${current30Start.toISOString()}`,
        sql`${queueEntries.completedAt} < ${tomorrowStart.toISOString()}`,
      ),
    )
    .get()?.count ?? 0;

  const attemptedLast30 = db
    .select({ count: sql<number>`count(*)` })
    .from(queueEntries)
    .where(
      and(
        inArray(queueEntries.status, attemptedStatuses),
        sql`${queueEntries.updatedAt} >= ${current30Start.toISOString()}`,
        sql`${queueEntries.updatedAt} < ${tomorrowStart.toISOString()}`,
      ),
    )
    .get()?.count ?? 0;

  const currentPeriodAccounts = db
    .select({ count: sql<number>`count(*)` })
    .from(users)
    .where(
      and(
        inArray(users.role, ["user", "owner"]),
        sql`${users.createdAt} >= ${current30Start.toISOString()}`,
        sql`${users.createdAt} < ${tomorrowStart.toISOString()}`,
      ),
    )
    .get()?.count ?? 0;

  const previousPeriodAccounts = db
    .select({ count: sql<number>`count(*)` })
    .from(users)
    .where(
      and(
        inArray(users.role, ["user", "owner"]),
        sql`${users.createdAt} >= ${previous30Start.toISOString()}`,
        sql`${users.createdAt} < ${current30Start.toISOString()}`,
      ),
    )
    .get()?.count ?? 0;

  const monthlyCompletedQueues = db
    .select({ count: sql<number>`count(*)` })
    .from(queueEntries)
    .where(
      and(
        inArray(queueEntries.status, completedStatuses),
        sql`${queueEntries.completedAt} is not null`,
        sql`${queueEntries.completedAt} >= ${monthStart.toISOString()}`,
        sql`${queueEntries.completedAt} < ${tomorrowStart.toISOString()}`,
      ),
    )
    .get()?.count ?? 0;

  const monthlyTargetCount = Math.max(monthlyCompletedQueues, Math.ceil(completedLast30 * 1.15), 25);
  const bestDay = [...last7Days].sort((left, right) => right.completedQueues - left.completedQueues)[0] ?? {
    label: "Mon",
    completedQueues: 0,
  };

  const topSubscriptionPlanRows = db
    .select({
      plan: businessSubscriptions.plan,
      count: sql<number>`count(*)`,
    })
    .from(businessSubscriptions)
    .where(eq(businessSubscriptions.status, "active"))
    .groupBy(businessSubscriptions.plan)
    .all()
    .sort((left, right) => right.count - left.count);

  const supportLoad = db
    .select({ count: sql<number>`count(*)` })
    .from(supportConversations)
    .where(eq(supportConversations.status, "active"))
    .get()?.count ?? 0;

  return {
    summary,
    hero: {
      queueCompletionRate: attemptedLast30 > 0 ? Math.round((completedLast30 / attemptedLast30) * 100) : 0,
      activeAccounts: usersCount + ownersCount,
      platformGrowth:
        previousPeriodAccounts > 0
          ? Math.round(((currentPeriodAccounts - previousPeriodAccounts) / previousPeriodAccounts) * 100)
          : currentPeriodAccounts > 0
            ? 100
            : 0,
      monthlyTargetProgress: Math.min(100, monthlyTargetCount > 0 ? Math.round((monthlyCompletedQueues / monthlyTargetCount) * 100) : 0),
      monthlyCompletedQueues,
      monthlyTargetCount,
    },
    roleDistribution: {
      users: usersCount,
      owners: ownersCount,
      businesses: businessesCount,
      total: usersCount + ownersCount + businessesCount,
    },
    last7Days,
    insights: {
      bestDayLabel: bestDay.label,
      bestDayCount: bestDay.completedQueues,
      topSubscriptionPlan: (topSubscriptionPlanRows[0]?.plan as "starter" | "growth" | "premium" | null | undefined) ?? null,
      supportLoad,
    },
  };
}

function getAdminAssistantAnalytics(): AdminAssistantAnalytics {
  const sessionRows = db
    .select({
      messageId: assistantMessages.id,
      resolutionState: assistantMessages.resolutionState,
    })
    .from(assistantMessages)
    .innerJoin(assistantThreads, eq(assistantMessages.threadId, assistantThreads.id))
    .where(
      and(
        eq(assistantMessages.role, "assistant"),
        inArray(assistantThreads.scope, ["user", "owner"]),
        inArray(assistantMessages.kind, ["answer", "support_referral", "action_result"]),
      ),
    )
    .all();

  const totalAssistantSessions = sessionRows.length;
  const totalResolvedSessions = sessionRows.filter((row) => row.resolutionState === "resolved").length;
  const totalEscalations = sessionRows.filter((row) => row.resolutionState === "escalated").length;

  const feedbackRows = db
    .select({
      feedbackId: assistantFeedback.id,
      role: assistantFeedback.role,
      ownerUserId: assistantFeedback.ownerUserId,
      ownerName: users.name,
      threadId: assistantFeedback.threadId,
      assistantMessageId: assistantFeedback.assistantMessageId,
      rating: assistantFeedback.rating,
      comment: assistantFeedback.comment,
      assistantMessage: assistantMessages.body,
      createdAt: assistantFeedback.createdAt,
    })
    .from(assistantFeedback)
    .innerJoin(users, eq(assistantFeedback.ownerUserId, users.id))
    .innerJoin(assistantMessages, eq(assistantFeedback.assistantMessageId, assistantMessages.id))
    .orderBy(desc(assistantFeedback.createdAt))
    .all();

  const ratingDistribution = {
    1: feedbackRows.filter((row) => row.rating === 1).length,
    2: feedbackRows.filter((row) => row.rating === 2).length,
    3: feedbackRows.filter((row) => row.rating === 3).length,
    4: feedbackRows.filter((row) => row.rating === 4).length,
    5: feedbackRows.filter((row) => row.rating === 5).length,
  };

  return {
    totalAssistantSessions,
    totalResolvedSessions,
    resolvedRate: totalAssistantSessions ? Number(((totalResolvedSessions / totalAssistantSessions) * 100).toFixed(1)) : 0,
    totalEscalations,
    escalationRate: totalAssistantSessions ? Number(((totalEscalations / totalAssistantSessions) * 100).toFixed(1)) : 0,
    averageRating: feedbackRows.length ? Number((feedbackRows.reduce((sum, row) => sum + row.rating, 0) / feedbackRows.length).toFixed(1)) : 0,
    totalRatings: feedbackRows.length,
    ratingDistribution,
    recentLowRatedSessions: feedbackRows
      .filter((row) => row.rating <= 3)
      .slice(0, 8)
      .map((row) => ({
        ...row,
        role: row.role as "user" | "owner",
        ownerName: row.ownerName,
        comment: row.comment ?? null,
      })),
  };
}

function getOwnerBusinessId(userId: number) {
  return db.select().from(users).where(eq(users.id, userId)).get()?.businessId ?? null;
}

function clearAllSessionsForUser(userId: number) {
  db.delete(sessions).where(eq(sessions.userId, userId)).run();
}

const ADMIN_ACCOUNT_DELETE_CONFIRMATION = "DELETE ACCOUNT";
const ADMIN_BUSINESS_DELETE_CONFIRMATION = "DELETE BUSINESS";

function deleteAssistantThreads(threadIds: number[]) {
  if (!threadIds.length) return;
  const assistantMessageIds = db
    .select({ id: assistantMessages.id })
    .from(assistantMessages)
    .where(inArray(assistantMessages.threadId, threadIds))
    .all()
    .map((row) => row.id);

  if (assistantMessageIds.length) {
    db.delete(assistantFeedback).where(inArray(assistantFeedback.assistantMessageId, assistantMessageIds)).run();
  }

  db.delete(assistantFeedback).where(inArray(assistantFeedback.threadId, threadIds)).run();

  if (assistantMessageIds.length) {
    db.delete(assistantMessages).where(inArray(assistantMessages.id, assistantMessageIds)).run();
  }

  db.delete(assistantThreads).where(inArray(assistantThreads.id, threadIds)).run();
}

function deleteSupportConversationsCascade(conversationIds: number[]) {
  if (!conversationIds.length) return;
  db.delete(supportMessages).where(inArray(supportMessages.conversationId, conversationIds)).run();
  db.delete(supportConversations).where(inArray(supportConversations.id, conversationIds)).run();
}

function deleteUserAccountCascade(userId: number) {
  const conversationIds = Array.from(
    new Set(
      db
        .select({ id: conversations.id })
        .from(conversations)
        .where(eq(conversations.userId, userId))
        .all()
        .map((row) => row.id)
        .concat(
          db
            .select({ id: conversations.id })
            .from(conversations)
            .where(eq(conversations.ownerId, userId))
            .all()
            .map((row) => row.id),
        ),
    ),
  );

  const queueEntryIds = db
    .select({ id: queueEntries.id })
    .from(queueEntries)
    .where(eq(queueEntries.userId, userId))
    .all()
    .map((row) => row.id);

  const supportConversationIds = db
    .select({ id: supportConversations.id })
    .from(supportConversations)
    .where(eq(supportConversations.requesterUserId, userId))
    .all()
    .map((row) => row.id);

  const assistantThreadIds = db
    .select({ id: assistantThreads.id })
    .from(assistantThreads)
    .where(eq(assistantThreads.ownerUserId, userId))
    .all()
    .map((row) => row.id);

  db.delete(sessions).where(eq(sessions.userId, userId)).run();
  db.delete(userPreferences).where(eq(userPreferences.userId, userId)).run();
  db.delete(notifications).where(eq(notifications.userId, userId)).run();
  db.delete(favorites).where(eq(favorites.userId, userId)).run();
  db.delete(savedPlaces).where(eq(savedPlaces.userId, userId)).run();
  db.delete(businessClaimRequests).where(eq(businessClaimRequests.requestedByUserId, userId)).run();
  db.delete(visitFeedback).where(eq(visitFeedback.userId, userId)).run();
  db.delete(visitReceipts).where(eq(visitReceipts.userId, userId)).run();
  db.delete(visitReceipts).where(eq(visitReceipts.ownerId, userId)).run();

  if (conversationIds.length) {
    db.delete(messages).where(inArray(messages.conversationId, conversationIds)).run();
    db.delete(conversations).where(inArray(conversations.id, conversationIds)).run();
  }

  if (queueEntryIds.length) {
    db.delete(queueEvents).where(inArray(queueEvents.queueEntryId, queueEntryIds)).run();
  }

  deleteSupportConversationsCascade(supportConversationIds);
  deleteAssistantThreads(assistantThreadIds);

  db.delete(appointments).where(eq(appointments.userId, userId)).run();
  db.delete(queueEntries).where(eq(queueEntries.userId, userId)).run();
  db.delete(users).where(eq(users.id, userId)).run();
}

function deleteBusinessCascade(businessId: number) {
  const queueEntryIds = db
    .select({ id: queueEntries.id })
    .from(queueEntries)
    .where(eq(queueEntries.businessId, businessId))
    .all()
    .map((row) => row.id);

  const conversationIds = db
    .select({ id: conversations.id })
    .from(conversations)
    .where(eq(conversations.businessId, businessId))
    .all()
    .map((row) => row.id);

  const assistantThreadIds = db
    .select({ id: assistantThreads.id })
    .from(assistantThreads)
    .where(eq(assistantThreads.businessId, businessId))
    .all()
    .map((row) => row.id);

  db.update(users).set({ businessId: null }).where(eq(users.businessId, businessId)).run();
  db.delete(favorites).where(eq(favorites.businessId, businessId)).run();
  db.delete(savedPlaces).where(eq(savedPlaces.businessId, businessId)).run();
  db.delete(visitFeedback).where(eq(visitFeedback.businessId, businessId)).run();
  db.delete(visitReceipts).where(eq(visitReceipts.businessId, businessId)).run();

  if (conversationIds.length) {
    db.delete(messages).where(inArray(messages.conversationId, conversationIds)).run();
    db.delete(conversations).where(inArray(conversations.id, conversationIds)).run();
  }

  if (queueEntryIds.length) {
    db.delete(queueEvents).where(inArray(queueEvents.queueEntryId, queueEntryIds)).run();
  }

  db.delete(appointments).where(eq(appointments.businessId, businessId)).run();
  db.delete(queueEntries).where(eq(queueEntries.businessId, businessId)).run();
  deleteAssistantThreads(assistantThreadIds);
  db.delete(businessNotices).where(eq(businessNotices.businessId, businessId)).run();
  db.delete(businessSubscriptions).where(eq(businessSubscriptions.businessId, businessId)).run();
  db.delete(staffMembers).where(eq(staffMembers.businessId, businessId)).run();
  db.delete(serviceCounters).where(eq(serviceCounters.businessId, businessId)).run();
  db.delete(businessServices).where(eq(businessServices.businessId, businessId)).run();
  db.delete(businessHours).where(eq(businessHours.businessId, businessId)).run();
  db.delete(businesses).where(eq(businesses.id, businessId)).run();
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 72) || crypto.randomUUID().slice(0, 8);
}

function createUniqueBusinessSlug(name: string) {
  const base = slugify(name);
  let candidate = base;
  let index = 2;
  while (db.select({ id: businesses.id }).from(businesses).where(eq(businesses.slug, candidate)).get()) {
    candidate = `${base}-${index}`;
    index += 1;
  }
  return candidate;
}

function createReceiptReference(businessId: number) {
  const count =
    db.select({ count: sql<number>`count(*)` }).from(visitReceipts).where(eq(visitReceipts.businessId, businessId)).get()?.count ?? 0;
  return `RCPT-${String(businessId).padStart(3, "0")}-${String(count + 1).padStart(4, "0")}`;
}

function createReceiptDownloadToken() {
  return crypto.randomUUID().replace(/-/g, "");
}

function renderReceiptDownloadHtml(receipt: NonNullable<ReturnType<typeof getReceiptById>>) {
  const currency = (cents: number | null) =>
    cents == null ? "" : new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
  const lineItem = receipt.lineItemLabel
    ? `<tr><td>${receipt.lineItemLabel}</td><td>${currency(receipt.amountCents) || "Included"}</td></tr>`
    : "";
  const total = receipt.totalCents != null ? `<tr class="total"><td>Total</td><td>${currency(receipt.totalCents)}</td></tr>` : "";
  const note = receipt.ownerNote ? `<div class="note">${receipt.ownerNote}</div>` : "";
  const payment = receipt.paymentNote ? `<div class="note">${receipt.paymentNote}</div>` : "";
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${receipt.referenceNumber}</title>
    <style>
      body { font-family: Arial, sans-serif; background: #eff6ff; color: #0f172a; padding: 32px; }
      .sheet { max-width: 720px; margin: 0 auto; background: #fff; border-radius: 20px; padding: 28px; box-shadow: 0 20px 50px rgba(15,23,42,0.12); }
      .kicker { color: #2563eb; text-transform: uppercase; letter-spacing: 0.18em; font-size: 12px; font-weight: 700; }
      h1 { margin: 10px 0 8px; font-size: 28px; }
      .meta { margin: 20px 0; border-top: 1px dashed #cbd5e1; border-bottom: 1px dashed #cbd5e1; padding: 16px 0; }
      .row { display: flex; justify-content: space-between; gap: 16px; padding: 6px 0; font-size: 14px; }
      .row span:last-child { font-weight: 700; text-align: right; }
      table { width: 100%; border-collapse: collapse; margin-top: 16px; }
      td { padding: 10px 0; border-bottom: 1px dashed #e2e8f0; }
      td:last-child { text-align: right; font-weight: 700; }
      .total td { border-top: 1px solid #cbd5e1; border-bottom: none; font-size: 16px; }
      .note { margin-top: 16px; background: #eff6ff; border-radius: 14px; padding: 14px; font-size: 14px; line-height: 1.6; }
    </style>
  </head>
  <body>
    <div class="sheet">
      <div class="kicker">${receipt.businessName}</div>
      <h1>Digital Receipt</h1>
      <div class="meta">
        <div class="row"><span>Reference</span><span>${receipt.referenceNumber}</span></div>
        <div class="row"><span>User</span><span>${receipt.userName}</span></div>
        <div class="row"><span>Service</span><span>${receipt.serviceName ?? "General service"}</span></div>
        <div class="row"><span>Visit Type</span><span>${receipt.visitType === "queue" ? "Live queue" : "Appointment"}</span></div>
        <div class="row"><span>Issued</span><span>${new Date(receipt.issuedAt).toLocaleString()}</span></div>
      </div>
      ${lineItem || total ? `<table>${lineItem}${total}</table>` : ""}
      ${payment}
      ${note}
    </div>
  </body>
</html>`;
}

function defaultBusinessHours(category: BusinessCategory) {
  if (category === "restaurant") {
    return [0, 1, 2, 3, 4, 5, 6].map((day) => ({
      dayOfWeek: day,
      openTime: "10:00",
      closeTime: "21:00",
      isClosed: false,
    }));
  }

  return [0, 1, 2, 3, 4, 5, 6].map((day) => ({
    dayOfWeek: day,
    openTime: "09:00",
    closeTime: "17:00",
    isClosed: day === 0 || day === 6,
  }));
}

function defaultServiceTemplates(category: BusinessCategory) {
  switch (category) {
    case "restaurant":
      return [
        { name: "Table Booking", description: "Manage guest seating and reservation arrivals.", averageServiceMinutes: 15, maxActiveQueue: 20, supportsAppointments: true, isActive: true },
        { name: "Walk-in Queue", description: "Handle guests waiting for immediate seating.", averageServiceMinutes: 12, maxActiveQueue: 25, supportsAppointments: false, isActive: true },
      ];
    case "hospital":
      return [
        { name: "General Consultation", description: "Coordinate general patient intake and check-in.", averageServiceMinutes: 20, maxActiveQueue: 18, supportsAppointments: true, isActive: true },
        { name: "Records and Billing", description: "Support records requests and billing concerns.", averageServiceMinutes: 12, maxActiveQueue: 15, supportsAppointments: true, isActive: true },
      ];
    case "government":
      return [
        { name: "Document Processing", description: "Handle document filing and verification visits.", averageServiceMinutes: 18, maxActiveQueue: 20, supportsAppointments: true, isActive: true },
        { name: "General Assistance", description: "Support walk-in questions and public service requests.", averageServiceMinutes: 10, maxActiveQueue: 20, supportsAppointments: false, isActive: true },
      ];
    case "salon":
      return [
        { name: "Hair and Beauty Service", description: "Manage scheduled beauty and grooming visits.", averageServiceMinutes: 30, maxActiveQueue: 12, supportsAppointments: true, isActive: true },
        { name: "Quick Touch-up", description: "Handle shorter walk-in services and touch-ups.", averageServiceMinutes: 15, maxActiveQueue: 10, supportsAppointments: true, isActive: true },
      ];
    case "retail":
      return [
        { name: "Customer Service", description: "Support returns, exchanges, and in-store questions.", averageServiceMinutes: 12, maxActiveQueue: 18, supportsAppointments: true, isActive: true },
        { name: "Order Pickup", description: "Manage pickup timing for prepared customer orders.", averageServiceMinutes: 8, maxActiveQueue: 20, supportsAppointments: true, isActive: true },
      ];
    case "bank":
    default:
      return [
        { name: "General Service", description: "Handle everyday counter transactions and assistance.", averageServiceMinutes: 12, maxActiveQueue: 20, supportsAppointments: true, isActive: true },
        { name: "Account Support", description: "Support longer account help and advisory visits.", averageServiceMinutes: 20, maxActiveQueue: 12, supportsAppointments: true, isActive: true },
      ];
  }
}

function createBusinessBootstrap(input: {
  businessName: string;
  category: BusinessCategory;
  description: string;
  address: string;
  phone: string;
  businessEmail: string;
  websiteUrl?: string;
}) {
  const category = db.select().from(businessCategories).where(eq(businessCategories.slug, input.category)).get();
  if (!category) {
    throw new Error("Unknown category");
  }

  const now = new Date().toISOString();
  const services = defaultServiceTemplates(input.category);
  const businessId = insertAndReturnId(db, businesses, {
      slug: createUniqueBusinessSlug(input.businessName),
      name: input.businessName,
      categoryId: category.id,
      description: input.description,
      address: input.address,
      phone: input.phone,
      email: input.businessEmail.toLowerCase(),
      latitude: 14.5995,
      longitude: 120.9842,
      rating: 0,
      reviewsCount: 0,
      imageUrl: "https://images.unsplash.com/photo-1497366754035-f200968a6e72?auto=format&fit=crop&w=1200&q=80",
      websiteUrl: input.websiteUrl || null,
      tagsJson: JSON.stringify([input.category, "new"]),
      source: "local",
      externalProvider: null,
      externalPlaceId: null,
      averageServiceMinutes: services[0]?.averageServiceMinutes ?? 15,
      maxSkips: 2,
      maxReschedules: 2,
      pauseLimitMinutes: FIXED_QUEUE_PAUSE_LIMIT_MINUTES,
      bookingHorizonDays: 14,
      isQueueOpen: false,
      createdAt: now,
      updatedAt: now,
    });

  db.insert(businessHours)
    .values(
      defaultBusinessHours(input.category).map((hour) => ({
        businessId,
        dayOfWeek: hour.dayOfWeek,
        openTime: hour.openTime,
        closeTime: hour.closeTime,
        isClosed: hour.isClosed,
      })),
    )
    .run();

  db.insert(businessServices)
    .values(
      services.map((service) => ({
        businessId,
        name: service.name,
        description: service.description,
        averageServiceMinutes: service.averageServiceMinutes,
        maxActiveQueue: service.maxActiveQueue,
        supportsAppointments: service.supportsAppointments,
        isActive: service.isActive,
        createdAt: now,
      })),
    )
    .run();

  const createdServices = db.select({ id: businessServices.id }).from(businessServices).where(eq(businessServices.businessId, businessId)).all();
  db.insert(serviceCounters)
    .values({
      businessId,
      name: "Front Desk",
      status: "open",
      activeServiceIdsJson: JSON.stringify(createdServices.map((service) => service.id)),
      assignedStaffName: null,
      createdAt: now,
    })
    .run();

  return businessId;
}

function createOrUpdateSubscription(
  businessId: number,
  input: { plan: string; interval: string; status: string; startedAt?: string; nextBillingAt?: string | null; endsAt?: string | null },
) {
  const now = new Date().toISOString();
  const current = db.select().from(businessSubscriptions).where(eq(businessSubscriptions.businessId, businessId)).get();
  const startedAt = input.startedAt ?? current?.startedAt ?? now;
  const nextBillingAt =
    input.nextBillingAt !== undefined
      ? input.nextBillingAt
      : input.status === "active"
        ? new Date(Date.now() + 1000 * 60 * 60 * 24 * (input.interval === "yearly" ? 365 : 30)).toISOString()
        : current?.nextBillingAt ?? null;
  const payload = {
    businessId,
    plan: input.plan,
    interval: input.interval,
    status: input.status,
    startedAt,
    nextBillingAt,
    endsAt: input.endsAt ?? null,
    updatedAt: now,
  };
  if (current) {
    db.update(businessSubscriptions).set(payload).where(eq(businessSubscriptions.businessId, businessId)).run();
  } else {
    db.insert(businessSubscriptions).values(payload).run();
  }
}

function validate<T>(res: express.Response, schema: { safeParse: (input: unknown) => { success: true; data: T } | { success: false } }, input: unknown) {
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    fail(res, 400, "Invalid request", "VALIDATION_ERROR");
    return null;
  }
  return parsed.data;
}

async function getBusinessOrFail(req: express.Request, res: express.Response, id: number) {
  const rows = await getBusinessRows(req.currentUser?.id);
  const business = rows.find((row) => row.id === id);
  if (!business) {
    fail(res, 404, "Business not found", "NOT_FOUND");
    return null;
  }
  return business;
}

function emitQueueUpdate(event: QueueRealtimeEvent) {
  broadcastEvent({
    type: "queue:update",
    payload: event,
    businessId: event.businessId,
    userId: event.userId ?? undefined,
  });
}

function emitForBusiness(
  businessId: number,
  userId?: number,
  overrides: Partial<Omit<QueueRealtimeEvent, "businessId" | "userId" | "changedAt">> = {},
) {
  emitQueueUpdate({
    entryId: overrides.entryId ?? null,
    businessId,
    userId: userId ?? null,
    status: overrides.status ?? null,
    action: overrides.action ?? "system-sync",
    changedAt: new Date().toISOString(),
    message: overrides.message ?? "Queue data changed.",
    queueOrderChanged: overrides.queueOrderChanged ?? true,
    needsAssignmentAttention: overrides.needsAssignmentAttention ?? false,
    affectsJoinAvailability: overrides.affectsJoinAvailability ?? false,
  });
}

function emitConversationUpdate(conversationId: number, businessId: number, userId: number) {
  broadcastEvent({ type: "chat:conversation-updated", payload: { conversationId, businessId, userId }, businessId, userId });
}

function emitSupportConversationUpdate(conversationId: number, requesterUserId: number) {
  broadcastEvent({ type: "support:conversation-updated", payload: { conversationId, requesterUserId }, userId: requesterUserId });
  broadcastEvent({ type: "support:conversation-updated", payload: { conversationId, requesterUserId } });
}

function emitSupportMessageUpdate(conversationId: number, requesterUserId: number) {
  broadcastEvent({ type: "support:new-message", payload: { conversationId, requesterUserId }, userId: requesterUserId });
  broadcastEvent({ type: "support:new-message", payload: { conversationId, requesterUserId } });
}

function getAdminIds() {
  return db.select({ id: users.id }).from(users).where(eq(users.role, "admin")).all().map((item) => item.id);
}

function getSupportConversationSummary(
  record: typeof supportConversations.$inferSelect,
  viewerRole: AuthUser["role"],
): SupportConversationSummary | null {
  const requester = db.select().from(users).where(eq(users.id, record.requesterUserId)).get();
  if (!requester) return null;
  const assignedAdmin = record.assignedAdminId ? db.select().from(users).where(eq(users.id, record.assignedAdminId)).get() : null;
  const latest = db
    .select()
    .from(supportMessages)
    .where(eq(supportMessages.conversationId, record.id))
    .orderBy(desc(supportMessages.createdAt))
    .get();

  const unreadCount =
    db
      .select({ count: sql<number>`count(*)` })
      .from(supportMessages)
      .where(
        and(
          eq(supportMessages.conversationId, record.id),
          reqContextSupportUnreadPredicate(viewerRole),
          sql`${supportMessages.readAt} is null`,
        ),
      )
      .get()?.count ?? 0;

  return {
    id: record.id,
    requesterUserId: requester.id,
    requesterName: requester.name,
    requesterRole: requester.role as SupportConversationSummary["requesterRole"],
    assignedAdminId: record.assignedAdminId ?? null,
    assignedAdminName: assignedAdmin?.name ?? null,
    subject: record.subject,
    status: record.status as SupportConversationSummary["status"],
    priority: record.priority as SupportConversationSummary["priority"],
    category: record.category as SupportConversationSummary["category"],
    latestMessage: latest?.body ?? null,
    latestMessageAt: latest?.createdAt ?? null,
    unreadCount,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

function reqContextSupportUnreadPredicate(viewerRole: AuthUser["role"]) {
  return viewerRole === "admin" ? sql`${supportMessages.senderRole} != 'admin'` : eq(supportMessages.senderRole, "admin");
}

function getSupportConversationDetail(id: number, viewerRole: AuthUser["role"]): SupportConversationDetail | null {
  const record = db.select().from(supportConversations).where(eq(supportConversations.id, id)).get();
  if (!record) return null;
  const summary = getSupportConversationSummary(record, viewerRole);
  if (!summary) return null;
  const messageRows = db
    .select({
      message: supportMessages,
      senderName: users.name,
    })
    .from(supportMessages)
    .innerJoin(users, eq(supportMessages.senderId, users.id))
    .where(eq(supportMessages.conversationId, id))
    .orderBy(supportMessages.createdAt)
    .all();

  return {
    ...summary,
    internalNotes: viewerRole === "admin" ? record.internalNotes ?? null : null,
    resolvedAt: record.resolvedAt ?? null,
    messages: messageRows.map(({ message, senderName }) => ({
      id: message.id,
      conversationId: message.conversationId,
      senderRole: message.senderRole as SupportConversationDetail["requesterRole"],
      senderId: message.senderId,
      senderName,
      body: message.body,
      createdAt: message.createdAt,
      readAt: message.readAt ?? null,
    })),
  };
}

function getSupportConversationSummariesForUser(userId: number, viewerRole: AuthUser["role"]) {
  return db
    .select()
    .from(supportConversations)
    .where(eq(supportConversations.requesterUserId, userId))
    .orderBy(desc(supportConversations.updatedAt))
    .all()
    .map((record) => getSupportConversationSummary(record, viewerRole))
    .filter(Boolean) as SupportConversationSummary[];
}

function getSupportConversationSummariesForAdmin(viewerRole: AuthUser["role"]) {
  return db
    .select()
    .from(supportConversations)
    .orderBy(desc(supportConversations.updatedAt))
    .all()
    .map((record) => getSupportConversationSummary(record, viewerRole))
    .filter(Boolean) as SupportConversationSummary[];
}

function ensureSupportConversationForUser(user: AuthUser, subject = "Technical support") {
  const existing = db
    .select()
    .from(supportConversations)
    .where(and(eq(supportConversations.requesterUserId, user.id), eq(supportConversations.status, "active")))
    .orderBy(desc(supportConversations.updatedAt))
    .get();

  if (existing) return getSupportConversationDetail(existing.id, user.role)!;

  const now = new Date().toISOString();
  const firstAdminId = getAdminIds()[0] ?? null;
  const conversationId = insertAndReturnId(db, supportConversations, {
      requesterUserId: user.id,
      assignedAdminId: firstAdminId,
      subject,
      status: "active",
      createdAt: now,
      updatedAt: now,
    });
  db.insert(supportMessages).values({
    conversationId,
    senderRole: user.role,
    senderId: user.id,
    body: `${subject}. I need help from Smart Queue technical support.`,
    createdAt: now,
    readAt: null,
  }).run();

  getAdminIds().forEach((adminId) => {
    createDetailedNotification(adminId, {
      type: "support-new-request",
      title: "New support request",
      message: `${user.name} opened a support conversation.`,
      severity: "info",
      category: "support",
    });
  });

  emitSupportConversationUpdate(conversationId, user.id);
  emitSupportMessageUpdate(conversationId, user.id);
  return getSupportConversationDetail(conversationId, user.role)!;
}

function getOwnerIdsForBusiness(businessId: number) {
  return db
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.businessId, businessId), eq(users.role, "owner")))
    .all()
    .map((row) => row.id);
}

function notifyBusinessOwners(
  businessId: number,
  input: {
    type: string;
    title: string;
    message: string;
    severity?: "success" | "info" | "warning" | "error";
    category?: string | null;
  },
) {
  getOwnerIdsForBusiness(businessId).forEach((ownerId) => {
    createDetailedNotification(ownerId, {
      ...input,
      category: input.category ?? "operations",
    });
  });
}

function getActiveConversation(businessId: number, userId: number) {
  return db
    .select()
    .from(conversations)
    .where(and(eq(conversations.businessId, businessId), eq(conversations.userId, userId), eq(conversations.status, "active")))
    .orderBy(desc(conversations.updatedAt))
    .get();
}

function touchConversation(
  businessId: number,
  userId: number,
  updates: {
    visitType?: "pre_visit" | "queue" | "appointment";
    queueEntryId?: number | null;
    appointmentId?: number | null;
    contextLabel?: string;
  } = {},
) {
  const now = new Date().toISOString();
  const existing = getActiveConversation(businessId, userId);
  if (existing) {
    db
      .update(conversations)
      .set({
        status: "active",
        visitType: updates.visitType ?? (existing.visitType as "pre_visit" | "queue" | "appointment"),
        queueEntryId: updates.queueEntryId !== undefined ? updates.queueEntryId : existing.queueEntryId,
        appointmentId: updates.appointmentId !== undefined ? updates.appointmentId : existing.appointmentId,
        contextLabel:
          updates.contextLabel ??
          getConversationContextLabel(
            (updates.visitType ?? (existing.visitType as "pre_visit" | "queue" | "appointment")) as "pre_visit" | "queue" | "appointment",
            "active",
          ),
        closeReason: null,
        closedAt: null,
        archivedAt: null,
        updatedAt: now,
      })
      .where(eq(conversations.id, existing.id))
      .run();
    return existing.id;
  }

  const owner = db.select().from(users).where(and(eq(users.businessId, businessId), eq(users.role, "owner"))).get();
  return insertAndReturnId(db, conversations, {
      businessId,
      userId,
      ownerId: owner?.id ?? null,
      status: "active",
      visitType: updates.visitType ?? "pre_visit",
      queueEntryId: updates.queueEntryId ?? null,
      appointmentId: updates.appointmentId ?? null,
      contextLabel: updates.contextLabel ?? getConversationContextLabel(updates.visitType ?? "pre_visit", "active"),
      closeReason: null,
      closedAt: null,
      archivedAt: null,
      createdAt: now,
      updatedAt: now,
    });
}

function endConversationForVisit(
  match: { queueEntryId?: number; appointmentId?: number },
  reason: "completed" | "cancelled" | "expired" | "manual" | "no_show" | "transferred",
) {
  const now = new Date().toISOString();
  const records = db
    .select()
    .from(conversations)
    .where(
      and(
        eq(conversations.status, "active"),
        match.queueEntryId !== undefined ? eq(conversations.queueEntryId, match.queueEntryId) : sql`1 = 1`,
        match.appointmentId !== undefined ? eq(conversations.appointmentId, match.appointmentId) : sql`1 = 1`,
      ),
    )
    .all();

  records.forEach((conversation) => {
    db
      .update(conversations)
      .set({
        status: "archived",
        contextLabel: getConversationContextLabel(conversation.visitType as "pre_visit" | "queue" | "appointment", "closed", reason),
        closeReason: reason,
        closedAt: now,
        archivedAt: now,
        updatedAt: now,
      })
      .where(eq(conversations.id, conversation.id))
      .run();
    emitConversationUpdate(conversation.id, conversation.businessId, conversation.userId);
  });
}

const ASSISTANT_MESSAGE_LIMIT = 30;
const SUPPORT_ESCALATION_KEYWORDS = [
  /\bnot working\b/i,
  /\bissue\b/i,
  /\bproblem\b/i,
  /\bbug\b/i,
  /\berror\b/i,
  /\btechnical\b/i,
  /\bcrash(?:ed|ing)?\b/i,
  /\bfailed?\b/i,
  /\bbroken\b/i,
  /\bmissing data\b/i,
  /\bnot loading\b/i,
  /\bcan(?:not|'t) log(?: ?in)?\b/i,
  /\blog(?: ?in|in) issue\b/i,
  /\bsubscription (?:issue|problem|error|failed?)\b/i,
  /\bpayment (?:issue|problem|error|failed?)\b/i,
  /\baccess (?:issue|problem|error)\b/i,
  /\bcan(?:not|'t) access\b/i,
  /\bsync(?:ing)?\b/i,
  /\bslow\b/i,
];
const PRODUCT_RELATED_KEYWORDS = [
  /\bsmart queue\b/i,
  /\bqtech\b/i,
  /\bqueue\b/i,
  /\bappointment\b/i,
  /\bbusiness\b/i,
  /\bdashboard\b/i,
  /\badmin\b/i,
  /\baccount\b/i,
  /\bmessage\b/i,
  /\bchat\b/i,
  /\bvisit\b/i,
  /\breceipt\b/i,
  /\bnotification\b/i,
  /\bprofile\b/i,
  /\bsetting\b/i,
  /\bmap\b/i,
  /\bsearch\b/i,
  /\bsaved\b/i,
  /\bfavorite\b/i,
  /\bservice\b/i,
  /\bcounter\b/i,
  /\bfeedback\b/i,
  /\banalytics\b/i,
];
const APP_ROUTE_CATALOG = {
  guest: [
    "/account",
    "/account/queues",
    "/account/search",
    "/account/map",
    "/account/appointments",
    "/account/receipts",
    "/account/messages",
    "/account/notifications",
    "/account/profile",
    "/account/settings",
    "/schedule-queue",
    "/queue-preview/:entryId",
    "/business/:id",
    "/places/external/:provider/:placeId",
  ],
  owner: [
    "/business-dashboard",
    "/business-dashboard/queue",
    "/business-dashboard/appointments",
    "/business-dashboard/services",
    "/business-dashboard/messages",
    "/business-dashboard/receipts",
    "/business-dashboard/analytics",
    "/business-dashboard/feedback",
    "/business-dashboard/notifications",
    "/business-dashboard/settings",
  ],
  admin: ["/admin-panel", "/admin-panel/overview", "/admin-panel/businesses", "/admin-panel/owners", "/admin-panel/accounts"],
};

function getAssistantScope(role: AuthUser["role"]): AssistantThreadScope {
  return role;
}

function isSupportEscalationPrompt(prompt: string) {
  return SUPPORT_ESCALATION_KEYWORDS.some((pattern) => pattern.test(prompt));
}

function isLikelyProductPrompt(prompt: string, parsed: AssistantRequest) {
  if (parsed.pageContext?.path || parsed.pageContext?.label) return true;
  return PRODUCT_RELATED_KEYWORDS.some((pattern) => pattern.test(prompt));
}

function buildSupportEscalationResponse(role: AuthUser["role"]): AssistantResponse {
  return {
    status: "answered",
    resolutionState: "escalated",
    canRate: false,
    message:
      role === "admin"
        ? "This sounds like a technical or account-level issue. Please contact Smart Queue support or technical support so they can investigate it directly."
        : "This sounds like a technical issue. Please contact Smart Queue support or technical support so they can check the problem directly.",
    nextSteps: [
      "Contact Smart Queue support or technical support.",
      "Share the screen, route, and what happened right before the issue started.",
      "Include any exact error text if you can see one.",
    ],
    suggestedReply: null,
    recommendedBusinessAction: null,
    refusalReason: null,
    actionProposal: null,
    actionResult: null,
    thread: null,
  };
}

function buildUnrelatedPromptResponse(): AssistantResponse {
  return {
    status: "refused",
    resolutionState: "unresolved",
    canRate: false,
    message: "I can help with Smart Queue features, routes, workflows, and account guidance inside this application.",
    nextSteps: [
      "Ask about queues, appointments, messages, receipts, dashboards, settings, or another Smart Queue screen.",
      "Mention the page you are on and what you want to do next.",
    ],
    suggestedReply: null,
    recommendedBusinessAction: null,
    refusalReason: "That request is outside Smart Queue support and product guidance.",
    actionProposal: null,
    actionResult: null,
    thread: null,
  };
}

function shouldAssistantMessageBeRateable(response: AssistantResponse, role: AuthUser["role"]) {
  if (role === "admin") return false;
  if (response.status === "refused" || response.status === "needs_confirmation") return false;
  if (response.actionResult && !response.actionResult.success) return false;
  return response.resolutionState === "resolved";
}

function toAssistantThreadMessage(row: typeof assistantMessages.$inferSelect): AssistantThreadMessage {
  const feedback = db.select().from(assistantFeedback).where(eq(assistantFeedback.assistantMessageId, row.id)).get();
  return {
    id: row.id,
    threadId: row.threadId,
    role: row.role as AssistantThreadMessage["role"],
    kind: row.kind as AssistantThreadMessage["kind"],
    body: row.body,
    resolutionState: (row.resolutionState as AssistantResolutionState | null) ?? null,
    canRate: row.canRate && !feedback,
    feedbackRating: feedback?.rating ?? null,
    feedbackComment: feedback?.comment ?? null,
    createdAt: row.createdAt,
  };
}

function getAssistantThreadDetail(threadId: number): AssistantThread | null {
  const thread = db.select().from(assistantThreads).where(eq(assistantThreads.id, threadId)).get();
  if (!thread) return null;
  const threadMessages = db.select().from(assistantMessages).where(eq(assistantMessages.threadId, threadId)).orderBy(assistantMessages.createdAt).all();
  return {
    id: thread.id,
    scope: thread.scope as AssistantThreadScope,
    ownerUserId: thread.ownerUserId,
    businessId: thread.businessId ?? null,
    createdAt: thread.createdAt,
    updatedAt: thread.updatedAt,
    messages: threadMessages.map(toAssistantThreadMessage),
  };
}

function ensureAssistantThread(user: AuthUser): AssistantThread {
  const scope = getAssistantScope(user.role);
  const existing = db
    .select()
    .from(assistantThreads)
    .where(and(eq(assistantThreads.scope, scope), eq(assistantThreads.ownerUserId, user.id)))
    .get();

  if (existing) {
    const nextBusinessId = user.role === "owner" ? getOwnerBusinessId(user.id) : null;
    if (existing.businessId !== nextBusinessId) {
      db
        .update(assistantThreads)
        .set({ businessId: nextBusinessId, updatedAt: new Date().toISOString() })
        .where(eq(assistantThreads.id, existing.id))
        .run();
    }
    return getAssistantThreadDetail(existing.id)!;
  }

  const now = new Date().toISOString();
  const threadId = insertAndReturnId(db, assistantThreads, {
      scope,
      ownerUserId: user.id,
      businessId: user.role === "owner" ? getOwnerBusinessId(user.id) : null,
      createdAt: now,
      updatedAt: now,
    });

  return getAssistantThreadDetail(threadId)!;
}

function trimAssistantThreadMessages(threadId: number) {
  const threadMessages = db
    .select({ id: assistantMessages.id })
    .from(assistantMessages)
    .where(eq(assistantMessages.threadId, threadId))
    .orderBy(desc(assistantMessages.createdAt), desc(assistantMessages.id))
    .all();

  if (threadMessages.length <= ASSISTANT_MESSAGE_LIMIT) return;
  const staleIds = threadMessages.slice(ASSISTANT_MESSAGE_LIMIT).map((item) => item.id);
  if (staleIds.length) {
    db.delete(assistantMessages).where(inArray(assistantMessages.id, staleIds)).run();
  }
}

function appendAssistantThreadMessage(
  threadId: number,
  role: AssistantThreadMessage["role"],
  kind: AssistantThreadMessage["kind"],
  body: string,
  options?: {
    resolutionState?: AssistantResolutionState | null;
    canRate?: boolean;
  },
) {
  const now = new Date().toISOString();
  const messageId = insertAndReturnId(db, assistantMessages, {
      threadId,
      role,
      kind,
      body,
      resolutionState: options?.resolutionState ?? null,
      canRate: options?.canRate ?? false,
      createdAt: now,
    });
  db.update(assistantThreads).set({ updatedAt: now }).where(eq(assistantThreads.id, threadId)).run();
  trimAssistantThreadMessages(threadId);
  return messageId;
}

function buildAssistantHistoryContext(thread: AssistantThread) {
  return thread.messages.slice(-12).map((message) => ({
    role: message.role,
    kind: message.kind,
    body: message.body,
    createdAt: message.createdAt,
  }));
}

function withAssistantThread(response: AssistantResponse, threadId: number): AssistantResponse {
  return {
    ...response,
    thread: getAssistantThreadDetail(threadId),
  };
}

function buildAssistantSystemPrompt(role: AuthUser["role"]) {
  const roleGuidance =
    role === "user"
      ? "You are helping a guest use Smart Queue. You may only propose low-risk user actions and you must never execute them yourself."
      : role === "owner"
        ? "You are helping a business owner understand their assigned business dashboard and operations. Do not propose or execute owner actions in this version."
        : "You are helping an admin understand platform records and management surfaces. Do not propose or execute admin actions in this version.";

  return `
You are the Smart Queue Assistant.

Identity:
- You are a product copilot for the Smart Queue application.
- You only answer questions about Smart Queue, its businesses, queues, appointments, messaging, timing, navigation, and supported workflows.
- You are not a general-purpose assistant.
- Your tone is friendly, calm, and supportive.
- Write like a helpful in-app guide: warm, clear, and reassuring.

Guardrails:
- Refuse unrelated requests and redirect the user back to Smart Queue topics.
- If the user describes a bug, technical problem, login/access issue, missing data, broken screen, subscription/payment problem, or anything not working, tell them to contact Smart Queue support or technical support.
- Never invent data or claim a business, queue, appointment, or action exists if it is not present in the supplied context.
- Never claim that an action was completed unless the backend execution really succeeded.
- Respect role boundaries and do not reveal hidden data across roles.
- If a request is missing details, ask for the missing details instead of guessing.
- If the context is incomplete or uncertain, say that plainly and offer the safest next step inside Smart Queue.

Action policy:
- Only user-role requests may include action proposals.
- Allowed user action proposals are: join_queue, create_appointment, cancel_appointment, queue_action, toggle_favorite, toggle_saved_place.
- Do not propose owner or admin operational actions.
- Do not execute actions. Only propose them when enough details are available.

Response format:
- Return JSON only.
- Use this shape:
{
  "status": "answered" | "refused" | "needs_confirmation",
  "resolutionState": "resolved" | "unresolved" | "escalated" | "needs_confirmation",
  "message": "string",
  "nextSteps": ["string"],
  "suggestedReply": "string or null",
  "recommendedBusinessAction": "string or null",
  "refusalReason": "string or null",
  "actionProposal": {
    "type": "join_queue" | "create_appointment" | "cancel_appointment" | "queue_action" | "toggle_favorite" | "toggle_saved_place",
    "label": "string",
    "confirmationMessage": "string",
    "businessId": 1,
    "serviceId": 1,
    "appointmentId": 1,
    "queueEntryId": 1,
    "queueAction": "pause" | "resume" | "skip" | "reschedule" | "cancel",
    "scheduledFor": "ISO string or null",
    "note": "string or null",
    "enable": true
  } | null,
  "actionResult": null
}

Resolution rules:
- Use "resolved" only when the request is actually answered or completed with the provided context.
- Use "unresolved" when the answer is partial, generic, missing key details, or asks the user to clarify.
- Use "escalated" when the request should go to Smart Queue support or technical support.
- Use "needs_confirmation" only when you are returning an action proposal that still needs user confirmation.

Response style:
- Keep answers concise, practical, and grounded in the provided context.
- Prefer plain language over jargon.
- When helpful, give step-by-step guidance.
- For how-to questions, prefer numbered or clearly ordered steps.
- If refusing, be kind and redirect back to supported Smart Queue topics.

${roleGuidance}

Reference:
${SMART_QUEUE_KNOWLEDGE_PACK}
`.trim();
}

function buildAssistantUserPrompt(label: string, prompt: string, context: Record<string, unknown>, history: ReturnType<typeof buildAssistantHistoryContext>) {
  return `
Mode: ${label}
Question: ${prompt}

Recent assistant thread:
${JSON.stringify(history, null, 2)}

Live Smart Queue context:
${JSON.stringify(context, null, 2)}
`.trim();
}

function normalizeAssistantResponse(response: AssistantResponse, role: AuthUser["role"]) {
  const normalized: AssistantResponse = {
    status: response.status ?? "answered",
    resolutionState:
      response.resolutionState ??
      (response.status === "needs_confirmation"
        ? "needs_confirmation"
        : response.actionResult
          ? response.actionResult.success
            ? "resolved"
            : "unresolved"
          : response.status === "refused"
            ? "unresolved"
            : "unresolved"),
    canRate: false,
    message: response.message ?? "I could not generate a helpful Smart Queue answer just now.",
    nextSteps: response.nextSteps ?? [],
    suggestedReply: response.suggestedReply ?? null,
    recommendedBusinessAction: response.recommendedBusinessAction ?? null,
    refusalReason: response.refusalReason ?? null,
    actionProposal: response.actionProposal ?? null,
    actionResult: response.actionResult ?? null,
    thread: response.thread ?? null,
  };

  if (role !== "user") {
    normalized.actionProposal = null;
    if (normalized.status === "needs_confirmation") {
      normalized.status = "answered";
      normalized.resolutionState = "needs_confirmation";
    }
  }

  normalized.canRate = shouldAssistantMessageBeRateable(normalized, role);

  return normalized;
}

function buildUserAssistantContext(userId: number, parsed: AssistantRequest) {
  const businessesForUser = db.select().from(businesses).all();
  const entries = getQueueEntriesForUser(userId);
  const appointmentsForUser = getAppointmentsForUser(userId);
  const notificationsForUser = getNotificationsForUser(userId);
  const savedPlaces = getSavedPlacesForUser(userId);
  const recentVisits = getVisitHistoryForUser(userId).slice(0, 5);
  const conversationsForUser = getConversationSummariesForUser(userId, "all").slice(0, 5);
  const businessContext = parsed.businessId ? db.select().from(businesses).where(eq(businesses.id, parsed.businessId)).get() : null;
  const services =
    parsed.businessId != null
      ? db.select().from(businessServices).where(and(eq(businessServices.businessId, parsed.businessId), eq(businessServices.isActive, true))).all()
      : [];
  const selectedQueue = parsed.queueEntryId != null ? entries.find((item) => item.id === parsed.queueEntryId) ?? null : null;
  const selectedAppointment = parsed.appointmentId != null ? appointmentsForUser.find((item) => item.id === parsed.appointmentId) ?? null : null;

  return {
    role: "user",
    routeCatalog: APP_ROUTE_CATALOG.guest,
    supportGuidance: "For technical issues, bugs, broken screens, login problems, subscription/access issues, or missing data, tell the guest to contact Smart Queue support or technical support.",
    pageContext: parsed.pageContext ?? null,
    businessesPreview: businessesForUser.slice(0, 8).map((item) => ({
      id: item.id,
      name: item.name,
      isQueueOpen: item.isQueueOpen,
    })),
    selectedBusiness: businessContext
      ? {
          id: businessContext.id,
          name: businessContext.name,
          address: businessContext.address,
          phone: businessContext.phone,
          email: businessContext.email,
        }
      : null,
    selectedBusinessServices: services.map((service) => ({
      id: service.id,
      name: service.name,
      supportsAppointments: !!service.supportsAppointments,
      isActive: !!service.isActive,
    })),
    activeQueueEntries: entries.map((item) => ({
      id: item.id,
      businessId: item.businessId,
      businessName: item.businessName,
      status: item.status,
      serviceId: item.serviceId,
      serviceName: item.serviceName,
      estimatedWaitMinutes: item.estimatedWaitMinutes,
      position: item.position,
    })),
    upcomingAppointments: appointmentsForUser
      .filter((item) => ["pending", "approved"].includes(item.status))
      .map((item) => ({
        id: item.id,
        businessId: item.businessId,
        businessName: item.businessName,
        serviceId: item.serviceId,
        serviceName: item.serviceName,
        scheduledFor: item.scheduledFor,
        status: item.status,
      })),
    savedPlaces: savedPlaces.map((item) => ({
      businessId: item.businessId,
      businessName: item.businessName,
      note: item.note,
    })),
    recentNotifications: notificationsForUser.slice(0, 5).map((item) => ({
      id: item.id,
      title: item.title,
      category: item.category,
      isRead: item.isRead,
      createdAt: item.createdAt,
    })),
    recentVisits: recentVisits.map((item) => ({
      id: item.id,
      businessName: item.businessName,
      visitType: item.visitType,
      status: item.status,
      serviceName: item.serviceName,
      canRebook: item.canRebook,
    })),
    recentConversations: conversationsForUser.map((item) => ({
      id: item.id,
      businessName: item.businessName,
      status: item.status,
      contextLabel: item.contextLabel,
      latestMessage: item.latestMessage,
    })),
    selectedQueueEntry: selectedQueue,
    selectedAppointment,
  };
}

function buildOwnerAssistantContext(user: AuthUser, parsed: AssistantRequest) {
  const businessId = getOwnerBusinessId(user.id);
  const dashboard = businessId ? getOwnerDashboardData(businessId) : null;
  const businessContext = businessId ? db.select().from(businesses).where(eq(businesses.id, businessId)).get() : null;

  return {
    role: "owner",
    routeCatalog: APP_ROUTE_CATALOG.owner,
    supportGuidance: "For technical issues, broken dashboard behavior, missing records, access problems, or billing/support issues, direct the owner to Smart Queue support or technical support.",
    pageContext: parsed.pageContext ?? null,
    business: businessContext
      ? {
          id: businessContext.id,
          name: businessContext.name,
          address: businessContext.address,
          isQueueOpen: businessContext.isQueueOpen,
          supportsReceipts: businessContext.supportsReceipts,
        }
      : null,
    queueSummary: dashboard
      ? {
          activeCount: dashboard.queueEntriesList.length,
          pendingAppointments: dashboard.pendingAppointments.length,
          pendingConversationCount: dashboard.conversations.length,
          notices: dashboard.notices.filter((item) => item.isActive).map((item) => ({
            id: item.id,
            title: item.title,
            severity: item.severity,
          })),
          services: dashboard.services.map((service) => ({
            id: service.id,
            name: service.name,
            estimatedWaitMinutes: service.estimatedWaitMinutes,
            supportsAppointments: service.supportsAppointments,
          })),
        }
      : null,
  };
}

function buildAdminAssistantContext(parsed: AssistantRequest) {
  return {
    role: "admin",
    routeCatalog: APP_ROUTE_CATALOG.admin,
    supportGuidance: "For technical faults, data integrity issues, access/login problems, or subscription/payment issues, direct the admin to Smart Queue support or technical support.",
    pageContext: parsed.pageContext ?? null,
    overview: {
      businesses: db.select({ count: sql<number>`count(*)` }).from(businesses).get()?.count ?? 0,
      owners: db.select({ count: sql<number>`count(*)` }).from(users).where(eq(users.role, "owner")).get()?.count ?? 0,
      users: db.select({ count: sql<number>`count(*)` }).from(users).where(eq(users.role, "user")).get()?.count ?? 0,
      pendingClaims: getClaimRequests().filter((item) => item.status === "pending").length,
      activeSubscriptions: getAllBusinessSubscriptions().filter((item) => item.status === "active").length,
    },
  };
}

async function getAssistantResponseForUser(user: AuthUser, parsed: AssistantRequest) {
  const thread = ensureAssistantThread(user);
  appendAssistantThreadMessage(thread.id, "user", "prompt", parsed.prompt);

  if (isSupportEscalationPrompt(parsed.prompt)) {
    const response = buildSupportEscalationResponse(user.role);
    appendAssistantThreadMessage(thread.id, "assistant", "support_referral", response.message, {
      resolutionState: response.resolutionState,
      canRate: response.canRate,
    });
    return withAssistantThread(response, thread.id);
  }

  if (!isLikelyProductPrompt(parsed.prompt, parsed)) {
    const response = buildUnrelatedPromptResponse();
    appendAssistantThreadMessage(thread.id, "assistant", "answer", response.message, {
      resolutionState: response.resolutionState,
      canRate: response.canRate,
    });
    return withAssistantThread(response, thread.id);
  }

  const context =
    user.role === "user"
      ? buildUserAssistantContext(user.id, parsed)
      : user.role === "owner"
        ? buildOwnerAssistantContext(user, parsed)
        : buildAdminAssistantContext(parsed);

  const historyContext = buildAssistantHistoryContext(thread);
  const assistantSystemPrompt = buildAssistantSystemPrompt(user.role);
  const assistantUserPrompt = buildAssistantUserPrompt(user.role, parsed.prompt, context, historyContext);

  let result: AssistantResponse;
  if (!isGroqAssistantConfigured()) {
    result = buildOfflineAssistantResponse(user.role, parsed.prompt, context);
  } else {
    try {
      result = await callGroqAssistant(assistantSystemPrompt, assistantUserPrompt);
    } catch {
      result = buildOfflineAssistantResponse(user.role, parsed.prompt, context);
    }
  }

  const normalized = normalizeAssistantResponse(result, user.role);
  appendAssistantThreadMessage(
    thread.id,
    "assistant",
    normalized.actionResult ? "action_result" : "answer",
    normalized.message,
    {
      resolutionState: normalized.resolutionState,
      canRate: normalized.canRate,
    },
  );
  return withAssistantThread(normalized, thread.id);
}

async function performJoinQueue(userId: number, businessId: number, serviceId: number) {
  const rows = await getBusinessRows(userId);
  const business = rows.find((row) => row.id === businessId);
  if (!business) throw new Error("Business not found.");
  const businessDetail = toBusinessDetail(business);
  const service = businessDetail.services.find((item) => item.id === serviceId && item.isActive);
  if (!service) throw new Error("That service is not available for live queueing.");
  if (!businessDetail.queueSettings.isQueueOpen) throw new Error("This business is not accepting live joins right now.");
  if (service.isAtCapacity) throw new Error(`The ${service.name} lane is already at capacity right now. Please try again later or pick another service.`);
  const { entryId, activeCount } = allocateActiveQueueEntry({
    businessId,
    userId,
    serviceId,
    serviceName: service.name,
    averageServiceMinutes: service.averageServiceMinutes,
    maxActiveQueue: service.maxActiveQueue,
  });
  const timestamp = db.select({ joinedAt: queueEntries.joinedAt }).from(queueEntries).where(eq(queueEntries.id, entryId)).get()?.joinedAt ?? new Date().toISOString();
  addQueueEvent(entryId, "joined", `Joined ${service.name}.`, timestamp);
  const conversationId = touchConversation(businessId, userId, {
    visitType: "queue",
    queueEntryId: entryId,
    appointmentId: null,
    contextLabel: getConversationContextLabel("queue", "active"),
  });
  revalidateQueueForBusiness(businessId);
  createNotification(userId, "queue-joined", "Queue joined", `You joined ${businessDetail.name} for ${service.name}.`);
  notifyBusinessOwners(businessId, {
    type: "queue-new-guest",
    title: "New queue guest",
    message: `A guest joined ${service.name}.`,
    severity: "success",
    category: "queue",
  });
  emitConversationUpdate(conversationId, businessId, userId);
  emitForBusiness(businessId, userId, {
    entryId,
    status: "waiting",
    action: "joined",
    message: `${businessDetail.name} added a guest to ${service.name}.`,
    queueOrderChanged: true,
    needsAssignmentAttention: true,
    affectsJoinAvailability: activeCount + 1 >= service.maxActiveQueue,
  });
  return { entryId, entries: getQueueEntriesForUser(userId), businessName: businessDetail.name, serviceName: service.name };
}

async function performCreateAppointment(userId: number, businessId: number, serviceId: number, scheduledForRaw: string, notes = "") {
  const rows = await getBusinessRows(userId);
  const business = rows.find((row) => row.id === businessId);
  if (!business) throw new Error("Business not found.");
  const businessDetail = toBusinessDetail(business);
  const service = businessDetail.services.find((item) => item.id === serviceId && item.supportsAppointments);
  if (!service) throw new Error("That service does not support appointments.");
  const scheduledFor = new Date(scheduledForRaw);
  if (Number.isNaN(scheduledFor.getTime()) || scheduledFor.getTime() <= Date.now()) throw new Error("Appointment time must be in the future.");
  const maxDate = new Date();
  maxDate.setDate(maxDate.getDate() + businessDetail.queueSettings.bookingHorizonDays);
  if (scheduledFor.getTime() > maxDate.getTime()) throw new Error("That appointment time is outside the current booking window.");
  const appointmentId = insertAndReturnId(db, appointments, {
      businessId,
      userId,
      serviceId,
      scheduledFor: scheduledFor.toISOString(),
      status: "pending",
      notes: notes || null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  const conversationId = touchConversation(businessId, userId, {
    visitType: "appointment",
    queueEntryId: null,
    appointmentId,
    contextLabel: getConversationContextLabel("appointment", "active"),
  });
  emitConversationUpdate(conversationId, businessId, userId);
  emitForBusiness(businessId, userId);
  return {
    appointmentId,
    appointments: getAppointmentsForUser(userId),
    businessName: businessDetail.name,
    serviceName: service.name,
  };
}

function performCancelAppointment(userId: number, appointmentId: number) {
  const appointment = db.select().from(appointments).where(and(eq(appointments.id, appointmentId), eq(appointments.userId, userId))).get();
  if (!appointment) throw new Error("Appointment not found.");
  db.update(appointments).set({ status: "cancelled", updatedAt: new Date().toISOString() }).where(eq(appointments.id, appointmentId)).run();
  endConversationForVisit({ appointmentId }, "cancelled");
  emitForBusiness(appointment.businessId, userId);
  return { appointments: getAppointmentsForUser(userId), businessId: appointment.businessId };
}

function performToggleFavorite(userId: number, businessId: number, enable: boolean) {
  const existing = db.select().from(favorites).where(and(eq(favorites.businessId, businessId), eq(favorites.userId, userId))).get();
  if (enable && !existing) {
    db.insert(favorites).values({ userId, businessId, createdAt: new Date().toISOString() }).run();
  }
  if (!enable && existing) {
    db.delete(favorites).where(and(eq(favorites.businessId, businessId), eq(favorites.userId, userId))).run();
  }
  emitForBusiness(businessId, userId);
}

function performToggleSavedPlace(userId: number, businessId: number, enable: boolean, note?: string | null) {
  const existing = db.select().from(savedPlaces).where(and(eq(savedPlaces.businessId, businessId), eq(savedPlaces.userId, userId))).get();
  if (enable && !existing) {
    db.insert(savedPlaces).values({ userId, businessId, note: note ?? null, createdAt: new Date().toISOString() }).run();
  }
  if (!enable && existing) {
    db.delete(savedPlaces).where(and(eq(savedPlaces.businessId, businessId), eq(savedPlaces.userId, userId))).run();
  }
}

function getQueueEntryRecordForUser(userId: number, entryId: number) {
  return db
    .select({ entry: queueEntries, business: businesses })
    .from(queueEntries)
    .innerJoin(businesses, eq(queueEntries.businessId, businesses.id))
    .where(and(eq(queueEntries.id, entryId), eq(queueEntries.userId, userId)))
    .get();
}

function getServiceQueueCount(businessId: number, serviceId: number | null, excludeEntryId?: number) {
  if (serviceId == null) return 0;
  const clauses = [
    eq(queueEntries.businessId, businessId),
    eq(queueEntries.serviceId, serviceId),
    inArray(queueEntries.status, ["waiting", "called", "paused", "in_service", "delayed"]),
  ];
  if (excludeEntryId != null) clauses.push(sql`${queueEntries.id} != ${excludeEntryId}`);
  return db.select({ count: sql<number>`count(*)` }).from(queueEntries).where(and(...clauses)).get()?.count ?? 0;
}

function executeUserQueueAction(userId: number, entryId: number, action: "pause" | "resume" | "skip" | "reschedule" | "cancel") {
  const record = getQueueEntryRecordForUser(userId, entryId);
  if (!record) throw new Error("Queue entry not found.");
  const current = record.entry;
  const pauseLimitMinutes = record.business.pauseLimitMinutes;
  const actionAvailability = getQueueActionAvailability(
    current,
    pauseLimitMinutes,
    record.business.maxSkips,
    record.business.maxReschedules,
  ).availableGuestActions;
  const now = new Date().toISOString();
  const isAllowed =
    action === "pause"
      ? actionAvailability.canPause
      : action === "resume"
        ? actionAvailability.canResume
        : action === "skip"
          ? actionAvailability.canSkip
          : action === "reschedule"
            ? actionAvailability.canReschedule
            : actionAvailability.canCancel;

  if (!isAllowed.allowed) {
    throw new Error(isAllowed.reason ?? "That queue action is not available right now.");
  }

  let notificationMessage = "Your queue was updated.";
  let ownerMessage = "The queue visit changed.";
  let realtimeMessage = "Your queue was updated.";
  let timelineLabel = "Queue updated.";
  let needsAssignmentAttention = false;
  let affectsJoinAvailability = false;

  switch (action) {
    case "pause": {
      const copy = getGuestQueueActionCopy("pause", pauseLimitMinutes);
      db.update(queueEntries).set({ status: "paused", pauseStartedAt: now, updatedAt: now }).where(eq(queueEntries.id, entryId)).run();
      timelineLabel = copy.timelineLabel;
      notificationMessage = copy.userMessage;
      ownerMessage = copy.ownerMessage;
      realtimeMessage = copy.realtimeMessage;
      break;
    }
    case "resume": {
      const copy = getGuestQueueActionCopy("resume", pauseLimitMinutes);
      const pauseStarted = current.pauseStartedAt ? new Date(current.pauseStartedAt).getTime() : Date.now();
      const pausedSeconds = Math.floor((Date.now() - pauseStarted) / 1000);
      db
        .update(queueEntries)
        .set({
          status: "waiting",
          pauseStartedAt: null,
          totalPausedSeconds: Math.min(current.totalPausedSeconds + pausedSeconds, pauseLimitMinutes * 60),
          updatedAt: now,
        })
        .where(eq(queueEntries.id, entryId))
        .run();
      timelineLabel = copy.timelineLabel;
      notificationMessage = copy.userMessage;
      ownerMessage = copy.ownerMessage;
      realtimeMessage = copy.realtimeMessage;
      break;
    }
    case "skip": {
      const copy = getGuestQueueActionCopy("skip", pauseLimitMinutes);
      if (current.skipsUsed >= record.business.maxSkips) throw new Error("Skip limit reached.");
      db
        .update(queueEntries)
        .set({
          skipsUsed: current.skipsUsed + 1,
          queueOrderKey: createQueueOrderKey(now),
          status: "waiting",
          pauseStartedAt: null,
          updatedAt: now,
        })
        .where(eq(queueEntries.id, entryId))
        .run();
      timelineLabel = copy.timelineLabel;
      notificationMessage = copy.userMessage;
      ownerMessage = copy.ownerMessage;
      realtimeMessage = copy.realtimeMessage;
      break;
    }
    case "reschedule": {
      const copy = getGuestQueueActionCopy("reschedule", pauseLimitMinutes);
      if (current.reschedulesUsed >= record.business.maxReschedules) throw new Error("Rejoin limit reached.");
      db
        .update(queueEntries)
        .set({
          reschedulesUsed: current.reschedulesUsed + 1,
          queueOrderKey: createQueueOrderKey(now),
          status: "waiting",
          pauseStartedAt: null,
          updatedAt: now,
        })
        .where(eq(queueEntries.id, entryId))
        .run();
      timelineLabel = copy.timelineLabel;
      notificationMessage = copy.userMessage;
      ownerMessage = copy.ownerMessage;
      realtimeMessage = copy.realtimeMessage;
      break;
    }
    case "cancel": {
      const copy = getGuestQueueActionCopy("cancel", pauseLimitMinutes);
      db.update(queueEntries).set({ status: "cancelled", cancelledAt: now, updatedAt: now }).where(eq(queueEntries.id, entryId)).run();
      timelineLabel = copy.timelineLabel;
      notificationMessage = copy.userMessage;
      ownerMessage = current.status === "called" ? "The guest cancelled after the business had already called the turn." : copy.ownerMessage;
      realtimeMessage = copy.realtimeMessage;
      affectsJoinAvailability = true;
      break;
    }
  }

  addQueueEvent(entryId, action === "cancel" ? "cancelled" : action === "reschedule" ? "rescheduled" : action === "skip" ? "skipped" : action === "pause" ? "paused" : "resumed", timelineLabel, now);
  if (action === "cancel") {
    endConversationForVisit({ queueEntryId: entryId }, "cancelled");
  }
  createNotification(userId, `queue-${action}`, "Queue updated", notificationMessage);
  notifyBusinessOwners(current.businessId, {
    type: `queue-guest-${action}`,
    title: "Guest queue change",
    message: `${record.entry.queueNumber} ${ownerMessage.charAt(0).toLowerCase()}${ownerMessage.slice(1)}`,
    severity: action === "cancel" ? "warning" : "info",
    category: "queue",
  });
  revalidateQueueForBusiness(current.businessId);
  const refreshed = db.select().from(queueEntries).where(eq(queueEntries.id, entryId)).get();
  if (refreshed?.status === "delayed") {
    touchConversation(current.businessId, userId, {
      visitType: "queue",
      queueEntryId: entryId,
      contextLabel: getConversationContextLabel("queue", "delayed"),
    });
  } else if (refreshed?.status === "waiting" || refreshed?.status === "paused" || refreshed?.status === "called") {
    touchConversation(current.businessId, userId, {
      visitType: "queue",
      queueEntryId: entryId,
      contextLabel: getConversationContextLabel("queue", "active"),
    });
  }
  emitForBusiness(current.businessId, userId, {
    entryId,
    status: (refreshed?.status as QueueRealtimeEvent["status"]) ?? null,
    action,
    message: realtimeMessage,
    queueOrderChanged: action !== "pause",
    needsAssignmentAttention,
    affectsJoinAvailability,
  });
  return {
    entries: getQueueEntriesForUser(userId),
    businessId: current.businessId,
    result: {
      entryId,
      action,
      status: refreshed?.status ?? current.status,
      message: notificationMessage,
    },
  };
}

function performUserQueueAction(userId: number, entryId: number, action: "pause" | "resume" | "skip" | "reschedule" | "cancel") {
  return executeUserQueueAction(userId, entryId, action);
}

async function executeAssistantAction(user: AuthUser, action: AssistantActionExecuteInput): Promise<AssistantResponse> {
  if (user.role !== "user") {
    return {
      status: "refused",
      resolutionState: "unresolved",
      canRate: false,
      message: "This version of the Smart Queue assistant only executes low-risk guest actions.",
      nextSteps: ["Use the dashboard controls directly for owner or admin tasks."],
      suggestedReply: null,
      recommendedBusinessAction: null,
      refusalReason: "Unsupported role for assistant execution.",
      actionProposal: null,
      actionResult: null,
    };
  }

  try {
    switch (action.type) {
      case "join_queue": {
        if (!action.businessId || !action.serviceId) throw new Error("A business and service are required to join a queue.");
        const result = await performJoinQueue(user.id, action.businessId, action.serviceId);
        return {
          status: "action_result",
          resolutionState: "resolved",
          canRate: true,
          message: `You are now in line at ${result.businessName} for ${result.serviceName}.`,
          nextSteps: ["Open your live queue card to follow timing updates."],
          suggestedReply: null,
          recommendedBusinessAction: null,
          refusalReason: null,
          actionProposal: null,
          actionResult: { type: action.type, success: true, message: "Queue joined successfully." },
        };
      }
      case "create_appointment": {
        if (!action.businessId || !action.serviceId || !action.scheduledFor) throw new Error("Business, service, and appointment time are required.");
        const result = await performCreateAppointment(user.id, action.businessId, action.serviceId, action.scheduledFor, action.note ?? "");
        return {
          status: "action_result",
          resolutionState: "resolved",
          canRate: true,
          message: `Your appointment request for ${result.serviceName} at ${result.businessName} has been created.`,
          nextSteps: ["Watch your appointments screen for approval updates."],
          suggestedReply: null,
          recommendedBusinessAction: null,
          refusalReason: null,
          actionProposal: null,
          actionResult: { type: action.type, success: true, message: "Appointment created successfully." },
        };
      }
      case "cancel_appointment": {
        if (!action.appointmentId) throw new Error("An appointment is required to cancel.");
        performCancelAppointment(user.id, action.appointmentId);
        return {
          status: "action_result",
          resolutionState: "resolved",
          canRate: true,
          message: "Your appointment has been cancelled.",
          nextSteps: ["Create a new appointment if you still want to visit later."],
          suggestedReply: null,
          recommendedBusinessAction: null,
          refusalReason: null,
          actionProposal: null,
          actionResult: { type: action.type, success: true, message: "Appointment cancelled successfully." },
        };
      }
      case "queue_action": {
        if (!action.queueEntryId || !action.queueAction) throw new Error("A queue entry and queue action are required.");
        const result = performUserQueueAction(user.id, action.queueEntryId, action.queueAction);
        return {
          status: "action_result",
          resolutionState: "resolved",
          canRate: true,
          message: result.result.message,
          nextSteps: ["Check your live queue card for the refreshed timing and status."],
          suggestedReply: null,
          recommendedBusinessAction: null,
          refusalReason: null,
          actionProposal: null,
          actionResult: { type: action.type, success: true, message: "Queue action completed successfully." },
        };
      }
      case "toggle_favorite": {
        if (!action.businessId || action.enable == null) throw new Error("A business and favorite state are required.");
        performToggleFavorite(user.id, action.businessId, action.enable);
        return {
          status: "action_result",
          resolutionState: "resolved",
          canRate: true,
          message: action.enable ? "This business is now in your favorites." : "This business was removed from your favorites.",
          nextSteps: ["Open the business page or your saved spots to keep planning."],
          suggestedReply: null,
          recommendedBusinessAction: null,
          refusalReason: null,
          actionProposal: null,
          actionResult: { type: action.type, success: true, message: "Favorite list updated successfully." },
        };
      }
      case "toggle_saved_place": {
        if (!action.businessId || action.enable == null) throw new Error("A business and saved-place state are required.");
        performToggleSavedPlace(user.id, action.businessId, action.enable, action.note ?? null);
        return {
          status: "action_result",
          resolutionState: "resolved",
          canRate: true,
          message: action.enable ? "This place was saved for later." : "This place was removed from your saved list.",
          nextSteps: ["Use saved places to compare future errands and visits."],
          suggestedReply: null,
          recommendedBusinessAction: null,
          refusalReason: null,
          actionProposal: null,
          actionResult: { type: action.type, success: true, message: "Saved places updated successfully." },
        };
      }
      default:
        throw new Error("That assistant action is not supported in this version.");
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "The requested assistant action could not be completed.";
    return {
      status: "action_result",
      resolutionState: "unresolved",
      canRate: false,
      message,
      nextSteps: ["Review the current page details and try again with more specific information."],
      suggestedReply: null,
      recommendedBusinessAction: null,
      refusalReason: null,
      actionProposal: null,
      actionResult: { type: action.type, success: false, message },
    };
  }
}

function handleQueueStateChange(req: express.Request, res: express.Response, action: "pause" | "resume" | "skip" | "reschedule" | "cancel") {
  const entryId = Number(req.params.id);
  if (Number.isNaN(entryId)) return fail(res, 400, "Invalid queue entry id", "INVALID_ID");
  try {
    const result = executeUserQueueAction(req.currentUser!.id, entryId, action);
    return ok(res, result);
  } catch (error) {
    return fail(res, 400, error instanceof Error ? error.message : "Queue action failed", "QUEUE_ACTION_FAILED");
  }
}

function handleOwnerQueueAction(req: express.Request, res: express.Response, nextState: "called" | "completed" | "no_show" | "in_service" | "delayed") {
  const entryId = Number(req.params.id);
  if (Number.isNaN(entryId)) return fail(res, 400, "Invalid queue entry id", "INVALID_ID");
  const entry = db.select().from(queueEntries).where(eq(queueEntries.id, entryId)).get();
  if (!entry) return fail(res, 404, "Queue entry not found", "NOT_FOUND");
  const ownerBusinessId = getOwnerBusinessId(req.currentUser!.id);
  if (!ownerBusinessId || ownerBusinessId !== entry.businessId) return fail(res, 403, "Forbidden", "FORBIDDEN");
  const pauseLimitMinutes = db.select({ pauseLimitMinutes: businesses.pauseLimitMinutes }).from(businesses).where(eq(businesses.id, entry.businessId)).get()?.pauseLimitMinutes ?? 30;
  const availability = getQueueActionAvailability(entry, pauseLimitMinutes).availableOwnerActions;
  const actionCheck =
    nextState === "called"
      ? availability.canCall
      : nextState === "in_service"
        ? availability.canStartService
        : nextState === "completed"
          ? availability.canComplete
          : nextState === "delayed"
            ? availability.canDelay
            : availability.canNoShow;
  if (!actionCheck.allowed) {
    return fail(res, 409, actionCheck.reason ?? "Invalid queue transition.", "INVALID_QUEUE_TRANSITION");
  }

  const now = new Date().toISOString();
  const copy = getOwnerQueueTransitionCopy(nextState);
  db.update(queueEntries).set({
    status: nextState,
    calledAt: nextState === "called" || nextState === "in_service" ? now : entry.calledAt,
    completedAt: nextState === "completed" ? now : entry.completedAt,
    cancelledAt: nextState === "no_show" ? now : entry.cancelledAt,
    updatedAt: now,
  }).where(eq(queueEntries.id, entryId)).run();
  addQueueEvent(entryId, nextState, copy.timelineLabel, now);
  revalidateQueueForBusiness(entry.businessId);
  createNotification(entry.userId, `queue-${nextState}`, "Queue status changed", copy.userMessage);
  createDetailedNotification(req.currentUser!.id, {
    type: `owner-queue-${nextState}`,
    title: nextState === "delayed" ? "Queue delay recorded" : "Queue updated",
    message: `${entry.queueNumber} ${copy.ownerMessage.charAt(0).toLowerCase()}${copy.ownerMessage.slice(1)}`,
    severity: nextState === "delayed" || nextState === "no_show" ? "warning" : "info",
    category: "queue",
  });
  if (nextState === "delayed") {
    touchConversation(entry.businessId, entry.userId, {
      visitType: "queue",
      queueEntryId: entryId,
      contextLabel: getConversationContextLabel("queue", "delayed"),
    });
  } else if (nextState === "called" || nextState === "in_service") {
    touchConversation(entry.businessId, entry.userId, {
      visitType: "queue",
      queueEntryId: entryId,
      contextLabel: getConversationContextLabel("queue", "active"),
    });
  }
  if (nextState === "completed") {
    endConversationForVisit({ queueEntryId: entryId }, "completed");
  }
  if (nextState === "no_show") {
    endConversationForVisit({ queueEntryId: entryId }, "no_show");
  }
  emitForBusiness(entry.businessId, entry.userId, {
    entryId,
    status: nextState,
    action: nextState,
    message: copy.realtimeMessage,
    queueOrderChanged: nextState !== "in_service",
    needsAssignmentAttention: nextState === "called" && (!entry.serviceId || !entry.counterId || !entry.staffName?.trim()),
  });
  return ok(res, { success: true });
}

function processScheduledWork() {
  const now = new Date();
  const expiredAppointments = db
    .select()
    .from(appointments)
    .where(and(eq(appointments.status, "pending"), sql`${appointments.scheduledFor} < ${now.toISOString()}`))
    .all();
  for (const appointment of expiredAppointments) {
    db.update(appointments).set({ status: "expired", updatedAt: now.toISOString() }).where(eq(appointments.id, appointment.id)).run();
    endConversationForVisit({ appointmentId: appointment.id }, "expired");
    createNotification(appointment.userId, "appointment-expired", "Appointment expired", "That appointment time has passed, so Smart Queue moved the chat into your visit archive.");
    emitForBusiness(appointment.businessId, appointment.userId);
  }

  const approvedAppointments = db.select().from(appointments).where(eq(appointments.status, "approved")).all();
  for (const appointment of approvedAppointments) {
    if (new Date(appointment.scheduledFor).getTime() > now.getTime()) continue;
    const business = db.select().from(businesses).where(eq(businesses.id, appointment.businessId)).get();
    if (!business) continue;
    const exists = db.select().from(queueEntries).where(and(eq(queueEntries.businessId, appointment.businessId), eq(queueEntries.userId, appointment.userId), eq(queueEntries.serviceId, appointment.serviceId), inArray(queueEntries.status, ["waiting", "called", "paused", "in_service", "delayed"]))).get();
    if (exists) continue;
    const serviceMinutes = db.select().from(businessServices).where(eq(businessServices.id, appointment.serviceId!)).get()?.averageServiceMinutes ?? business.averageServiceMinutes;
    let queueId: number;
    try {
      queueId = allocateActiveQueueEntry({
        businessId: appointment.businessId,
        userId: appointment.userId,
        serviceId: appointment.serviceId!,
        serviceName: "appointment conversion",
        averageServiceMinutes: serviceMinutes,
        enforceCapacity: false,
        joinedAt: now.toISOString(),
      }).entryId;
    } catch {
      continue;
    }
    addQueueEvent(queueId, "converted", "Appointment converted to live queue.", now.toISOString());
    db.update(appointments).set({ status: "converted", updatedAt: now.toISOString() }).where(eq(appointments.id, appointment.id)).run();
    touchConversation(appointment.businessId, appointment.userId, {
      visitType: "queue",
      queueEntryId: queueId,
      appointmentId: appointment.id,
      contextLabel: getConversationContextLabel("queue", "active"),
    });
    createNotification(appointment.userId, "appointment-converted", "Appointment is now live", "Your approved appointment is now an active queue entry.");
    revalidateQueueForBusiness(appointment.businessId);
    emitForBusiness(appointment.businessId, appointment.userId);
  }
}

let schedulerStarted = false;

export function createServer() {
  const app = express();
  app.disable("x-powered-by");
  app.set("trust proxy", runtimeConfig.trustProxy);
  app.use(
    cors({
      origin(origin, callback) {
        if (isAllowedCorsOrigin(origin)) {
          callback(null, true);
          return;
        }
        callback(new Error("Origin not allowed by CORS"));
      },
      credentials: true,
    }),
  );
  app.use((_req, res, next) => {
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "DENY");
    next();
  });
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  app.use(async (req, _res, next) => {
    req.currentUser = await getCurrentUser(req);
    next();
  });

  app.get("/api/ping", (_req, res) => res.json({ message: process.env.PING_MESSAGE ?? "pong" }));
  app.get("/api/health", (_req, res) => {
    try {
      verifyDatabaseConnection();
      return res.json({
        status: "ok",
        database: "ok",
        serverTime: new Date().toISOString(),
        runtime: {
          ...getDatabaseHealthSnapshot(),
          appUrl: runtimeConfig.appUrl || null,
          trustProxy: runtimeConfig.trustProxy,
          nodeEnv: runtimeConfig.nodeEnv,
        },
      });
    } catch (error) {
      console.error("Health check failed:", error);
      return res.status(503).json({
        status: "degraded",
        database: "error",
        serverTime: new Date().toISOString(),
        runtime: {
          ...getDatabaseHealthSnapshot(),
          appUrl: runtimeConfig.appUrl || null,
          trustProxy: runtimeConfig.trustProxy,
          nodeEnv: runtimeConfig.nodeEnv,
        },
      });
    }
  });
  app.get("/api/events", authRequired(), (req, res) => {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders?.();
    const clientId = crypto.randomUUID();
    registerEventClient({ id: clientId, userId: req.currentUser!.id, role: req.currentUser!.role, businessId: req.currentUser!.businessId ?? null, res });
    res.write(`event: connected\ndata: ${JSON.stringify({ ok: true })}\n\n`);
    const keepAlive = setInterval(() => res.write(`event: heartbeat\ndata: {}\n\n`), 20_000);
    req.on("close", () => {
      clearInterval(keepAlive);
      removeEventClient(clientId);
    });
  });

  app.post("/api/auth/register", (req, res) => {
    const parsed = validate(res, registerInputSchema, req.body);
    if (!parsed) return;
    const email = parsed.email.toLowerCase();
    if (db.select().from(users).where(eq(users.email, email)).get()) return fail(res, 409, "Email is already in use", "EMAIL_TAKEN");
    const created = db.insert(users).values({ email, name: parsed.name, passwordHash: hashSync(parsed.password, 10), role: "user", businessId: null, createdAt: new Date().toISOString() }).returning().get();
    const sessionId = createSession(created.id);
    setSessionCookie(req, res, sessionId);
    return ok(res, { user: sanitizeUser(created) });
  });

  app.get("/api/auth/business-signup-options", (_req, res) => {
    return ok(res, { plans: SUBSCRIPTION_PLANS });
  });

  app.get("/api/auth/business-signup-search", (req, res) => {
    const query = String(req.query.q ?? "").trim().toLowerCase();
    if (query.length < 2) return ok(res, { businesses: [] });

    const matches = db
      .select({
        id: businesses.id,
        name: businesses.name,
        category: businessCategories.slug,
        address: businesses.address,
      })
      .from(businesses)
      .innerJoin(businessCategories, eq(businessCategories.id, businesses.categoryId))
      .where(sql`lower(${businesses.name}) like ${`%${query}%`} or lower(${businesses.address}) like ${`%${query}%`}`)
      .orderBy(businesses.name)
      .limit(10)
      .all();

    return ok(res, {
      businesses: matches.map((business) => {
        const subscription = getBusinessSubscription(business.id);
        return {
          id: business.id,
          name: business.name,
          category: business.category as BusinessCategory,
          address: business.address,
          subscriptionStatus: subscription?.status ?? null,
          subscriptionPlan: subscription?.plan ?? null,
          hasActiveSubscription: subscription?.status === "active" || subscription?.status === "trial",
        };
      }),
    });
  });

  app.post("/api/auth/register-owner", (req, res) => {
    const parsed = validate(res, ownerRegisterInputSchema, req.body);
    if (!parsed) return;
    const email = parsed.email.toLowerCase();
    if (db.select().from(users).where(eq(users.email, email)).get()) return fail(res, 409, "Email is already in use", "EMAIL_TAKEN");

    let businessId: number;

    if (parsed.target.mode === "existing") {
      const business = db.select().from(businesses).where(eq(businesses.id, parsed.target.businessId)).get();
      if (!business) return fail(res, 404, "Business not found", "NOT_FOUND");
      const currentSubscription = getBusinessSubscription(business.id);
      const hasActiveSubscription = currentSubscription?.status === "active" || currentSubscription?.status === "trial";

      if (!hasActiveSubscription) {
        if (!parsed.target.subscriptionPlan || !parsed.target.subscriptionInterval) {
          return fail(res, 400, "Select a subscription plan before continuing", "SUBSCRIPTION_REQUIRED");
        }
        createOrUpdateSubscription(business.id, {
          plan: parsed.target.subscriptionPlan,
          interval: parsed.target.subscriptionInterval,
          status: "active",
        });
      }

      businessId = business.id;
    } else {
      try {
        businessId = createBusinessBootstrap({
          businessName: parsed.target.businessName,
          category: parsed.target.category,
          description: parsed.target.description,
          address: parsed.target.address,
          phone: parsed.target.phone,
          businessEmail: parsed.target.businessEmail,
          websiteUrl: parsed.target.websiteUrl,
        });
      } catch (error) {
        return fail(res, 400, error instanceof Error ? error.message : "Business could not be created", "BUSINESS_CREATE_FAILED");
      }

      createOrUpdateSubscription(businessId, {
        plan: parsed.target.subscriptionPlan,
        interval: parsed.target.subscriptionInterval,
        status: "active",
      });
    }

    const created = db
      .insert(users)
      .values({
        email,
        name: parsed.name,
        passwordHash: hashSync(parsed.password, 10),
        role: "owner",
        businessId,
        createdAt: new Date().toISOString(),
      })
      .returning()
      .get();

    const sessionId = createSession(created.id);
    setSessionCookie(req, res, sessionId);
    return ok(res, { user: sanitizeUser(created) });
  });

  app.post("/api/auth/register-admin", (req, res) => {
    const parsed = validate(res, adminRegisterInputSchema, req.body);
    if (!parsed) return;
    if (runtimeConfig.isProduction && !ADMIN_SIGNUP_SECRET) {
      return fail(res, 403, "Admin self-registration is disabled", "ADMIN_SIGNUP_DISABLED");
    }
    if (parsed.adminSecret !== ADMIN_SIGNUP_SECRET) {
      return fail(res, 403, "Admin access code is invalid", "INVALID_ADMIN_SECRET");
    }

    const email = parsed.email.toLowerCase();
    if (db.select().from(users).where(eq(users.email, email)).get()) return fail(res, 409, "Email is already in use", "EMAIL_TAKEN");

    const created = db
      .insert(users)
      .values({
        email,
        name: parsed.name,
        passwordHash: hashSync(parsed.password, 10),
        role: "admin",
        businessId: null,
        createdAt: new Date().toISOString(),
      })
      .returning()
      .get();

    const sessionId = createSession(created.id);
    setSessionCookie(req, res, sessionId);
    return ok(res, { user: sanitizeUser(created) });
  });

  app.post("/api/auth/login", (req, res) => {
    const parsed = validate(res, loginInputSchema, req.body);
    if (!parsed) return;
    const user = db.select().from(users).where(eq(users.email, parsed.email.toLowerCase())).get();
    if (!user || !compareSync(parsed.password, user.passwordHash)) return fail(res, 401, "Invalid email or password", "INVALID_CREDENTIALS");
    if (user.accountStatus === "suspended") return fail(res, 403, "This account has been suspended. Please contact Smart Queue support.", "ACCOUNT_SUSPENDED");
    const sessionId = createSession(user.id);
    db.update(users).set({ lastSignInAt: new Date().toISOString() }).where(eq(users.id, user.id)).run();
    setSessionCookie(req, res, sessionId);
    return ok(res, { user: sanitizeUser(user) });
  });

  app.post("/api/auth/logout", (req, res) => {
    const sessionId = req.sessionId ?? parseCookies(req.headers.cookie).get(SESSION_COOKIE);
    if (sessionId) db.delete(sessions).where(eq(sessions.id, sessionId)).run();
    clearSessionCookie(req, res);
    return ok(res, { success: true });
  });

  app.post("/api/auth/forgot-password", (req, res) => {
    const parsed = validate(res, forgotPasswordInputSchema, req.body);
    if (!parsed) return;
    const email = parsed.email.toLowerCase();
    const user = db.select().from(users).where(eq(users.email, email)).get();
    if (!user) {
      return ok(res, { success: true, resetLinkPreview: null });
    }

    const token = crypto.randomBytes(24).toString("hex");
    const expiresAt = new Date(Date.now() + PASSWORD_RESET_TTL_MS).toISOString();
    db.update(users)
      .set({
        passwordResetTokenHash: hashResetToken(token),
        passwordResetExpiresAt: expiresAt,
      })
      .where(eq(users.id, user.id))
      .run();

    return ok(res, {
      success: true,
      resetLinkPreview: createPasswordResetLink(token),
    });
  });

  app.post("/api/auth/reset-password", (req, res) => {
    const parsed = validate(res, resetPasswordInputSchema, req.body);
    if (!parsed) return;
    const tokenHash = hashResetToken(parsed.token);
    const user = db.select().from(users).where(eq(users.passwordResetTokenHash, tokenHash)).get();
    if (!user || !user.passwordResetExpiresAt || new Date(user.passwordResetExpiresAt).getTime() < Date.now()) {
      return fail(res, 400, "This reset link is invalid or has expired", "RESET_INVALID");
    }

    db.update(users)
      .set({
        passwordHash: hashSync(parsed.password, 10),
        passwordResetTokenHash: null,
        passwordResetExpiresAt: null,
      })
      .where(eq(users.id, user.id))
      .run();
    clearAllSessionsForUser(user.id);
    clearSessionCookie(req, res);
    return ok(res, { success: true });
  });

  app.post("/api/auth/change-password", authRequired(), (req, res) => {
    const parsed = validate(res, changePasswordInputSchema, req.body);
    if (!parsed) return;
    const user = db.select().from(users).where(eq(users.id, req.currentUser!.id)).get();
    if (!user) return fail(res, 404, "Account not found", "NOT_FOUND");
    if (!compareSync(parsed.currentPassword, user.passwordHash)) {
      return fail(res, 401, "Your current password did not match", "INVALID_CREDENTIALS");
    }
    if (parsed.currentPassword === parsed.newPassword) {
      return fail(res, 400, "Choose a new password different from the current one", "PASSWORD_UNCHANGED");
    }

    db.update(users)
      .set({
        passwordHash: hashSync(parsed.newPassword, 10),
        passwordResetTokenHash: null,
        passwordResetExpiresAt: null,
      })
      .where(eq(users.id, user.id))
      .run();

    const keepSessionId = req.sessionId ?? parseCookies(req.headers.cookie).get(SESSION_COOKIE);
    db.delete(sessions)
      .where(and(eq(sessions.userId, user.id), keepSessionId ? ne(sessions.id, keepSessionId) : sql`1 = 1`))
      .run();

    return ok(res, { success: true });
  });

  app.delete("/api/auth/account", authRequired(), (req, res) => {
    const parsed = validate(res, deleteAccountInputSchema, req.body);
    if (!parsed) return;
    const user = db.select().from(users).where(eq(users.id, req.currentUser!.id)).get();
    if (!user) return fail(res, 404, "Account not found", "NOT_FOUND");
    if (user.role !== "user") {
      return fail(res, 403, "Owner and admin accounts cannot self-delete here yet", "DELETE_RESTRICTED");
    }
    if (parsed.confirmation.trim().toUpperCase() !== "DELETE") {
      return fail(res, 400, "Type DELETE to confirm account removal", "DELETE_CONFIRMATION_REQUIRED");
    }
    if (!compareSync(parsed.password, user.passwordHash)) {
      return fail(res, 401, "Your password did not match", "INVALID_CREDENTIALS");
    }

    deleteUserAccountCascade(user.id);
    clearSessionCookie(req, res);
    return ok(res, { success: true });
  });

  app.get("/api/auth/me", (req, res) => ok(res, { user: req.currentUser ?? null }));
  app.get("/api/profile/me", authRequired(), (req, res) => {
    const user = db.select().from(users).where(eq(users.id, req.currentUser!.id)).get();
    if (!user) return fail(res, 404, "Profile not found", "NOT_FOUND");
    return ok(res, { profile: toUserProfile(user) });
  });

  app.get("/api/profile/preferences", authRequired(), (req, res) => {
    return ok(res, { preferences: getUserPreferences(req.currentUser!.id) });
  });

  app.patch("/api/profile/me", authRequired(), (req, res) => {
    const parsed = validate(res, profileUpdateInputSchema, req.body);
    if (!parsed) return;
    const existing = db.select().from(users).where(eq(users.id, req.currentUser!.id)).get();
    if (!existing) return fail(res, 404, "Profile not found", "NOT_FOUND");
    const nextEmail = parsed.email.toLowerCase();
    const taken = db.select().from(users).where(and(eq(users.email, nextEmail), ne(users.id, req.currentUser!.id))).get();
    if (taken) return fail(res, 409, "Email is already in use", "EMAIL_TAKEN");
    db.update(users).set({
      name: parsed.name,
      email: nextEmail,
      phone: parsed.phone || null,
      bio: parsed.bio || null,
      avatarUrl: parsed.avatarUrl || null,
      location: parsed.location || null,
    }).where(eq(users.id, req.currentUser!.id)).run();
    const updated = db.select().from(users).where(eq(users.id, req.currentUser!.id)).get();
    if (!updated) return fail(res, 404, "Profile not found", "NOT_FOUND");
    return ok(res, { profile: toUserProfile(updated), user: sanitizeUser(updated) });
  });

  app.patch("/api/profile/preferences", authRequired(), (req, res) => {
    const parsed = validate(res, userPreferencesUpdateInputSchema, req.body);
    if (!parsed) return;
    const currentPreferences = getUserPreferences(req.currentUser!.id);
    upsertUserPreferences(req.currentUser!.id, {
      emailSummaries: parsed.emailSummaries ?? currentPreferences.emailSummaries,
      desktopNotifications: parsed.desktopNotifications ?? currentPreferences.desktopNotifications,
      aiAssistant: parsed.aiAssistant ?? currentPreferences.aiAssistant,
      travelTips: parsed.travelTips ?? currentPreferences.travelTips,
    });
    return ok(res, { preferences: getUserPreferences(req.currentUser!.id) });
  });

  app.get("/api/chat/conversations", authRequired(), (req, res) => {
    const view = req.query.view === "archive" ? "archive" : req.query.view === "all" ? "all" : "active";
    if (req.currentUser!.role === "owner") {
      const businessId = getOwnerBusinessId(req.currentUser!.id);
      if (!businessId) return fail(res, 404, "No business assigned to this owner", "NO_BUSINESS");
      return ok(res, { conversations: getConversationSummariesForBusiness(businessId, view) });
    }
    return ok(res, { conversations: getConversationSummariesForUser(req.currentUser!.id, view) });
  });

  app.post("/api/chat/conversations", authRequired(), (req, res) => {
    const parsed = validate(res, createConversationInputSchema, req.body);
    if (!parsed) return;
    const business = db.select().from(businesses).where(eq(businesses.id, parsed.businessId)).get();
    if (!business) return fail(res, 404, "Business not found", "NOT_FOUND");
    const conversationId = touchConversation(parsed.businessId, req.currentUser!.id, {
      visitType: "pre_visit",
      queueEntryId: null,
      appointmentId: null,
      contextLabel: "Pre-visit question",
    });
    const conversation = db.select().from(conversations).where(eq(conversations.id, conversationId)).get() ?? null;
    if (!conversation) return fail(res, 500, "Conversation could not be created", "CONVERSATION_ERROR");
    emitConversationUpdate(conversation.id, conversation.businessId, conversation.userId);
    return ok(res, { conversation: getConversationDetail(conversation.id) });
  });

  app.get("/api/chat/conversations/:id", authRequired(), (req, res) => {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) return fail(res, 400, "Invalid conversation id", "INVALID_ID");
    const detail = getConversationDetail(id);
    if (!detail) return fail(res, 404, "Conversation not found", "NOT_FOUND");
    if (req.currentUser!.role === "owner") {
      const businessId = getOwnerBusinessId(req.currentUser!.id);
      if (!businessId || businessId !== detail.businessId) return fail(res, 403, "Forbidden", "FORBIDDEN");
    } else if (req.currentUser!.role === "user" && detail.userId !== req.currentUser!.id) {
      return fail(res, 403, "Forbidden", "FORBIDDEN");
    }
    return ok(res, { conversation: detail });
  });

  app.post("/api/chat/conversations/:id/messages", authRequired(), (req, res) => {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) return fail(res, 400, "Invalid conversation id", "INVALID_ID");
    const parsed = validate(res, sendMessageInputSchema, req.body);
    if (!parsed) return;
    const detail = getConversationDetail(id);
    if (!detail) return fail(res, 404, "Conversation not found", "NOT_FOUND");
    if (req.currentUser!.role === "owner") {
      const businessId = getOwnerBusinessId(req.currentUser!.id);
      if (!businessId || businessId !== detail.businessId) return fail(res, 403, "Forbidden", "FORBIDDEN");
    } else if (req.currentUser!.role === "user" && detail.userId !== req.currentUser!.id) {
      return fail(res, 403, "Forbidden", "FORBIDDEN");
    }
    if (detail.status !== "active") {
      return fail(res, 400, "This conversation has ended and is now read-only in your archive.", "CONVERSATION_CLOSED");
    }
    const now = new Date().toISOString();
    db.insert(messages).values({
      conversationId: id,
      businessId: detail.businessId,
      senderRole: req.currentUser!.role,
      senderId: req.currentUser!.id,
      body: parsed.body,
      createdAt: now,
      readAt: null,
    }).run();
    db.update(conversations).set({ updatedAt: now }).where(eq(conversations.id, id)).run();
    if (req.currentUser!.role === "user") {
      notifyBusinessOwners(detail.businessId, {
        type: "chat-new-message",
        title: "New guest message",
        message: `${detail.userName} sent a new message in ${detail.businessName}.`,
        severity: "info",
        category: "messages",
      });
    } else if (req.currentUser!.role === "owner") {
      createDetailedNotification(detail.userId, {
        type: "chat-owner-reply",
        title: "New business reply",
        message: `${detail.businessName} replied to your conversation.`,
        severity: "info",
        category: "messages",
      });
    }
    emitConversationUpdate(id, detail.businessId, detail.userId);
    broadcastEvent({ type: "chat:new-message", payload: { conversationId: id }, businessId: detail.businessId, userId: detail.userId });
    return ok(res, { conversation: getConversationDetail(id) });
  });

  app.post("/api/chat/conversations/:id/read", authRequired(), (req, res) => {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) return fail(res, 400, "Invalid conversation id", "INVALID_ID");
    const detail = getConversationDetail(id);
    if (!detail) return fail(res, 404, "Conversation not found", "NOT_FOUND");
    if (req.currentUser!.role === "owner") {
      const businessId = getOwnerBusinessId(req.currentUser!.id);
      if (!businessId || businessId !== detail.businessId) return fail(res, 403, "Forbidden", "FORBIDDEN");
      db.update(messages).set({ readAt: new Date().toISOString() }).where(and(eq(messages.conversationId, id), eq(messages.senderRole, "user"), sql`${messages.readAt} is null`)).run();
    } else {
      if (detail.userId !== req.currentUser!.id) return fail(res, 403, "Forbidden", "FORBIDDEN");
      db.update(messages).set({ readAt: new Date().toISOString() }).where(and(eq(messages.conversationId, id), eq(messages.senderRole, "owner"), sql`${messages.readAt} is null`)).run();
    }
    emitConversationUpdate(id, detail.businessId, detail.userId);
    broadcastEvent({ type: "chat:read-state", payload: { conversationId: id }, businessId: detail.businessId, userId: detail.userId });
    return ok(res, { success: true });
  });

  app.get("/api/support/conversations", authRequired(), (req, res) => {
    if (req.currentUser!.role === "admin") {
      return ok(res, { conversations: getSupportConversationSummariesForAdmin(req.currentUser!.role) });
    }
    return ok(res, { conversations: getSupportConversationSummariesForUser(req.currentUser!.id, req.currentUser!.role) });
  });

  app.post("/api/support/conversations", authRequired(), (req, res) => {
    if (req.currentUser!.role === "admin") return fail(res, 403, "Admins receive support requests through the admin support inbox.", "FORBIDDEN");
    const parsed = validate(res, supportConversationCreateInputSchema, req.body);
    if (!parsed) return;
    return ok(res, { conversation: ensureSupportConversationForUser(req.currentUser!, parsed.subject) });
  });

  app.get("/api/support/conversations/:id", authRequired(), (req, res) => {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) return fail(res, 400, "Invalid support conversation id", "INVALID_ID");
    const detail = getSupportConversationDetail(id, req.currentUser!.role);
    if (!detail) return fail(res, 404, "Support conversation not found", "NOT_FOUND");
    if (req.currentUser!.role !== "admin" && detail.requesterUserId !== req.currentUser!.id) {
      return fail(res, 403, "Forbidden", "FORBIDDEN");
    }
    return ok(res, { conversation: detail });
  });

  app.post("/api/support/conversations/:id/messages", authRequired(), (req, res) => {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) return fail(res, 400, "Invalid support conversation id", "INVALID_ID");
    const parsed = validate(res, supportMessageInputSchema, req.body);
    if (!parsed) return;
    const detail = getSupportConversationDetail(id, req.currentUser!.role);
    if (!detail) return fail(res, 404, "Support conversation not found", "NOT_FOUND");
    if (req.currentUser!.role !== "admin" && detail.requesterUserId !== req.currentUser!.id) {
      return fail(res, 403, "Forbidden", "FORBIDDEN");
    }

    const now = new Date().toISOString();
    db.insert(supportMessages).values({
      conversationId: id,
      senderRole: req.currentUser!.role,
      senderId: req.currentUser!.id,
      body: parsed.body,
      createdAt: now,
      readAt: null,
    }).run();
    db
      .update(supportConversations)
      .set({
        assignedAdminId: req.currentUser!.role === "admin" ? req.currentUser!.id : detail.assignedAdminId,
        updatedAt: now,
      })
      .where(eq(supportConversations.id, id))
      .run();

    if (req.currentUser!.role === "admin") {
      createDetailedNotification(detail.requesterUserId, {
        type: "support-admin-reply",
        title: "New support reply",
        message: "Smart Queue support replied to your conversation.",
        severity: "info",
        category: "support",
      });
    } else {
      getAdminIds().forEach((adminId) => {
        createDetailedNotification(adminId, {
          type: "support-new-message",
          title: "Support reply needed",
          message: `${detail.requesterName} sent a new support message.`,
          severity: "info",
          category: "support",
        });
      });
    }

    emitSupportConversationUpdate(id, detail.requesterUserId);
    emitSupportMessageUpdate(id, detail.requesterUserId);
    return ok(res, { conversation: getSupportConversationDetail(id, req.currentUser!.role) });
  });

  app.post("/api/support/conversations/:id/read", authRequired(), (req, res) => {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) return fail(res, 400, "Invalid support conversation id", "INVALID_ID");
    const detail = getSupportConversationDetail(id, req.currentUser!.role);
    if (!detail) return fail(res, 404, "Support conversation not found", "NOT_FOUND");
    if (req.currentUser!.role !== "admin" && detail.requesterUserId !== req.currentUser!.id) {
      return fail(res, 403, "Forbidden", "FORBIDDEN");
    }

    db
      .update(supportMessages)
      .set({ readAt: new Date().toISOString() })
      .where(
        and(
          eq(supportMessages.conversationId, id),
          req.currentUser!.role === "admin" ? sql`${supportMessages.senderRole} != 'admin'` : eq(supportMessages.senderRole, "admin"),
          sql`${supportMessages.readAt} is null`,
        ),
      )
      .run();

    emitSupportConversationUpdate(id, detail.requesterUserId);
    broadcastEvent({ type: "support:read-state", payload: { conversationId: id }, userId: detail.requesterUserId });
    broadcastEvent({ type: "support:read-state", payload: { conversationId: id } });
    return ok(res, { success: true });
  });

  app.get("/api/ai/thread", authRequired(), (req, res) => {
    const thread = ensureAssistantThread(req.currentUser!);
    return ok(res, { thread });
  });

  app.post("/api/ai/user-assistant", authRequired("user"), async (req, res) => {
    const parsed = validate(res, assistantRequestSchema, req.body);
    if (!parsed) return;
    const result = await getAssistantResponseForUser(req.currentUser!, parsed);
    broadcastEvent({ type: "ai:assistant-response", payload: { role: "user" }, userId: req.currentUser!.id });
    return ok(res, result);
  });

  app.post("/api/ai/owner-assistant", authRequired("owner"), async (req, res) => {
    const parsed = validate(res, assistantRequestSchema, req.body);
    if (!parsed) return;
    const businessId = getOwnerBusinessId(req.currentUser!.id);
    if (!businessId) return fail(res, 404, "No business assigned to this owner", "NO_BUSINESS");
    const result = await getAssistantResponseForUser(req.currentUser!, parsed);
    broadcastEvent({ type: "ai:assistant-response", payload: { role: "owner", businessId }, businessId });
    return ok(res, result);
  });

  app.post("/api/ai/admin-assistant", authRequired("admin"), async (req, res) => {
    const parsed = validate(res, assistantRequestSchema, req.body);
    if (!parsed) return;
    const result = await getAssistantResponseForUser(req.currentUser!, parsed);
    broadcastEvent({ type: "ai:assistant-response", payload: { role: "admin" }, userId: req.currentUser!.id });
    return ok(res, result);
  });

  app.post("/api/ai/feedback", authRequired(), (req, res) => {
    const parsed = validate(res, assistantFeedbackInputSchema, req.body);
    if (!parsed) return;
    if (!req.currentUser || (req.currentUser.role !== "user" && req.currentUser.role !== "owner")) {
      return fail(res, 403, "Only guest and owner assistant sessions can be rated.", "FORBIDDEN");
    }

    const thread = db.select().from(assistantThreads).where(eq(assistantThreads.id, parsed.threadId)).get();
    if (!thread || thread.ownerUserId !== req.currentUser.id || thread.scope !== req.currentUser.role) {
      return fail(res, 404, "Assistant thread not found", "NOT_FOUND");
    }

    const message = db
      .select()
      .from(assistantMessages)
      .where(and(eq(assistantMessages.id, parsed.assistantMessageId), eq(assistantMessages.threadId, parsed.threadId)))
      .get();
    if (!message || message.role !== "assistant") {
      return fail(res, 404, "Assistant message not found", "NOT_FOUND");
    }
    if (!message.canRate || message.resolutionState !== "resolved") {
      return fail(res, 400, "This assistant response is not eligible for rating.", "NOT_RATEABLE");
    }
    const existingFeedback = db.select().from(assistantFeedback).where(eq(assistantFeedback.assistantMessageId, message.id)).get();
    if (existingFeedback) {
      return fail(res, 409, "This assistant response has already been rated.", "ALREADY_RATED");
    }

    const createdAt = new Date().toISOString();
    const feedback = insertAndReturnRow<AssistantFeedback>(
      db,
      assistantFeedback,
      {
        role: req.currentUser.role,
        ownerUserId: req.currentUser.id,
        threadId: parsed.threadId,
        assistantMessageId: parsed.assistantMessageId,
        rating: parsed.rating,
        comment: parsed.comment.trim() ? parsed.comment.trim() : null,
        resolutionState: "resolved",
        createdAt,
      },
      {
        id: assistantFeedback.id,
        role: assistantFeedback.role,
        ownerUserId: assistantFeedback.ownerUserId,
        threadId: assistantFeedback.threadId,
        assistantMessageId: assistantFeedback.assistantMessageId,
        rating: assistantFeedback.rating,
        comment: assistantFeedback.comment,
        resolutionState: assistantFeedback.resolutionState,
        createdAt: assistantFeedback.createdAt,
      },
    );
    return ok(res, { feedback, thread: getAssistantThreadDetail(parsed.threadId) });
  });

  app.post("/api/ai/execute-action", authRequired(), async (req, res) => {
    const parsed = validate(res, assistantActionExecuteInputSchema, req.body);
    if (!parsed) return;
    const thread = ensureAssistantThread(req.currentUser!);
    const result = normalizeAssistantResponse(await executeAssistantAction(req.currentUser!, parsed), req.currentUser!.role);
    appendAssistantThreadMessage(
      thread.id,
      "assistant",
      "action_result",
      result.actionResult?.message ?? result.message,
      {
        resolutionState: result.resolutionState,
        canRate: result.canRate,
      },
    );
    broadcastEvent({ type: "ai:assistant-action", payload: { role: req.currentUser!.role, actionType: parsed.type }, userId: req.currentUser!.id, businessId: req.currentUser!.businessId ?? undefined });
    return ok(res, withAssistantThread(result, thread.id));
  });

  app.get("/api/discovery/external", async (req, res) => {
    const parsed = validate(res, externalDiscoveryQuerySchema, req.query);
    if (!parsed) return;
    const results = await searchExternalBusinesses(parsed.q);
    const linked = results.length
      ? db
          .select()
          .from(businesses)
          .where(and(eq(businesses.externalProvider, "google_places"), inArray(businesses.externalPlaceId, results.map((item) => item.externalProvider.placeId))))
          .all()
      : [];
    const linkedMap = new Map(linked.map((item) => [item.externalPlaceId, item]));
    return ok(res, {
      results: results.map((item) => {
        const existing = linkedMap.get(item.externalProvider.placeId);
        if (!existing) return item;
        return {
          ...item,
          source: existing.source === "imported" ? "imported" : "local",
          linkedBusinessId: existing.id,
          capabilities: {
            supportsRemoteQueue: true,
            supportsAppointments: true,
            supportsReceipts: false,
            isClaimable: false,
          },
        };
      }),
    });
  });

  app.get("/api/discovery/external/:provider/:placeId", async (req, res) => {
    if (req.params.provider !== "google_places") return fail(res, 400, "Unsupported provider", "INVALID_PROVIDER");
    const business = await getExternalBusinessDetail(req.params.placeId);
    if (!business) return fail(res, 404, "External business not found", "NOT_FOUND");
    const existing = db
      .select()
      .from(businesses)
      .where(and(eq(businesses.externalProvider, req.params.provider), eq(businesses.externalPlaceId, req.params.placeId)))
      .get();
    return ok(res, {
      business: existing
        ? {
            ...business,
            source: existing.source === "imported" ? "imported" : "local",
            linkedBusinessId: existing.id,
            capabilities: {
              supportsRemoteQueue: true,
              supportsAppointments: true,
              supportsReceipts: false,
              isClaimable: false,
            },
          }
        : business,
    });
  });

  app.post("/api/discovery/claims", authRequired(), (req, res) => {
    if (!["owner", "admin"].includes(req.currentUser!.role)) return fail(res, 403, "Only business users can send claim requests", "FORBIDDEN");
    const parsed = validate(res, businessClaimInputSchema, req.body);
    if (!parsed) return;
    const existingBusiness = db
      .select()
      .from(businesses)
      .where(and(eq(businesses.externalProvider, parsed.provider), eq(businesses.externalPlaceId, parsed.placeId)))
      .get();
    if (existingBusiness) return fail(res, 409, "This business is already available on Smart Queue", "ALREADY_IMPORTED");
    const existingClaim = db
      .select()
      .from(businessClaimRequests)
      .where(and(eq(businessClaimRequests.provider, parsed.provider), eq(businessClaimRequests.placeId, parsed.placeId)))
      .get();
    if (!existingClaim) {
      db.insert(businessClaimRequests).values({
        provider: parsed.provider,
        placeId: parsed.placeId,
        businessName: parsed.businessName,
        category: parsed.category,
        address: parsed.address,
        phone: parsed.phone || null,
        email: parsed.email || null,
        websiteUrl: parsed.websiteUrl || null,
        latitude: parsed.latitude,
        longitude: parsed.longitude,
        imageUrl: parsed.imageUrl,
        requestedByUserId: req.currentUser!.id,
        status: "pending",
        createdAt: new Date().toISOString(),
      }).run();
    }
    return ok(res, { success: true });
  });

  app.get("/api/businesses", async (req, res) => {
    const parsed = validate(res, businessListQuerySchema, req.query);
    if (!parsed) return;
    const rows = await getBusinessRows(req.currentUser?.id, parsed);
    return ok(res, { businesses: rows.map((row) => toBusinessSummary(row)) });
  });

  app.get("/api/businesses/map", async (req, res) => {
    const parsed = validate(res, businessListQuerySchema, req.query);
    if (!parsed) return;
    const rows = await getBusinessRows(req.currentUser?.id, parsed);
    return ok(res, { markers: rows.map((row) => toBusinessMapMarker(row)) });
  });

  app.get("/api/businesses/:id", async (req, res) => {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) return fail(res, 400, "Invalid business id", "INVALID_ID");
    const business = await getBusinessOrFail(req, res, id);
    if (!business) return;
    const recommendedDepartureMinutes = business.distanceKm != null ? Math.max(0, Math.round(toBusinessSummary(business).estimatedWaitMinutes - business.distanceKm * 4)) : null;
    return ok(res, { business: toBusinessDetail(business, recommendedDepartureMinutes) });
  });

  app.post("/api/businesses/:id/favorite", authRequired(), async (req, res) => {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) return fail(res, 400, "Invalid business id", "INVALID_ID");
    if (!db.select().from(favorites).where(and(eq(favorites.businessId, id), eq(favorites.userId, req.currentUser!.id))).get()) {
      db.insert(favorites).values({ userId: req.currentUser!.id, businessId: id, createdAt: new Date().toISOString() }).run();
    }
    emitForBusiness(id, req.currentUser!.id);
    return ok(res, { success: true });
  });

  app.delete("/api/businesses/:id/favorite", authRequired(), (req, res) => {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) return fail(res, 400, "Invalid business id", "INVALID_ID");
    db.delete(favorites).where(and(eq(favorites.businessId, id), eq(favorites.userId, req.currentUser!.id))).run();
    emitForBusiness(id, req.currentUser!.id);
    return ok(res, { success: true });
  });

  app.post("/api/saved-places/:businessId", authRequired("user"), (req, res) => {
    const businessId = Number(req.params.businessId);
    if (Number.isNaN(businessId)) return fail(res, 400, "Invalid business id", "INVALID_ID");
    if (!db.select().from(savedPlaces).where(and(eq(savedPlaces.businessId, businessId), eq(savedPlaces.userId, req.currentUser!.id))).get()) {
      db.insert(savedPlaces).values({ userId: req.currentUser!.id, businessId, note: req.body?.note ?? null, createdAt: new Date().toISOString() }).run();
    }
    return ok(res, { savedPlaces: getSavedPlacesForUser(req.currentUser!.id) });
  });

  app.delete("/api/saved-places/:businessId", authRequired("user"), (req, res) => {
    const businessId = Number(req.params.businessId);
    if (Number.isNaN(businessId)) return fail(res, 400, "Invalid business id", "INVALID_ID");
    db.delete(savedPlaces).where(and(eq(savedPlaces.businessId, businessId), eq(savedPlaces.userId, req.currentUser!.id))).run();
    return ok(res, { savedPlaces: getSavedPlacesForUser(req.currentUser!.id) });
  });

  app.get("/api/user/dashboard", authRequired("user"), async (req, res) => ok(res, await getUserDashboard(req.currentUser!.id)));
  app.get("/api/user/history", authRequired("user"), (req, res) => ok(res, { visits: getVisitHistoryForUser(req.currentUser!.id) }));
  app.get("/api/user/receipts", authRequired("user"), (req, res) => ok(res, { receipts: getReceiptsForUser(req.currentUser!.id) }));

  app.get("/api/receipts/:id", authRequired(), (req, res) => {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) return fail(res, 400, "Invalid receipt id", "INVALID_ID");
    const receipt = getReceiptById(id);
    if (!receipt) return fail(res, 404, "Receipt not found", "NOT_FOUND");
    const requester = req.currentUser!;
    const ownerBusinessId = requester.role === "owner" ? getOwnerBusinessId(requester.id) : null;
    if (requester.role === "user" && receipt.userId !== requester.id) return fail(res, 403, "Forbidden", "FORBIDDEN");
    if (requester.role === "owner" && ownerBusinessId !== receipt.businessId) return fail(res, 403, "Forbidden", "FORBIDDEN");
    return ok(res, { receipt });
  });

  app.get("/api/receipts/:id/download", authRequired(), (req, res) => {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) return fail(res, 400, "Invalid receipt id", "INVALID_ID");
    const receipt = getReceiptById(id);
    if (!receipt) return fail(res, 404, "Receipt not found", "NOT_FOUND");
    const requester = req.currentUser!;
    const ownerBusinessId = requester.role === "owner" ? getOwnerBusinessId(requester.id) : null;
    if (requester.role === "user" && receipt.userId !== requester.id) return fail(res, 403, "Forbidden", "FORBIDDEN");
    if (requester.role === "owner" && ownerBusinessId !== receipt.businessId) return fail(res, 403, "Forbidden", "FORBIDDEN");
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${receipt.referenceNumber.toLowerCase()}.html"`);
    return res.send(renderReceiptDownloadHtml(receipt));
  });

  app.get("/api/queue/my-active", authRequired("user"), (req, res) => ok(res, { entries: getQueueEntriesForUser(req.currentUser!.id) }));

  app.post("/api/queue/join", authRequired("user"), async (req, res) => {
    const parsed = validate(res, queueJoinInputSchema, req.body);
    if (!parsed) return;
    try {
      const result = await performJoinQueue(req.currentUser!.id, parsed.businessId, parsed.serviceId);
      return ok(res, { entryId: result.entryId, entries: result.entries });
    } catch (error) {
      return fail(res, 400, error instanceof Error ? error.message : "Queue join failed", "QUEUE_JOIN_FAILED");
    }
  });

  app.post("/api/queue/:id/pause", authRequired("user"), (req, res) => handleQueueStateChange(req, res, "pause"));
  app.post("/api/queue/:id/resume", authRequired("user"), (req, res) => handleQueueStateChange(req, res, "resume"));
  app.post("/api/queue/:id/skip", authRequired("user"), (req, res) => handleQueueStateChange(req, res, "skip"));
  app.post("/api/queue/:id/reschedule", authRequired("user"), (req, res) => handleQueueStateChange(req, res, "reschedule"));
  app.post("/api/queue/:id/cancel", authRequired("user"), (req, res) => handleQueueStateChange(req, res, "cancel"));

  app.get("/api/appointments/me", authRequired("user"), (req, res) => ok(res, { appointments: getAppointmentsForUser(req.currentUser!.id) }));

  app.post("/api/appointments", authRequired("user"), async (req, res) => {
    const parsed = validate(res, appointmentInputSchema, req.body);
    if (!parsed) return;
    const business = await getBusinessOrFail(req, res, parsed.businessId);
    if (!business) return;
    const businessDetail = toBusinessDetail(business);
    const service = businessDetail.services.find((item) => item.id === parsed.serviceId && item.supportsAppointments);
    if (!service) return fail(res, 400, "This service does not support appointments", "INVALID_SERVICE");
    const scheduledFor = new Date(parsed.scheduledFor);
    if (Number.isNaN(scheduledFor.getTime()) || scheduledFor.getTime() <= Date.now()) return fail(res, 400, "Appointment must be scheduled in the future", "INVALID_DATE");
    const maxDate = new Date();
    maxDate.setDate(maxDate.getDate() + businessDetail.queueSettings.bookingHorizonDays);
    if (scheduledFor.getTime() > maxDate.getTime()) return fail(res, 400, "Appointment exceeds booking horizon", "BOOKING_HORIZON");
    const scheduledDay = businessDetail.hours.find((hour) => hour.dayOfWeek === scheduledFor.getDay());
    if (!scheduledDay || scheduledDay.isClosed) {
      return fail(res, 400, "That business is closed on the selected day", "BUSINESS_CLOSED");
    }
    const scheduledMinutes = scheduledFor.getHours() * 60 + scheduledFor.getMinutes();
    const openMinutes = Number(scheduledDay.openTime.split(":")[0]) * 60 + Number(scheduledDay.openTime.split(":")[1]);
    const closeMinutes = Number(scheduledDay.closeTime.split(":")[0]) * 60 + Number(scheduledDay.closeTime.split(":")[1]);
    if (scheduledMinutes < openMinutes || scheduledMinutes > closeMinutes) {
      return fail(res, 400, "Choose a time during the business's posted hours", "OUTSIDE_BUSINESS_HOURS");
    }
    const appointmentId = insertAndReturnId(db, appointments, {
      businessId: parsed.businessId,
      userId: req.currentUser!.id,
      serviceId: parsed.serviceId,
      scheduledFor: scheduledFor.toISOString(),
      status: "pending",
      notes: parsed.notes || null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    const conversationId = touchConversation(parsed.businessId, req.currentUser!.id, {
      visitType: "appointment",
      queueEntryId: null,
      appointmentId,
      contextLabel: "Upcoming appointment",
    });
    notifyBusinessOwners(parsed.businessId, {
      type: "appointment-pending",
      title: "New appointment request",
      message: `${req.currentUser!.name} requested ${service.name} on ${scheduledFor.toLocaleString()}.`,
      severity: "info",
      category: "appointments",
    });
    emitConversationUpdate(conversationId, parsed.businessId, req.currentUser!.id);
    emitForBusiness(parsed.businessId, req.currentUser!.id);
    return ok(res, { appointments: getAppointmentsForUser(req.currentUser!.id) });
  });

  app.patch("/api/appointments/:id/cancel", authRequired("user"), (req, res) => {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) return fail(res, 400, "Invalid appointment id", "INVALID_ID");
    const appointment = db.select().from(appointments).where(and(eq(appointments.id, id), eq(appointments.userId, req.currentUser!.id))).get();
    if (!appointment) return fail(res, 404, "Appointment not found", "NOT_FOUND");
    db.update(appointments).set({ status: "cancelled", updatedAt: new Date().toISOString() }).where(eq(appointments.id, id)).run();
    endConversationForVisit({ appointmentId: id }, "cancelled");
    emitForBusiness(appointment.businessId, req.currentUser!.id);
    return ok(res, { appointments: getAppointmentsForUser(req.currentUser!.id) });
  });

  app.post("/api/feedback", authRequired("user"), (req, res) => {
    const parsed = validate(res, feedbackInputSchema, req.body);
    if (!parsed) return;
    const visit = db.select().from(queueEntries).where(and(eq(queueEntries.id, parsed.visitId), eq(queueEntries.userId, req.currentUser!.id), eq(queueEntries.status, "completed"))).get();
    if (!visit) return fail(res, 400, "Only completed visits can be reviewed", "INVALID_VISIT");
    if (db.select().from(visitFeedback).where(eq(visitFeedback.queueEntryId, parsed.visitId)).get()) return fail(res, 409, "Feedback already submitted", "FEEDBACK_EXISTS");
    db.insert(visitFeedback).values({
      businessId: parsed.businessId,
      userId: req.currentUser!.id,
      queueEntryId: parsed.visitId,
      appointmentId: null,
      rating: parsed.rating,
      comment: parsed.comment,
      ownerReply: null,
      createdAt: new Date().toISOString(),
    }).run();
    notifyBusinessOwners(parsed.businessId, {
      type: "guest-feedback-submitted",
      title: "New guest feedback",
      message: `${req.currentUser!.name} left a new rating and review for your business.`,
      severity: "info",
      category: "feedback",
    });
    emitForBusiness(parsed.businessId, req.currentUser!.id);
    return ok(res, { visits: getVisitHistoryForUser(req.currentUser!.id) });
  });

  app.get("/api/notifications", authRequired(), (req, res) => ok(res, { notifications: getNotificationsForUser(req.currentUser!.id) }));
  app.post("/api/notifications/:id/read", authRequired(), (req, res) => {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) return fail(res, 400, "Invalid notification id", "INVALID_ID");
    const notification = db.select().from(notifications).where(and(eq(notifications.id, id), eq(notifications.userId, req.currentUser!.id))).get();
    if (!notification) return fail(res, 404, "Notification not found", "NOT_FOUND");
    db.update(notifications).set({ isRead: true, readAt: new Date().toISOString() }).where(eq(notifications.id, id)).run();
    broadcastEvent({ type: "notifications:update", payload: { id }, userId: req.currentUser!.id, businessId: req.currentUser!.businessId ?? undefined });
    return ok(res, { success: true });
  });
  app.post("/api/notifications/read-all", authRequired(), (req, res) => {
    db.update(notifications)
      .set({ isRead: true, readAt: new Date().toISOString() })
      .where(and(eq(notifications.userId, req.currentUser!.id), eq(notifications.isRead, false)))
      .run();
    broadcastEvent({ type: "notifications:update", payload: { all: true }, userId: req.currentUser!.id, businessId: req.currentUser!.businessId ?? undefined });
    return ok(res, { success: true });
  });
  app.delete("/api/notifications/:id", authRequired(), (req, res) => {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) return fail(res, 400, "Invalid notification id", "INVALID_ID");
    const notification = db.select().from(notifications).where(and(eq(notifications.id, id), eq(notifications.userId, req.currentUser!.id))).get();
    if (!notification) return fail(res, 404, "Notification not found", "NOT_FOUND");
    db.delete(notifications).where(eq(notifications.id, id)).run();
    broadcastEvent({ type: "notifications:update", payload: { id, deleted: true }, userId: req.currentUser!.id, businessId: req.currentUser!.businessId ?? undefined });
    return ok(res, { success: true });
  });
  app.post("/api/notifications/delete-batch", authRequired(), (req, res) => {
    const ids = Array.isArray(req.body?.ids) ? req.body.ids.map(Number).filter((value) => Number.isInteger(value) && value > 0) : [];
    if (!ids.length) return fail(res, 400, "No notification ids provided", "VALIDATION_ERROR");
    db.delete(notifications).where(and(eq(notifications.userId, req.currentUser!.id), inArray(notifications.id, ids))).run();
    broadcastEvent({ type: "notifications:update", payload: { ids, deleted: true }, userId: req.currentUser!.id, businessId: req.currentUser!.businessId ?? undefined });
    return ok(res, { success: true });
  });

  app.get("/api/owner/dashboard", authRequired("owner"), async (req, res) => {
    const businessId = getOwnerBusinessId(req.currentUser!.id);
    if (!businessId) return fail(res, 404, "No business assigned to this owner", "NO_BUSINESS");
    const business = await getBusinessOrFail(req, res, businessId);
    if (!business) return;
    const businessDetail = toBusinessDetail(business);
    const owner = getOwnerDashboardData(businessId);
    return ok(res, {
      business: businessDetail,
      subscription: owner.subscription,
      subscriptionPlans: owner.subscriptionPlans,
      operationsSummary: owner.operationsSummary,
      setupWarnings: owner.setupWarnings,
      queueAttention: owner.queueAttention,
      appointmentCounts: owner.appointmentCounts,
      queueOpen: businessDetail.queueSettings.isQueueOpen,
      activeCount: owner.queueEntriesList.length,
      waitingCount: owner.queueEntriesList.filter((entry) => entry.status === "waiting").length,
      pausedCount: owner.queueEntriesList.filter((entry) => entry.status === "paused").length,
      calledCount: owner.queueEntriesList.filter((entry) => entry.status === "called").length,
      averageWaitMinutes: businessDetail.queueSettings.averageServiceMinutes,
      todayAppointments: db.select({ count: sql<number>`count(*)` }).from(appointments).where(and(eq(appointments.businessId, businessId), sql`date(${appointments.scheduledFor}) = date('now')`)).get()?.count ?? 0,
      pendingAppointments: owner.pendingAppointments,
      upcomingAppointments: owner.upcomingAppointments,
      recentAppointments: owner.recentAppointments,
      queueEntries: owner.queueEntriesList,
      conversations: owner.conversations,
      services: owner.services,
      counters: owner.counters,
      staffMembers: owner.staff,
      notices: owner.notices,
      feedback: owner.feedback,
      analytics: owner.analytics,
    });
  });

  app.get("/api/owner/receipts", authRequired("owner"), (req, res) => {
    const businessId = getOwnerBusinessId(req.currentUser!.id);
    if (!businessId) return fail(res, 404, "No business assigned to this owner", "NO_BUSINESS");
    const business = db.select({ supportsReceipts: businesses.supportsReceipts }).from(businesses).where(eq(businesses.id, businessId)).get();
    return ok(res, {
      receipts: getReceiptsForBusiness(businessId),
      eligibleVisits: getEligibleReceiptVisitsForBusiness(businessId),
      supportsReceipts: business?.supportsReceipts ?? false,
    });
  });

  app.post("/api/owner/receipts", authRequired("owner"), (req, res) => {
    const businessId = getOwnerBusinessId(req.currentUser!.id);
    if (!businessId) return fail(res, 404, "No business assigned to this owner", "NO_BUSINESS");
    const business = db.select().from(businesses).where(eq(businesses.id, businessId)).get();
    if (!business?.supportsReceipts) return fail(res, 400, "Receipts are not enabled for this business", "RECEIPTS_DISABLED");
    const parsed = validate(res, ownerReceiptInputSchema, req.body);
    if (!parsed) return;

    if (parsed.visitType === "queue") {
      const visit = db.select().from(queueEntries).where(and(eq(queueEntries.id, parsed.visitId), eq(queueEntries.businessId, businessId), eq(queueEntries.status, "completed"))).get();
      if (!visit) return fail(res, 404, "Completed queue visit not found", "NOT_FOUND");
      const existing = db.select().from(visitReceipts).where(eq(visitReceipts.queueEntryId, visit.id)).get();
      if (existing) return ok(res, { receipt: getReceiptById(existing.id)! });
      const issuedAt = new Date().toISOString();
      const receiptId = insertAndReturnId(db, visitReceipts, {
        businessId,
        userId: visit.userId,
        ownerId: req.currentUser!.id,
        queueEntryId: visit.id,
        appointmentId: null,
        visitType: "queue",
        referenceNumber: createReceiptReference(businessId),
        status: "issued",
        ownerNote: parsed.ownerNote || null,
        lineItemLabel: parsed.lineItemLabel || null,
        amountCents: parsed.amountCents ?? null,
        totalCents: parsed.totalCents ?? parsed.amountCents ?? null,
        paymentNote: parsed.paymentNote || null,
        downloadToken: createReceiptDownloadToken(),
        issuedAt,
        updatedAt: issuedAt,
      });
      const receipt = getReceiptById(receiptId);
      if (!receipt) return fail(res, 500, "Receipt could not be created", "CREATE_FAILED");
      createNotification(visit.userId, "receipt-issued", `Receipt from ${business.name}`, `Your digital receipt ${receipt.referenceNumber} is now available.`);
      createDetailedNotification(req.currentUser!.id, {
        type: "receipt-issued",
        title: "Receipt issued",
        message: `Receipt ${receipt.referenceNumber} was created for ${receipt.userName}.`,
        severity: "success",
        category: "receipts",
      });
      emitForBusiness(businessId, visit.userId);
      return ok(res, { receipt });
    }

    const appointment = db.select().from(appointments).where(and(eq(appointments.id, parsed.visitId), eq(appointments.businessId, businessId), eq(appointments.status, "completed"))).get();
    if (!appointment) return fail(res, 404, "Completed appointment not found", "NOT_FOUND");
    const existing = db.select().from(visitReceipts).where(eq(visitReceipts.appointmentId, appointment.id)).get();
    if (existing) return ok(res, { receipt: getReceiptById(existing.id)! });
    const issuedAt = new Date().toISOString();
    const receiptId = insertAndReturnId(db, visitReceipts, {
      businessId,
      userId: appointment.userId,
      ownerId: req.currentUser!.id,
      queueEntryId: null,
      appointmentId: appointment.id,
      visitType: "appointment",
      referenceNumber: createReceiptReference(businessId),
      status: "issued",
      ownerNote: parsed.ownerNote || null,
      lineItemLabel: parsed.lineItemLabel || null,
      amountCents: parsed.amountCents ?? null,
      totalCents: parsed.totalCents ?? parsed.amountCents ?? null,
      paymentNote: parsed.paymentNote || null,
      downloadToken: createReceiptDownloadToken(),
      issuedAt,
      updatedAt: issuedAt,
    });
    const receipt = getReceiptById(receiptId);
    if (!receipt) return fail(res, 500, "Receipt could not be created", "CREATE_FAILED");
    createNotification(appointment.userId, "receipt-issued", `Receipt from ${business.name}`, `Your digital receipt ${receipt.referenceNumber} is now available.`);
    createDetailedNotification(req.currentUser!.id, {
      type: "receipt-issued",
      title: "Receipt issued",
      message: `Receipt ${receipt.referenceNumber} was created for ${receipt.userName}.`,
      severity: "success",
      category: "receipts",
    });
    emitForBusiness(businessId, appointment.userId);
    return ok(res, { receipt });
  });

  app.patch("/api/owner/receipt-settings", authRequired("owner"), (req, res) => {
    const businessId = getOwnerBusinessId(req.currentUser!.id);
    if (!businessId) return fail(res, 404, "No business assigned to this owner", "NO_BUSINESS");
    const parsed = validate(res, ownerReceiptSettingsSchema, req.body);
    if (!parsed) return;
    db.update(businesses).set({ supportsReceipts: parsed.supportsReceipts, updatedAt: new Date().toISOString() }).where(eq(businesses.id, businessId)).run();
    emitForBusiness(businessId);
    return ok(res, { supportsReceipts: parsed.supportsReceipts });
  });

  app.get("/api/owner/subscription", authRequired("owner"), (req, res) => {
    const businessId = getOwnerBusinessId(req.currentUser!.id);
    if (!businessId) return fail(res, 404, "No business assigned to this owner", "NO_BUSINESS");
    return ok(res, { subscription: getBusinessSubscription(businessId), plans: SUBSCRIPTION_PLANS });
  });

  app.patch("/api/owner/subscription", authRequired("owner"), (req, res) => {
    const businessId = getOwnerBusinessId(req.currentUser!.id);
    if (!businessId) return fail(res, 404, "No business assigned to this owner", "NO_BUSINESS");
    const parsed = validate(res, businessSubscriptionUpdateSchema, req.body);
    if (!parsed) return;
    createOrUpdateSubscription(businessId, {
      plan: parsed.plan,
      interval: parsed.interval,
      status: parsed.status ?? "active",
      endsAt: parsed.status === "cancelled" ? new Date().toISOString() : null,
    });
    return ok(res, { subscription: getBusinessSubscription(businessId), plans: SUBSCRIPTION_PLANS });
  });

  app.get("/api/owner/queue", authRequired("owner"), (req, res) => {
    const businessId = getOwnerBusinessId(req.currentUser!.id);
    if (!businessId) return fail(res, 404, "No business assigned to this owner", "NO_BUSINESS");
    return ok(res, { entries: getOwnerDashboardData(businessId).queueEntriesList });
  });

  app.patch("/api/owner/queue/open-state", authRequired("owner"), (req, res) => {
    if (typeof req.body?.open !== "boolean") return fail(res, 400, "Missing open boolean", "VALIDATION_ERROR");
    const businessId = getOwnerBusinessId(req.currentUser!.id);
    if (!businessId) return fail(res, 404, "No business assigned to this owner", "NO_BUSINESS");
    db.update(businesses).set({ isQueueOpen: req.body.open, updatedAt: new Date().toISOString() }).where(eq(businesses.id, businessId)).run();
    createDetailedNotification(req.currentUser!.id, {
      type: req.body.open ? "queue-opened" : "queue-paused",
      title: req.body.open ? "Queues opened" : "Queues paused",
      message: req.body.open ? "Guests can join the live queue again." : "Live queue joins are paused until you reopen them.",
      severity: req.body.open ? "success" : "warning",
      category: "queue",
    });
    emitForBusiness(businessId, undefined, {
      action: req.body.open ? "joins-opened" : "joins-paused",
      message: req.body.open ? "The business reopened queue joins." : "The business paused new queue joins.",
      queueOrderChanged: false,
      needsAssignmentAttention: false,
      affectsJoinAvailability: true,
    });
    return ok(res, { success: true });
  });

  app.post("/api/owner/queue/:id/call-next", authRequired("owner"), (req, res) => handleOwnerQueueAction(req, res, "called"));
  app.post("/api/owner/queue/:id/in-service", authRequired("owner"), (req, res) => handleOwnerQueueAction(req, res, "in_service"));
  app.post("/api/owner/queue/:id/delay", authRequired("owner"), (req, res) => handleOwnerQueueAction(req, res, "delayed"));
  app.post("/api/owner/queue/:id/complete", authRequired("owner"), (req, res) => handleOwnerQueueAction(req, res, "completed"));
  app.post("/api/owner/queue/:id/no-show", authRequired("owner"), (req, res) => handleOwnerQueueAction(req, res, "no_show"));

  app.post("/api/owner/queue/:id/assign", authRequired("owner"), (req, res) => {
    const entryId = Number(req.params.id);
    if (Number.isNaN(entryId)) return fail(res, 400, "Invalid queue entry id", "INVALID_ID");
    const parsed = validate(res, ownerQueueAssignmentSchema, req.body);
    if (!parsed) return;
    const entry = db.select().from(queueEntries).where(eq(queueEntries.id, entryId)).get();
    if (!entry) return fail(res, 404, "Queue entry not found", "NOT_FOUND");
    const ownerBusinessId = getOwnerBusinessId(req.currentUser!.id);
    if (!ownerBusinessId || ownerBusinessId !== entry.businessId) return fail(res, 403, "Forbidden", "FORBIDDEN");
    const service = parsed.serviceId == null
      ? (entry.serviceId == null ? null : db.select().from(businessServices).where(eq(businessServices.id, entry.serviceId)).get())
      : db.select().from(businessServices).where(eq(businessServices.id, parsed.serviceId)).get();
    if (parsed.serviceId != null) {
      if (!service || service.businessId !== entry.businessId) return fail(res, 404, "Service not found for this business", "SERVICE_NOT_FOUND");
      if (!service.isActive) return fail(res, 409, "Choose an active service before assigning the queue entry.", "SERVICE_INACTIVE");
    }
    const counter = parsed.counterId == null ? null : db.select().from(serviceCounters).where(eq(serviceCounters.id, parsed.counterId)).get();
    if (parsed.counterId != null) {
      if (!counter || counter.businessId !== entry.businessId) return fail(res, 404, "Counter not found for this business", "COUNTER_NOT_FOUND");
      if (counter.status === "offline") return fail(res, 409, "Choose a counter that is open or busy, not offline.", "COUNTER_OFFLINE");
    }
    const resolvedServiceId = parsed.serviceId ?? entry.serviceId ?? null;
    const counterServiceIds = counter ? JSON.parse(counter.activeServiceIdsJson) as number[] : [];
    if (counter && resolvedServiceId == null) {
      return fail(res, 409, "Choose a service before assigning a counter.", "SERVICE_REQUIRED");
    }
    if (counter && resolvedServiceId != null && counterServiceIds.length > 0 && !counterServiceIds.includes(resolvedServiceId)) {
      return fail(res, 409, "That counter is not configured for the selected service.", "COUNTER_SERVICE_MISMATCH");
    }
    if (resolvedServiceId != null && resolvedServiceId !== entry.serviceId) {
      const serviceForCapacity = service ?? db.select().from(businessServices).where(eq(businessServices.id, resolvedServiceId)).get();
      if (!serviceForCapacity || serviceForCapacity.businessId !== entry.businessId) {
        return fail(res, 404, "Service not found for this business", "SERVICE_NOT_FOUND");
      }
      const activeInLane = getServiceQueueCount(entry.businessId, resolvedServiceId, entryId);
      if (activeInLane >= serviceForCapacity.maxActiveQueue) {
        return fail(res, 409, `The ${serviceForCapacity.name} lane is already at capacity.`, "QUEUE_CAPACITY_REACHED");
      }
    }
    const staffName = parsed.staffName.trim() || counter?.assignedStaffName || null;
    db.update(queueEntries).set({ counterId: parsed.counterId, serviceId: resolvedServiceId, staffName, updatedAt: new Date().toISOString() }).where(eq(queueEntries.id, entryId)).run();
    addQueueEvent(entryId, "assigned", "Assigned to service counter.", new Date().toISOString());
    revalidateQueueForBusiness(entry.businessId);
    createDetailedNotification(req.currentUser!.id, {
      type: "queue-assigned",
      title: "Queue assignment updated",
      message: `Assignment details were updated for ${entry.queueNumber}.`,
      severity: "info",
      category: "queue",
    });
    emitForBusiness(entry.businessId, entry.userId, {
      entryId,
      status: entry.status as QueueRealtimeEvent["status"],
      action: "assigned",
      message: `Assignment details were updated for ${entry.queueNumber}.`,
      queueOrderChanged: false,
      needsAssignmentAttention: !resolvedServiceId || !parsed.counterId || !staffName?.trim(),
    });
    return ok(res, { success: true });
  });

  app.patch("/api/owner/appointments/:id", authRequired("owner"), (req, res) => {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) return fail(res, 400, "Invalid appointment id", "INVALID_ID");
    const parsed = validate(res, appointmentUpdateSchema, req.body);
    if (!parsed) return;
    const businessId = getOwnerBusinessId(req.currentUser!.id);
    if (!businessId) return fail(res, 404, "No business assigned to this owner", "NO_BUSINESS");
    const appointment = db.select().from(appointments).where(and(eq(appointments.id, id), eq(appointments.businessId, businessId))).get();
    if (!appointment) return fail(res, 404, "Appointment not found", "NOT_FOUND");
    const allowedStatuses =
      appointment.status === "pending"
        ? ["approved", "rejected", "cancelled"]
        : appointment.status === "approved"
          ? ["completed", "cancelled"]
          : appointment.status === "converted"
            ? ["completed"]
            : [];
    if (!allowedStatuses.includes(parsed.status)) {
      return fail(res, 409, `Appointments in ${appointment.status} status cannot be moved to ${parsed.status}.`, "INVALID_APPOINTMENT_TRANSITION");
    }
    if (parsed.status === "approved" && new Date(appointment.scheduledFor).getTime() < Date.now()) {
      return fail(res, 409, "Past appointments cannot be approved. Ask the guest to rebook instead.", "APPOINTMENT_IN_PAST");
    }
    db.update(appointments).set({ status: parsed.status, updatedAt: new Date().toISOString() }).where(eq(appointments.id, id)).run();
    if (parsed.status === "approved") {
      const conversationId = touchConversation(appointment.businessId, appointment.userId, {
        visitType: "appointment",
        queueEntryId: null,
        appointmentId: id,
        contextLabel: "Upcoming appointment",
      });
      emitConversationUpdate(conversationId, appointment.businessId, appointment.userId);
    }
    if (parsed.status === "rejected" || parsed.status === "cancelled") {
      endConversationForVisit({ appointmentId: id }, "cancelled");
    }
    if (parsed.status === "completed") {
      endConversationForVisit({ appointmentId: id }, "completed");
    }
    createNotification(appointment.userId, "appointment-status", `Appointment ${parsed.status}`, `Your appointment status is now ${parsed.status}.`);
    createDetailedNotification(req.currentUser!.id, {
      type: `owner-appointment-${parsed.status}`,
      title: "Appointment updated",
      message: `Appointment ${id} is now ${parsed.status}.`,
      severity: parsed.status === "approved" || parsed.status === "completed" ? "success" : "warning",
      category: "appointments",
    });
    emitForBusiness(businessId, appointment.userId);
    return ok(res, { success: true });
  });

  app.post("/api/owner/services", authRequired("owner"), (req, res) => {
    const parsed = validate(res, ownerServiceInputSchema, req.body);
    if (!parsed) return;
    const businessId = getOwnerBusinessId(req.currentUser!.id);
    if (!businessId) return fail(res, 404, "No business assigned to this owner", "NO_BUSINESS");
    db.insert(businessServices).values({
      businessId,
      name: parsed.name.trim(),
      description: parsed.description.trim(),
      averageServiceMinutes: parsed.averageServiceMinutes,
      maxActiveQueue: parsed.maxActiveQueue,
      supportsAppointments: parsed.supportsAppointments,
      isActive: parsed.isActive,
      createdAt: new Date().toISOString(),
    }).run();
    emitForBusiness(businessId);
    return ok(res, { services: getOwnerDashboardData(businessId).services });
  });

  app.patch("/api/owner/services/:id", authRequired("owner"), (req, res) => {
    const serviceId = Number(req.params.id);
    if (Number.isNaN(serviceId)) return fail(res, 400, "Invalid service id", "INVALID_ID");
    const parsed = validate(res, ownerServiceInputSchema, req.body);
    if (!parsed) return;
    const businessId = getOwnerBusinessId(req.currentUser!.id);
    if (!businessId) return fail(res, 404, "No business assigned to this owner", "NO_BUSINESS");
    const service = db.select().from(businessServices).where(eq(businessServices.id, serviceId)).get();
    if (!service || service.businessId !== businessId) return fail(res, 404, "Service not found", "NOT_FOUND");
    db.update(businessServices).set({ ...parsed, name: parsed.name.trim(), description: parsed.description.trim() }).where(eq(businessServices.id, serviceId)).run();
    emitForBusiness(businessId);
    return ok(res, { success: true });
  });

  app.post("/api/owner/counters", authRequired("owner"), (req, res) => {
    const parsed = validate(res, ownerCounterInputSchema, req.body);
    if (!parsed) return;
    const businessId = getOwnerBusinessId(req.currentUser!.id);
    if (!businessId) return fail(res, 404, "No business assigned to this owner", "NO_BUSINESS");
    const validServiceIds = new Set(db.select({ id: businessServices.id }).from(businessServices).where(eq(businessServices.businessId, businessId)).all().map((row) => row.id));
    if (parsed.activeServiceIds.some((serviceId) => !validServiceIds.has(serviceId))) {
      return fail(res, 409, "Counters can only be linked to services from the same business.", "COUNTER_SERVICE_MISMATCH");
    }
    db.insert(serviceCounters).values({ businessId, name: parsed.name.trim(), status: parsed.status, activeServiceIdsJson: JSON.stringify(parsed.activeServiceIds), assignedStaffName: parsed.assignedStaffName.trim() || null, createdAt: new Date().toISOString() }).run();
    emitForBusiness(businessId);
    return ok(res, { counters: getOwnerDashboardData(businessId).counters });
  });

  app.patch("/api/owner/counters/:id", authRequired("owner"), (req, res) => {
    const counterId = Number(req.params.id);
    if (Number.isNaN(counterId)) return fail(res, 400, "Invalid counter id", "INVALID_ID");
    const parsed = validate(res, ownerCounterInputSchema, req.body);
    if (!parsed) return;
    const businessId = getOwnerBusinessId(req.currentUser!.id);
    if (!businessId) return fail(res, 404, "No business assigned to this owner", "NO_BUSINESS");
    const counter = db.select().from(serviceCounters).where(eq(serviceCounters.id, counterId)).get();
    if (!counter || counter.businessId !== businessId) return fail(res, 404, "Counter not found", "NOT_FOUND");
    const validServiceIds = new Set(db.select({ id: businessServices.id }).from(businessServices).where(eq(businessServices.businessId, businessId)).all().map((row) => row.id));
    if (parsed.activeServiceIds.some((serviceId) => !validServiceIds.has(serviceId))) {
      return fail(res, 409, "Counters can only be linked to services from the same business.", "COUNTER_SERVICE_MISMATCH");
    }
    db.update(serviceCounters).set({ name: parsed.name.trim(), status: parsed.status, activeServiceIdsJson: JSON.stringify(parsed.activeServiceIds), assignedStaffName: parsed.assignedStaffName.trim() || null }).where(eq(serviceCounters.id, counterId)).run();
    emitForBusiness(businessId);
    return ok(res, { success: true });
  });

  app.post("/api/owner/notices", authRequired("owner"), (req, res) => {
    const parsed = validate(res, ownerNoticeInputSchema, req.body);
    if (!parsed) return;
    const businessId = getOwnerBusinessId(req.currentUser!.id);
    if (!businessId) return fail(res, 404, "No business assigned to this owner", "NO_BUSINESS");
    db.insert(businessNotices).values({
      businessId,
      title: parsed.title.trim(),
      message: parsed.message.trim(),
      severity: parsed.severity,
      isActive: parsed.isActive,
      createdAt: new Date().toISOString(),
    }).run();
    emitForBusiness(businessId);
    return ok(res, { notices: getOwnerDashboardData(businessId).notices });
  });

  app.patch("/api/owner/notices/:id", authRequired("owner"), (req, res) => {
    const noticeId = Number(req.params.id);
    if (Number.isNaN(noticeId)) return fail(res, 400, "Invalid notice id", "INVALID_ID");
    const parsed = validate(res, ownerNoticeInputSchema, req.body);
    if (!parsed) return;
    const businessId = getOwnerBusinessId(req.currentUser!.id);
    if (!businessId) return fail(res, 404, "No business assigned to this owner", "NO_BUSINESS");
    const notice = db.select().from(businessNotices).where(eq(businessNotices.id, noticeId)).get();
    if (!notice || notice.businessId !== businessId) return fail(res, 404, "Notice not found", "NOT_FOUND");
    db.update(businessNotices).set({ ...parsed, title: parsed.title.trim(), message: parsed.message.trim() }).where(eq(businessNotices.id, noticeId)).run();
    emitForBusiness(businessId);
    return ok(res, { success: true });
  });

  app.patch("/api/owner/hours", authRequired("owner"), (req, res) => {
    const parsed = validate(res, ownerBusinessHoursInputSchema, req.body);
    if (!parsed) return;
    const businessId = getOwnerBusinessId(req.currentUser!.id);
    if (!businessId) return fail(res, 404, "No business assigned to this owner", "NO_BUSINESS");
    db.delete(businessHours).where(eq(businessHours.businessId, businessId)).run();
    db
      .insert(businessHours)
      .values(
        parsed.hours.map((hour) => ({
          businessId,
          dayOfWeek: hour.dayOfWeek,
          openTime: hour.openTime,
          closeTime: hour.closeTime,
          isClosed: hour.isClosed,
        })),
      )
      .run();
    db.update(businesses).set({ updatedAt: new Date().toISOString() }).where(eq(businesses.id, businessId)).run();
    emitForBusiness(businessId);
    return ok(res, { success: true });
  });

  app.patch("/api/owner/business-profile", authRequired("owner"), (req, res) => {
    const parsed = validate(res, ownerBusinessProfileInputSchema, req.body);
    if (!parsed) return;
    const businessId = getOwnerBusinessId(req.currentUser!.id);
    if (!businessId) return fail(res, 404, "No business assigned to this owner", "NO_BUSINESS");
    db.update(businesses)
      .set({
        name: parsed.name.trim(),
        phone: parsed.phone.trim(),
        email: parsed.email.trim().toLowerCase(),
        address: parsed.address.trim(),
        websiteUrl: parsed.websiteUrl.trim() || null,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(businesses.id, businessId))
      .run();
    emitForBusiness(businessId);
    return ok(res, { success: true });
  });

  app.post("/api/owner/feedback/:id/reply", authRequired("owner"), (req, res) => {
    const feedbackId = Number(req.params.id);
    if (Number.isNaN(feedbackId)) return fail(res, 400, "Invalid feedback id", "INVALID_ID");
    const parsed = validate(res, ownerFeedbackReplySchema, req.body);
    if (!parsed) return;
    const businessId = getOwnerBusinessId(req.currentUser!.id);
    if (!businessId) return fail(res, 404, "No business assigned to this owner", "NO_BUSINESS");
    const feedback = db.select().from(visitFeedback).where(eq(visitFeedback.id, feedbackId)).get();
    if (!feedback || feedback.businessId !== businessId) return fail(res, 404, "Feedback item not found", "NOT_FOUND");
    db.update(visitFeedback).set({ ownerReply: parsed.reply.trim() }).where(eq(visitFeedback.id, feedbackId)).run();
    if (feedback) emitForBusiness(feedback.businessId);
    return ok(res, { success: true });
  });

  app.get("/api/admin/overview", authRequired("admin"), (_req, res) => {
    return ok(res, getAdminAnalyticsSnapshot().summary);
  });

  app.get("/api/admin/analytics", authRequired("admin"), (_req, res) => {
    return ok(res, getAdminAnalyticsSnapshot());
  });

  app.get("/api/admin/assistant-analytics", authRequired("admin"), (_req, res) => {
    return ok(res, getAdminAssistantAnalytics());
  });

  app.get("/api/admin/command-center", authRequired("admin"), (_req, res) => {
    return ok(res, getAdminCommandCenter());
  });

  app.get("/api/admin/businesses", authRequired("admin"), async (req, res) => {
    return ok(res, { businesses: await getAdminBusinessList() });
  });

  app.get("/api/admin/businesses/:id", authRequired("admin"), async (req, res) => {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) return fail(res, 400, "Invalid business id", "INVALID_ID");
    const business = (await getAdminBusinessList()).find((item) => item.id === id);
    if (!business) return fail(res, 404, "Business not found", "NOT_FOUND");
    return ok(res, { business });
  });

  app.get("/api/admin/subscriptions", authRequired("admin"), (_req, res) => {
    return ok(res, { subscriptions: getAdminSubscriptionRecords(), plans: SUBSCRIPTION_PLANS });
  });

  app.get("/api/admin/claim-requests", authRequired("admin"), (_req, res) => {
    return ok(res, { claims: getClaimRequests() });
  });

  app.get("/api/admin/accounts", authRequired("admin"), (_req, res) => {
    return ok(res, { accounts: getAdminAccountRecords() });
  });

  app.get("/api/admin/activity-log", authRequired("admin"), (_req, res) => {
    return ok(res, { activity: getAdminActivityItems() });
  });

  app.get("/api/admin/announcements", authRequired("admin"), (_req, res) => {
    return ok(res, { announcements: getAdminAnnouncements() });
  });

  app.post("/api/admin/announcements", authRequired("admin"), (req, res) => {
    const parsed = validate(res, adminAnnouncementInputSchema, req.body);
    if (!parsed) return;
    const now = new Date().toISOString();
    const announcementId = insertAndReturnId(db, platformAnnouncements, {
      title: parsed.title,
      message: parsed.message,
      audience: parsed.audience,
      status: parsed.status,
      createdByAdminId: req.currentUser!.id,
      publishedAt: parsed.status === "published" ? now : null,
      createdAt: now,
      updatedAt: now,
    });
    if (parsed.status === "published") {
      const targetRoles = parsed.audience === "all" ? ["user", "owner"] : [parsed.audience === "users" ? "user" : "owner"];
      db.select().from(users).where(inArray(users.role, targetRoles as ("user" | "owner")[])).all().forEach((user) => {
        createDetailedNotification(user.id, {
          type: "platform-announcement",
          title: parsed.title,
          message: parsed.message,
          severity: "info",
          category: "announcement",
        });
      });
    }
    logAdminActivity(req.currentUser!.id, "announcement_created", "announcement", announcementId, `Created ${parsed.status} announcement "${parsed.title}".`);
    return ok(res, { announcement: getAdminAnnouncements().find((item) => item.id === announcementId) });
  });

  app.patch("/api/admin/announcements/:id", authRequired("admin"), (req, res) => {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) return fail(res, 400, "Invalid announcement id", "INVALID_ID");
    const parsed = validate(res, adminAnnouncementInputSchema, req.body);
    if (!parsed) return;
    const existing = db.select().from(platformAnnouncements).where(eq(platformAnnouncements.id, id)).get();
    if (!existing) return fail(res, 404, "Announcement not found", "NOT_FOUND");
    const now = new Date().toISOString();
    db.update(platformAnnouncements).set({
      title: parsed.title,
      message: parsed.message,
      audience: parsed.audience,
      status: parsed.status,
      publishedAt: parsed.status === "published" ? existing.publishedAt ?? now : existing.publishedAt,
      updatedAt: now,
    }).where(eq(platformAnnouncements.id, id)).run();
    logAdminActivity(req.currentUser!.id, "announcement_updated", "announcement", id, `Updated announcement "${parsed.title}".`);
    return ok(res, { announcement: getAdminAnnouncements().find((item) => item.id === id) });
  });

  app.get("/api/admin/platform-settings", authRequired("admin"), (_req, res) => {
    return ok(res, { settings: readPlatformSettings() });
  });

  app.put("/api/admin/platform-settings", authRequired("admin"), (req, res) => {
    const parsed = validate(res, adminPlatformSettingsSchema, req.body);
    if (!parsed) return;
    writePlatformSettings(parsed);
    logAdminActivity(req.currentUser!.id, "platform_settings_updated", "platform_settings", null, "Updated platform settings.");
    return ok(res, { settings: readPlatformSettings() });
  });

  app.post("/api/admin/businesses", authRequired("admin"), (req, res) => {
    const parsed = validate(res, adminBusinessInputSchema, req.body);
    if (!parsed) return;
    const category = db.select().from(businessCategories).where(eq(businessCategories.slug, parsed.category)).get();
    if (!category) return fail(res, 400, "Unknown category", "INVALID_CATEGORY");
    const now = new Date().toISOString();
    const businessId = insertAndReturnId(db, businesses, {
      slug: parsed.slug,
      name: parsed.name,
      categoryId: category.id,
      description: parsed.description,
      address: parsed.address,
      phone: parsed.phone,
      email: parsed.email,
      websiteUrl: null,
      latitude: parsed.latitude,
      longitude: parsed.longitude,
      rating: parsed.rating,
      reviewsCount: parsed.reviewsCount,
      imageUrl: parsed.imageUrl,
      tagsJson: JSON.stringify(parsed.tags),
      source: "local",
      externalProvider: null,
      externalPlaceId: null,
      averageServiceMinutes: parsed.queueSettings.averageServiceMinutes,
      maxSkips: parsed.queueSettings.maxSkips,
      maxReschedules: parsed.queueSettings.maxReschedules,
      pauseLimitMinutes: parsed.queueSettings.pauseLimitMinutes,
      bookingHorizonDays: parsed.queueSettings.bookingHorizonDays,
      isQueueOpen: parsed.queueSettings.isQueueOpen,
      createdAt: now,
      updatedAt: now,
    });
    db.insert(businessHours).values(parsed.hours.map((hour) => ({ businessId, dayOfWeek: hour.dayOfWeek, openTime: hour.openTime, closeTime: hour.closeTime, isClosed: hour.isClosed }))).run();
    const serviceIds = parsed.services.map((service) =>
      insertAndReturnId(db, businessServices, {
        businessId,
        name: service.name,
        description: service.description,
        averageServiceMinutes: service.averageServiceMinutes,
        maxActiveQueue: service.maxActiveQueue,
        supportsAppointments: service.supportsAppointments,
        isActive: service.isActive,
        createdAt: now,
      }),
    );
    parsed.counters.forEach((counter) => {
      db.insert(serviceCounters).values({ businessId, name: counter.name, status: counter.status, activeServiceIdsJson: JSON.stringify(counter.activeServiceIds.length ? counter.activeServiceIds : serviceIds), assignedStaffName: counter.assignedStaffName || null, createdAt: now }).run();
    });
    createOrUpdateSubscription(businessId, { plan: "starter", interval: "monthly", status: "trial", startedAt: now, nextBillingAt: null });
    logAdminActivity(req.currentUser!.id, "business_created", "business", businessId, `Created business ${parsed.name}.`);
    return ok(res, { id: businessId });
  });

  app.post("/api/admin/import-business", authRequired("admin"), (req, res) => {
    const parsed = validate(res, businessImportInputSchema, req.body);
    if (!parsed) return;
    const existing = db
      .select()
      .from(businesses)
      .where(and(eq(businesses.externalProvider, parsed.provider), eq(businesses.externalPlaceId, parsed.placeId)))
      .get();
    if (existing) return ok(res, { id: existing.id });
    const category = db.select().from(businessCategories).where(eq(businessCategories.slug, parsed.category)).get();
    if (!category) return fail(res, 400, "Unknown category", "INVALID_CATEGORY");
    const now = new Date().toISOString();
    const slugBase = slugify(parsed.name);
    const slug = db.select().from(businesses).where(eq(businesses.slug, slugBase)).get() ? `${slugBase}-${Date.now().toString().slice(-4)}` : slugBase;
    const businessId = insertAndReturnId(db, businesses, {
      slug,
      name: parsed.name,
      categoryId: category.id,
      description: parsed.description,
      address: parsed.address,
      phone: parsed.phone || "Phone not available",
      email: parsed.email || "contact@qtech-imported.local",
      websiteUrl: parsed.websiteUrl || null,
      latitude: parsed.latitude,
      longitude: parsed.longitude,
      rating: parsed.rating,
      reviewsCount: parsed.reviewsCount,
      imageUrl: parsed.imageUrl,
      tagsJson: JSON.stringify(parsed.tags.length ? parsed.tags : ["imported"]),
      source: "imported",
      externalProvider: parsed.provider,
      externalPlaceId: parsed.placeId,
      averageServiceMinutes: 15,
      maxSkips: 2,
      maxReschedules: 2,
      pauseLimitMinutes: FIXED_QUEUE_PAUSE_LIMIT_MINUTES,
      bookingHorizonDays: 14,
      isQueueOpen: false,
      createdAt: now,
      updatedAt: now,
    });
    db.insert(businessHours).values(
      Array.from({ length: 7 }, (_, dayOfWeek) => ({
        businessId,
        dayOfWeek,
        openTime: "09:00",
        closeTime: "17:00",
        isClosed: dayOfWeek === 0 || dayOfWeek === 6,
      })),
    ).run();
    db.insert(businessServices).values({
      businessId,
      name: "General service",
      description: "Imported business lane ready for queue and booking setup.",
      averageServiceMinutes: 15,
      maxActiveQueue: 20,
      supportsAppointments: true,
      isActive: true,
      createdAt: now,
    }).run();
    createOrUpdateSubscription(businessId, { plan: "starter", interval: "monthly", status: "trial", startedAt: now, nextBillingAt: null });
    db.update(businessClaimRequests).set({ status: "imported" }).where(and(eq(businessClaimRequests.provider, parsed.provider), eq(businessClaimRequests.placeId, parsed.placeId))).run();
    logAdminActivity(req.currentUser!.id, "claim_imported", "business", businessId, `Imported business ${parsed.name} from claim feed.`);
    return ok(res, { id: businessId });
  });

  app.get("/api/admin/users", authRequired("admin"), (_req, res) => ok(res, { users: db.select({ id: users.id, email: users.email, name: users.name, role: users.role, businessId: users.businessId }).from(users).orderBy(users.createdAt).all() }));

  app.post("/api/admin/owners", authRequired("admin"), (req, res) => {
    const parsed = validate(res, createOwnerInputSchema, req.body);
    if (!parsed) return;
    if (db.select().from(users).where(eq(users.email, parsed.email.toLowerCase())).get()) return fail(res, 409, "Email is already in use", "EMAIL_TAKEN");
    const ownerId = insertAndReturnId(db, users, { email: parsed.email.toLowerCase(), name: parsed.name, passwordHash: hashSync(parsed.password, 10), role: "owner", businessId: parsed.businessId ?? null, createdAt: new Date().toISOString() });
    logAdminActivity(req.currentUser!.id, "owner_created", "user", ownerId, `Created owner ${parsed.name}.`);
    return ok(res, { success: true });
  });

  app.patch("/api/admin/businesses/:id", authRequired("admin"), (req, res) => {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) return fail(res, 400, "Invalid business id", "INVALID_ID");
    const parsed = validate(res, adminBusinessUpdateInputSchema, req.body);
    if (!parsed) return;
    const business = db.select().from(businesses).where(eq(businesses.id, id)).get();
    if (!business) return fail(res, 404, "Business not found", "NOT_FOUND");
    const category = db.select().from(businessCategories).where(eq(businessCategories.slug, parsed.category)).get();
    if (!category) return fail(res, 400, "Unknown category", "INVALID_CATEGORY");
    if (parsed.recordStatus === "suspended" && !parsed.moderationReason.trim()) {
      return fail(res, 409, "Provide a moderation reason before suspending a business.", "MODERATION_REASON_REQUIRED");
    }
    db.update(businesses).set({
      name: parsed.name.trim(),
      categoryId: category.id,
      description: parsed.description.trim(),
      address: parsed.address.trim(),
      phone: parsed.phone.trim(),
      email: parsed.email.trim().toLowerCase(),
      websiteUrl: parsed.websiteUrl.trim() || null,
      recordStatus: parsed.recordStatus,
      moderationReason: parsed.recordStatus === "suspended" ? parsed.moderationReason.trim() || null : null,
      moderatedAt: parsed.recordStatus === "suspended" ? new Date().toISOString() : null,
      updatedAt: new Date().toISOString(),
    }).where(eq(businesses.id, id)).run();
    logAdminActivity(req.currentUser!.id, "business_updated", "business", id, `Updated business ${parsed.name.trim()}${parsed.recordStatus === "suspended" ? " and suspended it." : "."}`);
    return ok(res, { success: true });
  });

  app.delete("/api/admin/businesses/:id", authRequired("admin"), (req, res) => {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) return fail(res, 400, "Invalid business id", "INVALID_ID");
    const parsed = validate(res, adminDeleteInputSchema, req.body);
    if (!parsed) return;
    if (parsed.confirmation !== ADMIN_BUSINESS_DELETE_CONFIRMATION) {
      return fail(res, 400, `Type "${ADMIN_BUSINESS_DELETE_CONFIRMATION}" to confirm business deletion.`, "INVALID_CONFIRMATION");
    }
    const business = db.select().from(businesses).where(eq(businesses.id, id)).get();
    if (!business) return fail(res, 404, "Business not found", "NOT_FOUND");
    if (business.recordStatus !== "suspended") {
      return fail(res, 409, "Suspend this business before deleting it.", "SUSPEND_REQUIRED");
    }
    deleteBusinessCascade(id);
    logAdminActivity(req.currentUser!.id, "business_deleted", "business", id, `Deleted business ${business.name}.`);
    return ok(res, { success: true });
  });

  app.post("/api/admin/businesses/:id/assign-owner", authRequired("admin"), (req, res) => {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) return fail(res, 400, "Invalid business id", "INVALID_ID");
    const parsed = validate(res, adminAssignBusinessOwnerInputSchema, req.body);
    if (!parsed) return;
    const business = db.select().from(businesses).where(eq(businesses.id, id)).get();
    if (!business) return fail(res, 404, "Business not found", "NOT_FOUND");
    db.update(users).set({ businessId: null }).where(and(eq(users.businessId, id), eq(users.role, "owner"))).run();
    if (parsed.ownerUserId != null) {
      const owner = db.select().from(users).where(eq(users.id, parsed.ownerUserId)).get();
      if (!owner || owner.role !== "owner") return fail(res, 404, "Owner not found", "NOT_FOUND");
      if (owner.accountStatus === "suspended") return fail(res, 409, "Suspended owners cannot be assigned to a business.", "OWNER_SUSPENDED");
      db.update(users).set({ businessId: id }).where(eq(users.id, owner.id)).run();
      logAdminActivity(req.currentUser!.id, "owner_assigned", "business", id, `Assigned ${owner.name} to ${business.name}.`);
    } else {
      logAdminActivity(req.currentUser!.id, "owner_unassigned", "business", id, `Removed owner assignment from ${business.name}.`);
    }
    return ok(res, { success: true });
  });

  app.patch("/api/admin/accounts/:id/status", authRequired("admin"), (req, res) => {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) return fail(res, 400, "Invalid account id", "INVALID_ID");
    if (id === req.currentUser!.id) return fail(res, 400, "You cannot change your own account status here.", "INVALID_ACTION");
    const parsed = validate(res, adminAccountStatusInputSchema, req.body);
    if (!parsed) return;
    const user = db.select().from(users).where(eq(users.id, id)).get();
    if (!user) return fail(res, 404, "Account not found", "NOT_FOUND");
    if (parsed.accountStatus === "suspended" && !parsed.moderationReason.trim()) {
      return fail(res, 409, "Provide a moderation reason before suspending an account.", "MODERATION_REASON_REQUIRED");
    }
    setUserStatus(id, parsed.accountStatus, parsed.moderationReason || null);
    logAdminActivity(req.currentUser!.id, "account_status_updated", "user", id, `${parsed.accountStatus === "suspended" ? "Suspended" : "Reactivated"} ${user.name}${parsed.accountStatus === "suspended" ? ` for "${parsed.moderationReason.trim()}".` : "."}`);
    return ok(res, { success: true });
  });

  app.delete("/api/admin/accounts/:id", authRequired("admin"), (req, res) => {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) return fail(res, 400, "Invalid account id", "INVALID_ID");
    if (id === req.currentUser!.id) return fail(res, 400, "You cannot delete your own account here.", "INVALID_ACTION");
    const parsed = validate(res, adminDeleteInputSchema, req.body);
    if (!parsed) return;
    if (parsed.confirmation !== ADMIN_ACCOUNT_DELETE_CONFIRMATION) {
      return fail(res, 400, `Type "${ADMIN_ACCOUNT_DELETE_CONFIRMATION}" to confirm account deletion.`, "INVALID_CONFIRMATION");
    }
    const user = db.select().from(users).where(eq(users.id, id)).get();
    if (!user) return fail(res, 404, "Account not found", "NOT_FOUND");
    if (user.role === "admin") return fail(res, 403, "Admin accounts cannot be deleted from this screen.", "DELETE_RESTRICTED");
    if (user.accountStatus !== "suspended") {
      return fail(res, 409, "Suspend this account before deleting it.", "SUSPEND_REQUIRED");
    }
    deleteUserAccountCascade(id);
    logAdminActivity(req.currentUser!.id, "account_deleted", "user", id, `Deleted ${user.role} account ${user.name}.`);
    return ok(res, { success: true });
  });

  app.post("/api/admin/accounts/:id/force-reset", authRequired("admin"), (req, res) => {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) return fail(res, 400, "Invalid account id", "INVALID_ID");
    const user = db.select().from(users).where(eq(users.id, id)).get();
    if (!user) return fail(res, 404, "Account not found", "NOT_FOUND");
    const token = crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "");
    db.update(users).set({
      passwordResetTokenHash: hashResetToken(token),
      passwordResetExpiresAt: new Date(Date.now() + PASSWORD_RESET_TTL_MS).toISOString(),
    }).where(eq(users.id, id)).run();
    clearUserSessions(id);
    logAdminActivity(req.currentUser!.id, "forced_password_reset", "user", id, `Forced password reset for ${user.name}.`);
    return ok(res, { success: true, resetLinkPreview: createPasswordResetLink(token) });
  });

  app.post("/api/admin/owners/:id/transfer-business", authRequired("admin"), (req, res) => {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) return fail(res, 400, "Invalid owner id", "INVALID_ID");
    const parsed = validate(res, adminOwnerTransferInputSchema, req.body);
    if (!parsed) return;
    const owner = db.select().from(users).where(eq(users.id, id)).get();
    if (!owner || owner.role !== "owner") return fail(res, 404, "Owner not found", "NOT_FOUND");
    if (parsed.businessId != null) {
      const targetBusiness = db.select().from(businesses).where(eq(businesses.id, parsed.businessId)).get();
      if (!targetBusiness) return fail(res, 404, "Business not found", "NOT_FOUND");
      if (targetBusiness.recordStatus === "suspended") return fail(res, 409, "Owners cannot be transferred into suspended businesses.", "BUSINESS_SUSPENDED");
      db.update(users).set({ businessId: parsed.businessId }).where(eq(users.id, id)).run();
      logAdminActivity(req.currentUser!.id, "owner_transferred", "user", id, `Transferred ${owner.name} to ${targetBusiness.name}.`);
      return ok(res, { success: true });
    }
    db.update(users).set({ businessId: parsed.businessId }).where(eq(users.id, id)).run();
    logAdminActivity(req.currentUser!.id, "owner_transferred", "user", id, `Removed ${owner.name} from their business assignment.`);
    return ok(res, { success: true });
  });

  app.patch("/api/admin/claim-requests/:id", authRequired("admin"), (req, res) => {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) return fail(res, 400, "Invalid claim id", "INVALID_ID");
    const parsed = validate(res, adminClaimReviewInputSchema, req.body);
    if (!parsed) return;
    const claim = db.select().from(businessClaimRequests).where(eq(businessClaimRequests.id, id)).get();
    if (!claim) return fail(res, 404, "Claim not found", "NOT_FOUND");
    db.update(businessClaimRequests).set({
      status: parsed.status,
      reviewNotes: parsed.reviewNotes || null,
      reviewedByAdminId: req.currentUser!.id,
      reviewedAt: new Date().toISOString(),
    }).where(eq(businessClaimRequests.id, id)).run();
    logAdminActivity(req.currentUser!.id, "claim_reviewed", "claim_request", id, `${parsed.status === "dismissed" ? "Dismissed" : "Updated"} claim ${claim.businessName}.`);
    return ok(res, { success: true });
  });

  app.patch("/api/admin/subscriptions/:businessId", authRequired("admin"), (req, res) => {
    const businessId = Number(req.params.businessId);
    if (Number.isNaN(businessId)) return fail(res, 400, "Invalid business id", "INVALID_ID");
    const parsed = validate(res, businessSubscriptionUpdateSchema, req.body);
    if (!parsed) return;
    const business = db.select().from(businesses).where(eq(businesses.id, businessId)).get();
    if (!business) return fail(res, 404, "Business not found", "NOT_FOUND");
    createOrUpdateSubscription(businessId, {
      plan: parsed.plan,
      interval: parsed.interval,
      status: parsed.status ?? "active",
      endsAt: parsed.status === "cancelled" ? new Date().toISOString() : null,
    });
    logAdminActivity(req.currentUser!.id, "subscription_updated", "business", businessId, `Updated subscription for ${business.name}.`);
    return ok(res, { success: true });
  });

  app.patch("/api/admin/support/conversations/:id/triage", authRequired("admin"), (req, res) => {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) return fail(res, 400, "Invalid support conversation id", "INVALID_ID");
    const parsed = validate(res, supportConversationTriageInputSchema, req.body);
    if (!parsed) return;
    const conversation = db.select().from(supportConversations).where(eq(supportConversations.id, id)).get();
    if (!conversation) return fail(res, 404, "Support conversation not found", "NOT_FOUND");
    db.update(supportConversations).set({
      status: parsed.status,
      priority: parsed.priority,
      category: parsed.category,
      assignedAdminId: parsed.assignedAdminId ?? req.currentUser!.id,
      internalNotes: parsed.internalNotes || null,
      resolvedAt: parsed.status === "resolved" ? new Date().toISOString() : null,
      updatedAt: new Date().toISOString(),
    }).where(eq(supportConversations.id, id)).run();
    logAdminActivity(req.currentUser!.id, "support_triaged", "support_conversation", id, `Updated support conversation #${id}.`);
    return ok(res, { conversation: getSupportConversationDetail(id, req.currentUser!.role) });
  });

  app.use((req, res, next) => {
    if (!req.path.startsWith("/api")) return next();
    return fail(res, 404, "API endpoint not found", "NOT_FOUND");
  });

  if (!schedulerStarted) {
    schedulerStarted = true;
    setInterval(() => processScheduledWork(), 30_000);
  }

  return app;
}
