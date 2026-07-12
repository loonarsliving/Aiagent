import { createLogger } from "@mkh/shared";
import type { OTAConnector } from "../../ports/ota.port";
import type { OTAPropertySnapshot } from "../../types";

const logger = createLogger("connectors:ota:mock");

/**
 * Mocked — never calls a real OTA channel manager API. "Belum konek OTA"
 * per instruction, but OTA Manager's full SOP (read occupancy/ADR/
 * competitor price/booking pace, propose dynamic pricing) is built and
 * exercised against this realistic fake data today. Swap this adapter's
 * body for a real Booking.com/Agoda/Airbnb partner API call later; the
 * OTAConnector shape and OTA Manager's logic stay unchanged.
 */
export const mockOTAAdapter: OTAConnector = {
  async getPropertySnapshots(): Promise<OTAPropertySnapshot[]> {
    logger.debug("mock OTA snapshot lookup");
    const today = new Date().toISOString().slice(0, 10);
    return [
      {
        propertyId: "villa_blok_c",
        propertyName: "Villa Blok C",
        date: today,
        roomsTotal: 12,
        roomsBooked: 10,
        occupancyPct: 83.3,
        adrIdr: 850_000,
        competitorAvgPriceIdr: 900_000,
        bookingPaceIndex: 118,
        currentDynamicPriceIdr: 900_000,
      },
      {
        propertyId: "villa_blok_d",
        propertyName: "Villa Blok D",
        date: today,
        roomsTotal: 8,
        roomsBooked: 3,
        occupancyPct: 37.5,
        adrIdr: 780_000,
        competitorAvgPriceIdr: 720_000,
        bookingPaceIndex: 64,
        currentDynamicPriceIdr: 680_000,
      },
      {
        propertyId: "villa_blok_e",
        propertyName: "Villa Blok E",
        date: today,
        roomsTotal: 10,
        roomsBooked: 9,
        occupancyPct: 90,
        adrIdr: 950_000,
        competitorAvgPriceIdr: 880_000,
        bookingPaceIndex: 105,
        currentDynamicPriceIdr: 980_000,
      },
    ];
  },
};
