import type { Repository } from "@mkh/database";
import { BaseMockConnector, type MockConnectorOptions } from "../base-mock-connector";

/** Stands in for the Telegram Bot API. Swap for a real adapter implementing the same `Connector` interface once TELEGRAM_* credentials are authorized — no other code changes. */
export class MockTelegramConnector extends BaseMockConnector {
  constructor(repo: Repository, options?: MockConnectorOptions) {
    super("telegram", repo, options);
  }
}
