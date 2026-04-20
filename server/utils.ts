import { and, desc, eq, inArray, sql } from "drizzle-orm";
import type {
  BusinessCapability,
  BusinessClaimRequest,
  ChatMessage,
  ConversationCloseReason,
  ConversationDetail,
  ConversationStatus,
  ConversationSummary,
  Appointment,
  AuthUser,
  BestTimeWindow,
  BusinessDetail,
  BusinessHour,
  BusinessListQuery,
  BusinessMapMarker,
  BusinessNotice,
  BusinessSubscription,
  BusinessService,
  BusinessSummary,
  FeedbackItem,
  NotificationItem,
  QueueEntry,
  QueueGuestActionAvailability,
  QueueOwnerActionAvailability,
  QueueEvent,
  QueueRealtimeEvent,
  ReceiptItem,
  ReceiptVisitType,
  QueueStatus,
  SavedPlace,
  ServiceCounter,
  StaffMember,
  TrustSummary,
  UserDashboard,
  UserPreferences,
  VisitHistoryItem,
  OwnerEligibleReceiptVisit,
} from "../shared/api";
import {
  getConversationContextLabel as getSharedConversationContextLabel,
  getPauseExpiredCopy,
  getQueueStatusPresentation,
} from "../shared/queueCopy";
import { db } from "./db";
import { broadcastEvent } from "./realtime";
import {
  appointments,
  businessCategories,
  businessHours,
  businessNotices,
  businesses,
  businessClaimRequests,
  businessServices,
  businessSubscriptions,
  favorites,
  notifications,
  queueEntries,
  queueEvents,
  savedPlaces,
  serviceCounters,
  staffMembers,
  userPreferences,
  users,
  visitFeedback,
  visitReceipts,
  conversations,
  messages,
} from "./schema";

export const FIXED_QUEUE_PAUSE_LIMIT_MINUTES = 30;
export const DEFAULT_USER_PREFERENCES: UserPreferences = {
  emailSummaries: true,
  desktopNotifications: true,
  aiAssistant: true,
  travelTips: true,
};

const SHORT_WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;
export const SUBSCRIPTION_PLANS = [
  {
    plan: "starter",
    name: "Starter",
    description: "A simple beginning for smaller teams moving away from long physical lines.",
    monthlyLabel: "Monthly plan",
    yearlyLabel: "Yearly plan",
    highlights: ["Remote queueing", "Appointment handling", "Business profile"],
  },
  {
    plan: "growth",
    name: "Growth",
    description: "For growing businesses that want stronger guest communication and visibility.",
    monthlyLabel: "Monthly plan",
    yearlyLabel: "Yearly plan",
    highlights: ["Everything in Starter", "Guest messaging", "Service and counter setup"],
  },
  {
    plan: "premium",
    name: "Premium",
    description: "For teams that want the fullest Smart Queue directory presence and queue operations toolkit.",
    monthlyLabel: "Monthly plan",
    yearlyLabel: "Yearly plan",
    highlights: ["Everything in Growth", "Priority directory presence", "Advanced operations support"],
  },
] as const;

function parseJsonArray(value: string | null | undefined): number[] {
  try {
    const parsed = JSON.parse(value ?? "[]");
    return Array.isArray(parsed) ? parsed.map(Number) : [];
  } catch {
    return [];
  }
}

