import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import fs from "fs";
import path from "path";
import { hashSync } from "bcryptjs";
import {
  adminActivityLogs,
  assistantFeedback,
  assistantMessages,
  assistantThreads,
  appointments,
  businessCategories,
  businessClaimRequests,
  businessHours,
  businessSubscriptions,
  businesses,
  businessNotices,
  businessServices,
  conversations,
  favorites,
  messages,
  queueEntries,
  queueEvents,
  savedPlaces,
  serviceCounters,
  staffMembers,
  platformAnnouncements,
  platformSettings,
  supportConversations,
  supportMessages,
  userPreferences,
  users,
  visitFeedback,
  visitReceipts,
} from "./schema";
import { insertAndReturnId } from "./db-write";
import { runtimeConfig } from "./runtime";

const dataDir = path.resolve(process.cwd(), runtimeConfig.dataDir);
const dbFile = path.join(dataDir, "qless.sqlite");
const isProduction = runtimeConfig.isProduction;
const enableDemoSeeding = runtimeConfig.demoSeedingEnabled;
const databaseUrlConfigured = Boolean(runtimeConfig.databaseUrl);

if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const sqlite = new Database(dbFile);
sqlite.pragma("journal_mode = WAL");
sqlite.pragma("foreign_keys = ON");

const ACTIVE_QUEUE_STATUSES_SQL = "('waiting','called','paused','in_service','delayed')";

export const db = drizzle(sqlite);
export const databaseProvider = "sqlite" as const;
export const databaseLocation = dbFile;
export const isCloudDatabaseConfigured = databaseUrlConfigured;

function logDatabaseBootstrap() {
  const modeLabel = isProduction ? "production" : "development";
  const seedingLabel = enableDemoSeeding ? "enabled" : "disabled";
  console.log(`[db] Starting ${modeLabel} database bootstrap`);
  console.log(`[db] Active database provider: ${databaseProvider}`);
  console.log(`[db] SQLite file: ${dbFile}`);
  console.log(`[db] Demo seeding: ${seedingLabel}`);
  if (databaseUrlConfigured) {
    console.warn("[db] DATABASE_URL is configured, but this release still runs on the SQLite adapter. Postgres migration is not wired yet.");
  }
  if (isProduction && !process.env.QTECH_DATA_DIR) {
    console.warn("[db] QTECH_DATA_DIR is not set in production. Use a persistent disk path on your host.");
  }
}

export function verifyDatabaseConnection() {
  sqlite.prepare("SELECT 1 as ok").get();
}

export function getDatabaseHealthSnapshot() {
  return {
    provider: databaseProvider,
    location: databaseLocation,
    cloudDatabaseConfigured: isCloudDatabaseConfigured,
    demoSeedingEnabled: enableDemoSeeding,
  };
}

const DAYS = [0, 1, 2, 3, 4, 5, 6];

function nowIso() {
  return new Date().toISOString();
}

function defaultHours(openTime: string, closeTime: string, closedDays: number[] = []) {
  return DAYS.map((day) => ({
    dayOfWeek: day,
    openTime,
    closeTime,
    isClosed: closedDays.includes(day),
  }));
}

function tableHasColumn(table: string, column: string) {
  const rows = sqlite.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
  return rows.some((row) => row.name === column);
}

function ensureColumn(table: string, column: string, ddl: string) {
  if (!tableHasColumn(table, column)) {
    sqlite.exec(`ALTER TABLE ${table} ADD COLUMN ${ddl}`);
  }
}

function ensureUserProfileColumns() {
  ensureColumn("users", "phone", "phone TEXT");
  ensureColumn("users", "bio", "bio TEXT");
  ensureColumn("users", "avatar_url", "avatar_url TEXT");
  ensureColumn("users", "location", "location TEXT");
  ensureColumn("users", "password_reset_token_hash", "password_reset_token_hash TEXT");
  ensureColumn("users", "password_reset_expires_at", "password_reset_expires_at TEXT");
  ensureColumn("users", "account_status", "account_status TEXT NOT NULL DEFAULT 'active'");
  ensureColumn("users", "moderation_reason", "moderation_reason TEXT");
  ensureColumn("users", "moderated_at", "moderated_at TEXT");
  ensureColumn("users", "last_sign_in_at", "last_sign_in_at TEXT");
}

function ensureBusinessMetadataColumns() {
  ensureColumn("businesses", "website_url", "website_url TEXT");
  ensureColumn("businesses", "source", "source TEXT NOT NULL DEFAULT 'local'");
  ensureColumn("businesses", "external_provider", "external_provider TEXT");
  ensureColumn("businesses", "external_place_id", "external_place_id TEXT");
  ensureColumn("businesses", "supports_receipts", "supports_receipts INTEGER NOT NULL DEFAULT 0");
  ensureColumn("businesses", "record_status", "record_status TEXT NOT NULL DEFAULT 'active'");
  ensureColumn("businesses", "moderation_reason", "moderation_reason TEXT");
  ensureColumn("businesses", "moderated_at", "moderated_at TEXT");
}

function ensureConversationColumns() {
  ensureColumn("conversations", "status", "status TEXT NOT NULL DEFAULT 'active'");
  ensureColumn("conversations", "visit_type", "visit_type TEXT NOT NULL DEFAULT 'pre_visit'");
  ensureColumn("conversations", "queue_entry_id", "queue_entry_id INTEGER REFERENCES queue_entries(id)");
  ensureColumn("conversations", "appointment_id", "appointment_id INTEGER REFERENCES appointments(id)");
  ensureColumn("conversations", "close_reason", "close_reason TEXT");
  ensureColumn("conversations", "closed_at", "closed_at TEXT");
  ensureColumn("conversations", "archived_at", "archived_at TEXT");
  sqlite.exec("DROP INDEX IF EXISTS conversations_business_user_idx");
}

function ensureNotificationColumns() {
  ensureColumn("notifications", "severity", "severity TEXT NOT NULL DEFAULT 'info'");
  ensureColumn("notifications", "category", "category TEXT");
  ensureColumn("notifications", "read_at", "read_at TEXT");
}

function ensureSupportConversationColumns() {
  ensureColumn("support_conversations", "priority", "priority TEXT NOT NULL DEFAULT 'medium'");
  ensureColumn("support_conversations", "category", "category TEXT NOT NULL DEFAULT 'general'");
  ensureColumn("support_conversations", "internal_notes", "internal_notes TEXT");
  ensureColumn("support_conversations", "resolved_at", "resolved_at TEXT");
}

function ensureClaimReviewColumns() {
  ensureColumn("business_claim_requests", "review_notes", "review_notes TEXT");
  ensureColumn("business_claim_requests", "reviewed_by_admin_id", "reviewed_by_admin_id INTEGER REFERENCES users(id)");
  ensureColumn("business_claim_requests", "reviewed_at", "reviewed_at TEXT");
}

