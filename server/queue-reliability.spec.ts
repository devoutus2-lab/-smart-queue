import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

type Harness = {
  baseUrl: string;
  cleanup: () => Promise<void>;
};

type ApiResult<T> = {
  status: number;
  data: T;
  cookie: string | null;
};

const originalEnv = {
  NODE_ENV: process.env.NODE_ENV,
  QTECH_DATA_DIR: process.env.QTECH_DATA_DIR,
  QTECH_ENABLE_DEMO_SEEDING: process.env.QTECH_ENABLE_DEMO_SEEDING,
  ADMIN_SIGNUP_SECRET: process.env.ADMIN_SIGNUP_SECRET,
  APP_URL: process.env.APP_URL,
};

afterEach(() => {
  process.env.NODE_ENV = originalEnv.NODE_ENV;
  restoreEnv("QTECH_DATA_DIR", originalEnv.QTECH_DATA_DIR);
  restoreEnv("QTECH_ENABLE_DEMO_SEEDING", originalEnv.QTECH_ENABLE_DEMO_SEEDING);
  restoreEnv("ADMIN_SIGNUP_SECRET", originalEnv.ADMIN_SIGNUP_SECRET);
  restoreEnv("APP_URL", originalEnv.APP_URL);
});

function restoreEnv(key: string, value: string | undefined) {
  if (value === undefined) {
    delete process.env[key];
  } else {
    process.env[key] = value;
  }
}

async function startHarness(): Promise<Harness> {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "qtech-queue-"));
  process.env.NODE_ENV = "test";
  process.env.QTECH_DATA_DIR = tempDir;
  process.env.QTECH_ENABLE_DEMO_SEEDING = "true";
  process.env.ADMIN_SIGNUP_SECRET = "test-admin-secret";
  delete process.env.APP_URL;

  vi.resetModules();

  const [{ createServer }, { sqlite }] = await Promise.all([
    import("./index"),
    import("./db"),
  ]);

  const app = createServer();
  const server = await new Promise<import("node:http").Server>((resolve) => {
    const instance = app.listen(0, "127.0.0.1", () => resolve(instance));
  });
  const address = server.address();
  const port = typeof address === "object" && address ? address.port : 0;

  return {
    baseUrl: `http://127.0.0.1:${port}`,
    cleanup: async () => {
      await new Promise<void>((resolve, reject) => {
        server.close((error) => {
          if (error) reject(error);
          else resolve();
        });
      });
      sqlite.close();
      vi.resetModules();
      try {
        fs.rmSync(tempDir, { recursive: true, force: true });
      } catch {
        // Windows can briefly hold sqlite sidecar files after close in CI/dev.
      }
    },
  };
}