function parseStringArray(value: string | null | undefined): string[] {
  try {
    const parsed = JSON.parse(value ?? "[]");
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

function timeToMinutes(value: string) {
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
}

type ConversationListView = "active" | "archive" | "all";

function getConversationContextLabel(conversation: typeof conversations.$inferSelect) {
  if (conversation.contextLabel) return conversation.contextLabel;
  return getSharedConversationContextLabel(
    conversation.visitType as "pre_visit" | "queue" | "appointment",
    conversation.status === "active" ? "active" : "closed",
    (conversation.closeReason as ConversationCloseReason | null | undefined) ?? null,
  );
}

function includeConversationInView(status: string, view: ConversationListView) {
  if (view === "all") return true;
  if (view === "active") return status === "active";
  return status === "closed" || status === "archived";
}

function toConversationSummary(
  conversation: typeof conversations.$inferSelect,
  businessName: string,
  userName: string,
  unreadCount: number,
): ConversationSummary {
  const latest = db
    .select()
    .from(messages)
    .where(eq(messages.conversationId, conversation.id))
    .orderBy(desc(messages.createdAt))
    .get();

  return {
    id: conversation.id,
    businessId: conversation.businessId,
    businessName,
    userId: conversation.userId,
    userName,
    status: (conversation.status as ConversationStatus) ?? "active",
    visitType: (conversation.visitType as ConversationSummary["visitType"]) ?? "pre_visit",
    queueEntryId: conversation.queueEntryId ?? null,
    appointmentId: conversation.appointmentId ?? null,
    latestMessage: latest?.body ?? null,
    latestMessageAt: latest?.createdAt ?? null,
    unreadCount,
    contextLabel: getConversationContextLabel(conversation),
    closeReason: (conversation.closeReason as ConversationSummary["closeReason"]) ?? null,
    closedAt: conversation.closedAt ?? null,
    archivedAt: conversation.archivedAt ?? null,
  };
}

export function calculateDistanceKm(lat1: number, lng1: number, lat2: number, lng2: number) {
  const toRad = (value: number) => (value * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Number((R * c).toFixed(1));
}

export function isBusinessOpen(hours: BusinessHour[], date = new Date()) {
  const today = hours.find((item) => item.dayOfWeek === date.getDay());
  if (!today || today.isClosed) return false;
  const currentMinutes = date.getHours() * 60 + date.getMinutes();
  return currentMinutes >= timeToMinutes(today.openTime) && currentMinutes <= timeToMinutes(today.closeTime);
}

type BaseBusinessRow = typeof businesses.$inferSelect & {
  category: string;
};

function getServiceName(serviceId: number | null | undefined) {
  if (serviceId == null) return null;
  return db.select({ name: businessServices.name }).from(businessServices).where(eq(businessServices.id, serviceId)).get()?.name ?? null;
}

export function createNotification(userId: number, type: string, title: string, message: string) {
  db.insert(notifications).values({
    userId,
    type,
    severity: "info",
    category: null,
    title,
    message,
    isRead: false,
    readAt: null,
    createdAt: new Date().toISOString(),
  }).run();
}

export function createDetailedNotification(
  userId: number,
  input: {
    type: string;
    title: string;
    message: string;
    severity?: NotificationItem["severity"];
    category?: string | null;
    createdAt?: string;
  },
) {
  db.insert(notifications).values({
    userId,
    type: input.type,
    severity: input.severity ?? "info",
    category: input.category ?? null,
    title: input.title,
    message: input.message,
    isRead: false,
    readAt: null,
    createdAt: input.createdAt ?? new Date().toISOString(),
  }).run();
}

export function addQueueEvent(queueEntryId: number, eventType: string, label: string, createdAt = new Date().toISOString()) {
  db.insert(queueEvents).values({ queueEntryId, eventType, label, createdAt }).run();
}

export function getBusinessSubscription(businessId: number): BusinessSubscription {
  const row = db.select().from(businessSubscriptions).where(eq(businessSubscriptions.businessId, businessId)).get();
  if (!row) {
    return {
      businessId,
      plan: "starter",
      interval: "monthly",
      status: "trial",
      startedAt: new Date().toISOString(),
      nextBillingAt: null,
      endsAt: null,
    };
  }
  return {
    businessId: row.businessId,
    plan: row.plan as BusinessSubscription["plan"],
    interval: row.interval as BusinessSubscription["interval"],
    status: row.status as BusinessSubscription["status"],
    startedAt: row.startedAt,
    nextBillingAt: row.nextBillingAt ?? null,
    endsAt: row.endsAt ?? null,
  };
}

export function getAllBusinessSubscriptions(): BusinessSubscription[] {
  return db.select().from(businessSubscriptions).all().map((row) => ({
    businessId: row.businessId,
    plan: row.plan as BusinessSubscription["plan"],
    interval: row.interval as BusinessSubscription["interval"],
    status: row.status as BusinessSubscription["status"],
    startedAt: row.startedAt,
    nextBillingAt: row.nextBillingAt ?? null,
    endsAt: row.endsAt ?? null,
  }));
}

export function getClaimRequests(): BusinessClaimRequest[] {
  return db
    .select({
      claim: businessClaimRequests,
      requesterName: users.name,
      requesterEmail: users.email,
      reviewedByAdminName: sql<string | null>`(
        select name from users as reviewed_admin where reviewed_admin.id = ${businessClaimRequests.reviewedByAdminId}
      )`,
    })
    .from(businessClaimRequests)
    .innerJoin(users, eq(businessClaimRequests.requestedByUserId, users.id))
    .orderBy(desc(businessClaimRequests.createdAt))
    .all()
    .map(({ claim, requesterName, requesterEmail, reviewedByAdminName }) => ({
      id: claim.id,
      provider: claim.provider,
      placeId: claim.placeId,
      businessName: claim.businessName,
      category: claim.category as BusinessClaimRequest["category"],
      address: claim.address,
      phone: claim.phone ?? null,
      email: claim.email ?? null,
      websiteUrl: claim.websiteUrl ?? null,
      latitude: claim.latitude,
      longitude: claim.longitude,
      imageUrl: claim.imageUrl,
      requestedByUserId: claim.requestedByUserId,
      requestedByName: requesterName,
      requestedByEmail: requesterEmail,
      status: claim.status as BusinessClaimRequest["status"],
      reviewNotes: claim.reviewNotes ?? null,
      reviewedByAdminId: claim.reviewedByAdminId ?? null,
      reviewedByAdminName: reviewedByAdminName ?? null,
      reviewedAt: claim.reviewedAt ?? null,
      createdAt: claim.createdAt,
    }));
}

export function getUserById(userId: number): AuthUser | null {
  const user = db.select().from(users).where(eq(users.id, userId)).get();
  if (!user || user.accountStatus === "suspended") return null;
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role as AuthUser["role"],
    businessId: user.businessId ?? null,
  };
}

export function getBusinessHoursByBusinessId() {
  const rows = db.select().from(businessHours).all();
  const map = new Map<number, BusinessHour[]>();
  rows.forEach((row) => {
    const list = map.get(row.businessId) ?? [];
    list.push({
      dayOfWeek: row.dayOfWeek,
      openTime: row.openTime,
      closeTime: row.closeTime,
      isClosed: !!row.isClosed,
    });
    map.set(row.businessId, list);
  });
  return map;
}

export function getServiceMapByBusinessId() {
  const rows = db.select().from(businessServices).all();
  const map = new Map<number, BusinessService[]>();
  rows.forEach((row) => {
    const list = map.get(row.businessId) ?? [];
    list.push({
      id: row.id,
      businessId: row.businessId,
      name: row.name,
      description: row.description,
      averageServiceMinutes: row.averageServiceMinutes,
      maxActiveQueue: row.maxActiveQueue,
      supportsAppointments: !!row.supportsAppointments,
      isActive: !!row.isActive,
      estimatedWaitMinutes: 0,
    });
    map.set(row.businessId, list);
  });
  return map;
}

export function getCounterMapByBusinessId() {
  const rows = db.select().from(serviceCounters).all();
  const map = new Map<number, ServiceCounter[]>();
  rows.forEach((row) => {
    const list = map.get(row.businessId) ?? [];
    list.push({
      id: row.id,
      businessId: row.businessId,
      name: row.name,
      status: row.status as ServiceCounter["status"],
      activeServiceIds: parseJsonArray(row.activeServiceIdsJson),
      assignedStaffName: row.assignedStaffName ?? null,
    });
    map.set(row.businessId, list);
  });
  return map;
}

export function getStaffMapByBusinessId() {
  const rows = db.select().from(staffMembers).all();
  const map = new Map<number, StaffMember[]>();
  rows.forEach((row) => {
    const list = map.get(row.businessId) ?? [];
    list.push({
      id: row.id,
      businessId: row.businessId,
      name: row.name,
      roleLabel: row.roleLabel,
      status: row.status as StaffMember["status"],
      activeCounterId: row.activeCounterId ?? null,
    });
    map.set(row.businessId, list);
  });
  return map;
}

export function getNoticeMapByBusinessId() {
  const rows = db.select().from(businessNotices).all();
  const map = new Map<number, BusinessNotice[]>();
  rows.forEach((row) => {
    const list = map.get(row.businessId) ?? [];
    list.push({
      id: row.id,
      businessId: row.businessId,
      title: row.title,
      message: row.message,
      severity: row.severity as BusinessNotice["severity"],
      isActive: !!row.isActive,
      createdAt: row.createdAt,
    });
    map.set(row.businessId, list);
  });
  return map;
}

export function getFeedbackByBusinessId() {
  const rows = db
    .select({
      feedback: visitFeedback,
      userName: users.name,
      businessName: businesses.name,
      serviceName: businessServices.name,
    })
    .from(visitFeedback)
    .innerJoin(users, eq(visitFeedback.userId, users.id))
    .innerJoin(businesses, eq(visitFeedback.businessId, businesses.id))
    .leftJoin(queueEntries, eq(visitFeedback.queueEntryId, queueEntries.id))
    .leftJoin(businessServices, eq(queueEntries.serviceId, businessServices.id))
    .orderBy(desc(visitFeedback.createdAt))
    .all();
  const map = new Map<number, FeedbackItem[]>();
  rows.forEach(({ feedback, userName, serviceName }) => {
    const list = map.get(feedback.businessId) ?? [];
    list.push({
      id: feedback.id,
      businessId: feedback.businessId,
      userName,
      rating: feedback.rating,
      comment: feedback.comment,
      ownerReply: feedback.ownerReply ?? null,
      createdAt: feedback.createdAt,
      visitLabel: serviceName ? `${serviceName} visit` : "Completed visit",
    });
    map.set(feedback.businessId, list);
  });
  return map;
}

export function getTrustSummary(feedbackItems: FeedbackItem[]): TrustSummary {
  const totalReviews = feedbackItems.length;
  const averageRating = totalReviews
    ? Number((feedbackItems.reduce((sum, item) => sum + item.rating, 0) / totalReviews).toFixed(1))
    : 0;
  return {
    averageRating,
    totalReviews,
    recentFeedback: feedbackItems.slice(0, 3),
  };
}

export function getBestTimeWindows(businessId: number): BestTimeWindow[] {
  const rows = db
    .select({
      hour: sql<number>`cast(strftime('%H', ${queueEntries.joinedAt}) as integer)`,
      averageWait: sql<number>`cast(avg(${queueEntries.estimatedWaitMinutes}) as integer)`,
    })
    .from(queueEntries)
    .where(eq(queueEntries.businessId, businessId))
    .groupBy(sql`strftime('%H', ${queueEntries.joinedAt})`)
    .orderBy(sql`avg(${queueEntries.estimatedWaitMinutes}) asc`)
    .limit(3)
    .all();
  if (!rows.length) {
    return [
      { label: "Morning", averageWaitMinutes: 12 },
      { label: "Afternoon", averageWaitMinutes: 18 },
      { label: "Evening", averageWaitMinutes: 22 },
    ];
  }
  return rows.map((row) => ({
    label: `${String(row.hour).padStart(2, "0")}:00`,
    averageWaitMinutes: row.averageWait ?? 0,
  }));
}

export async function getBusinessRows(currentUserId?: number, query?: BusinessListQuery) {
  const rows = db
    .select({
      id: businesses.id,
      slug: businesses.slug,
      name: businesses.name,
      categoryId: businesses.categoryId,
      description: businesses.description,
      address: businesses.address,
      phone: businesses.phone,
      email: businesses.email,
      latitude: businesses.latitude,
      longitude: businesses.longitude,
      rating: businesses.rating,
      reviewsCount: businesses.reviewsCount,
      imageUrl: businesses.imageUrl,
      websiteUrl: businesses.websiteUrl,
      tagsJson: businesses.tagsJson,
      source: businesses.source,
      externalProvider: businesses.externalProvider,
      externalPlaceId: businesses.externalPlaceId,
      averageServiceMinutes: businesses.averageServiceMinutes,
      maxSkips: businesses.maxSkips,
      maxReschedules: businesses.maxReschedules,
      pauseLimitMinutes: businesses.pauseLimitMinutes,
      bookingHorizonDays: businesses.bookingHorizonDays,
      isQueueOpen: businesses.isQueueOpen,
      supportsReceipts: businesses.supportsReceipts,
      createdAt: businesses.createdAt,
      updatedAt: businesses.updatedAt,
      category: businessCategories.slug,
    })
    .from(businesses)
    .innerJoin(businessCategories, eq(businesses.categoryId, businessCategories.id))
    .all() as BaseBusinessRow[];

  const hoursMap = getBusinessHoursByBusinessId();
  const servicesMap = getServiceMapByBusinessId();
  const countersMap = getCounterMapByBusinessId();
  const noticesMap = getNoticeMapByBusinessId();
  const feedbackMap = getFeedbackByBusinessId();
  const favoritesRows = currentUserId ? db.select().from(favorites).where(eq(favorites.userId, currentUserId)).all() : [];
  const savedRows = currentUserId ? db.select().from(savedPlaces).where(eq(savedPlaces.userId, currentUserId)).all() : [];
  const favoriteIds = new Set(favoritesRows.map((row) => row.businessId));
  const savedIds = new Set(savedRows.map((row) => row.businessId));
  const favoriteCountMap = new Map<number, number>();
  db.select().from(favorites).all().forEach((row) => {
    favoriteCountMap.set(row.businessId, (favoriteCountMap.get(row.businessId) ?? 0) + 1);
  });

  const queueRows = db.select().from(queueEntries).where(inArray(queueEntries.status, ["waiting", "called", "paused", "in_service", "delayed"])).all();
  const activeCountMap = new Map<number, number>();
  const currentServingMap = new Map<number, number>();
  const serviceWaitMap = new Map<number, number>();
  const serviceActiveCountMap = new Map<number, number>();
  queueRows.forEach((row) => {
    activeCountMap.set(row.businessId, (activeCountMap.get(row.businessId) ?? 0) + 1);
    if (row.status === "called" || row.status === "in_service") {
      currentServingMap.set(row.businessId, row.id);
    }
    if (row.serviceId) {
      serviceWaitMap.set(row.serviceId, (serviceWaitMap.get(row.serviceId) ?? 0) + 1);
      serviceActiveCountMap.set(row.serviceId, (serviceActiveCountMap.get(row.serviceId) ?? 0) + 1);
    }
  });

  let result = rows.map((row) => {
    const services = (servicesMap.get(row.id) ?? []).map((service) => ({
      ...service,
      currentActiveQueue: serviceActiveCountMap.get(service.id) ?? 0,
      isAtCapacity: (serviceActiveCountMap.get(service.id) ?? 0) >= service.maxActiveQueue,
      estimatedWaitMinutes: (serviceWaitMap.get(service.id) ?? 0) * service.averageServiceMinutes,
    }));
    const feedbackItems = feedbackMap.get(row.id) ?? [];
    return {
      ...row,
      tags: parseStringArray(row.tagsJson),
      hours: hoursMap.get(row.id) ?? [],
      services,
      counters: countersMap.get(row.id) ?? [],
      notices: (noticesMap.get(row.id) ?? []).filter((notice) => notice.isActive),
      feedbackItems,
      trustSummary: getTrustSummary(feedbackItems),
      favoritesCount: favoriteCountMap.get(row.id) ?? 0,
      activeQueueCount: activeCountMap.get(row.id) ?? 0,
      currentServingQueueEntryId: currentServingMap.get(row.id) ?? null,
      isFavorite: favoriteIds.has(row.id),
      isSaved: savedIds.has(row.id),
      distanceKm:
        query?.lat != null && query?.lng != null
          ? calculateDistanceKm(query.lat, query.lng, row.latitude, row.longitude)
          : null,
    };
  });

  if (query?.q) {
    const needle = query.q.toLowerCase();
    result = result.filter((row) =>
      [row.name, row.description, row.address, row.category, ...row.tags, ...row.services.map((service) => service.name)]
        .join(" ")
        .toLowerCase()
        .includes(needle),
    );
  }
  if (query?.category) result = result.filter((row) => row.category === query.category);
  if (query?.serviceId) result = result.filter((row) => row.services.some((service) => service.id === query.serviceId));
  if (query?.openNow) result = result.filter((row) => isBusinessOpen(row.hours));
  if (query?.favoritesOnly) result = result.filter((row) => row.isFavorite);
  if (query?.savedOnly) result = result.filter((row) => row.isSaved);

  switch (query?.sort) {
    case "distance":
      result.sort((a, b) => (a.distanceKm ?? 999999) - (b.distanceKm ?? 999999));
      break;
    case "rating":
      result.sort((a, b) => b.trustSummary.averageRating - a.trustSummary.averageRating);
      break;
    case "wait":
      result.sort((a, b) => a.averageServiceMinutes * Math.max(1, a.activeQueueCount) - b.averageServiceMinutes * Math.max(1, b.activeQueueCount));
      break;
    default:
      result.sort((a, b) => {
        const scoreA = a.trustSummary.averageRating * 10 + a.favoritesCount + (isBusinessOpen(a.hours) ? 10 : 0);
        const scoreB = b.trustSummary.averageRating * 10 + b.favoritesCount + (isBusinessOpen(b.hours) ? 10 : 0);
        return scoreB - scoreA;
      });
  }
  return result;
}

export function toBusinessSummary(row: Awaited<ReturnType<typeof getBusinessRows>>[number]): BusinessSummary {
  const openNow = isBusinessOpen(row.hours);
  const capabilities: BusinessCapability = {
    supportsRemoteQueue: row.source !== "external",
    supportsAppointments: row.services.some((service) => service.supportsAppointments),
    supportsReceipts: row.supportsReceipts,
    isClaimable: !row.externalPlaceId,
  };
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    category: row.category as BusinessSummary["category"],
    description: row.description,
    address: row.address,
    phone: row.phone ?? null,
    email: row.email ?? null,
    latitude: row.latitude,
    longitude: row.longitude,
    rating: row.rating,
    reviewsCount: row.reviewsCount,
    imageUrl: row.imageUrl,
    websiteUrl: row.websiteUrl ?? null,
    tags: row.tags,
    source: (row.source as BusinessSummary["source"]) ?? "local",
    externalProvider: row.externalProvider && row.externalPlaceId ? { provider: row.externalProvider, placeId: row.externalPlaceId } : null,
    linkedBusinessId: null,
    capabilities,
    isOpenNow: openNow,
    distanceKm: row.distanceKm,
    favoritesCount: row.favoritesCount,
    activeQueueCount: row.activeQueueCount,
    estimatedWaitMinutes: row.services.length ? Math.min(...row.services.map((service) => service.estimatedWaitMinutes)) : row.averageServiceMinutes * Math.max(0, row.activeQueueCount),
    isFavorite: row.isFavorite,
    isSaved: row.isSaved,
    queueSettings: {
      averageServiceMinutes: row.averageServiceMinutes,
      maxSkips: row.maxSkips,
      maxReschedules: row.maxReschedules,
      pauseLimitMinutes: row.pauseLimitMinutes,
      bookingHorizonDays: row.bookingHorizonDays,
      isQueueOpen: row.isQueueOpen,
    },
    serviceHighlights: row.services.slice(0, 3),
    trustSummary: row.trustSummary,
  };
}

export function toBusinessDetail(row: Awaited<ReturnType<typeof getBusinessRows>>[number], recommendedDepartureMinutes: number | null = null): BusinessDetail {
  return {
    ...toBusinessSummary(row),
    hours: row.hours,
    currentServingQueueEntryId: row.currentServingQueueEntryId,
    services: row.services,
    counters: row.counters,
    notices: row.notices,
    bestTimeWindows: getBestTimeWindows(row.id),
    recommendedDepartureMinutes,
    subscription: getBusinessSubscription(row.id),
  };
}

export function toBusinessMapMarker(row: Awaited<ReturnType<typeof getBusinessRows>>[number]): BusinessMapMarker {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    category: row.category as BusinessMapMarker["category"],
    latitude: row.latitude,
    longitude: row.longitude,
    isOpenNow: isBusinessOpen(row.hours),
    estimatedWaitMinutes: toBusinessSummary(row).estimatedWaitMinutes,
  };
}

