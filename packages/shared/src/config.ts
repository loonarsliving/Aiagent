import { z } from "zod";

const envSchema = z.object({
  DATA_MODE: z.enum(["dummy", "supabase"]).default("dummy"),
  NEXT_PUBLIC_SUPABASE_URL: z.string().optional(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),
  CRON_SECRET: z.string().optional(),
  NOTIFY_CHANNEL_DEFAULT: z
    .enum(["dummy", "whatsapp", "telegram", "email", "push"])
    .default("dummy"),
  /** Max attempts per employee task run, including the first try. 1 = no retry. */
  MAX_RETRY_ATTEMPTS: z.coerce.number().int().min(1).max(10).default(3),
  /** Base backoff in ms before a retry; doubles each attempt (1x, 2x, 4x, ...). */
  RETRY_BACKOFF_MS: z.coerce.number().int().min(0).max(60_000).default(200),
});

export type AppConfig = z.infer<typeof envSchema>;

let cached: AppConfig | undefined;

/**
 * Parses process.env once and caches the result. Unset/optional vars are
 * fine — every downstream package treats a missing credential as "stay in
 * dummy/no-op mode" rather than throwing, so this never blocks local dev.
 */
export function getConfig(): AppConfig {
  if (!cached) {
    cached = envSchema.parse({
      DATA_MODE: process.env.DATA_MODE,
      NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
      CRON_SECRET: process.env.CRON_SECRET,
      NOTIFY_CHANNEL_DEFAULT: process.env.NOTIFY_CHANNEL_DEFAULT,
      MAX_RETRY_ATTEMPTS: process.env.MAX_RETRY_ATTEMPTS,
      RETRY_BACKOFF_MS: process.env.RETRY_BACKOFF_MS,
    });
  }
  return cached;
}

/** Test-only escape hatch to force a fresh parse after mutating process.env. */
export function resetConfigCache(): void {
  cached = undefined;
}
