import { generateId, getConfig, type AIModuleId, type NotificationChannelType, type NotificationMessage, type NotificationSeverity } from "@mkh/shared";
import { getRepository } from "@mkh/database";
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
 * Every AI module calls this to raise something for a human's attention
 * (e.g. "Campaign A needs review", "Sales Cabang Makassar belum mencapai
 * target"). The message is always persisted first (so it shows up in the
 * dashboard even if delivery fails/is unconfigured), then dispatched to the
 * configured channel.
 */
export async function notify(input: NotifyInput): Promise<NotificationMessage> {
  const config = getConfig();
  const channelType = input.channel ?? config.NOTIFY_CHANNEL_DEFAULT;

  const message: NotificationMessage = {
    id: generateId("ntf"),
    channel: channelType,
    severity: input.severity ?? "info",
    title: input.title,
    body: input.body,
    target: input.target,
    sourceModuleId: input.sourceModuleId,
    createdAt: new Date().toISOString(),
  };

  await getRepository().saveNotification(message);

  const channel = CHANNELS[channelType] ?? dummyChannel;
  await channel.send(message);

  return message;
}