export function getQueueTimeline(queueEntryId: number): QueueEvent[] {
  return db.select().from(queueEvents).where(eq(queueEvents.queueEntryId, queueEntryId)).orderBy(queueEvents.createdAt).all().map((row) => ({
    id: row.id,
    queueEntryId: row.queueEntryId,
    eventType: row.eventType,
    label: row.label,
    createdAt: row.createdAt,
  }));
}

function createQueueActionAvailability(allowed: boolean, reason: string | null = null) {
  return { allowed, reason } as const;
}

function getPauseLimitMinutes(entry: typeof queueEntries.$inferSelect) {
  return db.select({ pauseLimitMinutes: businesses.pauseLimitMinutes }).from(businesses).where(eq(businesses.id, entry.businessId)).get()?.pauseLimitMinutes ?? FIXED_QUEUE_PAUSE_LIMIT_MINUTES;
}

function getPauseExpiryIso(entry: typeof queueEntries.$inferSelect, pauseLimitMinutes: number) {
  if (!entry.pauseStartedAt) return null;
  const remainingSeconds = Math.max(0, pauseLimitMinutes * 60 - entry.totalPausedSeconds);
  return new Date(new Date(entry.pauseStartedAt).getTime() + remainingSeconds * 1000).toISOString();
}

export function expirePausedQueueEntry(entryId: number) {
  const row = db
    .select({ entry: queueEntries, pauseLimitMinutes: businesses.pauseLimitMinutes })
    .from(queueEntries)
    .innerJoin(businesses, eq(queueEntries.businessId, businesses.id))
    .where(eq(queueEntries.id, entryId))
    .get();
  if (!row || row.entry.status !== "paused" || !row.entry.pauseStartedAt) return false;
  const pauseStarted = new Date(row.entry.pauseStartedAt).getTime();
  const pausedSeconds = Math.floor((Date.now() - pauseStarted) / 1000);
  if (row.entry.totalPausedSeconds + pausedSeconds <= row.pauseLimitMinutes * 60) return false;
  const now = new Date().toISOString();
  db
    .update(queueEntries)
    .set({
      status: "delayed",
      pauseStartedAt: null,
      totalPausedSeconds: row.pauseLimitMinutes * 60,
      updatedAt: now,
    })
    .where(eq(queueEntries.id, entryId))
    .run();
  const copy = getPauseExpiredCopy();
  addQueueEvent(entryId, "pause-expired", copy.timelineLabel, now);
  createNotification(row.entry.userId, "queue-pause-expired", "Queue updated", copy.userMessage);
  db
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.businessId, row.entry.businessId), eq(users.role, "owner")))
    .all()
    .forEach((owner) => {
      createDetailedNotification(owner.id, {
        type: "queue-guest-pause-expired",
        title: "Guest queue change",
        message: copy.ownerMessage,
        severity: "warning",
        category: "queue",
      });
    });
  db
    .update(conversations)
    .set({
      contextLabel: getSharedConversationContextLabel("queue", "delayed"),
      updatedAt: now,
    })
    .where(and(eq(conversations.queueEntryId, entryId), eq(conversations.status, "active")))
    .run();
  const realtimeEvent: QueueRealtimeEvent = {
    entryId,
    businessId: row.entry.businessId,
    userId: row.entry.userId,
    status: "delayed",
    action: "pause-expired",
    changedAt: now,
    message: copy.realtimeMessage,
    queueOrderChanged: true,
    needsAssignmentAttention: true,
    affectsJoinAvailability: false,
  };
  broadcastEvent({
    type: "queue:update",
    payload: realtimeEvent,
    businessId: row.entry.businessId,
    userId: row.entry.userId,
  });
  return true;
}