function ensureAssistantColumns() {
  ensureColumn("assistant_messages", "resolution_state", "resolution_state TEXT");
  ensureColumn("assistant_messages", "can_rate", "can_rate INTEGER NOT NULL DEFAULT 0");
}

function ensureQueueEntryColumns() {
  ensureColumn("queue_entries", "service_id", "service_id INTEGER REFERENCES business_services(id)");
  ensureColumn("queue_entries", "counter_id", "counter_id INTEGER REFERENCES service_counters(id)");
  ensureColumn("queue_entries", "staff_name", "staff_name TEXT");
  ensureColumn("queue_entries", "queue_order_key", "queue_order_key TEXT NOT NULL DEFAULT ''");
  sqlite.prepare(`
    UPDATE queue_entries
    SET queue_order_key = joined_at || '#' || printf('%010d', id)
    WHERE queue_order_key IS NULL OR queue_order_key = ''
  `).run();
  sqlite.exec(`
    CREATE INDEX IF NOT EXISTS queue_entries_business_service_order_idx
      ON queue_entries (business_id, service_id, queue_order_key);
    CREATE UNIQUE INDEX IF NOT EXISTS queue_entries_active_queue_number_idx
      ON queue_entries (business_id, service_id, queue_number)
      WHERE service_id IS NOT NULL AND status IN ${ACTIVE_QUEUE_STATUSES_SQL};
    CREATE UNIQUE INDEX IF NOT EXISTS queue_entries_active_user_service_idx
      ON queue_entries (business_id, user_id, service_id)
      WHERE service_id IS NOT NULL AND status IN ${ACTIVE_QUEUE_STATUSES_SQL};
  `);
}

