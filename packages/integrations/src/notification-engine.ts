import type { ConnectorType, OutboundMessageContent } from "@mkh/shared";
import type { SendResult } from "./connector";
import type { ConnectorManager, DispatchAction } from "./connector-manager";

export interface NotificationEngineInput {
  connector: ConnectorType;
  recipient: string;
  content: OutboundMessageContent;
}

/**
 * Channel-agnostic outbound message dispatch (Sprint 4A brief, Part 7).
 * Supports every `OutboundMessageContent` kind — text, image, pdf,
 * template, buttons, and whatever "future interactive message" kind gets
 * added to that union later — by routing through `ConnectorManager`,
 * which already owns retry/backoff/DLQ via the Job Queue. This class has
 * no WhatsApp-specific (or any channel-specific) logic anywhere in it:
 * the `connector` a caller passes in is just data, exactly as
 * interchangeable as every other `ConnectorType`.
 */
export class NotificationEngine {
  constructor(private readonly manager: ConnectorManager) {}

  async send(input: NotificationEngineInput): Promise<SendResult> {
    const action = actionFor(input.content);
    return this.manager.route(input.connector, action, dispatchInputFor(input.recipient, input.content));
  }
}

function actionFor(content: OutboundMessageContent): DispatchAction {
  if (content.kind === "template") return "sendTemplate";
  if (content.kind === "image" || content.kind === "pdf") return "sendMedia";
  return "sendMessage"; // text, buttons, and any future kind not yet backed by a dedicated connector capability
}

function dispatchInputFor(recipient: string, content: OutboundMessageContent): unknown {
  if (content.kind === "template") {
    return { recipient, templateName: content.templateName, params: content.params };
  }
  if (content.kind === "image") {
    return { recipient, url: content.url, caption: content.caption };
  }
  if (content.kind === "pdf") {
    return { recipient, url: content.url, caption: content.filename };
  }
  return { recipient, content };
}
