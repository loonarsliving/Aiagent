import type { Repository } from "@mkh/database";
import { CONNECTOR_TYPES, type ConnectorType } from "@mkh/shared";
import type { Connector } from "./connector";
import { isConnectorConfigured } from "./connector-config";
import { MockWhatsAppConnector } from "./connectors/mock/whatsapp.mock";
import { MockTelegramConnector } from "./connectors/mock/telegram.mock";
import { MockEmailConnector } from "./connectors/mock/email.mock";
import { MockMetaConnector } from "./connectors/mock/meta.mock";
import { MockMkConnectConnector } from "./connectors/mock/mkconnect.mock";
import { MockOtaConnector } from "./connectors/mock/ota.mock";
import { WhatsAppCloudConnector } from "./connectors/whatsapp-cloud-connector";
import { createFetchWhatsAppHttpClient } from "./connectors/whatsapp-http-client";

/**
 * Every connector is a mock — except `whatsapp` as of Sprint 4B, which
 * activates `WhatsAppCloudConnector` (real Meta Graph API calls) the
 * moment `WHATSAPP_ACCESS_TOKEN` / `WHATSAPP_PHONE_NUMBER_ID` /
 * `WHATSAPP_BUSINESS_ACCOUNT_ID` / `WHATSAPP_VERIFY_TOKEN` are all set,
 * and falls straight back to the mock the moment any one of them is
 * unset. Swapping any *other* connector for a real adapter (once Meta
 * Marketing API / Telegram Bot API / an email provider / MK Connect / an
 * OTA API is authorized) is the same one-line change here — exactly like
 * `packages/connectors/src/registry.ts` and `packages/ai-engine/src/registry.ts`
 * already do for their own domains.
 */
export function createConnectorRegistry(repo: Repository): Record<ConnectorType, Connector> {
  return {
    whatsapp: createWhatsAppConnector(repo),
    telegram: new MockTelegramConnector(repo),
    email: new MockEmailConnector(repo),
    meta: new MockMetaConnector(repo),
    mkconnect: new MockMkConnectConnector(repo),
    ota: new MockOtaConnector(repo),
  };
}

function createWhatsAppConnector(repo: Repository): Connector {
  if (!isConnectorConfigured("whatsapp")) {
    return new MockWhatsAppConnector(repo);
  }
  const http = createFetchWhatsAppHttpClient(process.env.WHATSAPP_ACCESS_TOKEN!);
  return new WhatsAppCloudConnector(
    repo,
    {
      accessToken: process.env.WHATSAPP_ACCESS_TOKEN!,
      phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID!,
      businessAccountId: process.env.WHATSAPP_BUSINESS_ACCOUNT_ID!,
      verifyToken: process.env.WHATSAPP_VERIFY_TOKEN!,
    },
    http,
  );
}

export { CONNECTOR_TYPES };
