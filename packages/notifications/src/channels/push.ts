import { createLogger } from "@mkh/shared";
import type { NotificationChannel } from "../channel";

const logger = createLogger("notifications:push");

/** Skeleton for web/mobile push (e.g. Web Push / FCM). Inert until PUSH_PROVIDER_API_KEY is set. */
export const pushChannel: NotificationChannel = {
  type: "push",
  async send(message) {
    const apiKey = process.env.PUSH_PROVIDER_API_KEY;
    if (!apiKey) {
      logger.warn("Push channel not configured, message not sent", { title: message.title });
      return { delivered: false, detail: "PUSH_PROVIDER_API_KEY not set." };
    }
    // TODO(integration): call the push provider's send API here.
    logger.info("would send push notification", { target: message.target, title: message.title });
    return { delivered: false, detail: "Push adapter implemented but not yet wired to a live send call." };
  },
};