function createTables() {
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS business_categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      slug TEXT NOT NULL UNIQUE,
      label TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS businesses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      slug TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      category_id INTEGER NOT NULL,
      description TEXT NOT NULL,
      address TEXT NOT NULL,
      phone TEXT NOT NULL,
      email TEXT NOT NULL,
      latitude REAL NOT NULL,
      longitude REAL NOT NULL,
      rating REAL NOT NULL DEFAULT 0,
      reviews_count INTEGER NOT NULL DEFAULT 0,
      image_url TEXT NOT NULL,
      website_url TEXT,
      tags_json TEXT NOT NULL DEFAULT '[]',
      source TEXT NOT NULL DEFAULT 'local',
      external_provider TEXT,
      external_place_id TEXT,
      average_service_minutes INTEGER NOT NULL DEFAULT 15,
      max_skips INTEGER NOT NULL DEFAULT 2,
      max_reschedules INTEGER NOT NULL DEFAULT 2,
      pause_limit_minutes INTEGER NOT NULL DEFAULT 30,
      booking_horizon_days INTEGER NOT NULL DEFAULT 14,
      is_queue_open INTEGER NOT NULL DEFAULT 0,
      supports_receipts INTEGER NOT NULL DEFAULT 0,
      record_status TEXT NOT NULL DEFAULT 'active',
      moderation_reason TEXT,
      moderated_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (category_id) REFERENCES business_categories(id)
    );
    CREATE TABLE IF NOT EXISTS business_hours (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      business_id INTEGER NOT NULL,
      day_of_week INTEGER NOT NULL,
      open_time TEXT NOT NULL,
      close_time TEXT NOT NULL,
      is_closed INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY (business_id) REFERENCES businesses(id)
    );
    CREATE TABLE IF NOT EXISTS business_services (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      business_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      description TEXT NOT NULL,
      average_service_minutes INTEGER NOT NULL,
      max_active_queue INTEGER NOT NULL DEFAULT 20,
      supports_appointments INTEGER NOT NULL DEFAULT 1,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      FOREIGN KEY (business_id) REFERENCES businesses(id)
    );
    CREATE TABLE IF NOT EXISTS service_counters (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      business_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      status TEXT NOT NULL,
      active_service_ids_json TEXT NOT NULL DEFAULT '[]',
      assigned_staff_name TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (business_id) REFERENCES businesses(id)
    );
    CREATE TABLE IF NOT EXISTS staff_members (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      business_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      role_label TEXT NOT NULL,
      status TEXT NOT NULL,
      active_counter_id INTEGER,
      created_at TEXT NOT NULL,
      FOREIGN KEY (business_id) REFERENCES businesses(id),
      FOREIGN KEY (active_counter_id) REFERENCES service_counters(id)
    );
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      password_reset_token_hash TEXT,
      password_reset_expires_at TEXT,
      role TEXT NOT NULL,
      business_id INTEGER,
      phone TEXT,
      bio TEXT,
      avatar_url TEXT,
      location TEXT,
      account_status TEXT NOT NULL DEFAULT 'active',
      moderation_reason TEXT,
      moderated_at TEXT,
      last_sign_in_at TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (business_id) REFERENCES businesses(id)
    );
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );
    CREATE TABLE IF NOT EXISTS user_preferences (
      user_id INTEGER PRIMARY KEY,
      email_summaries INTEGER NOT NULL DEFAULT 1,
      desktop_notifications INTEGER NOT NULL DEFAULT 1,
      ai_assistant INTEGER NOT NULL DEFAULT 1,
      travel_tips INTEGER NOT NULL DEFAULT 1,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );
    CREATE TABLE IF NOT EXISTS queue_entries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      business_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      service_id INTEGER,
      counter_id INTEGER,
      staff_name TEXT,
      status TEXT NOT NULL,
      queue_number TEXT NOT NULL,
      queue_order_key TEXT NOT NULL DEFAULT '',
      joined_at TEXT NOT NULL,
      called_at TEXT,
      completed_at TEXT,
      cancelled_at TEXT,
      pause_started_at TEXT,
      total_paused_seconds INTEGER NOT NULL DEFAULT 0,
      skips_used INTEGER NOT NULL DEFAULT 0,
      reschedules_used INTEGER NOT NULL DEFAULT 0,
      estimated_wait_minutes INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (business_id) REFERENCES businesses(id),
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (service_id) REFERENCES business_services(id),
      FOREIGN KEY (counter_id) REFERENCES service_counters(id)
    );
    CREATE TABLE IF NOT EXISTS queue_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      queue_entry_id INTEGER NOT NULL,
      event_type TEXT NOT NULL,
      label TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (queue_entry_id) REFERENCES queue_entries(id)
    );
    CREATE TABLE IF NOT EXISTS conversations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      business_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      owner_id INTEGER,
      status TEXT NOT NULL DEFAULT 'active',
      visit_type TEXT NOT NULL DEFAULT 'pre_visit',
      queue_entry_id INTEGER,
      appointment_id INTEGER,
      context_label TEXT,
      close_reason TEXT,
      closed_at TEXT,
      archived_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (business_id) REFERENCES businesses(id),
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (owner_id) REFERENCES users(id),
      FOREIGN KEY (queue_entry_id) REFERENCES queue_entries(id),
      FOREIGN KEY (appointment_id) REFERENCES appointments(id)
    );
    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      conversation_id INTEGER NOT NULL,
      business_id INTEGER NOT NULL,
      sender_role TEXT NOT NULL,
      sender_id INTEGER NOT NULL,
      body TEXT NOT NULL,
      created_at TEXT NOT NULL,
      read_at TEXT,
      FOREIGN KEY (conversation_id) REFERENCES conversations(id),
      FOREIGN KEY (business_id) REFERENCES businesses(id),
      FOREIGN KEY (sender_id) REFERENCES users(id)
    );
    CREATE TABLE IF NOT EXISTS assistant_threads (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      scope TEXT NOT NULL,
      owner_user_id INTEGER NOT NULL,
      business_id INTEGER,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (owner_user_id) REFERENCES users(id),
      FOREIGN KEY (business_id) REFERENCES businesses(id)
    );
    CREATE UNIQUE INDEX IF NOT EXISTS assistant_threads_owner_scope_idx ON assistant_threads (scope, owner_user_id);
    CREATE TABLE IF NOT EXISTS assistant_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      thread_id INTEGER NOT NULL,
      role TEXT NOT NULL,
      kind TEXT NOT NULL,
      body TEXT NOT NULL,
      resolution_state TEXT,
      can_rate INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      FOREIGN KEY (thread_id) REFERENCES assistant_threads(id)
    );
    CREATE TABLE IF NOT EXISTS assistant_feedback (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      role TEXT NOT NULL,
      owner_user_id INTEGER NOT NULL,
      thread_id INTEGER NOT NULL,
      assistant_message_id INTEGER NOT NULL,
      rating INTEGER NOT NULL,
      comment TEXT,
      resolution_state TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (owner_user_id) REFERENCES users(id),
      FOREIGN KEY (thread_id) REFERENCES assistant_threads(id),
      FOREIGN KEY (assistant_message_id) REFERENCES assistant_messages(id)
    );
    CREATE UNIQUE INDEX IF NOT EXISTS assistant_feedback_message_idx ON assistant_feedback (assistant_message_id);
    CREATE TABLE IF NOT EXISTS support_conversations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      requester_user_id INTEGER NOT NULL,
      assigned_admin_id INTEGER,
      subject TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active',
      priority TEXT NOT NULL DEFAULT 'medium',
      category TEXT NOT NULL DEFAULT 'general',
      internal_notes TEXT,
      resolved_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (requester_user_id) REFERENCES users(id),
      FOREIGN KEY (assigned_admin_id) REFERENCES users(id)
    );
    CREATE TABLE IF NOT EXISTS support_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      conversation_id INTEGER NOT NULL,
      sender_role TEXT NOT NULL,
      sender_id INTEGER NOT NULL,
      body TEXT NOT NULL,
      created_at TEXT NOT NULL,
      read_at TEXT,
      FOREIGN KEY (conversation_id) REFERENCES support_conversations(id),
      FOREIGN KEY (sender_id) REFERENCES users(id)
    );
    CREATE TABLE IF NOT EXISTS appointments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      business_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      scheduled_for TEXT NOT NULL,
      status TEXT NOT NULL,
      notes TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (business_id) REFERENCES businesses(id),
      FOREIGN KEY (user_id) REFERENCES users(id)
    );
    CREATE TABLE IF NOT EXISTS visit_feedback (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      business_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      queue_entry_id INTEGER,
      appointment_id INTEGER,
      rating INTEGER NOT NULL,
      comment TEXT NOT NULL,
      owner_reply TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (business_id) REFERENCES businesses(id),
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (queue_entry_id) REFERENCES queue_entries(id),
      FOREIGN KEY (appointment_id) REFERENCES appointments(id)
    );
    CREATE TABLE IF NOT EXISTS visit_receipts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      business_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      owner_id INTEGER NOT NULL,
      queue_entry_id INTEGER,
      appointment_id INTEGER,
      visit_type TEXT NOT NULL,
      reference_number TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'issued',
      owner_note TEXT,
      line_item_label TEXT,
      amount_cents INTEGER,
      total_cents INTEGER,
      payment_note TEXT,
      download_token TEXT NOT NULL,
      issued_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (business_id) REFERENCES businesses(id),
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (owner_id) REFERENCES users(id),
      FOREIGN KEY (queue_entry_id) REFERENCES queue_entries(id),
      FOREIGN KEY (appointment_id) REFERENCES appointments(id)
    );
    CREATE INDEX IF NOT EXISTS visit_receipts_business_idx ON visit_receipts (business_id);
    CREATE INDEX IF NOT EXISTS visit_receipts_user_idx ON visit_receipts (user_id);
    CREATE UNIQUE INDEX IF NOT EXISTS visit_receipts_queue_idx ON visit_receipts (queue_entry_id) WHERE queue_entry_id IS NOT NULL;
    CREATE UNIQUE INDEX IF NOT EXISTS visit_receipts_appointment_idx ON visit_receipts (appointment_id) WHERE appointment_id IS NOT NULL;
    CREATE TABLE IF NOT EXISTS business_notices (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      business_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      severity TEXT NOT NULL,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      FOREIGN KEY (business_id) REFERENCES businesses(id)
    );
    CREATE TABLE IF NOT EXISTS favorites (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      business_id INTEGER NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (business_id) REFERENCES businesses(id)
    );
    CREATE UNIQUE INDEX IF NOT EXISTS favorites_user_business_idx ON favorites (user_id, business_id);
    CREATE TABLE IF NOT EXISTS saved_places (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      business_id INTEGER NOT NULL,
      note TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (business_id) REFERENCES businesses(id)
    );
    CREATE UNIQUE INDEX IF NOT EXISTS saved_places_user_business_idx ON saved_places (user_id, business_id);
    CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      type TEXT NOT NULL,
      severity TEXT NOT NULL DEFAULT 'info',
      category TEXT,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      is_read INTEGER NOT NULL DEFAULT 0,
      read_at TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );
    CREATE TABLE IF NOT EXISTS business_subscriptions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      business_id INTEGER NOT NULL,
      plan TEXT NOT NULL,
      interval TEXT NOT NULL,
      status TEXT NOT NULL,
      started_at TEXT NOT NULL,
      next_billing_at TEXT,
      ends_at TEXT,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (business_id) REFERENCES businesses(id)
    );
    CREATE TABLE IF NOT EXISTS business_claim_requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      provider TEXT NOT NULL,
      place_id TEXT NOT NULL,
      business_name TEXT NOT NULL,
      category TEXT NOT NULL,
      address TEXT NOT NULL,
      phone TEXT,
      email TEXT,
      website_url TEXT,
      latitude REAL NOT NULL,
      longitude REAL NOT NULL,
      image_url TEXT NOT NULL,
      requested_by_user_id INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      review_notes TEXT,
      reviewed_by_admin_id INTEGER,
      reviewed_at TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (requested_by_user_id) REFERENCES users(id),
      FOREIGN KEY (reviewed_by_admin_id) REFERENCES users(id)
    );
    CREATE UNIQUE INDEX IF NOT EXISTS business_claim_requests_provider_place_idx ON business_claim_requests (provider, place_id);
    CREATE TABLE IF NOT EXISTS admin_activity_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      admin_user_id INTEGER,
      action_type TEXT NOT NULL,
      target_type TEXT NOT NULL,
      target_id INTEGER,
      summary TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (admin_user_id) REFERENCES users(id)
    );
    CREATE TABLE IF NOT EXISTS platform_announcements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      audience TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'draft',
      created_by_admin_id INTEGER,
      published_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (created_by_admin_id) REFERENCES users(id)
    );
    CREATE TABLE IF NOT EXISTS platform_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);

  ensureQueueEntryColumns();
  ensureColumn("appointments", "service_id", "service_id INTEGER REFERENCES business_services(id)");
  ensureAssistantColumns();
  ensureSupportConversationColumns();
  ensureClaimReviewColumns();
}

