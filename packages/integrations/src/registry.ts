import type { Repository } from "@mkh/database";
import { CONNECTOR_TYPES, type ConnectorType } from "@mkh/shared";
import type { Connector } from "./connector";
import { MockWhatsAppConnector } from "./connectors/mock/whatsapp.mock";
import { MockTelegramConnector } from "./connectors/mock/telegram.mock";
import { MockEmailConnector } from "./connectors/mock/email.mock";
import { MockMetaConnector } from "./connectors/mock/meta.mock";
import { MockMkConnectConnector } from "./connectors/mock/mkconnect.mock";
import { MockOtaConnector } from "./connectors/mock/ota.mock";

/**
 * Every connector is a mock today. Swapping any one for a real adapter
 * (once WhatsApp Cloud API / Meta Marketing API / Telegram Bot API / an
 * email provider / MK Connect / an OTA API is authorized) is a one-line
 * change here — exactly like `packages/connectors/src/registry.ts` and
 * `packages/ai-engine/src/registry.ts` already do for their own domains.
 */
export function createConnectorRegistry(repo: Repository): Record<ConnectorType, Connector> {
  return {
    whatsapp: new MockWhatsAppConnector(repo),
    telegram: new MockTelegramConnector(repo),
    email: new MockEmailConnector(repo),
    meta: new MockMetaConnector(repo),
    mkconnect: new MockMkConnectConnector(repo),
    ota: new MockOtaConnector(repo),
  };
}

export { CONNECTOR_TYPES };
