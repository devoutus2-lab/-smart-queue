export type CookieSameSite = "lax" | "strict" | "none";
export type CookieSecureMode = "auto" | "true" | "false";

export type RuntimeConfig = {
  nodeEnv: string;
  isProduction: boolean;
  host: string;
  port: number;
  appUrl: string;
  dataDir: string;
  databaseUrl: string;
  databaseAuthToken: string;
  demoSeedingEnabled: boolean;
  trustProxy: boolean | number;
  cookieDomain: string;
  cookieSameSite: CookieSameSite;
  cookieSecureMode: CookieSecureMode;
  corsAllowedOrigins: string[];
};

export type PersistenceStatus = {
  mode: "sqlite-local" | "sqlite-ephemeral" | "cloud-configured-unavailable";
  provider: "sqlite";
  durable: boolean;
  ephemeral: boolean;
  storageWarning: string | null;
};

function trimTrailingSlashes(value: string) {
  return value.trim().replace(/\/+$/, "");
}

function parseBoolean(value: string | undefined, fallback: boolean) {
  if (value == null) return fallback;
  const normalized = value.trim().toLowerCase();
  if (normalized === "true") return true;
  if (normalized === "false") return false;
  return fallback;
}

function parseNumber(value: string | undefined, fallback: number) {
  if (!value) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function parseTrustProxy(value: string | undefined): boolean | number {
  if (!value) return 1;
  const normalized = value.trim().toLowerCase();
  if (normalized === "true") return true;
  if (normalized === "false") return false;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 1;
}

export function createRuntimeConfig(env: NodeJS.ProcessEnv = process.env): RuntimeConfig {
  const nodeEnv = env.NODE_ENV?.trim() || "development";
  const isProduction = nodeEnv === "production";
  const demoSeedingFallback = isProduction ? "false" : "true";

  return {
    nodeEnv,
    isProduction,
    host: env.HOST?.trim() || "0.0.0.0",
    port: parseNumber(env.PORT, 3000),
    appUrl: trimTrailingSlashes(env.APP_URL || ""),
    dataDir: env.QTECH_DATA_DIR?.trim() || ".data",
    databaseUrl: env.DATABASE_URL?.trim() || "",
    databaseAuthToken: env.DATABASE_AUTH_TOKEN?.trim() || "",
    demoSeedingEnabled: parseBoolean(env.QTECH_ENABLE_DEMO_SEEDING, demoSeedingFallback === "true"),
    trustProxy: parseTrustProxy(env.TRUST_PROXY),
    cookieDomain: env.SESSION_COOKIE_DOMAIN?.trim() || "",
    cookieSameSite: ((env.SESSION_COOKIE_SAME_SITE?.trim().toLowerCase() || "lax") as CookieSameSite),
    cookieSecureMode: ((env.SESSION_COOKIE_SECURE?.trim().toLowerCase() || "auto") as CookieSecureMode),
    corsAllowedOrigins: (env.CORS_ALLOWED_ORIGINS || "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean),
  };
}

function normalizePath(value: string) {
  return value.replace(/\\/g, "/").toLowerCase();
}

function isEphemeralSqlitePath(config: RuntimeConfig) {
  const normalized = normalizePath(config.dataDir);
  return normalized === "/tmp" || normalized.startsWith("/tmp/") || normalized.includes("/render/project/src/.data");
}

function databaseUrlNeedsAuthToken(databaseUrl: string) {
  return databaseUrl.startsWith("libsql://") || databaseUrl.startsWith("https://");
}

export function getPersistenceStatus(config: RuntimeConfig): PersistenceStatus {
  if (config.databaseUrl) {
    return {
      mode: "cloud-configured-unavailable",
      provider: "sqlite",
      durable: false,
      ephemeral: false,
      storageWarning: "DATABASE_URL is configured, but this build still runs on the SQLite adapter. Durable cloud persistence is not active yet.",
    };
  }

  const ephemeral = config.isProduction && isEphemeralSqlitePath(config);
  return {
    mode: ephemeral ? "sqlite-ephemeral" : "sqlite-local",
    provider: "sqlite",
    durable: !ephemeral,
    ephemeral,
    storageWarning: ephemeral
      ? "Production data is stored on an ephemeral filesystem. New accounts, sessions, and queue data can disappear after a restart, redeploy, or free-tier recycle."
      : null,
  };
}

export function validateRuntimeConfig(config: RuntimeConfig) {
  const warnings: string[] = [];
  const errors: string[] = [];
  const persistence = getPersistenceStatus(config);

  if (config.isProduction && !config.appUrl) {
    warnings.push("APP_URL is not set. Absolute links and secure-cookie detection will rely on proxy headers.");
  }

  if (config.isProduction && !(process.env.ADMIN_SIGNUP_SECRET?.trim())) {
    warnings.push("ADMIN_SIGNUP_SECRET is not set. Admin self-registration will be disabled in production.");
  }

  if (config.isProduction && config.demoSeedingEnabled) {
    warnings.push("QTECH_ENABLE_DEMO_SEEDING is enabled in production. Demo data may be inserted into hosted environments.");
  }

  if (config.isProduction && persistence.storageWarning) {
    warnings.push(persistence.storageWarning);
  }

  if (config.isProduction && config.databaseUrl && databaseUrlNeedsAuthToken(config.databaseUrl) && !config.databaseAuthToken) {
    errors.push("DATABASE_AUTH_TOKEN is required for the configured managed database URL.");
  }

  if (config.cookieSameSite === "none" && config.cookieSecureMode === "false") {
    errors.push("SESSION_COOKIE_SAME_SITE=none requires SESSION_COOKIE_SECURE to be auto or true.");
  }

  if (config.corsAllowedOrigins.length > 0 && !config.appUrl) {
    warnings.push("CORS_ALLOWED_ORIGINS is set without APP_URL. Same-origin deployment is still recommended for auth and SSE.");
  }

  return { warnings, errors };
}

export function getRuntimeSummary(config: RuntimeConfig = runtimeConfig) {
  const persistence = getPersistenceStatus(config);
  return {
    nodeEnv: config.nodeEnv,
    host: config.host,
    port: config.port,
    appUrl: config.appUrl || null,
    trustProxy: config.trustProxy,
    demoSeedingEnabled: config.demoSeedingEnabled,
    databaseUrlConfigured: Boolean(config.databaseUrl),
    persistence,
    sameOriginDeployment: config.corsAllowedOrigins.length === 0,
  };
}

export function logRuntimeValidationSummary(config: RuntimeConfig = runtimeConfig) {
  const { warnings, errors } = validateRuntimeConfig(config);

  warnings.forEach((warning) => console.warn(`[runtime] ${warning}`));
  errors.forEach((error) => console.error(`[runtime] ${error}`));

  return { warnings, errors };
}

export const runtimeConfig = createRuntimeConfig();