function seedCategories() {
  const count = sqlite.prepare("SELECT COUNT(*) as count FROM business_categories").get() as { count: number };
  if (count.count > 0) return;
  db.insert(businessCategories)
    .values([
      { slug: "restaurant", label: "Restaurant" },
      { slug: "bank", label: "Bank" },
      { slug: "hospital", label: "Hospital" },
      { slug: "government", label: "Government" },
      { slug: "salon", label: "Salon" },
      { slug: "retail", label: "Retail" },
    ])
    .run();
}

function getCategoryId(slug: string) {
  const row = sqlite.prepare("SELECT id FROM business_categories WHERE slug = ?").get(slug) as { id: number } | undefined;
  return row?.id;
}

function seedBusinesses() {
  const timestamp = nowIso();
  const businessData = [
    {
      slug: "downtown-bank-trust",
      name: "Downtown Bank & Trust",
      category: "bank",
      description: "Modern banking with fast teller service, loan consultations, and guided account support.",
      address: "123 Main Street, Downtown",
      phone: "+1 (555) 123-4567",
      email: "hello@downtownbank.com",
      latitude: 40.7128,
      longitude: -74.006,
      rating: 4.6,
      reviewsCount: 248,
      imageUrl: "https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?auto=format&fit=crop&w=1200&q=80",
      websiteUrl: "https://www.downtownbank.com",
      tagsJson: JSON.stringify(["banking", "loans", "wealth", "tellers"]),
      averageServiceMinutes: 20,
      maxSkips: 2,
      maxReschedules: 2,
      pauseLimitMinutes: 30,
      bookingHorizonDays: 21,
      isQueueOpen: true,
      supportsReceipts: true,
      hours: defaultHours("09:00", "17:00", [0, 6]),
      services: [
        { name: "Quick Teller", description: "Deposits, withdrawals, basic account help.", averageServiceMinutes: 10, maxActiveQueue: 25, supportsAppointments: false },
        { name: "Loan Consultation", description: "Personal and business lending consultations.", averageServiceMinutes: 30, maxActiveQueue: 8, supportsAppointments: true },
      ],
      counters: [
        { name: "Counter A", status: "open", serviceIndexes: [0], assignedStaffName: "Dana Owner" },
        { name: "Advisory Desk", status: "open", serviceIndexes: [1], assignedStaffName: "Leo Advisor" },
      ],
      staff: [
        { name: "Dana Owner", roleLabel: "Manager", status: "available", counterIndex: 0 },
        { name: "Leo Advisor", roleLabel: "Advisor", status: "busy", counterIndex: 1 },
      ],
      notices: [{ title: "Bring an ID", message: "Government-issued ID is required for new account and loan services.", severity: "info", isActive: true }],
    },
    {
      slug: "metro-hospital-urgent-care",
      name: "Metro Hospital Urgent Care",
      category: "hospital",
      description: "Urgent care intake with queue visibility, remote joining, and same-day appointment slots.",
      address: "456 Medical Avenue, Midtown",
      phone: "+1 (555) 234-5678",
      email: "urgent@metrohospital.com",
      latitude: 40.715,
      longitude: -74.008,
      rating: 4.7,
      reviewsCount: 512,
      imageUrl: "https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?auto=format&fit=crop&w=1200&q=80",
      websiteUrl: "https://www.metrohospital.com",
      tagsJson: JSON.stringify(["urgent care", "healthcare", "walk-in", "same-day"]),
      averageServiceMinutes: 30,
      maxSkips: 1,
      maxReschedules: 1,
      pauseLimitMinutes: 30,
      bookingHorizonDays: 7,
      isQueueOpen: true,
      supportsReceipts: false,
      hours: defaultHours("07:00", "23:00"),
      services: [
        { name: "Urgent Assessment", description: "Immediate triage and first-pass assessment.", averageServiceMinutes: 18, maxActiveQueue: 20, supportsAppointments: false },
        { name: "Follow-up Consult", description: "Scheduled check-ins for non-emergency patients.", averageServiceMinutes: 25, maxActiveQueue: 12, supportsAppointments: true },
      ],
      counters: [
        { name: "Triage 1", status: "open", serviceIndexes: [0], assignedStaffName: "Nurse Kim" },
        { name: "Consult Room", status: "busy", serviceIndexes: [1], assignedStaffName: "Dr. Howard" },
      ],
      staff: [
        { name: "Nurse Kim", roleLabel: "Triage Nurse", status: "available", counterIndex: 0 },
        { name: "Dr. Howard", roleLabel: "Physician", status: "busy", counterIndex: 1 },
      ],
      notices: [{ title: "Peak period", message: "Urgent Assessment is experiencing longer than usual wait times tonight.", severity: "warning", isActive: true }],
    },
    {
      slug: "urban-bistro",
      name: "Urban Bistro",
      category: "restaurant",
      description: "A busy neighborhood bistro that lets guests join the table waitlist from anywhere.",
      address: "789 Elm Street, Arts District",
      phone: "+1 (555) 345-6789",
      email: "host@urbanbistro.com",
      latitude: 40.71,
      longitude: -74.01,
      rating: 4.8,
      reviewsCount: 876,
      imageUrl: "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=1200&q=80",
      websiteUrl: "https://www.urbanbistro.com",
      tagsJson: JSON.stringify(["dining", "reservations", "brunch", "waitlist"]),
      averageServiceMinutes: 18,
      maxSkips: 2,
      maxReschedules: 2,
      pauseLimitMinutes: 30,
      bookingHorizonDays: 30,
      isQueueOpen: true,
      supportsReceipts: true,
      hours: defaultHours("11:00", "22:00", [1]),
      services: [
        { name: "Indoor Table", description: "Main dining room table service.", averageServiceMinutes: 20, maxActiveQueue: 16, supportsAppointments: true },
        { name: "Patio Table", description: "Outdoor patio seating subject to weather.", averageServiceMinutes: 15, maxActiveQueue: 10, supportsAppointments: true },
      ],
      counters: [
        { name: "Host Stand", status: "open", serviceIndexes: [0, 1], assignedStaffName: "Marco Owner" },
      ],
      staff: [
        { name: "Marco Owner", roleLabel: "Host Lead", status: "available", counterIndex: 0 },
      ],
      notices: [{ title: "Patio limited", message: "Patio seating may be delayed due to light rain.", severity: "info", isActive: true }],
    },
    {
      slug: "city-services-center",
      name: "City Services Center",
      category: "government",
      description: "Permits, licensing, and civil records with better queue transparency and time estimates.",
      address: "321 Civic Center Plaza",
      phone: "+1 (555) 456-7890",
      email: "services@city.gov",
      latitude: 40.718,
      longitude: -74.005,
      rating: 4.1,
      reviewsCount: 324,
      imageUrl: "https://images.unsplash.com/photo-1577412647305-991150c7d163?auto=format&fit=crop&w=1200&q=80",
      websiteUrl: "https://www.city.gov/services",
      tagsJson: JSON.stringify(["permits", "licensing", "records"]),
      averageServiceMinutes: 25,
      maxSkips: 1,
      maxReschedules: 1,
      pauseLimitMinutes: 30,
      bookingHorizonDays: 10,
      isQueueOpen: false,
      supportsReceipts: true,
      hours: defaultHours("08:00", "16:00", [0, 6]),
      services: [
        { name: "Licensing", description: "Permit and license processing.", averageServiceMinutes: 25, maxActiveQueue: 14, supportsAppointments: true },
        { name: "Records Request", description: "Civil records and document pickup.", averageServiceMinutes: 12, maxActiveQueue: 18, supportsAppointments: true },
      ],
      counters: [
        { name: "Window 1", status: "offline", serviceIndexes: [0], assignedStaffName: "Closed" },
      ],
      staff: [
        { name: "Jamie Clerk", roleLabel: "Clerk", status: "offline", counterIndex: 0 },
      ],
      notices: [{ title: "Closed for queue joins", message: "Only pre-approved appointments are being honored this afternoon.", severity: "urgent", isActive: true }],
    },
    {
      slug: "premium-hair-studio",
      name: "Premium Hair Studio",
      category: "salon",
      description: "Hair styling and color consultations with quick appointment booking and queue fallback.",
      address: "555 Fashion Boulevard",
      phone: "+1 (555) 567-8901",
      email: "style@premiumhair.com",
      latitude: 40.711,
      longitude: -74.007,
      rating: 4.9,
      reviewsCount: 645,
      imageUrl: "https://images.unsplash.com/photo-1521590832167-7bcbfaa6381f?auto=format&fit=crop&w=1200&q=80",
      websiteUrl: "https://www.premiumhair.com",
      tagsJson: JSON.stringify(["hair", "color", "beauty", "styling"]),
      averageServiceMinutes: 15,
      maxSkips: 2,
      maxReschedules: 3,
      pauseLimitMinutes: 30,
      bookingHorizonDays: 30,
      isQueueOpen: true,
      supportsReceipts: true,
      hours: defaultHours("10:00", "19:00", [2]),
      services: [
        { name: "Haircut", description: "Cuts and quick styling.", averageServiceMinutes: 20, maxActiveQueue: 10, supportsAppointments: true },
        { name: "Color Session", description: "Color treatment and consultation.", averageServiceMinutes: 45, maxActiveQueue: 6, supportsAppointments: true },
      ],
      counters: [
        { name: "Chair 1", status: "open", serviceIndexes: [0], assignedStaffName: "Aria Stylist" },
        { name: "Color Bar", status: "busy", serviceIndexes: [1], assignedStaffName: "Mina Colorist" },
      ],
      staff: [
        { name: "Aria Stylist", roleLabel: "Stylist", status: "available", counterIndex: 0 },
        { name: "Mina Colorist", roleLabel: "Colorist", status: "busy", counterIndex: 1 },
      ],
      notices: [],
    },
    {
      slug: "tech-school",
      name: "Tech School",
      category: "retail",
      description: "A modern learning center for coding, digital skills, and guided tech support with bookable advising sessions.",
      address: "101 Innovation Drive, Learning District",
      phone: "+1 (555) 789-2345",
      email: "hello@techschool.com",
      latitude: 40.7136,
      longitude: -74.0038,
      rating: 4.7,
      reviewsCount: 189,
      imageUrl: "https://images.unsplash.com/photo-1522202176988-66273c2fd55f?auto=format&fit=crop&w=1200&q=80",
      websiteUrl: "https://www.techschool.com",
      tagsJson: JSON.stringify(["coding", "classes", "enrollment", "student services"]),
      averageServiceMinutes: 20,
      maxSkips: 2,
      maxReschedules: 2,
      pauseLimitMinutes: 30,
      bookingHorizonDays: 21,
      isQueueOpen: true,
      supportsReceipts: true,
      hours: defaultHours("08:30", "18:00", [0]),
      services: [
        { name: "Admissions Help", description: "Course inquiries, enrollment questions, and class planning.", averageServiceMinutes: 18, maxActiveQueue: 14, supportsAppointments: true },
        { name: "Student Tech Support", description: "Help with portals, accounts, and classroom setup.", averageServiceMinutes: 12, maxActiveQueue: 20, supportsAppointments: false },
      ],
      counters: [
        { name: "Admissions Desk", status: "open", serviceIndexes: [0], assignedStaffName: "Nina Advisor" },
        { name: "Support Hub", status: "open", serviceIndexes: [1], assignedStaffName: "Owen Support" },
      ],
      staff: [
        { name: "Nina Advisor", roleLabel: "Admissions Advisor", status: "available", counterIndex: 0 },
        { name: "Owen Support", roleLabel: "Student Support", status: "available", counterIndex: 1 },
      ],
      notices: [{ title: "Orientation week", message: "Expect slightly longer waits for admissions help during afternoon orientation blocks.", severity: "info", isActive: true }],
    },
    {
      slug: "megastore-service-center",
      name: "MegaStore Service Center",
      category: "retail",
      description: "Customer service, pickups, and returns with live queueing and appointment slots.",
      address: "888 Shopping Center Drive",
      phone: "+1 (555) 678-9012",
      email: "service@megastore.com",
      latitude: 40.709,
      longitude: -74.009,
      rating: 4.3,
      reviewsCount: 421,
      imageUrl: "https://images.unsplash.com/photo-1519567241046-7f570eee3ce6?auto=format&fit=crop&w=1200&q=80",
      websiteUrl: "https://www.megastore.com",
      tagsJson: JSON.stringify(["retail", "returns", "pickup", "support"]),
      averageServiceMinutes: 10,
      maxSkips: 3,
      maxReschedules: 3,
      pauseLimitMinutes: 30,
      bookingHorizonDays: 14,
      isQueueOpen: true,
      supportsReceipts: true,
      hours: defaultHours("09:00", "20:00"),
      services: [
        { name: "Returns Desk", description: "Returns, exchanges, and refund support.", averageServiceMinutes: 12, maxActiveQueue: 20, supportsAppointments: true },
        { name: "Order Pickup", description: "Reserved online orders and lockers.", averageServiceMinutes: 8, maxActiveQueue: 25, supportsAppointments: true },
      ],
      counters: [
        { name: "Returns Counter", status: "open", serviceIndexes: [0], assignedStaffName: "Sam Support" },
        { name: "Pickup Counter", status: "open", serviceIndexes: [1], assignedStaffName: "Jules Pickup" },
      ],
      staff: [
        { name: "Sam Support", roleLabel: "Support Lead", status: "available", counterIndex: 0 },
        { name: "Jules Pickup", roleLabel: "Pickup Specialist", status: "available", counterIndex: 1 },
      ],
      notices: [{ title: "Locker issue", message: "Self-service lockers are unavailable. Please use the staffed pickup counter.", severity: "warning", isActive: true }],
    },
  ];

  for (const business of businessData) {
    const existing = sqlite.prepare("SELECT id FROM businesses WHERE slug = ?").get(business.slug) as { id: number } | undefined;
    if (existing) continue;

    const categoryId = getCategoryId(business.category)!;
    const businessId = insertAndReturnId(db, businesses, {
      slug: business.slug,
      name: business.name,
      categoryId,
      description: business.description,
      address: business.address,
      phone: business.phone,
      email: business.email,
      latitude: business.latitude,
      longitude: business.longitude,
      rating: business.rating,
      reviewsCount: business.reviewsCount,
      imageUrl: business.imageUrl,
      websiteUrl: business.websiteUrl,
      source: "local",
      externalProvider: null,
      externalPlaceId: null,
      tagsJson: business.tagsJson,
      averageServiceMinutes: business.averageServiceMinutes,
      maxSkips: business.maxSkips,
      maxReschedules: business.maxReschedules,
      pauseLimitMinutes: business.pauseLimitMinutes,
      bookingHorizonDays: business.bookingHorizonDays,
      isQueueOpen: business.isQueueOpen,
      supportsReceipts: business.supportsReceipts,
      createdAt: timestamp,
      updatedAt: timestamp,
    });

    db.insert(businessHours).values(business.hours.map((hour) => ({ businessId, ...hour }))).run();
    const createdServices = business.services.map((service) =>
      insertAndReturnId(db, businessServices, { businessId, ...service, createdAt: timestamp }),
    );
    const createdCounters = business.counters.map((counter) =>
      insertAndReturnId(db, serviceCounters, {
        businessId,
        name: counter.name,
        status: counter.status,
        activeServiceIdsJson: JSON.stringify(counter.serviceIndexes.map((index) => createdServices[index])),
        assignedStaffName: counter.assignedStaffName,
        createdAt: timestamp,
      }),
    );
    business.staff.forEach((member) => {
      db.insert(staffMembers).values({
        businessId,
        name: member.name,
        roleLabel: member.roleLabel,
        status: member.status,
        activeCounterId: createdCounters[member.counterIndex] ?? null,
        createdAt: timestamp,
      }).run();
    });
    business.notices.forEach((notice) => {
      db.insert(businessNotices).values({ businessId, ...notice, createdAt: timestamp }).run();
    });
  }
}

