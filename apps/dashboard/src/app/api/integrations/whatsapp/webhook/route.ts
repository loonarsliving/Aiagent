import { NextResponse, type NextRequest } from "next/server";
import { getRepository } from "@mkh/database";
import { getConnectorManager, handleWhatsAppWebhookEvent, verifyWhatsAppWebhookChallenge } from "@mkh/integrations";

export const dynamic = "force-dynamic";

/**
 * Meta's webhook verification handshake — called once when this URL is
 * registered in the Meta Developer dashboard, and again any time the
 * subscription is re-verified. See docs/INTEGRATION_LAYER.md for the
 * exact URL/token to hand Meta and a curl example.
 */
export async function GET(request: NextRequest) {
  const mode = request.nextUrl.searchParams.get("hub.mode");
  const token = request.nextUrl.searchParams.get("hub.verify_token");
  const challenge = request.nextUrl.searchParams.get("hub.challenge");

  const manager = getConnectorManager();
  if (challenge && verifyWhatsAppWebhookChallenge(mode, token, manager)) {
    return new NextResponse(challenge, { status: 200 });
  }
  return NextResponse.json({ error: "webhook verification failed" }, { status: 403 });
}

/**
 * Receives every WhatsApp Cloud API event Meta sends (incoming messages,
 * delivery/read status callbacks, ...). Always acknowledges with 200 —
 * per Meta's own guidance, a non-200 response causes Meta to retry
 * (and, after enough consecutive failures, disable the subscription
 * entirely) — so even a payload we can't process is acknowledged and the
 * failure is recorded in the Integration Log instead of surfaced as an
 * HTTP error to Meta. Only a genuinely unparseable request body is
 * rejected outright.
 */
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  if (body === null) {
    return NextResponse.json({ status: "error", reason: "invalid JSON body" }, { status: 400 });
  }

  const result = await handleWhatsAppWebhookEvent(getRepository(), getConnectorManager(), body);
  return NextResponse.json(result, { status: 200 });
}
