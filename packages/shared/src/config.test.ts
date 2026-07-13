import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { getConfig, resetConfigCache } from "./config";

const ENV_KEYS = [
  "DATA_MODE",
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "CRON_SECRET",
  "NOTIFY_CHANNEL_DEFAULT",
  "MAX_RETRY_ATTEMPTS",
  "RETRY_BACKOFF_MS",
  "AI_PROVIDER",
  "GEMINI_API_KEY",
  "GEMINI_MODEL",
  "AI_TEMPERATURE",
  "AI_MAX_OUTPUT_TOKENS",
  "AI_RETRY_ATTEMPTS",
  "AI_RETRY_BACKOFF_MS",
  "AI_TIMEOUT_MS",
  "AI_SAFETY_THRESHOLD",
  "AI_RETRIEVAL_TOP_K",
  "NOTIFY_AI_REFINEMENT_ENABLED",
  "QUEUE_MAX_ATTEMPTS",
  "QUEUE_RETRY_BACKOFF_MS",
  "SCHEDULER_LOCK_TTL_MS",
  "COMPANY_NAME",
  "COMPANY_INDUSTRY",
  "COMPANY_TIMEZONE",
  "COMPANY_OWNER_TITLE",
] as const;

let snapshot: Record<string, string | undefined>;

beforeEach(() => {
  snapshot = Object.fromEntries(ENV_KEYS.map((k) => [k, process.env[k]]));
  for (const k of ENV_KEYS) delete process.env[k];
  resetConfigCache();
});

afterEach(() => {
  for (const k of ENV_KEYS) {
    if (snapshot[k] === undefined) delete process.env[k];
    else process.env[k] = snapshot[k];
  }
  resetConfigCache();
});