function backfillMissingBusinessServices() {
  const count = sqlite.prepare("SELECT COUNT(*) as count FROM business_services").get() as { count: number };
  if (count.count > 0) return;

  const timestamp = nowIso();
  const serviceTemplates: Record<string, Array<{ name: string; description: string; averageServiceMinutes: number; maxActiveQueue: number; supportsAppointments: boolean }>> = {
    "downtown-bank-trust": [
      { name: "Quick Teller", description: "Deposits, withdrawals, basic account help.", averageServiceMinutes: 10, maxActiveQueue: 25, supportsAppointments: false },
      { name: "Loan Consultation", description: "Personal and business lending consultations.", averageServiceMinutes: 30, maxActiveQueue: 8, supportsAppointments: true },
    ],
    "metro-hospital-urgent-care": [
      { name: "Urgent Assessment", description: "Immediate triage and first-pass assessment.", averageServiceMinutes: 18, maxActiveQueue: 20, supportsAppointments: false },
      { name: "Follow-up Consult", description: "Scheduled check-ins for non-emergency patients.", averageServiceMinutes: 25, maxActiveQueue: 12, supportsAppointments: true },
    ],
    "urban-bistro": [
      { name: "Indoor Table", description: "Main dining room table service.", averageServiceMinutes: 20, maxActiveQueue: 16, supportsAppointments: true },
      { name: "Patio Table", description: "Outdoor patio seating subject to weather.", averageServiceMinutes: 15, maxActiveQueue: 10, supportsAppointments: true },
    ],
    "city-services-center": [
      { name: "Licensing", description: "Permit and license processing.", averageServiceMinutes: 25, maxActiveQueue: 14, supportsAppointments: true },
      { name: "Records Request", description: "Civil records and document pickup.", averageServiceMinutes: 12, maxActiveQueue: 18, supportsAppointments: true },
    ],
    "premium-hair-studio": [
      { name: "Haircut", description: "Cuts and quick styling.", averageServiceMinutes: 20, maxActiveQueue: 10, supportsAppointments: true },
      { name: "Color Session", description: "Color treatment and consultation.", averageServiceMinutes: 45, maxActiveQueue: 6, supportsAppointments: true },
    ],
    "megastore-service-center": [
      { name: "Returns Desk", description: "Returns, exchanges, and refund support.", averageServiceMinutes: 12, maxActiveQueue: 20, supportsAppointments: true },
      { name: "Order Pickup", description: "Reserved online orders and lockers.", averageServiceMinutes: 8, maxActiveQueue: 25, supportsAppointments: true },
    ],
  };

  const businessesList = sqlite.prepare("SELECT id, slug FROM businesses").all() as Array<{ id: number; slug: string }>;
  for (const business of businessesList) {
    const templates = serviceTemplates[business.slug];
    if (!templates?.length) continue;
    db.insert(businessServices)
      .values(
        templates.map((service) => ({
          businessId: business.id,
          ...service,
          isActive: true,
          createdAt: timestamp,
        })),
      )
      .run();
  }
}

