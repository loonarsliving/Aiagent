import type { OTAPropertySnapshot } from "../types";

/**
 * OTA channel manager port — occupancy, ADR, competitor price, booking
 * pace, dynamic pricing per property. Not connected to a real OTA yet
 * (see mock-ota.adapter.ts); this interface is what a real adapter
 * (Booking.com/Agoda/Airbnb partner API) would implement.
 */
export interface OTAConnector {
  getPropertySnapshots(): Promise<OTAPropertySnapshot[]>;
}
