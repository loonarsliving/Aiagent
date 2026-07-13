import { getConfig } from "@mkh/shared";
import type { CompanyContext } from "./types";

/**
 * Grounding facts every prompt includes — read from the config layer
 * (Sprint 3A: no hardcoded business values), not fetched from any
 * external system (no new external API besides Gemini in Sprint 2).
 */
export function getCompanyContext(): CompanyContext {
  const config = getConfig();
  return {
    companyName: config.COMPANY_NAME,
    industry: config.COMPANY_INDUSTRY,
    timezone: config.COMPANY_TIMEZONE,
    ownerTitle: config.COMPANY_OWNER_TITLE,
  };
}
