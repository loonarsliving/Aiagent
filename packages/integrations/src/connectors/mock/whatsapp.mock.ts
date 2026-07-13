import type { Repository } from "@mkh/database";
import { BaseMockConnector, type MockConnectorOptions } from "../base-mock-connector";

/** Stands in for the WhatsApp Cloud API. Swap for a real adapter implementing the same `Connector` interface once WHATSAPP_* credentials are authorized — no other code changes. */
export class MockWhatsAppConnector extends BaseMockConnector {
  constructor(repo: Repository, options?: MockConnectorOptions) {
    super("whatsapp", repo, options);
  }
}
