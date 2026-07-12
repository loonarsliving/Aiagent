import { createLogger } from "@mkh/shared";
import type { NotificationChannel } from "../channel";

const logger = createLogger("notifications:whatsapp");

/**
 * Skeleton for WhatsApp Business API (Cloud API). Wire in the real
 * `POST /{phone-number-id}/messages` call once WHATSAPP_BUSINESS_TOKEN and
 * WHATSAPP_BUSINESS_PHONE_ID are set — until then this is inert.
 */
export const whatsappChannel: NotificationChannel = {
  type: "whatsapp",
  async send(message) {
    const token = process.env.WHATSAPP_BUSINESS_TOKEN;
    const phoneId = process.env.WHATSAPP_BUSINESS_PHONE_ID;
    if (!token || !phoneId) {
      logger.warn("WhatsApp channel not configured, message not sent", { title: message.title });
      return { delivered: false, detail: "WHATSAPP_BUSINESS_TOKEN / WHATSAPP_BUSINESS_PHONE_ID not set." };
    }
    // TODO(integration): call Meta WhatsApp Cloud API here.
    logger.info("would send WhatsApp message", { target: message.target, title: message.title });
    return { delivered: false, detail: "WhatsApp adapter implemented but not yet wired to a live send call." };
  },
};
