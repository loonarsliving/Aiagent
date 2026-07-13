import { CONNECTOR_TYPES, type ConnectorType } from "@mkh/shared";

/**
 * Which env vars each connector expects once a real adapter replaces its
 * mock — read directly from `process.env`, matching the existing
 * convention in `packages/notifications/src/channels/*.ts` (Sprint 1)
 * rather than the zod-validated `@mkh/shared` config schema, since these
 * are per-external-service credentials, not core app configuration.
 * Nothing here is a secret itself — just the *names* of the env vars a
 * real integration would need. See `.env.example`.
 *
 * `whatsapp` is live as of Sprint 4B (`WhatsAppCloudConnector` — see
 * `connectors/whatsapp-cloud-connector.ts`); every other connector is
 * still mock-only, so its entry here just documents what a future real
 * adapter would need.
 */
export const CONNECTOR_REQUIRED_ENV: Record<ConnectorType, string[]> = {
  whatsapp: ["WHATSAPP_ACCESS_TOKEN", "WHATSAPP_PHONE_NUMBER_ID", "WHATSAPP_BUSINESS_ACCOUNT_ID", "WHATSAPP_VERIFY_TOKEN"],
  telegram: ["TELEGRAM_BOT_TOKEN", "TELEGRAM_CHAT_ID"],
  email: ["EMAIL_PROVIDER_API_KEY"],
  meta: ["META_ADS_ACCESS_TOKEN", "META_ADS_ACCOUNT_ID"],
  mkconnect: ["MK_CONNECT_BASE_URL", "MK_CONNECT_API_KEY"],
  ota: ["OTA_API_KEY"],
};

/** True once every env var this connector needs is set. For `whatsapp`, true means the real `WhatsAppCloudConnector` is active (see `registry.ts`); for every other connector it's still documentation only, since no other live adapter exists yet. */
export function isConnectorConfigured(type: ConnectorType, env: NodeJS.ProcessEnv = process.env): boolean {
  return CONNECTOR_REQUIRED_ENV[type].every((key) => Boolean(env[key]));
}

export function missingConnectorEnv(type: ConnectorType, env: NodeJS.ProcessEnv = process.env): string[] {
  return CONNECTOR_REQUIRED_ENV[type].filter((key) => !env[key]);
}

export { CONNECTOR_TYPES };
