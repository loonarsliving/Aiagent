import { createLogger, generateId, getConfig } from "@mkh/shared";
import { getRepository } from "@mkh/database";

const logger = createLogger("scheduler:distributed-lock");

export class LockNotAcquiredError extends Error {
  constructor(public readonly lockKey: string) {
    super(`Could not acquire distributed lock "${lockKey}" — held by another process`);
    this.name = "LockNotAcquiredError";
  }
}

export interface WithDistributedLockOptions {
  /** Lease duration in ms — defaults to config.SCHEDULER_LOCK_TTL_MS. Bounds how long a crashed holder can block others before the lock is reclaimable. */
  ttlMs?: number;
  /** Defaults to a fresh generated id — override only for deterministic tests. */
  holderId?: string;
}

/**
 * Runs `fn` only while holding an exclusive, TTL-based lease on `lockKey`
 * (see Repository.acquireLock/releaseLock — atomic via a Postgres RPC in
 * SupabaseRepository, in-memory in InMemoryRepository). If the lock is
 * already held by a live holder elsewhere, throws LockNotAcquiredError
 * without calling `fn` at all — callers decide what "couldn't get the
 * lock" means for them (the scheduler executor treats it as "someone else
 * is already running this slot, skip"). Always releases on the way out,
 * success or failure, via `finally`.
 */
export async function withDistributedLock<T>(lockKey: string, fn: () => Promise<T>, options: WithDistributedLockOptions = {}): Promise<T> {
  const repo = getRepository();
  const config = getConfig();
  const holderId = options.holderId ?? generateId("holder");
  const ttlMs = options.ttlMs ?? config.SCHEDULER_LOCK_TTL_MS;
  const expiresAt = new Date(Date.now() + ttlMs).toISOString();

  const acquired = await repo.acquireLock(lockKey, holderId, expiresAt);
  if (!acquired) {
    throw new LockNotAcquiredError(lockKey);
  }

  logger.info("lock acquired", { lockKey, holderId, ttlMs });
  try {
    return await fn();
  } finally {
    await repo.releaseLock(lockKey, holderId);
    logger.info("lock released", { lockKey, holderId });
  }
}
