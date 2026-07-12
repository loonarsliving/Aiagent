import type { ExternalSystemConnector } from "../../ports/external-system.port";

/**
 * Guardrail adapter for MK Connect (the integration layer to
 * mkh.haluoleo.id / the production ERP). Always throws — this is
 * intentional, not a bug. MK Connect integration is explicitly out of
 * scope until the Owner authorizes it (see docs/ROADMAP.md); this adapter
 * exists so any accidental wiring attempt fails loudly instead of
 * silently reaching production.
 */
export const mockExternalSystemAdapter: ExternalSystemConnector = {
  async call(_endpoint: string, _payload?: unknown): Promise<never> {
    throw new Error(
      "MK Connect integration is not enabled. This is a standalone project isolated from mkh.haluoleo.id " +
        "until the Owner explicitly authorizes integration.",
    );
  },
};
