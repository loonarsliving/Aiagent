import { describe, expect, it } from "vitest";
import {
  getExternalSystemConnector,
  getMetaAdsConnector,
  getOTAConnector,
  getSocialResearchConnector,
  getTrendConnector,
} from "./registry";

describe("connector registry", () => {
  it("resolves every port to its mock adapter", () => {
    expect(getSocialResearchConnector()).toBeTruthy();
    expect(getTrendConnector()).toBeTruthy();
    expect(getMetaAdsConnector()).toBeTruthy();
    expect(getOTAConnector()).toBeTruthy();
    expect(getExternalSystemConnector()).toBeTruthy();
  });

  it("getExternalSystemConnector's mock always throws — MK Connect integration is not yet authorized", async () => {
    await expect(getExternalSystemConnector().call("/some-endpoint")).rejects.toThrow(/MK Connect/);
  });
});