function normalizePausedEntriesForBusiness(businessId: number) {
  const pausedEntries = db
    .select({ id: queueEntries.id })
    .from(queueEntries)
    .where(and(eq(queueEntries.businessId, businessId), eq(queueEntries.status, "paused")))
    .all();
  let changed = false;
  pausedEntries.forEach((entry) => {
    changed = expirePausedQueueEntry(entry.id) || changed;
  });
  return changed;
}

function getQueueSortWeight(status: QueueStatus) {
  switch (status) {
    case "called":
      return 0;
    case "in_service":
      return 1;
    case "waiting":
      return 2;
    case "delayed":
      return 3;
    case "paused":
      return 4;
    default:
      return 5;
  }
}

function getQueueOrderingValue(entry: typeof queueEntries.$inferSelect) {
  return entry.queueOrderKey || `${entry.joinedAt}#${String(entry.id).padStart(10, "0")}`;
}

export function getQueueActionAvailability(
  entry: typeof queueEntries.$inferSelect,
  pauseLimitMinutes: number,
  maxSkips = Number.POSITIVE_INFINITY,
  maxReschedules = Number.POSITIVE_INFINITY,
) {
  const pauseExpired = entry.status === "paused" && Boolean(getPauseExpiryIso(entry, pauseLimitMinutes) && new Date(getPauseExpiryIso(entry, pauseLimitMinutes)!).getTime() <= Date.now());
  const skipLimitReached = entry.skipsUsed >= maxSkips;
  const rescheduleLimitReached = entry.reschedulesUsed >= maxReschedules;
  const availableGuestActions: QueueGuestActionAvailability = {
    canPause: createQueueActionAvailability(entry.status === "waiting", entry.status === "waiting" ? null : "Only waiting guests can pause their place."),
    canResume: createQueueActionAvailability(entry.status === "paused" && !pauseExpired, pauseExpired ? "Your hold expired. Rejoin later to return to the live line." : entry.status === "paused" ? null : "Only paused guests can resume."),
    canSkip: createQueueActionAvailability(
      ["waiting", "paused"].includes(entry.status) && !skipLimitReached,
      skipLimitReached
        ? `You already used all ${maxSkips} skip ${maxSkips === 1 ? "opportunity" : "opportunities"} for this visit.`
        : ["waiting", "paused"].includes(entry.status)
          ? null
          : "You can only skip while waiting or paused.",
    ),
    canReschedule: createQueueActionAvailability(
      ["waiting", "paused", "delayed"].includes(entry.status) && !rescheduleLimitReached,
      rescheduleLimitReached
        ? `You already used all ${maxReschedules} rejoin ${maxReschedules === 1 ? "opportunity" : "opportunities"} for this visit.`
        : ["waiting", "paused", "delayed"].includes(entry.status)
          ? null
          : "You can only rejoin later before service starts.",
    ),
    canCancel: createQueueActionAvailability(entry.status !== "in_service", entry.status !== "in_service" ? null : "You cannot cancel once service has started."),
  };

  const hasAssignment = Boolean(entry.serviceId && entry.counterId && entry.staffName?.trim());
  const availableOwnerActions: QueueOwnerActionAvailability = {
    canCall: createQueueActionAvailability(["waiting", "delayed"].includes(entry.status), ["waiting", "delayed"].includes(entry.status) ? null : "Only waiting or delayed guests can be called."),
    canStartService: createQueueActionAvailability(entry.status === "called" && hasAssignment, entry.status !== "called" ? "Only called guests can move into service." : hasAssignment ? null : "Assign a service, counter, and staff member first."),
    canComplete: createQueueActionAvailability(entry.status === "in_service", entry.status === "in_service" ? null : "Only guests already in service can be completed."),
    canDelay: createQueueActionAvailability(["waiting", "called"].includes(entry.status), ["waiting", "called"].includes(entry.status) ? null : "Only waiting or called guests can be delayed."),
    canNoShow: createQueueActionAvailability(["waiting", "called", "delayed"].includes(entry.status), ["waiting", "called", "delayed"].includes(entry.status) ? null : "Only waiting, called, or delayed guests can be marked no-show."),
    canAssign: createQueueActionAvailability(entry.status !== "in_service" && entry.status !== "completed" && entry.status !== "cancelled" && entry.status !== "no_show", entry.status !== "in_service" && entry.status !== "completed" && entry.status !== "cancelled" && entry.status !== "no_show" ? null : "Assignment can only change while the visit is still active."),
  };

  return { availableGuestActions, availableOwnerActions };
}

function getQueueStatusCopy(entry: typeof queueEntries.$inferSelect, pauseLimitMinutes: number) {
  const pauseExpiresAt = getPauseExpiryIso(entry, pauseLimitMinutes);
  const presentation = getQueueStatusPresentation(entry.status as QueueStatus);
  return {
    statusLabel: presentation.label,
    statusDescription:
      entry.status === "paused" && pauseExpiresAt
        ? `${presentation.description} Resume before ${new Date(pauseExpiresAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}.`
        : presentation.description,
    pauseExpiresAt,
  };
}

