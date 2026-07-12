import { createLogger } from "@mkh/shared";
import type { NotificationChannel } from "../channel";

const logger = createLogger("notifications:dummy");

/** Default channel — every environment can use this with zero configuration. */
export const dummyChannel: NotificationChannel = {
  type: "dummy",
  async send(message) {
    logger.info("notification (dummy)", {
      severity: message.severity,
      title: message.title,
      body: message.body,
      target: message.target ?? "(unset)",
    });
    return { delivered: true, detail: "Logged to console (dummy channel, no real delivery)." };
  },
};
