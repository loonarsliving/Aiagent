import type { Repository } from "@mkh/database";
import { BaseMockConnector, type MockConnectorOptions } from "../base-mock-connector";

/** Stands in for the Meta Marketing API. Swap for a real adapter implementing the same `Connector` interface once META_ADS_* credentials are authorized — no other code changes. */
export class MockMetaConnector extends BaseMockConnector {
  constructor(repo: Repository, options?: MockConnectorOptions) {
    super("meta", repo, options);
  }
}
