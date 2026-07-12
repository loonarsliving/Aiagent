import type { AIModuleId } from "@mkh/shared";

/**
 * "Internal system of record" data — the shape sales/finance data would take
 * once synced from the real ERP (eventually via MK Connect). For now these
 * are served as seeded fixtures by InMemoryRepository.
 */

export interface SalesRepProgress {
  repId: string;
  name: string;
  branch: string;
  targetIdr: number;
  achievedIdr: number;
  lastActivityDaysAgo: number;
}

export interface SalesSnapshot {
  asOf: string;
  periodLabel: string;
  reps: SalesRepProgress[];
}

export type FinanceTransactionType = "income" | "expense";

export interface FinanceTransaction {
  id: string;
  date: string;
  type: FinanceTransactionType;
  category: string;
  amountIdr: number;
  description: string;
}

export interface FinanceSnapshot {
  asOf: string;
  transactions: FinanceTransaction[];
}

/**
 * Which of Marketing Operation's 7 weekly checklist items (0=Senin..6=Minggu)
 * Markom has already marked done. In DATA_MODE=dummy this is a seeded
 * fixture standing in for what would be a real Markom-facing checkbox in
 * MK Connect — enough to make the "remind about incomplete tasks" SOP step
 * genuinely testable instead of hand-waved.
 */
export interface MarkomChecklistCompletionState {
  asOf: string;
  completedDayIndexes: number[];
}

export interface StaffAttendanceRecord {
  staffId: string;
  name: string;
  branch: string;
  role: string;
  presentDays: number;
  lateDays: number;
  leaveDaysTaken: number;
  leaveDaysQuota: number;
  /** 0-100. */
  kpiScore: number;
}

export interface HRSnapshot {
  asOf: string;
  periodLabel: string;
  workingDaysInPeriod: number;
  staff: StaffAttendanceRecord[];
}

/**
 * A single fact Marketing Intelligence has learned — a viral post, a
 * competitor move, a trend signal. Deduplicated by `id`; rediscovering the
 * same fact bumps `timesSeen`/`lastSeenAt` instead of creating a duplicate
 * row (see @mkh/memory's mergeKnowledgeItem, which is what decides that).
 */
export interface KnowledgeItem {
  id: string;
  moduleId: AIModuleId;
  category: string;
  title: string;
  sourceUrl?: string;
  firstSeenAt: string;
  lastSeenAt: string;
  timesSeen: number;
  metadata: Record<string, unknown>;
}
