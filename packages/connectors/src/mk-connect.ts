/**
 * Guardrail stub. MK Connect (the integration layer to mkh.haluoleo.id /
 * the production ERP) is explicitly out of scope until the Owner gives the
 * go-ahead — see docs/ROADMAP.md. This function exists so any accidental
 * wiring attempt fails loudly instead of silently reaching production.
 */
export async function callMkConnect(_endpoint: string, _payload?: unknown): Promise<never> {
  throw new Error(
    "MK Connect integration is not enabled. This is a standalone project isolated from mkh.haluoleo.id " +
      "until the Owner explicitly authorizes integration.",
  );
}