export function revalidateQueueForBusiness(businessId: number) {
  normalizePausedEntriesForBusiness(businessId);
  const services = db.select().from(businessServices).where(eq(businessServices.businessId, businessId)).all();
  const grouped = new Map<number | null, typeof queueEntries.$inferSelect[]>();
  const activeEntries = db
    .select()
    .from(queueEntries)
    .where(and(eq(queueEntries.businessId, businessId), inArray(queueEntries.status, ["waiting", "called", "paused", "in_service", "delayed"])))
    .all();
  activeEntries.forEach((entry) => {
    const list = grouped.get(entry.serviceId ?? null) ?? [];
    list.push(entry);
    grouped.set(entry.serviceId ?? null, list);
  });
  grouped.forEach((entries, serviceId) => {
    const serviceMinutes = services.find((service) => service.id === serviceId)?.averageServiceMinutes ?? 15;
    entries
      .sort((left, right) => {
        const statusWeight = getQueueSortWeight(left.status as QueueStatus) - getQueueSortWeight(right.status as QueueStatus);
        if (statusWeight !== 0) return statusWeight;
        return getQueueOrderingValue(left).localeCompare(getQueueOrderingValue(right));
      })
      .forEach((entry, index) => {
        const queueIndex =
          entry.status === "called" || entry.status === "in_service"
            ? 0
            : entry.status === "waiting"
              ? index
              : entry.status === "delayed"
                ? index + 1
                : index + 2;
      db.update(queueEntries)
        .set({
          estimatedWaitMinutes: entry.status === "called" || entry.status === "in_service" ? 0 : queueIndex * serviceMinutes,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(queueEntries.id, entry.id))
        .run();
      });
  });
}

function getOwnerSetupWarnings(
  business: typeof businesses.$inferSelect | undefined,
  hours: BusinessHour[],
  services: BusinessService[],
  counters: ServiceCounter[],
) {
  const warnings: string[] = [];
  if (!business) return ["Business profile could not be loaded."];
  if (!hours.length || hours.every((hour) => hour.isClosed)) {
    warnings.push("Posted hours are incomplete. Guests cannot reliably tell when you are open.");
  }
  if (!services.some((service) => service.isActive)) {
    warnings.push("No active services are available. Guests will have nothing clear to join or book.");
  }
  if (!counters.some((counter) => counter.status !== "offline")) {
    warnings.push("No counters are ready for work. Queue operations will bottleneck quickly.");
  }
  if (business.isQueueOpen && !counters.some((counter) => counter.status === "open")) {
    warnings.push("Queue joins are open, but no counter is marked open for service.");
  }
  return warnings;
}

function getOwnerOperationsSummary(input: {
  queueOpen: boolean;
  waitingCount: number;
  delayedCount: number;
  unassignedCount: number;
  pendingAppointments: number;
  unreadConversationCount: number;
  unresolvedNegativeFeedbackCount: number;
  setupWarnings: string[];
}) {
  if (input.setupWarnings.length > 0) {
    return {
      kind: "setup" as const,
      title: "Fix business setup before service slows down",
      message: input.setupWarnings[0],
      primaryActionLabel: "Open settings",
      primaryActionHref: "/business-dashboard/settings",
      secondaryActionLabel: "Review services",
      secondaryActionHref: "/business-dashboard/services",
    };
  }
  if (!input.queueOpen) {
    return {
      kind: "queue_attention" as const,
      title: "Queue joins are paused",
      message: "Guests cannot enter the live queue until you reopen it.",
      primaryActionLabel: "Open queue controls",
      primaryActionHref: "/business-dashboard/queue",
      secondaryActionLabel: "Review today view",
      secondaryActionHref: "/business-dashboard",
    };
  }
  if (input.delayedCount > 0 || input.unassignedCount > 0) {
    return {
      kind: "queue_attention" as const,
      title: "Queue flow needs attention",
      message:
        input.delayedCount > 0
          ? `${input.delayedCount} guest ${input.delayedCount === 1 ? "is" : "are"} delayed and may need a manual follow-up.`
          : `${input.unassignedCount} waiting ${input.unassignedCount === 1 ? "guest is" : "guests are"} missing a clear assignment.`,
      primaryActionLabel: "Review queue",
      primaryActionHref: "/business-dashboard/queue",
      secondaryActionLabel: "Open messages",
      secondaryActionHref: "/business-dashboard/messages",
    };
  }
  if (input.pendingAppointments > 0) {
    return {
      kind: "appointments" as const,
      title: "Appointments need review",
      message: `${input.pendingAppointments} appointment ${input.pendingAppointments === 1 ? "is" : "are"} waiting for an owner decision.`,
      primaryActionLabel: "Review appointments",
      primaryActionHref: "/business-dashboard/appointments",
      secondaryActionLabel: "Open today view",
      secondaryActionHref: "/business-dashboard",
    };
  }
  if (input.unresolvedNegativeFeedbackCount > 0) {
    return {
      kind: "feedback" as const,
      title: "A guest review needs a response",
      message: `${input.unresolvedNegativeFeedbackCount} low-rated review ${input.unresolvedNegativeFeedbackCount === 1 ? "is" : "are"} still awaiting a public reply.`,
      primaryActionLabel: "Reply to feedback",
      primaryActionHref: "/business-dashboard/feedback",
      secondaryActionLabel: "Open messages",
      secondaryActionHref: "/business-dashboard/messages",
    };
  }
  if (input.unreadConversationCount > 0) {
    return {
      kind: "messages" as const,
      title: "Guest conversations are active",
      message: `${input.unreadConversationCount} conversation ${input.unreadConversationCount === 1 ? "is" : "are"} still active and may need a reply.`,
      primaryActionLabel: "Open messages",
      primaryActionHref: "/business-dashboard/messages",
      secondaryActionLabel: "Open today view",
      secondaryActionHref: "/business-dashboard",
    };
  }
  return {
    kind: "steady" as const,
    title: "Operations are steady",
    message: "Queues, appointments, and staffing look healthy right now.",
    primaryActionLabel: "Open today view",
    primaryActionHref: "/business-dashboard",
    secondaryActionLabel: "Review analytics",
    secondaryActionHref: "/business-dashboard/analytics",
  };
}

export function getQueueEntriesForUser(userId: number): QueueEntry[] {
  const rows = db
    .select({
      entry: queueEntries,
      businessName: businesses.name,
      userName: users.name,
      pauseLimitMinutes: businesses.pauseLimitMinutes,
      maxSkips: businesses.maxSkips,
      maxReschedules: businesses.maxReschedules,
      serviceName: businessServices.name,
      counterName: serviceCounters.name,
    })
    .from(queueEntries)
    .innerJoin(businesses, eq(queueEntries.businessId, businesses.id))
    .innerJoin(users, eq(queueEntries.userId, users.id))
    .leftJoin(businessServices, eq(queueEntries.serviceId, businessServices.id))
    .leftJoin(serviceCounters, eq(queueEntries.counterId, serviceCounters.id))
    .where(and(eq(queueEntries.userId, userId), inArray(queueEntries.status, ["waiting", "called", "paused", "in_service", "delayed"])))
    .orderBy(desc(queueEntries.createdAt))
    .all();

  return rows.map(({ entry, businessName, userName, pauseLimitMinutes, maxSkips, maxReschedules, serviceName, counterName }) => {
    if (entry.status === "paused") {
      expirePausedQueueEntry(entry.id);
    }
    const refreshedEntry = db.select().from(queueEntries).where(eq(queueEntries.id, entry.id)).get() ?? entry;
    const serviceQueue = db
      .select()
      .from(queueEntries)
      .where(and(eq(queueEntries.businessId, refreshedEntry.businessId), eq(queueEntries.serviceId, refreshedEntry.serviceId), inArray(queueEntries.status, ["waiting", "called", "paused", "in_service", "delayed"])))
      .all()
      .sort((left, right) => {
        const statusWeight = getQueueSortWeight(left.status as QueueStatus) - getQueueSortWeight(right.status as QueueStatus);
        if (statusWeight !== 0) return statusWeight;
        return getQueueOrderingValue(left).localeCompare(getQueueOrderingValue(right));
      });
    const position =
      refreshedEntry.status === "paused"
        ? null
        : serviceQueue.filter((item) => item.status !== "paused").findIndex((item) => item.id === refreshedEntry.id);
    const queueMeta = getQueueStatusCopy(refreshedEntry, pauseLimitMinutes);
    const actionAvailability = getQueueActionAvailability(refreshedEntry, pauseLimitMinutes, maxSkips, maxReschedules);
    return {
      id: refreshedEntry.id,
      businessId: refreshedEntry.businessId,
      businessName,
      userId: refreshedEntry.userId,
      userName,
      status: refreshedEntry.status as QueueStatus,
      queueNumber: refreshedEntry.queueNumber,
      position: position >= 0 ? position + 1 : null,
      estimatedWaitMinutes: refreshedEntry.estimatedWaitMinutes,
      joinedAt: refreshedEntry.joinedAt,
      calledAt: refreshedEntry.calledAt ?? null,
      skipsUsed: refreshedEntry.skipsUsed,
      reschedulesUsed: refreshedEntry.reschedulesUsed,
      pauseLimitMinutes,
      pauseStartedAt: refreshedEntry.pauseStartedAt ?? null,
      pauseExpiresAt: queueMeta.pauseExpiresAt,
      totalPausedSeconds: refreshedEntry.totalPausedSeconds,
      serviceId: refreshedEntry.serviceId ?? null,
      serviceName: serviceName ?? null,
      counterId: refreshedEntry.counterId ?? null,
      counterName: counterName ?? null,
      staffName: refreshedEntry.staffName ?? null,
      statusLabel: queueMeta.statusLabel,
      statusDescription: queueMeta.statusDescription,
      availableGuestActions: actionAvailability.availableGuestActions,
      availableOwnerActions: actionAvailability.availableOwnerActions,
      timeline: getQueueTimeline(refreshedEntry.id),
    };
  });
}

export function getAppointmentsForUser(userId: number): Appointment[] {
  return db
    .select({
      appointment: appointments,
      businessName: businesses.name,
      userName: users.name,
      serviceName: businessServices.name,
    })
    .from(appointments)
    .innerJoin(businesses, eq(appointments.businessId, businesses.id))
    .innerJoin(users, eq(appointments.userId, users.id))
    .leftJoin(businessServices, eq(appointments.serviceId, businessServices.id))
    .where(eq(appointments.userId, userId))
    .orderBy(desc(appointments.scheduledFor))
    .all()
    .map(({ appointment, businessName, userName, serviceName }) => ({
      id: appointment.id,
      businessId: appointment.businessId,
      businessName,
      userId: appointment.userId,
      userName,
      scheduledFor: appointment.scheduledFor,
      status: appointment.status as Appointment["status"],
      notes: appointment.notes ?? null,
      createdAt: appointment.createdAt,
      serviceId: appointment.serviceId ?? null,
      serviceName: serviceName ?? null,
    }));
}

export function getNotificationsForUser(userId: number): NotificationItem[] {
  function getNotificationAction(item: typeof notifications.$inferSelect) {
    if (item.type.startsWith("queue-")) {
      return {
        actionHref: "/account/queues",
        actionLabel: "Open live queues",
      };
    }

    if (item.type.startsWith("appointment-")) {
      return {
        actionHref: "/account/appointments",
        actionLabel: "Open appointments",
      };
    }

    if (item.type === "receipt-issued") {
      return {
        actionHref: "/account/receipts",
        actionLabel: "Open receipts",
      };
    }

    if (item.category === "messages" || item.type.includes("message")) {
      return {
        actionHref: "/account/messages",
        actionLabel: "Open messages",
      };
    }

    if (item.category === "support") {
      return {
        actionHref: "/account/support",
        actionLabel: "Open support",
      };
    }

    return {
      actionHref: null,
      actionLabel: null,
    };
  }

  return db
    .select()
    .from(notifications)
    .where(eq(notifications.userId, userId))
    .orderBy(desc(notifications.createdAt))
    .limit(30)
    .all()
    .map((item) => ({
      ...getNotificationAction(item),
      id: item.id,
      type: item.type,
      severity: (item.severity as NotificationItem["severity"]) ?? "info",
      category: item.category ?? null,
      title: item.title,
      message: item.message,
      isRead: !!item.isRead,
      readAt: item.readAt ?? null,
      createdAt: item.createdAt,
    }));
}

export function getSavedPlacesForUser(userId: number): SavedPlace[] {
  return db
    .select({
      saved: savedPlaces,
      businessName: businesses.name,
    })
    .from(savedPlaces)
    .innerJoin(businesses, eq(savedPlaces.businessId, businesses.id))
    .where(eq(savedPlaces.userId, userId))
    .orderBy(desc(savedPlaces.createdAt))
    .all()
    .map(({ saved, businessName }) => ({
      id: saved.id,
      businessId: saved.businessId,
      businessName,
      note: saved.note ?? null,
      createdAt: saved.createdAt,
    }));
}

export function getConversationSummariesForUser(userId: number, view: ConversationListView = "active"): ConversationSummary[] {
  const rows = db
    .select({
      conversation: conversations,
      businessName: businesses.name,
      userName: users.name,
    })
    .from(conversations)
    .innerJoin(businesses, eq(conversations.businessId, businesses.id))
    .innerJoin(users, eq(conversations.userId, users.id))
    .where(eq(conversations.userId, userId))
    .orderBy(desc(conversations.updatedAt))
    .all();

  return rows
    .filter(({ conversation }) => includeConversationInView(conversation.status, view))
    .map(({ conversation, businessName, userName }) => {
      const unreadCount =
        db
          .select({ count: sql<number>`count(*)` })
          .from(messages)
          .where(and(eq(messages.conversationId, conversation.id), eq(messages.senderRole, "owner"), sql`${messages.readAt} is null`))
          .get()?.count ?? 0;
      return toConversationSummary(conversation, businessName, userName, unreadCount);
    });
}

export function getConversationSummariesForBusiness(businessId: number, view: ConversationListView = "active"): ConversationSummary[] {
  const rows = db
    .select({
      conversation: conversations,
      businessName: businesses.name,
      userName: users.name,
    })
    .from(conversations)
    .innerJoin(businesses, eq(conversations.businessId, businesses.id))
    .innerJoin(users, eq(conversations.userId, users.id))
    .where(eq(conversations.businessId, businessId))
    .orderBy(desc(conversations.updatedAt))
    .all();

  return rows
    .filter(({ conversation }) => includeConversationInView(conversation.status, view))
    .map(({ conversation, businessName, userName }) => {
      const unreadCount =
        db
          .select({ count: sql<number>`count(*)` })
          .from(messages)
          .where(and(eq(messages.conversationId, conversation.id), eq(messages.senderRole, "user"), sql`${messages.readAt} is null`))
          .get()?.count ?? 0;
      return toConversationSummary(conversation, businessName, userName, unreadCount);
    });
}

export function getConversationDetail(conversationId: number): ConversationDetail | null {
  const summary = db
    .select({
      conversation: conversations,
      businessName: businesses.name,
      userName: users.name,
    })
    .from(conversations)
    .innerJoin(businesses, eq(conversations.businessId, businesses.id))
    .innerJoin(users, eq(conversations.userId, users.id))
    .where(eq(conversations.id, conversationId))
    .get();
  if (!summary) return null;
  const unreadCount =
    db.select({ count: sql<number>`count(*)` }).from(messages).where(and(eq(messages.conversationId, conversationId), sql`${messages.readAt} is null`)).get()?.count ?? 0;
  const messageRows = db
    .select({
      message: messages,
      senderName: users.name,
    })
    .from(messages)
    .innerJoin(users, eq(messages.senderId, users.id))
    .where(eq(messages.conversationId, conversationId))
    .orderBy(messages.createdAt)
    .all();

  return {
    ...toConversationSummary(summary.conversation, summary.businessName, summary.userName, unreadCount),
    messages: messageRows.map(({ message, senderName }) => ({
      id: message.id,
      conversationId: message.conversationId,
      businessId: message.businessId,
      senderRole: message.senderRole as ChatMessage["senderRole"],
      senderId: message.senderId,
      senderName,
      body: message.body,
      createdAt: message.createdAt,
      readAt: message.readAt ?? null,
    })),
  };
}

export function getVisitHistoryForUser(userId: number): VisitHistoryItem[] {
  const queueHistory = db
    .select({
      entry: queueEntries,
      businessName: businesses.name,
      serviceName: businessServices.name,
      feedbackId: visitFeedback.id,
      receiptId: visitReceipts.id,
    })
    .from(queueEntries)
    .innerJoin(businesses, eq(queueEntries.businessId, businesses.id))
    .leftJoin(businessServices, eq(queueEntries.serviceId, businessServices.id))
    .leftJoin(visitFeedback, eq(queueEntries.id, visitFeedback.queueEntryId))
    .leftJoin(visitReceipts, eq(queueEntries.id, visitReceipts.queueEntryId))
    .where(and(eq(queueEntries.userId, userId), inArray(queueEntries.status, ["completed", "cancelled", "no_show", "transferred"])))
    .orderBy(desc(queueEntries.updatedAt))
    .all()
    .map(({ entry, businessName, serviceName, feedbackId, receiptId }) => ({
      id: entry.id,
      businessId: entry.businessId,
      businessName,
      visitType: "queue" as const,
      serviceId: entry.serviceId ?? null,
      serviceName: serviceName ?? null,
      status: entry.status,
      completedAt: entry.completedAt ?? entry.updatedAt,
      scheduledFor: null,
      canRebook: true,
      canReview: entry.status === "completed" && !feedbackId,
      receiptId: receiptId ?? null,
      canViewReceipt: receiptId != null,
    }));

  const appointmentHistory = db
    .select({
      appointment: appointments,
      businessName: businesses.name,
      serviceName: businessServices.name,
      feedbackId: visitFeedback.id,
      receiptId: visitReceipts.id,
    })
    .from(appointments)
    .innerJoin(businesses, eq(appointments.businessId, businesses.id))
    .leftJoin(businessServices, eq(appointments.serviceId, businessServices.id))
    .leftJoin(visitFeedback, eq(appointments.id, visitFeedback.appointmentId))
    .leftJoin(visitReceipts, eq(appointments.id, visitReceipts.appointmentId))
    .where(and(eq(appointments.userId, userId), inArray(appointments.status, ["completed", "cancelled", "rejected"])))
    .orderBy(desc(appointments.updatedAt))
    .all()
    .map(({ appointment, businessName, serviceName, feedbackId, receiptId }) => ({
      id: appointment.id,
      businessId: appointment.businessId,
      businessName,
      visitType: "appointment" as const,
      serviceId: appointment.serviceId ?? null,
      serviceName: serviceName ?? null,
      status: appointment.status,
      completedAt: appointment.updatedAt,
      scheduledFor: appointment.scheduledFor,
      canRebook: true,
      canReview: appointment.status === "completed" && !feedbackId,
      receiptId: receiptId ?? null,
      canViewReceipt: receiptId != null,
    }));

  return [...queueHistory, ...appointmentHistory]
    .sort((a, b) => new Date(b.completedAt ?? b.scheduledFor ?? 0).getTime() - new Date(a.completedAt ?? a.scheduledFor ?? 0).getTime())
    .slice(0, 10);
}

function toReceiptItem(receipt: typeof visitReceipts.$inferSelect): ReceiptItem | null {
  const business = db.select({ name: businesses.name }).from(businesses).where(eq(businesses.id, receipt.businessId)).get();
  const user = db.select({ name: users.name }).from(users).where(eq(users.id, receipt.userId)).get();
  if (!business || !user) return null;

  if (receipt.visitType === "queue" && receipt.queueEntryId != null) {
    const entry = db.select().from(queueEntries).where(eq(queueEntries.id, receipt.queueEntryId)).get();
    if (!entry) return null;
    return {
      id: receipt.id,
      businessId: receipt.businessId,
      businessName: business.name,
      userId: receipt.userId,
      userName: user.name,
      ownerId: receipt.ownerId,
      visitType: "queue",
      queueEntryId: receipt.queueEntryId,
      appointmentId: null,
      serviceName: getServiceName(entry.serviceId),
      referenceNumber: receipt.referenceNumber,
      status: "issued",
      ownerNote: receipt.ownerNote ?? null,
      lineItemLabel: receipt.lineItemLabel ?? null,
      amountCents: receipt.amountCents ?? null,
      totalCents: receipt.totalCents ?? null,
      paymentNote: receipt.paymentNote ?? null,
      issuedAt: receipt.issuedAt,
      completedAt: entry.completedAt ?? entry.updatedAt,
      scheduledFor: null,
      downloadToken: receipt.downloadToken,
    };
  }

  if (receipt.visitType === "appointment" && receipt.appointmentId != null) {
    const appointment = db.select().from(appointments).where(eq(appointments.id, receipt.appointmentId)).get();
    if (!appointment) return null;
    return {
      id: receipt.id,
      businessId: receipt.businessId,
      businessName: business.name,
      userId: receipt.userId,
      userName: user.name,
      ownerId: receipt.ownerId,
      visitType: "appointment",
      queueEntryId: null,
      appointmentId: receipt.appointmentId,
      serviceName: getServiceName(appointment.serviceId),
      referenceNumber: receipt.referenceNumber,
      status: "issued",
      ownerNote: receipt.ownerNote ?? null,
      lineItemLabel: receipt.lineItemLabel ?? null,
      amountCents: receipt.amountCents ?? null,
      totalCents: receipt.totalCents ?? null,
      paymentNote: receipt.paymentNote ?? null,
      issuedAt: receipt.issuedAt,
      completedAt: appointment.updatedAt,
      scheduledFor: appointment.scheduledFor,
      downloadToken: receipt.downloadToken,
    };
  }

  return null;
}

export function getReceiptsForUser(userId: number): ReceiptItem[] {
  return db.select().from(visitReceipts).where(eq(visitReceipts.userId, userId)).orderBy(desc(visitReceipts.issuedAt)).all()
    .map(toReceiptItem)
    .filter((item): item is ReceiptItem => item != null);
}

export function getReceiptsForBusiness(businessId: number): ReceiptItem[] {
  return db.select().from(visitReceipts).where(eq(visitReceipts.businessId, businessId)).orderBy(desc(visitReceipts.issuedAt)).all()
    .map(toReceiptItem)
    .filter((item): item is ReceiptItem => item != null);
}

export function getReceiptById(receiptId: number): ReceiptItem | null {
  const receipt = db.select().from(visitReceipts).where(eq(visitReceipts.id, receiptId)).get();
  return receipt ? toReceiptItem(receipt) : null;
}

export function getEligibleReceiptVisitsForBusiness(businessId: number): OwnerEligibleReceiptVisit[] {
  const queueVisits = db
    .select({
      entry: queueEntries,
      userName: users.name,
      serviceName: businessServices.name,
      receiptId: visitReceipts.id,
      referenceNumber: visitReceipts.referenceNumber,
    })
    .from(queueEntries)
    .innerJoin(users, eq(queueEntries.userId, users.id))
    .leftJoin(businessServices, eq(queueEntries.serviceId, businessServices.id))
    .leftJoin(visitReceipts, eq(queueEntries.id, visitReceipts.queueEntryId))
    .where(and(eq(queueEntries.businessId, businessId), eq(queueEntries.status, "completed")))
    .orderBy(desc(queueEntries.updatedAt))
    .all()
    .map(({ entry, userName, serviceName, receiptId, referenceNumber }) => ({
      id: entry.id,
      businessId,
      userId: entry.userId,
      userName,
      visitType: "queue" as ReceiptVisitType,
      serviceName: serviceName ?? null,
      status: entry.status,
      completedAt: entry.completedAt ?? entry.updatedAt,
      scheduledFor: null,
      existingReceiptId: receiptId ?? null,
      existingReferenceNumber: referenceNumber ?? null,
    }));

  const appointmentVisits = db
    .select({
      appointment: appointments,
      userName: users.name,
      serviceName: businessServices.name,
      receiptId: visitReceipts.id,
      referenceNumber: visitReceipts.referenceNumber,
    })
    .from(appointments)
    .innerJoin(users, eq(appointments.userId, users.id))
    .leftJoin(businessServices, eq(appointments.serviceId, businessServices.id))
    .leftJoin(visitReceipts, eq(appointments.id, visitReceipts.appointmentId))
    .where(and(eq(appointments.businessId, businessId), eq(appointments.status, "completed")))
    .orderBy(desc(appointments.updatedAt))
    .all()
    .map(({ appointment, userName, serviceName, receiptId, referenceNumber }) => ({
      id: appointment.id,
      businessId,
      userId: appointment.userId,
      userName,
      visitType: "appointment" as ReceiptVisitType,
      serviceName: serviceName ?? null,
      status: appointment.status,
      completedAt: appointment.updatedAt,
      scheduledFor: appointment.scheduledFor,
      existingReceiptId: receiptId ?? null,
      existingReferenceNumber: referenceNumber ?? null,
    }));

  return [...queueVisits, ...appointmentVisits].sort(
    (a, b) =>
      new Date(b.completedAt ?? b.scheduledFor ?? 0).getTime() -
      new Date(a.completedAt ?? a.scheduledFor ?? 0).getTime(),
  );
}

export async function getUserDashboard(userId: number): Promise<UserDashboard> {
  const activeEntries = getQueueEntriesForUser(userId);
  const upcomingAppointments = getAppointmentsForUser(userId).filter((appointment) => ["pending", "approved"].includes(appointment.status));
  const notifications = getNotificationsForUser(userId);
  const savedPlaces = getSavedPlacesForUser(userId);
  const recentVisits = getVisitHistoryForUser(userId);
  const conversations = getConversationSummariesForUser(userId);
  const unreadNotifications = notifications.filter((item) => !item.isRead);
  const unreadConversations = conversations.filter((conversation) => conversation.unreadCount > 0);
  const businesses = await getBusinessRows(userId);
  const recommendation = activeEntries[0]
    ? {
        kind: "queue" as const,
        title: "Your live visit needs attention",
        message: `Smart Queue is already holding your place at ${activeEntries[0].businessName}. Track status changes, ETA, and the next action from your live queue card.`,
        primaryActionLabel: "Open live queue",
        primaryActionHref: `/queue-preview/${activeEntries[0].id}`,
        secondaryActionLabel: "View all live queues",
        secondaryActionHref: "/account/queues",
        businessId: activeEntries[0].businessId,
      }
    : upcomingAppointments[0]
      ? {
          kind: "appointment" as const,
          title: "You have an upcoming visit to prepare for",
          message: `Your ${upcomingAppointments[0].status} appointment with ${upcomingAppointments[0].businessName} is the next thing to review before you leave.`,
          primaryActionLabel: "Open appointments",
          primaryActionHref: "/account/appointments",
          secondaryActionLabel: "Open business",
          secondaryActionHref: `/business/${upcomingAppointments[0].businessId}`,
          businessId: upcomingAppointments[0].businessId,
        }
      : unreadConversations[0]
        ? {
            kind: "messages" as const,
            title: "You have unread business updates",
            message: `${unreadConversations[0].businessName} has an unread conversation waiting. Open messages to review it before the visit slips out of sync.`,
            primaryActionLabel: "Open messages",
            primaryActionHref: `/account/messages?business=${unreadConversations[0].businessId}`,
            secondaryActionLabel: "Open support",
            secondaryActionHref: unreadNotifications.some((item) => item.category === "support") ? "/account/support" : null,
            businessId: unreadConversations[0].businessId,
          }
        : businesses[0]
          ? {
              kind: "discovery" as const,
              title: "A strong next option is ready",
              message: `${businesses[0].name} looks like a practical next stop based on wait time, convenience, and service fit.`,
              primaryActionLabel: "Open business",
              primaryActionHref: `/business/${businesses[0].id}`,
              secondaryActionLabel: "Browse search",
              secondaryActionHref: "/account/search",
              businessId: businesses[0].id,
            }
          : {
              kind: "discovery" as const,
              title: "Start with discovery",
              message: savedPlaces[0]
                ? `You already saved ${savedPlaces[0].businessName}. Reopen it or browse the signed-in directory for another option.`
                : "Search and map are the best starting points when you do not have an active queue, booking, or conversation yet.",
              primaryActionLabel: savedPlaces[0] ? "Open saved place" : "Browse businesses",
              primaryActionHref: savedPlaces[0] ? `/business/${savedPlaces[0].businessId}` : "/account/search",
              secondaryActionLabel: savedPlaces[0] ? "Browse search" : "Open map view",
              secondaryActionHref: savedPlaces[0] ? "/account/search" : "/account/map",
              businessId: savedPlaces[0]?.businessId ?? null,
            };
  return { activeEntries, upcomingAppointments, notifications, savedPlaces, recentVisits, conversations, recommendation };
}

export function getUserPreferences(userId: number): UserPreferences {
  const row = db.select().from(userPreferences).where(eq(userPreferences.userId, userId)).get();
  if (!row) return DEFAULT_USER_PREFERENCES;
  return {
    emailSummaries: row.emailSummaries,
    desktopNotifications: row.desktopNotifications,
    aiAssistant: row.aiAssistant,
    travelTips: row.travelTips,
  };
}

export function getOwnerDashboardData(businessId: number) {
  const business = db.select().from(businesses).where(eq(businesses.id, businessId)).get();
  normalizePausedEntriesForBusiness(businessId);
  const queueEntriesList = db
    .select({
      entry: queueEntries,
      userName: users.name,
      businessName: businesses.name,
      pauseLimitMinutes: businesses.pauseLimitMinutes,
      maxSkips: businesses.maxSkips,
      maxReschedules: businesses.maxReschedules,
      serviceName: businessServices.name,
      counterName: serviceCounters.name,
    })
    .from(queueEntries)
    .innerJoin(users, eq(queueEntries.userId, users.id))
    .innerJoin(businesses, eq(queueEntries.businessId, businesses.id))
    .leftJoin(businessServices, eq(queueEntries.serviceId, businessServices.id))
    .leftJoin(serviceCounters, eq(queueEntries.counterId, serviceCounters.id))
    .where(and(eq(queueEntries.businessId, businessId), inArray(queueEntries.status, ["waiting", "called", "paused", "in_service", "delayed"])))
    .all()
    .sort(({ entry: left }, { entry: right }) => {
      const statusWeight = getQueueSortWeight(left.status as QueueStatus) - getQueueSortWeight(right.status as QueueStatus);
      if (statusWeight !== 0) return statusWeight;
      return getQueueOrderingValue(left).localeCompare(getQueueOrderingValue(right));
    })
    .map(({ entry, userName, businessName, pauseLimitMinutes, maxSkips, maxReschedules, serviceName, counterName }, index) => {
      const queueMeta = getQueueStatusCopy(entry, pauseLimitMinutes);
      const actionAvailability = getQueueActionAvailability(entry, pauseLimitMinutes, maxSkips, maxReschedules);
      return {
        id: entry.id,
        businessId,
        businessName,
        userId: entry.userId,
        userName,
        status: entry.status as QueueStatus,
        queueNumber: entry.queueNumber,
        position: entry.status === "paused" ? null : index + 1,
        estimatedWaitMinutes: entry.estimatedWaitMinutes,
        joinedAt: entry.joinedAt,
        calledAt: entry.calledAt ?? null,
        skipsUsed: entry.skipsUsed,
        reschedulesUsed: entry.reschedulesUsed,
        pauseLimitMinutes,
        pauseStartedAt: entry.pauseStartedAt ?? null,
        pauseExpiresAt: queueMeta.pauseExpiresAt,
        totalPausedSeconds: entry.totalPausedSeconds,
        serviceId: entry.serviceId ?? null,
        serviceName: serviceName ?? null,
        counterId: entry.counterId ?? null,
        counterName: counterName ?? null,
        staffName: entry.staffName ?? null,
        statusLabel: queueMeta.statusLabel,
        statusDescription: queueMeta.statusDescription,
        availableGuestActions: actionAvailability.availableGuestActions,
        availableOwnerActions: actionAvailability.availableOwnerActions,
        timeline: getQueueTimeline(entry.id),
      };
    });

  const appointmentRows = db
    .select({
      appointment: appointments,
      userName: users.name,
      businessName: businesses.name,
      serviceName: businessServices.name,
    })
    .from(appointments)
    .innerJoin(users, eq(appointments.userId, users.id))
    .innerJoin(businesses, eq(appointments.businessId, businesses.id))
    .leftJoin(businessServices, eq(appointments.serviceId, businessServices.id))
    .where(and(eq(appointments.businessId, businessId), inArray(appointments.status, ["pending", "approved", "completed", "cancelled", "rejected", "expired", "converted"])))
    .orderBy(appointments.scheduledFor)
    .all()
    .map(({ appointment, userName, businessName, serviceName }) => ({
      id: appointment.id,
      businessId: appointment.businessId,
      businessName,
      userId: appointment.userId,
      userName,
      scheduledFor: appointment.scheduledFor,
      status: appointment.status as Appointment["status"],
      notes: appointment.notes ?? null,
      createdAt: appointment.createdAt,
      serviceId: appointment.serviceId ?? null,
      serviceName: serviceName ?? null,
    }));
  const pendingAppointments = appointmentRows.filter((appointment) => appointment.status === "pending");
  const upcomingAppointments = appointmentRows.filter((appointment) => appointment.status === "approved");
  const recentAppointments = [...appointmentRows]
    .filter((appointment) => ["completed", "cancelled", "rejected", "expired", "converted"].includes(appointment.status))
    .sort((left, right) => right.scheduledFor.localeCompare(left.scheduledFor))
    .slice(0, 8);

  const services = getServiceMapByBusinessId().get(businessId) ?? [];
  const counters = getCounterMapByBusinessId().get(businessId) ?? [];
  const staff = getStaffMapByBusinessId().get(businessId) ?? [];
  const notices = getNoticeMapByBusinessId().get(businessId) ?? [];
  const feedback = getFeedbackByBusinessId().get(businessId) ?? [];
  const conversations = getConversationSummariesForBusiness(businessId);
  const setupWarnings = getOwnerSetupWarnings(business, getBusinessHoursByBusinessId().get(businessId) ?? [], services, counters);
  const queueEntriesNeedingAssignment = queueEntriesList.filter((entry) => !entry.counterId || !entry.staffName?.trim());
  const delayedQueueEntries = queueEntriesList.filter((entry) => entry.status === "delayed");
  const blockedReadyEntries = queueEntriesList.filter((entry) => entry.status === "called" && (!entry.counterId || !entry.staffName?.trim()));
  const unresolvedNegativeFeedbackCount = feedback.filter((item) => item.rating <= 3 && !item.ownerReply?.trim()).length;
  const completedToday =
    db.select({ count: sql<number>`count(*)` }).from(queueEntries).where(and(eq(queueEntries.businessId, businessId), eq(queueEntries.status, "completed"), sql`date(${queueEntries.updatedAt}) = date('now')`)).get()?.count ?? 0;
  const completedTodayByService = new Map<number, number>();
  (
    db
      .select({
        serviceId: queueEntries.serviceId,
        count: sql<number>`count(*)`,
      })
      .from(queueEntries)
      .where(
        and(
          eq(queueEntries.businessId, businessId),
          eq(queueEntries.status, "completed"),
          sql`date(${queueEntries.updatedAt}) = date('now')`,
        ),
      )
      .groupBy(queueEntries.serviceId)
      .all() as Array<{ serviceId: number | null; count: number }>
  ).forEach((row) => {
    if (row.serviceId != null) completedTodayByService.set(row.serviceId, row.count);
  });
  const noShowCount =
    db.select({ count: sql<number>`count(*)` }).from(queueEntries).where(and(eq(queueEntries.businessId, businessId), eq(queueEntries.status, "no_show"))).get()?.count ?? 0;
  const approvedAppointments =
    db.select({ count: sql<number>`count(*)` }).from(appointments).where(and(eq(appointments.businessId, businessId), eq(appointments.status, "approved"))).get()?.count ?? 0;
  const convertedAppointments =
    db.select({ count: sql<number>`count(*)` }).from(appointments).where(and(eq(appointments.businessId, businessId), inArray(appointments.status, ["converted", "completed"]))).get()?.count ?? 0;
  const completedHistoryRows = db
    .select({
      day: sql<string>`date(${queueEntries.updatedAt})`,
      servedCount: sql<number>`count(*)`,
      averageWaitMinutes: sql<number>`round(avg(${queueEntries.estimatedWaitMinutes}))`,
    })
    .from(queueEntries)
    .where(
      and(
        eq(queueEntries.businessId, businessId),
        eq(queueEntries.status, "completed"),
        sql`date(${queueEntries.updatedAt}) >= date('now', '-6 days')`,
      ),
    )
    .groupBy(sql`date(${queueEntries.updatedAt})`)
    .all();
  const appointmentHistoryRows = db
    .select({
      day: sql<string>`date(${appointments.scheduledFor})`,
      appointmentCount: sql<number>`count(*)`,
    })
    .from(appointments)
    .where(
      and(
        eq(appointments.businessId, businessId),
        inArray(appointments.status, ["pending", "approved", "converted", "completed"]),
        sql`date(${appointments.scheduledFor}) >= date('now', '-6 days')`,
      ),
    )
    .groupBy(sql`date(${appointments.scheduledFor})`)
    .all();
  const servedByDay = new Map(completedHistoryRows.map((row) => [row.day, row]));
  const appointmentsByDay = new Map(appointmentHistoryRows.map((row) => [row.day, row.appointmentCount]));
  const utcToday = new Date();
  const last7Days = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(Date.UTC(
      utcToday.getUTCFullYear(),
      utcToday.getUTCMonth(),
      utcToday.getUTCDate() - (6 - index),
    ));
    const isoDay = date.toISOString().slice(0, 10);
    const served = servedByDay.get(isoDay);
    return {
      date: isoDay,
      label: SHORT_WEEKDAY_LABELS[date.getUTCDay()],
      servedCount: served?.servedCount ?? 0,
      appointmentCount: appointmentsByDay.get(isoDay) ?? 0,
      averageWaitMinutes: served?.averageWaitMinutes ?? 0,
    };
  });
  const operationsSummary = getOwnerOperationsSummary({
    queueOpen: business?.isQueueOpen ?? false,
    waitingCount: queueEntriesList.filter((entry) => entry.status === "waiting").length,
    delayedCount: delayedQueueEntries.length,
    unassignedCount: queueEntriesNeedingAssignment.length,
    pendingAppointments: pendingAppointments.length,
    unreadConversationCount: conversations.filter((conversation) => conversation.status === "active").length,
    unresolvedNegativeFeedbackCount,
    setupWarnings,
  });
  return {
    subscription: getBusinessSubscription(businessId),
    subscriptionPlans: [...SUBSCRIPTION_PLANS],
    operationsSummary,
    setupWarnings,
    queueAttention: {
      unassignedCount: queueEntriesNeedingAssignment.length,
      delayedCount: delayedQueueEntries.length,
      blockedReadyCount: blockedReadyEntries.length,
      activeCounterCount: counters.filter((counter) => counter.status !== "offline").length,
      activeServiceCount: services.filter((service) => service.isActive).length,
      canOperateSmoothly: setupWarnings.length === 0 && delayedQueueEntries.length === 0,
    },
    appointmentCounts: {
      pending: pendingAppointments.length,
      upcoming: upcomingAppointments.length,
      completed: appointmentRows.filter((appointment) => appointment.status === "completed").length,
      cancelled: appointmentRows.filter((appointment) => ["cancelled", "rejected", "expired"].includes(appointment.status)).length,
    },
    queueEntriesList,
    pendingAppointments,
    upcomingAppointments,
    recentAppointments,
    conversations,
    services: services.map((service) => ({
      ...service,
      estimatedWaitMinutes: queueEntriesList.filter((item) => item.serviceId === service.id).length * service.averageServiceMinutes,
    })),
    counters,
    staff,
    notices,
    feedback,
    analytics: {
      last7Days,
      servicePerformance: services.map((service) => ({
        serviceId: service.id,
        serviceName: service.name,
        averageWaitMinutes: queueEntriesList.filter((item) => item.serviceId === service.id).length * service.averageServiceMinutes,
        throughputToday: completedTodayByService.get(service.id) ?? 0,
      })),
      noShowCount,
      appointmentConversionRate: approvedAppointments ? Number((convertedAppointments / approvedAppointments).toFixed(2)) : 0,
      busiestWindows: getBestTimeWindows(businessId),
    },
  };
}