describe("getConfig", () => {
  it("defaults DATA_MODE to dummy and NOTIFY_CHANNEL_DEFAULT to dummy when unset", () => {
    const config = getConfig();
    expect(config.DATA_MODE).toBe("dummy");
    expect(config.NOTIFY_CHANNEL_DEFAULT).toBe("dummy");
  });

  it("leaves optional Supabase/cron vars undefined rather than throwing when unset", () => {
    const config = getConfig();
    expect(config.NEXT_PUBLIC_SUPABASE_URL).toBeUndefined();
    expect(config.SUPABASE_SERVICE_ROLE_KEY).toBeUndefined();
    expect(config.CRON_SECRET).toBeUndefined();
  });

  it("parses DATA_MODE=supabase when explicitly set", () => {
    process.env.DATA_MODE = "supabase";
    resetConfigCache();
    expect(getConfig().DATA_MODE).toBe("supabase");
  });

  it("rejects an invalid DATA_MODE value instead of silently accepting it", () => {
    process.env.DATA_MODE = "not-a-real-mode";
    resetConfigCache();
    expect(() => getConfig()).toThrow();
  });

  it("defaults MAX_RETRY_ATTEMPTS to 3 and RETRY_BACKOFF_MS to 200 when unset", () => {
    const config = getConfig();
    expect(config.MAX_RETRY_ATTEMPTS).toBe(3);
    expect(config.RETRY_BACKOFF_MS).toBe(200);
  });

  it("coerces MAX_RETRY_ATTEMPTS from a string env var to a number", () => {
    process.env.MAX_RETRY_ATTEMPTS = "5";
    resetConfigCache();
    expect(getConfig().MAX_RETRY_ATTEMPTS).toBe(5);
  });

  it("rejects a MAX_RETRY_ATTEMPTS outside the sane 1-10 range", () => {
    process.env.MAX_RETRY_ATTEMPTS = "0";
    resetConfigCache();
    expect(() => getConfig()).toThrow();
  });

  it("caches the parsed config across calls until resetConfigCache is called", () => {
    process.env.DATA_MODE = "dummy";
    resetConfigCache();
    const first = getConfig();

    process.env.DATA_MODE = "supabase"; // mutate env without resetting cache
    const second = getConfig();

    expect(second).toBe(first); // same cached object, change not picked up yet
    expect(second.DATA_MODE).toBe("dummy");

    resetConfigCache();
    expect(getConfig().DATA_MODE).toBe("supabase"); // picked up after reset
  });

  it("defaults the AI Provider Layer to gemini with sane, documented defaults", () => {
    const config = getConfig();
    expect(config.AI_PROVIDER).toBe("gemini");
    expect(config.GEMINI_API_KEY).toBeUndefined();
    expect(config.GEMINI_MODEL).toBe("gemini-2.0-flash");
    expect(config.AI_TEMPERATURE).toBe(0.3);
    expect(config.AI_MAX_OUTPUT_TOKENS).toBe(1024);
    expect(config.AI_RETRY_ATTEMPTS).toBe(3);
    expect(config.AI_RETRY_BACKOFF_MS).toBe(300);
    expect(config.AI_TIMEOUT_MS).toBe(15_000);
    expect(config.AI_SAFETY_THRESHOLD).toBe("BLOCK_MEDIUM_AND_ABOVE");
    expect(config.AI_RETRIEVAL_TOP_K).toBe(8);
    expect(config.NOTIFY_AI_REFINEMENT_ENABLED).toBe(true);
  });

  it("rejects an unknown AI_PROVIDER instead of silently accepting it", () => {
    process.env.AI_PROVIDER = "not-a-real-provider";
    resetConfigCache();
    expect(() => getConfig()).toThrow();
  });

  it("coerces AI_TEMPERATURE from a string env var and rejects out-of-range values", () => {
    process.env.AI_TEMPERATURE = "0.7";
    resetConfigCache();
    expect(getConfig().AI_TEMPERATURE).toBe(0.7);

    process.env.AI_TEMPERATURE = "5";
    resetConfigCache();
    expect(() => getConfig()).toThrow();
  });

  it("reads GEMINI_API_KEY when set, without ever defaulting it to a real-looking value", () => {
    process.env.GEMINI_API_KEY = "test-key-not-real";
    resetConfigCache();
    expect(getConfig().GEMINI_API_KEY).toBe("test-key-not-real");
  });

  it('parses NOTIFY_AI_REFINEMENT_ENABLED="false" as false — regression guard against z.coerce.boolean()\'s Boolean("false") === true trap', () => {
    process.env.NOTIFY_AI_REFINEMENT_ENABLED = "false";
    resetConfigCache();
    expect(getConfig().NOTIFY_AI_REFINEMENT_ENABLED).toBe(false);
  });

  it('treats any value other than the literal string "false" as enabled', () => {
    process.env.NOTIFY_AI_REFINEMENT_ENABLED = "true";
    resetConfigCache();
    expect(getConfig().NOTIFY_AI_REFINEMENT_ENABLED).toBe(true);

    process.env.NOTIFY_AI_REFINEMENT_ENABLED = "1";
    resetConfigCache();
    expect(getConfig().NOTIFY_AI_REFINEMENT_ENABLED).toBe(true);
  });

  it("defaults the Job Queue and Scheduler Lock infrastructure settings (Sprint 3B)", () => {
    const config = getConfig();
    expect(config.QUEUE_MAX_ATTEMPTS).toBe(5);
    expect(config.QUEUE_RETRY_BACKOFF_MS).toBe(1_000);
    expect(config.SCHEDULER_LOCK_TTL_MS).toBe(300_000);
  });

  it("coerces the Sprint 3B infrastructure settings from string env vars", () => {
    process.env.QUEUE_MAX_ATTEMPTS = "8";
    process.env.QUEUE_RETRY_BACKOFF_MS = "2000";
    process.env.SCHEDULER_LOCK_TTL_MS = "60000";
    resetConfigCache();
    const config = getConfig();
    expect(config.QUEUE_MAX_ATTEMPTS).toBe(8);
    expect(config.QUEUE_RETRY_BACKOFF_MS).toBe(2_000);
    expect(config.SCHEDULER_LOCK_TTL_MS).toBe(60_000);
  });

  it("defaults the company profile to PT Maha Karya Haluoleo's real values (Sprint 3A: no hardcoded business values in code)", () => {
    const config = getConfig();
    expect(config.COMPANY_NAME).toBe("PT Maha Karya Haluoleo");
    expect(config.COMPANY_TIMEZONE).toBe("Asia/Makassar");
    expect(config.COMPANY_OWNER_TITLE).toBe("Owner");
    expect(config.COMPANY_INDUSTRY.length).toBeGreaterThan(0);
  });

  it("overrides every company profile value from env", () => {
    process.env.COMPANY_NAME = "Test Co";
    process.env.COMPANY_INDUSTRY = "Test Industry";
    process.env.COMPANY_TIMEZONE = "Asia/Jakarta";
    process.env.COMPANY_OWNER_TITLE = "CEO";
    resetConfigCache();

    const config = getConfig();
    expect(config.COMPANY_NAME).toBe("Test Co");
    expect(config.COMPANY_INDUSTRY).toBe("Test Industry");
    expect(config.COMPANY_TIMEZONE).toBe("Asia/Jakarta");
    expect(config.COMPANY_OWNER_TITLE).toBe("CEO");
  });
});