function backfillBusinessReceiptCapabilities() {
  const receiptEnabledSlugs = new Set([
    "downtown-bank-trust",
    "urban-bistro",
    "city-services-center",
    "premium-hair-studio",
    "tech-school",
    "megastore-service-center",
  ]);

  const rows = sqlite.prepare("SELECT id, slug, supports_receipts FROM businesses").all() as Array<{
    id: number;
    slug: string;
    supports_receipts: number;
  }>;

  rows.forEach((row) => {
    const nextValue = receiptEnabledSlugs.has(row.slug) ? 1 : 0;
    if (row.supports_receipts !== nextValue) {
      sqlite.prepare("UPDATE businesses SET supports_receipts = ? WHERE id = ?").run(nextValue, row.id);
    }
  });
}

function seedSubscriptions() {
  const rows = sqlite.prepare("SELECT id FROM businesses").all() as { id: number }[];
  const createdAt = nowIso();
  const existingIds = new Set(
    (sqlite.prepare("SELECT business_id FROM business_subscriptions").all() as Array<{ business_id: number }>).map((row) => row.business_id),
  );
  const missingRows = rows.filter((row) => !existingIds.has(row.id));
  if (!missingRows.length) return;

  db.insert(businessSubscriptions).values(
    missingRows.map((row, index) => ({
      businessId: row.id,
      plan: index % 3 === 0 ? "premium" : index % 2 === 0 ? "growth" : "starter",
      interval: index % 2 === 0 ? "yearly" : "monthly",
      status: "active",
      startedAt: createdAt,
      nextBillingAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * (index % 2 === 0 ? 365 : 30)).toISOString(),
      endsAt: null,
      updatedAt: createdAt,
    })),
  ).run();
}

