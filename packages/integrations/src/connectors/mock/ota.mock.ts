import type { Repository } from "@mkh/database";
import { BaseMockConnector, type MockConnectorOptions } from "../base-mock-connector";

/** Stands in for OTA platform APIs (Booking.com, Traveloka, etc). Swap for a real adapter implementing the same `Connector` interface once OTA_* credentials are authorized — no other code changes. */
export class MockOtaConnector extends BaseMockConnector {
  constructor(repo: Repository, options?: MockConnectorOptions) {
    super("ota", repo, options);
  }
}
