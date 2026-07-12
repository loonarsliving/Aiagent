import { createLogger } from "@mkh/shared";
import type { NotificationChannel } from "../channel";

const logger = createLogger("notifications:email");

/** Skeleton for a transactional email provider (Resend/SendGrid/etc). Inert until EMAIL_PROVIDER_API_KEY is set. */
export const emailChannel: NotificationChannel = {
  type: "email",
  async send(message) {
    const apiKey = process.env.EMAIL_PROVIDER_API_KEY;
    const from = process.env.EMAIL_FROM_ADDRESS;
    if (!apiKey || !from) {
      logger.warn("Email channel not configured, message not sent", { title: message.title });
      return { delivered: false, detail: "EMAIL_PROVIDER_API_KEY / EMAIL_FROM_ADDRESS not set." };
    }
    // TODO(integration): call the email provider's send API here.
    logger.info("would send email", { target: message.target, title: message.title });
    return { delivered: false, detail: "Email adapter implemented but not yet wired to a live send call." };
  },
};
