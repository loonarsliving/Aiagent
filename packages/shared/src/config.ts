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

  // --- AI Provider Layer (Sprint 2 — Reasoning Engine) ------------------
  /** Which AIProvider implementation the Reasoning Engine resolves through. Only "gemini" is implemented; the others are guardrail stubs. */
  AI_PROVIDER: z.enum(["gemini", "claude", "openai", "ollama"]).default("gemini"),
  /** Required only when AI_PROVIDER=gemini. Never hardcoded — read from env only. */
  GEMINI_API_KEY: z.string().optional(),
  GEMINI_MODEL: z.string().default("gemini-2.0-flash"),
  /** 0-2, higher = more creative/less deterministic. */
  AI_TEMPERATURE: z.coerce.number().min(0).max(2).default(0.3),
  AI_MAX_OUTPUT_TOKENS: z.coerce.number().int().min(64).max(8192).default(1024),
  /** Reasoning Engine's own retry loop around AIProvider.generate() — independent of MAX_RETRY_ATTEMPTS (which governs employee task retries). */
  AI_RETRY_ATTEMPTS: z.coerce.number().int().min(1).max(10).default(3),
  AI_RETRY_BACKOFF_MS: z.coerce.number().int().min(0).max(60_000).default(300),
  AI_TIMEOUT_MS: z.coerce.number().int().min(1_000).max(120_000).default(15_000),
  /** Gemini safety filter threshold — how aggressively to block flagged content categories. */
  AI_SAFETY_THRESHOLD: z
    .enum(["BLOCK_NONE", "BLOCK_ONLY_HIGH", "BLOCK_MEDIUM_AND_ABOVE", "BLOCK_LOW_AND_ABOVE"])
    .default("BLOCK_MEDIUM_AND_ABOVE"),
  /** Max knowledge/memory items the Retrieval Layer includes in a single reasoning prompt — token optimization, never "send the whole knowledge base." */
  AI_RETRIEVAL_TOP_K: z.coerce.number().int().min(1).max(50).default(8),
  /**
   * Escape hatch for the Notification Coordinator's optional Gemini
   * wording-refinement call inside notify() — every notify() call attempts
   * one Gemini call when true. Set to the literal string "false" to stay
   * within a tight API quota; falls back to original wording either way.
   * Deliberately NOT z.coerce.boolean() — that coerces via JS's Boolean(),
   * under which Boolean("false") is true (any non-empty string is
   * truthy), silently defeating the "set false to disable" instruction.
   */
  NOTIFY_AI_REFINEMENT_ENABLED: z
    .string()
    .optional()
    .transform((v) => v !== "false")
    .pipe(z.boolean()),

  // --- Company profile (Sprint 3A — no hardcoded business values) --------
  /** Grounding fact every Reasoning Engine prompt includes — never hardcoded, see company-context.ts. */
  COMPANY_NAME: z.string().default("PT Maha Karya Haluoleo"),
  COMPANY_INDUSTRY: z
    .string()
    .default(
      "Pengembang properti & villa (real estate developer) di Sulawesi Tenggara/Selatan — unit bisnis penjualan perumahan, villa, dan marketing digital",
    ),
  /** Every "what day is it" decision (scheduler cron, freshness checks) must agree on this, not the server's local timezone. */
  COMPANY_TIMEZONE: z.string().default("Asia/Makassar"),
  COMPANY_OWNER_TITLE: z.string().default("Owner"),
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
      AI_PROVIDER: process.env.AI_PROVIDER,
      GEMINI_API_KEY: process.env.GEMINI_API_KEY,
      GEMINI_MODEL: process.env.GEMINI_MODEL,
      AI_TEMPERATURE: process.env.AI_TEMPERATURE,
      AI_MAX_OUTPUT_TOKENS: process.env.AI_MAX_OUTPUT_TOKENS,
      AI_RETRY_ATTEMPTS: process.env.AI_RETRY_ATTEMPTS,
      AI_RETRY_BACKOFF_MS: process.env.AI_RETRY_BACKOFF_MS,
      AI_TIMEOUT_MS: process.env.AI_TIMEOUT_MS,
      AI_SAFETY_THRESHOLD: process.env.AI_SAFETY_THRESHOLD,
      AI_RETRIEVAL_TOP_K: process.env.AI_RETRIEVAL_TOP_K,
      NOTIFY_AI_REFINEMENT_ENABLED: process.env.NOTIFY_AI_REFINEMENT_ENABLED,
      COMPANY_NAME: process.env.COMPANY_NAME,
      COMPANY_INDUSTRY: process.env.COMPANY_INDUSTRY,
      COMPANY_TIMEZONE: process.env.COMPANY_TIMEZONE,
      COMPANY_OWNER_TITLE: process.env.COMPANY_OWNER_TITLE,
    });
  }
  return cached;
}

/** Test-only escape hatch to force a fresh parse after mutating process.env. */
export function resetConfigCache(): void {
  cached = undefined;
}
