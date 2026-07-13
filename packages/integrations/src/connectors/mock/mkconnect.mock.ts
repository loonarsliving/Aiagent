import type { Repository } from "@mkh/database";
import { BaseMockConnector, type MockConnectorOptions } from "../base-mock-connector";

/** Stands in for MK Connect (mkh.haluoleo.id). Swap for a real adapter implementing the same `Connector` interface once MK_CONNECT_* credentials are authorized — no other code changes. Blocked at the code level until then, same as `packages/connectors`' ExternalSystemConnector guardrail. */
export class MockMkConnectConnector extends BaseMockConnector {
  constructor(repo: Repository, options?: MockConnectorOptions) {
    super("mkconnect", repo, options);
  }
}
