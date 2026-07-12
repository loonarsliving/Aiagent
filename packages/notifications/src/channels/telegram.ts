import { createLogger } from "@mkh/shared";
import type { NotificationChannel } from "../channel";

const logger = createLogger("notifications:telegram");

/** Skeleton for a Telegram Bot API sender (sendMessage). Inert until TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID are set. */
export const telegramChannel: NotificationChannel = {
  type: "telegram",
  async send(message) {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;
    if (!token || !chatId) {
      logger.warn("Telegram channel not configured, message not sent", { title: message.title });
      return { delivered: false, detail: "TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID not set." };
    }
    // TODO(integration): call https://api.telegram.org/bot<token>/sendMessage here.
    logger.info("would send Telegram message", { chatId, title: message.title });
    return { delivered: false, detail: "Telegram adapter implemented but not yet wired to a live send call." };
  },
};
