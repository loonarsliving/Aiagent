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
});
