import type { NotificationMessage } from "@mkh/shared";

export interface NotificationChannel {
  readonly type: NotificationMessage["channel"];
  /** Delivers (or, for the dummy channel, just logs) a message that has already been persisted. */
  send(message: NotificationMessage): Promise<{ delivered: boolean; detail: string }>;
}
