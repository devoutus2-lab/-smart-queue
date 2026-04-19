import { describe, expect, it } from "vitest";
import { createRuntimeConfig, validateRuntimeConfig } from "./runtime";

describe("runtime configuration", () => {
  it("defaults production demo seeding to false", () => {
    const config = createRuntimeConfig({
      NODE_ENV: "production",
    });

    expect(config.demoSeedingEnabled).toBe(false);
  });

  it("flags insecure SameSite none cookies", () => {
    const config = createRuntimeConfig({
      NODE_ENV: "production",
      SESSION_COOKIE_SAME_SITE: "none",
      SESSION_COOKIE_SECURE: "false",
    });

    const result = validateRuntimeConfig(config);

    expect(result.errors).toContain("SESSION_COOKIE_SAME_SITE=none requires SESSION_COOKIE_SECURE to be auto or true.");
  });

  it("warns when production app url is missing", () => {
    const config = createRuntimeConfig({
      NODE_ENV: "production",
      QTECH_ENABLE_DEMO_SEEDING: "false",
    });

    const result = validateRuntimeConfig(config);

    expect(result.warnings).toContain(
      "APP_URL is not set. Absolute links and secure-cookie detection will rely on proxy headers.",
    );
  });
});
