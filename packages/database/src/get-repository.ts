import { getConfig } from "@mkh/shared";
import type { Repository } from "./repository";
import { InMemoryRepository } from "./repositories/in-memory-repository";
import { SupabaseRepository } from "./repositories/supabase-repository";

let instance: Repository | undefined;

/**
 * Single entry point every consumer (ai-engine, dashboard, mcp-server)
 * should use instead of constructing a repository directly. Reads
 * DATA_MODE once and caches the instance for the life of the process.
 */
export function getRepository(): Repository {
  if (instance) return instance;

  const config = getConfig();
  if (config.DATA_MODE === "supabase") {
    if (!config.NEXT_PUBLIC_SUPABASE_URL || !config.SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error(
        "DATA_MODE=supabase requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to be set",
      );
    }
    instance = new SupabaseRepository(config.NEXT_PUBLIC_SUPABASE_URL, config.SUPABASE_SERVICE_ROLE_KEY);
  } else {
    instance = new InMemoryRepository();
  }
  return instance;
}

/** Test-only escape hatch so tests can force a fresh repository. */
export function resetRepositoryCache(): void {
  instance = undefined;
}
