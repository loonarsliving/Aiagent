import { afterEach, describe, expect, it } from "vitest";
import { InMemoryRepository } from "@mkh/database";
import { createConnectorRegistry } from "./registry";
import { MockWhatsAppConnector } from "./connectors/mock/whatsapp.mock";
import { WhatsAppCloudConnector } from "./connectors/whatsapp-cloud-connector";

const WHATSAPP_ENV_KEYS = ["WHATSAPP_ACCESS_TOKEN", "WHATSAPP_PHONE_NUMBER_ID", "WHATSAPP_BUSINESS_ACCOUNT_ID", "WHATSAPP_VERIFY_TOKEN"];

describe("createConnectorRegistry — whatsapp live/mock selection", () => {
  afterEach(() => {
    for (const key of WHATSAPP_ENV_KEYS) delete process.env[key];
  });

  it("falls back to MockWhatsAppConnector when no WhatsApp credentials are set", () => {
    const registry = createConnectorRegistry(new InMemoryRepository());
    expect(registry.whatsapp).toBeInstanceOf(MockWhatsAppConnector);
  });

  it("falls back to MockWhatsAppConnector when only some WhatsApp credentials are set", () => {
    process.env.WHATSAPP_ACCESS_TOKEN = "token";
    process.env.WHATSAPP_PHONE_NUMBER_ID = "123";
    // WHATSAPP_BUSINESS_ACCOUNT_ID and WHATSAPP_VERIFY_TOKEN deliberately left unset.
    const registry = createConnectorRegistry(new InMemoryRepository());
    expect(registry.whatsapp).toBeInstanceOf(MockWhatsAppConnector);
  });

  it("activates the real WhatsAppCloudConnector once every credential is set", () => {
    process.env.WHATSAPP_ACCESS_TOKEN = "token";
    process.env.WHATSAPP_PHONE_NUMBER_ID = "123";
    process.env.WHATSAPP_BUSINESS_ACCOUNT_ID = "456";
    process.env.WHATSAPP_VERIFY_TOKEN = "verify";

    const registry = createConnectorRegistry(new InMemoryRepository());
    expect(registry.whatsapp).toBeInstanceOf(WhatsAppCloudConnector);
  });

  it("other connectors stay mock regardless of WhatsApp env vars", () => {
    process.env.WHATSAPP_ACCESS_TOKEN = "token";
    process.env.WHATSAPP_PHONE_NUMBER_ID = "123";
    process.env.WHATSAPP_BUSINESS_ACCOUNT_ID = "456";
    process.env.WHATSAPP_VERIFY_TOKEN = "verify";

    const registry = createConnectorRegistry(new InMemoryRepository());
    expect(registry.telegram.type).toBe("telegram");
    expect(registry.email.type).toBe("email");
    expect(registry.meta.type).toBe("meta");
    expect(registry.mkconnect.type).toBe("mkconnect");
    expect(registry.ota.type).toBe("ota");
  });
});
