import { generateId, getConfig, type AIModuleId, type NotificationChannelType, type NotificationMessage, type NotificationSeverity } from "@mkh/shared";
import { getRepository } from "@mkh/database";
import { refineNotificationWording } from "./ai-refinement";
import type { NotificationChannel } from "./channel";
import { dummyChannel } from "./channels/dummy";
import { whatsappChannel } from "./channels/whatsapp";
import { telegramChannel } from "./channels/telegram";
import { emailChannel } from "./channels/email";
import { pushChannel } from "./channels/push";

const CHANNELS: Record<NotificationChannelType, NotificationChannel> = {
  dummy: dummyChannel,
  whatsapp: whatsappChannel,
  telegram: telegramChannel,
  email: emailChannel,
  push: pushChannel,
};

export interface NotifyInput {
  title: string;
  body: string;
  severity?: NotificationSeverity;
  target?: string;
  sourceModuleId?: AIModuleId;
  /** Overrides NOTIFY_CHANNEL_DEFAULT for this single message. */
  channel?: NotificationChannelType;
}

/**
 * `notify()` IS the Notification Coordinator — the single funnel every AI
 * employee calls to raise something for a human's attention (e.g.
 * "Campaign A needs review", "Sales Cabang Makassar belum mencapai
 * target"). No employee is allowed to call a NotificationChannel directly;
 * this function is the only public entry point into this package's
 * dispatch logic (see index.ts — channels are exported for the coordinator
 * itself and for testing, not for employees to import). The message is
 * always persisted first (so it shows up in the dashboard even if delivery
 * fails/is unconfigured), then dispatched to the configured channel —
 * currently WhatsApp/Telegram/Email/Push are all inert until their env
 * vars are set, so every send safely resolves through the dummy channel.
 */
export async function notify(input: NotifyInput): Promise<NotificationMessage> {
  const config = getConfig();
  const channelType = input.channel ?? config.NOTIFY_CHANNEL_DEFAULT;
  const severity = input.severity ?? "info";

  const wording = await refineNotificationWording({
    title: input.title,
    body: input.body,
    severity,
    target: input.target,
  });

  const message: NotificationMessage = {
    id: generateId("ntf"),
    channel: channelType,
    severity,
    title: wording.title,
    body: wording.body,
    target: input.target,
    sourceModuleId: input.sourceModuleId,
    createdAt: new Date().toISOString(),
  };

  await getRepository().saveNotification(message);

  const channel = CHANNELS[channelType] ?? dummyChannel;
  await channel.send(message);

  return message;
}
