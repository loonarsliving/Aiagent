import { getRepository } from "@mkh/database";
import { ConnectorManager } from "./connector-manager";

let instance: ConnectorManager | undefined;

/**
 * Single entry point for the process-wide `ConnectorManager` — mirrors
 * `@mkh/database`'s `getRepository()` singleton pattern. Reusing one
 * instance matters here specifically because `disable()`/`enable()` state
 * lives only in memory on the instance; without this, every caller
 * (dashboard server actions, a future background worker) constructing its
 * own `ConnectorManager` would silently lose each other's disable state.
 */
export function getConnectorManager(): ConnectorManager {
  if (!instance) instance = new ConnectorManager(getRepository());
  return instance;
}

/** Test-only escape hatch so tests can force a fresh manager. */
export function resetConnectorManagerCache(): void {
  instance = undefined;
}