async function apiRequest<T>(baseUrl: string, url: string, init: RequestInit = {}): Promise<ApiResult<T>> {
  const response = await fetch(`${baseUrl}${url}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
  const data = (await response.json()) as T;
  const rawCookie = response.headers.get("set-cookie");
  return {
    status: response.status,
    data,
    cookie: rawCookie ? rawCookie.split(";")[0] : null,
  };
}

async function login(baseUrl: string, email: string, password: string) {
  const result = await apiRequest<{ data?: { user: { id: number } }; error?: { message: string } }>(baseUrl, "/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  expect(result.status).toBe(200);
  expect(result.cookie).toBeTruthy();
  return result.cookie!;
}

async function createOwnerBusiness(baseUrl: string) {
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const result = await apiRequest<{ data?: { user: { id: number } } }>(baseUrl, "/api/auth/register-owner", {
    method: "POST",
    body: JSON.stringify({
      name: "Queue Owner",
      email: `owner-${suffix}@example.com`,
      password: "password123",
      target: {
        mode: "new",
        businessName: `Queue Demo ${suffix}`,
        category: "bank",
        description: "Queue reliability demo business for concurrent team testing.",
        address: "123 Demo Street",
        phone: "+1 555 000 0000",
        businessEmail: `biz-${suffix}@example.com`,
        websiteUrl: "",
        subscriptionPlan: "growth",
        subscriptionInterval: "monthly",
      },
    }),
  });
  expect(result.status).toBe(200);
  expect(result.cookie).toBeTruthy();

  const openQueue = await apiRequest(baseUrl, "/api/owner/queue/open-state", {
    method: "PATCH",
    headers: { Cookie: result.cookie! },
    body: JSON.stringify({ open: true }),
  });
  expect(openQueue.status).toBe(200);

  const dashboard = await apiRequest<{
    data: {
      business: { id: number; services: Array<{ id: number; isActive: boolean }> };
      counters: Array<{ id: number; status: string; assignedStaffName: string | null }>;
    };
  }>(
    baseUrl,
    "/api/owner/dashboard",
    { headers: { Cookie: result.cookie! } },
  );
  expect(dashboard.status).toBe(200);
  const serviceId = dashboard.data.data.business.services.find((service) => service.isActive)?.id;
  const counter = dashboard.data.data.counters.find((item) => item.status !== "offline");
  expect(serviceId).toBeTypeOf("number");
  expect(counter?.id).toBeTypeOf("number");

  return {
    ownerCookie: result.cookie!,
    businessId: dashboard.data.data.business.id,
    serviceId: serviceId!,
    counterId: counter!.id,
    staffName: counter!.assignedStaffName ?? "Queue Demo Staff",
  };
}

async function joinQueue(baseUrl: string, cookie: string, businessId: number, serviceId: number) {
  return apiRequest<{ data?: { entryId: number }; error?: { message: string } }>(baseUrl, "/api/queue/join", {
    method: "POST",
    headers: { Cookie: cookie },
    body: JSON.stringify({ businessId, serviceId }),
  });
}

async function getOwnerQueue(baseUrl: string, cookie: string) {
  return apiRequest<{ data: { entries: Array<{ id: number; queueNumber: string; userName: string; status: string; position: number | null }> } }>(
    baseUrl,
    "/api/owner/queue",
    { headers: { Cookie: cookie } },
  );
}

async function getMyQueue(baseUrl: string, cookie: string) {
  return apiRequest<{ data: { entries: Array<{ id: number; status: string; position: number | null }> } }>(baseUrl, "/api/queue/my-active", {
    headers: { Cookie: cookie },
  });
}

describe("queue reliability", () => {
  it("assigns unique queue numbers to near-simultaneous joins", async () => {
    const harness = await startHarness();
    try {
      const { baseUrl } = harness;
      const [saraCookie, jamesCookie] = await Promise.all([
        login(baseUrl, "sara@qless.app", "password123"),
        login(baseUrl, "james@qless.app", "password123"),
      ]);
      const { businessId, serviceId, ownerCookie } = await createOwnerBusiness(baseUrl);

      const [saraJoin, jamesJoin] = await Promise.all([
        joinQueue(baseUrl, saraCookie, businessId, serviceId),
        joinQueue(baseUrl, jamesCookie, businessId, serviceId),
      ]);

      expect(saraJoin.status).toBe(200);
      expect(jamesJoin.status).toBe(200);

      const ownerQueue = await getOwnerQueue(baseUrl, ownerCookie);
      const activeEntries = ownerQueue.data.data.entries.filter((entry) => entry.status === "waiting");

      expect(activeEntries).toHaveLength(2);
      expect(new Set(activeEntries.map((entry) => entry.queueNumber)).size).toBe(2);
    } finally {
      await harness.cleanup();
    }
  }, 20_000);

  it("prevents the same user from creating two active entries concurrently", async () => {
    const harness = await startHarness();
    try {
      const { baseUrl } = harness;
      const saraCookie = await login(baseUrl, "sara@qless.app", "password123");
      const { businessId, serviceId, ownerCookie } = await createOwnerBusiness(baseUrl);

      const [firstJoin, secondJoin] = await Promise.all([
        joinQueue(baseUrl, saraCookie, businessId, serviceId),
        joinQueue(baseUrl, saraCookie, businessId, serviceId),
      ]);

      expect([firstJoin.status, secondJoin.status].sort()).toEqual([200, 400]);
      const ownerQueue = await getOwnerQueue(baseUrl, ownerCookie);
      expect(ownerQueue.data.data.entries.filter((entry) => entry.status === "waiting")).toHaveLength(1);
    } finally {
      await harness.cleanup();
    }
  }, 20_000);

  it("moves skipped and rescheduled entries to the back of the waiting line", async () => {
    const harness = await startHarness();
    try {
      const { baseUrl } = harness;
      const { businessId, serviceId, ownerCookie } = await createOwnerBusiness(baseUrl);

      const userACookie = await login(baseUrl, "sara@qless.app", "password123");
      const userBCookie = await login(baseUrl, "james@qless.app", "password123");
      const userCRegister = await apiRequest<{ data?: { user: { id: number } } }>(baseUrl, "/api/auth/register", {
        method: "POST",
        body: JSON.stringify({ name: "Taylor Demo", email: "taylor@example.com", password: "password123" }),
      });
      expect(userCRegister.status).toBe(200);
      const userCCookie = userCRegister.cookie!;

      await joinQueue(baseUrl, userACookie, businessId, serviceId);
      await joinQueue(baseUrl, userBCookie, businessId, serviceId);
      await joinQueue(baseUrl, userCCookie, businessId, serviceId);

      let ownerQueue = await getOwnerQueue(baseUrl, ownerCookie);
      expect(ownerQueue.data.data.entries.slice(0, 3).map((entry) => entry.userName)).toEqual(["Sara Carter", "James Patel", "Taylor Demo"]);

      const saraEntryId = ownerQueue.data.data.entries.find((entry) => entry.userName === "Sara Carter")!.id;
      const jamesEntryId = ownerQueue.data.data.entries.find((entry) => entry.userName === "James Patel")!.id;

      const skipResult = await apiRequest(baseUrl, `/api/queue/${saraEntryId}/skip`, {
        method: "POST",
        headers: { Cookie: userACookie },
      });
      expect(skipResult.status).toBe(200);

      ownerQueue = await getOwnerQueue(baseUrl, ownerCookie);
      expect(ownerQueue.data.data.entries.slice(0, 3).map((entry) => entry.userName)).toEqual(["James Patel", "Taylor Demo", "Sara Carter"]);

      const rescheduleResult = await apiRequest(baseUrl, `/api/queue/${jamesEntryId}/reschedule`, {
        method: "POST",
        headers: { Cookie: userBCookie },
      });
      expect(rescheduleResult.status).toBe(200);

      ownerQueue = await getOwnerQueue(baseUrl, ownerCookie);
      expect(ownerQueue.data.data.entries.slice(0, 3).map((entry) => entry.userName)).toEqual(["Taylor Demo", "Sara Carter", "James Patel"]);
    } finally {
      await harness.cleanup();
    }
  }, 20_000);

  it("keeps pause and owner state transitions visible across guest and owner views", async () => {
    const harness = await startHarness();
    try {
      const { baseUrl } = harness;
      const [saraCookie, jamesCookie] = await Promise.all([
        login(baseUrl, "sara@qless.app", "password123"),
        login(baseUrl, "james@qless.app", "password123"),
      ]);
      const { businessId, serviceId, ownerCookie, counterId, staffName } = await createOwnerBusiness(baseUrl);

      await joinQueue(baseUrl, saraCookie, businessId, serviceId);
      await joinQueue(baseUrl, jamesCookie, businessId, serviceId);

      let ownerQueue = await getOwnerQueue(baseUrl, ownerCookie);
      const saraEntryId = ownerQueue.data.data.entries.find((entry) => entry.userName === "Sara Carter")!.id;

      const pauseResult = await apiRequest(baseUrl, `/api/queue/${saraEntryId}/pause`, {
        method: "POST",
        headers: { Cookie: saraCookie },
      });
      expect(pauseResult.status).toBe(200);

      ownerQueue = await getOwnerQueue(baseUrl, ownerCookie);
      expect(ownerQueue.data.data.entries.find((entry) => entry.userName === "Sara Carter")?.status).toBe("paused");
      expect(ownerQueue.data.data.entries.find((entry) => entry.userName === "James Patel")?.position).toBe(1);

      const resumeResult = await apiRequest(baseUrl, `/api/queue/${saraEntryId}/resume`, {
        method: "POST",
        headers: { Cookie: saraCookie },
      });
      expect(resumeResult.status).toBe(200);

      const callResult = await apiRequest(baseUrl, `/api/owner/queue/${saraEntryId}/call-next`, {
        method: "POST",
        headers: { Cookie: ownerCookie },
      });
      expect(callResult.status).toBe(200);

      const myQueue = await getMyQueue(baseUrl, saraCookie);
      expect(myQueue.data.data.entries.find((entry) => entry.id === saraEntryId)?.status).toBe("called");

      const assignResult = await apiRequest(baseUrl, `/api/owner/queue/${saraEntryId}/assign`, {
        method: "POST",
        headers: { Cookie: ownerCookie },
        body: JSON.stringify({ serviceId, counterId, staffName }),
      });
      expect(assignResult.status).toBe(200);

      const inServiceResult = await apiRequest(baseUrl, `/api/owner/queue/${saraEntryId}/in-service`, {
        method: "POST",
        headers: { Cookie: ownerCookie },
      });
      expect(inServiceResult.status).toBe(200);

      const inServiceQueue = await getMyQueue(baseUrl, saraCookie);
      expect(inServiceQueue.data.data.entries.find((entry) => entry.id === saraEntryId)?.status).toBe("in_service");

      const completeResult = await apiRequest(baseUrl, `/api/owner/queue/${saraEntryId}/complete`, {
        method: "POST",
        headers: { Cookie: ownerCookie },
      });
      expect(completeResult.status).toBe(200);

      const afterComplete = await getMyQueue(baseUrl, saraCookie);
      expect(afterComplete.data.data.entries.find((entry) => entry.id === saraEntryId)).toBeUndefined();
    } finally {
      await harness.cleanup();
    }
  }, 20_000);
});
