import { describe, expect, it } from "vitest";
import { CONNECTOR_REQUIRED_ENV, isConnectorConfigured, missingConnectorEnv } from "./connector-config";

describe("connector-config", () => {
  it("reports every connector as unconfigured when no relevant env vars are set", () => {
    for (const type of Object.keys(CONNECTOR_REQUIRED_ENV) as (keyof typeof CONNECTOR_REQUIRED_ENV)[]) {
      expect(isConnectorConfigured(type, {})).toBe(false);
      expect(missingConnectorEnv(type, {})).toEqual(CONNECTOR_REQUIRED_ENV[type]);
    }
  });

  it("reports a connector as configured only once every one of its required env vars is set", () => {
    expect(isConnectorConfigured("whatsapp", { WHATSAPP_ACCESS_TOKEN: "x" })).toBe(false);
    expect(
      isConnectorConfigured("whatsapp", {
        WHATSAPP_ACCESS_TOKEN: "x",
        WHATSAPP_PHONE_NUMBER_ID: "y",
        WHATSAPP_BUSINESS_ACCOUNT_ID: "z",
        WHATSAPP_VERIFY_TOKEN: "w",
      }),
    ).toBe(true);
  });

  it("missingConnectorEnv lists only the still-unset vars", () => {
    expect(missingConnectorEnv("meta", { META_ADS_ACCESS_TOKEN: "x" })).toEqual(["META_ADS_ACCOUNT_ID"]);
  });
});
