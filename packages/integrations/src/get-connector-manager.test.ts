import { afterEach, describe, expect, it } from "vitest";
import { resetRepositoryCache } from "@mkh/database";
import { getConnectorManager, resetConnectorManagerCache } from "./get-connector-manager";

describe("getConnectorManager", () => {
  afterEach(() => {
    resetConnectorManagerCache();
    resetRepositoryCache();
  });

  it("returns the same instance across calls", () => {
    expect(getConnectorManager()).toBe(getConnectorManager());
  });

  it("preserves disable() state across calls to the singleton", () => {
    getConnectorManager().disable("whatsapp");
    expect(getConnectorManager().isEnabled("whatsapp")).toBe(false);
  });

  it("resetConnectorManagerCache forces a fresh instance", () => {
    const first = getConnectorManager();
    resetConnectorManagerCache();
    expect(getConnectorManager()).not.toBe(first);
  });
});
