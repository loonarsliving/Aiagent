/**
 * MK Connect — the future bridge to mkh.haluoleo.id / the production ERP.
 * The port exists so the shape is ready; the only adapter implementing it
 * right now (mock-external-system.adapter.ts) always throws, as a
 * guardrail against accidental production wiring before the Owner
 * authorizes integration.
 */
export interface ExternalSystemConnector {
  call(endpoint: string, payload?: unknown): Promise<never>;
}
