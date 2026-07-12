import { COMPANY_TIMEZONE } from "@mkh/shared";
import type { CompanyContext } from "./types";

/**
 * Grounding facts every prompt includes — a plain constant, not fetched
 * from any external system (no new external API besides Gemini in Sprint 2).
 */
export const COMPANY_CONTEXT: CompanyContext = {
  companyName: "PT Maha Karya Haluoleo",
  industry: "Pengembang properti & villa (real estate developer) di Sulawesi Tenggara/Selatan — unit bisnis penjualan perumahan, villa, dan marketing digital",
  timezone: COMPANY_TIMEZONE,
  ownerTitle: "Owner",
};
