import type { Repository } from "@mkh/database";
import { BaseMockConnector, type MockConnectorOptions } from "../base-mock-connector";

/** Stands in for an email provider (SES/SendGrid/etc). Swap for a real adapter implementing the same `Connector` interface once EMAIL_* credentials are authorized — no other code changes. */
export class MockEmailConnector extends BaseMockConnector {
  constructor(repo: Repository, options?: MockConnectorOptions) {
    super("email", repo, options);
  }
}