function seedUsers() {
  const count = sqlite.prepare("SELECT COUNT(*) as count FROM users").get() as { count: number };
  if (count.count > 0) return;
  const rows = sqlite.prepare("SELECT id, slug FROM businesses").all() as { id: number; slug: string }[];
  const bankId = rows.find((row) => row.slug === "downtown-bank-trust")?.id ?? null;
  const restaurantId = rows.find((row) => row.slug === "urban-bistro")?.id ?? null;
  const createdAt = nowIso();

  db.insert(users).values([
    { email: "admin@qless.app", name: "QLESS Admin", passwordHash: hashSync("password123", 10), role: "admin", businessId: null, createdAt },
    { email: "owner.bank@qless.app", name: "Dana Owner", passwordHash: hashSync("password123", 10), role: "owner", businessId: bankId, createdAt },
    { email: "owner.restaurant@qless.app", name: "Marco Owner", passwordHash: hashSync("password123", 10), role: "owner", businessId: restaurantId, createdAt },
    { email: "sara@qless.app", name: "Sara Carter", passwordHash: hashSync("password123", 10), role: "user", businessId: null, createdAt },
    { email: "james@qless.app", name: "James Patel", passwordHash: hashSync("password123", 10), role: "user", businessId: null, createdAt },
  ]).run();
}

function getServiceIdByName(businessId: number, name: string) {
  const row = sqlite
    .prepare("SELECT id FROM business_services WHERE business_id = ? AND name = ?")
    .get(businessId, name) as { id: number } | undefined;
  return row?.id ?? null;
}

function addQueueEvent(queueEntryId: number, eventType: string, label: string, createdAt: string) {
  db.insert(queueEvents).values({ queueEntryId, eventType, label, createdAt }).run();
}

function seedOperationalData() {
  const queueCount = sqlite.prepare("SELECT COUNT(*) as count FROM queue_entries").get() as { count: number };
  if (queueCount.count > 0) return;

  const businessRows = sqlite.prepare("SELECT id, slug, name FROM businesses").all() as {
    id: number;
    slug: string;
    name: string;
  }[];
  const userRows = sqlite.prepare("SELECT id, email FROM users WHERE role = 'user'").all() as { id: number; email: string }[];
  const bank = businessRows.find((row) => row.slug === "downtown-bank-trust");
  const retail = businessRows.find((row) => row.slug === "megastore-service-center");
  const salon = businessRows.find((row) => row.slug === "premium-hair-studio");
  const sara = userRows.find((row) => row.email === "sara@qless.app");
  const james = userRows.find((row) => row.email === "james@qless.app");
  const createdAt = nowIso();

  if (bank && sara) {
    const queueId = insertAndReturnId(db, queueEntries, {
        businessId: bank.id,
        userId: sara.id,
        serviceId: getServiceIdByName(bank.id, "Quick Teller"),
        counterId: null,
        staffName: null,
        status: "waiting",
        queueNumber: "Q001",
        joinedAt: createdAt,
        estimatedWaitMinutes: 12,
        createdAt,
        updatedAt: createdAt,
      });
    addQueueEvent(queueId, "joined", "Joined Quick Teller queue.", createdAt);
  }

  if (retail && james) {
    db.insert(appointments).values({
      businessId: retail.id,
      userId: james.id,
      serviceId: getServiceIdByName(retail.id, "Order Pickup"),
      scheduledFor: new Date(Date.now() + 1000 * 60 * 90).toISOString(),
      status: "approved",
      notes: "Pickup order support",
      createdAt,
      updatedAt: createdAt,
    }).run();
    db.insert(savedPlaces).values({ userId: james.id, businessId: retail.id, note: "Fastest pickup option", createdAt }).run();
  }

  if (salon && sara) {
    const pastDate = new Date(Date.now() - 1000 * 60 * 60 * 26).toISOString();
    const queueId = insertAndReturnId(db, queueEntries, {
        businessId: salon.id,
        userId: sara.id,
        serviceId: getServiceIdByName(salon.id, "Haircut"),
        counterId: null,
        staffName: "Aria Stylist",
        status: "completed",
        queueNumber: "Q087",
        joinedAt: pastDate,
        calledAt: pastDate,
        completedAt: pastDate,
        estimatedWaitMinutes: 0,
        createdAt: pastDate,
        updatedAt: pastDate,
      });
    addQueueEvent(queueId, "completed", "Haircut visit completed.", pastDate);
    db.insert(visitFeedback).values({
      businessId: salon.id,
      userId: sara.id,
      queueEntryId: queueId,
      appointmentId: null,
      rating: 5,
      comment: "Smooth check-in and the stylist was ready right on time.",
      ownerReply: "Thank you for visiting us again!",
      createdAt: pastDate,
    }).run();
    db.insert(savedPlaces).values({ userId: sara.id, businessId: salon.id, note: "Favorite stylist for quick cuts", createdAt }).run();
  }
}

