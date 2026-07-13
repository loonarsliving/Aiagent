import type { JobPriority } from "@mkh/shared";

/** Lower rank = claimed first. Shared by InMemoryRepository and SupabaseRepository so job-priority ordering is defined exactly once. */
export const PRIORITY_RANK: Record<JobPriority, number> = { urgent: 0, high: 1, normal: 2, low: 3 };