function seedConversations() {
  const count = sqlite.prepare("SELECT COUNT(*) as count FROM conversations").get() as { count: number };
  if (count.count > 0) return;

  const sara = sqlite.prepare("SELECT id FROM users WHERE email = ?").get("sara@qless.app") as { id: number } | undefined;
  const james = sqlite.prepare("SELECT id FROM users WHERE email = ?").get("james@qless.app") as { id: number } | undefined;
  const bank = sqlite.prepare("SELECT id FROM businesses WHERE slug = ?").get("downtown-bank-trust") as { id: number } | undefined;
  const retail = sqlite.prepare("SELECT id FROM businesses WHERE slug = ?").get("megastore-service-center") as { id: number } | undefined;
  const bankOwner = sqlite.prepare("SELECT id FROM users WHERE email = ?").get("owner.bank@qless.app") as { id: number } | undefined;
  const now = nowIso();

  if (sara && bank) {
    const activeQueue = sqlite
      .prepare("SELECT id FROM queue_entries WHERE business_id = ? AND user_id = ? AND status IN ('waiting','called','paused','in_service','delayed') ORDER BY created_at DESC LIMIT 1")
      .get(bank.id, sara.id) as { id: number } | undefined;
    const conversationId = insertAndReturnId(db, conversations, {
        businessId: bank.id,
        userId: sara.id,
        ownerId: bankOwner?.id ?? null,
        status: "active",
        visitType: activeQueue ? "queue" : "pre_visit",
        queueEntryId: activeQueue?.id ?? null,
        appointmentId: null,
        contextLabel: activeQueue ? "Live queue" : "Pre-visit question",
        closeReason: null,
        closedAt: null,
        archivedAt: null,
        createdAt: now,
        updatedAt: now,
      });
    db.insert(messages).values([
      {
        conversationId,
        businessId: bank.id,
        senderRole: "user",
        senderId: sara.id,
        body: "Hi, I want to pay my bills later today. Is the teller line moving on schedule?",
        createdAt: now,
        readAt: null,
      },
      {
        conversationId,
        businessId: bank.id,
        senderRole: "owner",
        senderId: bankOwner?.id ?? sara.id,
        body: "The queue is moving steadily. Smart Queue will keep your place in line if you join now.",
        createdAt: new Date(Date.now() + 60_000).toISOString(),
        readAt: null,
      },
    ]).run();
  }

  if (james && retail) {
    const retailOwner = sqlite.prepare("SELECT id FROM users WHERE business_id = ? AND role = 'owner'").get(retail.id) as { id: number } | undefined;
    const appointment = sqlite
      .prepare("SELECT id FROM appointments WHERE business_id = ? AND user_id = ? ORDER BY created_at DESC LIMIT 1")
      .get(retail.id, james.id) as { id: number } | undefined;
    const closedAt = new Date(Date.now() - 1000 * 60 * 45).toISOString();
    const conversationId = insertAndReturnId(db, conversations, {
        businessId: retail.id,
        userId: james.id,
        ownerId: retailOwner?.id ?? null,
        status: "archived",
        visitType: appointment ? "appointment" : "pre_visit",
        queueEntryId: null,
        appointmentId: appointment?.id ?? null,
        contextLabel: appointment ? "Upcoming appointment" : "Pre-visit question",
        closeReason: "completed",
        closedAt,
        archivedAt: closedAt,
        createdAt: new Date(Date.now() - 1000 * 60 * 90).toISOString(),
        updatedAt: closedAt,
      });
    db.insert(messages).values([
      {
        conversationId,
        businessId: retail.id,
        senderRole: "user",
        senderId: james.id,
        body: "Can I still pick up my order if I am running another errand first?",
        createdAt: new Date(Date.now() - 1000 * 60 * 88).toISOString(),
        readAt: closedAt,
      },
      {
        conversationId,
        businessId: retail.id,
        senderRole: "owner",
        senderId: retailOwner?.id ?? james.id,
        body: "Yes. Keep an eye on your timing card and head over when Smart Queue says your turn is close.",
        createdAt: new Date(Date.now() - 1000 * 60 * 86).toISOString(),
        readAt: closedAt,
      },
    ]).run();
  }
}

function seedReceipts() {
  const count = sqlite.prepare("SELECT COUNT(*) as count FROM visit_receipts").get() as { count: number };
  if (count.count > 0) return;

  const salon = sqlite.prepare("SELECT id FROM businesses WHERE slug = ?").get("premium-hair-studio") as { id: number } | undefined;
  const sara = sqlite.prepare("SELECT id FROM users WHERE email = ?").get("sara@qless.app") as { id: number } | undefined;
  const salonOwner = sqlite.prepare("SELECT id FROM users WHERE business_id = ? AND role = 'owner'").get(salon?.id ?? -1) as { id: number } | undefined;
  if (!salon || !sara || !salonOwner) return;

  const queueVisit = sqlite
    .prepare("SELECT id FROM queue_entries WHERE business_id = ? AND user_id = ? AND status = 'completed' ORDER BY updated_at DESC LIMIT 1")
    .get(salon.id, sara.id) as { id: number } | undefined;
  if (!queueVisit) return;

  const issuedAt = nowIso();
  db.insert(visitReceipts).values({
    businessId: salon.id,
    userId: sara.id,
    ownerId: salonOwner.id,
    queueEntryId: queueVisit.id,
    appointmentId: null,
    visitType: "queue",
    referenceNumber: "RCPT-PHS-1001",
    status: "issued",
    ownerNote: "Thank you for visiting Premium Hair Studio.",
    lineItemLabel: "Haircut service",
    amountCents: 2800,
    totalCents: 2800,
    paymentNote: "Paid in store",
    downloadToken: "seed-receipt-premium-hair-1001",
    issuedAt,
    updatedAt: issuedAt,
  }).run();
}

export function initializeDatabase() {
  logDatabaseBootstrap();
  createTables();
  ensureUserProfileColumns();
  ensureBusinessMetadataColumns();
  ensureConversationColumns();
  ensureNotificationColumns();
  ensureQueueEntryColumns();
  ensureSupportConversationColumns();
  ensureClaimReviewColumns();
  if (!enableDemoSeeding) {
    return;
  }
  seedCategories();
  seedBusinesses();
  backfillBusinessReceiptCapabilities();
  backfillMissingBusinessServices();
  seedUsers();
  seedOperationalData();
  seedSubscriptions();
  seedConversations();
  seedReceipts();
}

export { sqlite };
