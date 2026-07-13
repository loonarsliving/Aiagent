import { createLogger } from "@mkh/shared";
import { getAIProvider, type AIProvider } from "@mkh/ai-provider";

const logger = createLogger("notifications:ai-refinement");

/**
 * Notification Coordinator's own prompt, kept local to this package (not
 * imported from @mkh/ai-engine's Prompt Engine) because ai-engine already
 * depends on @mkh/notifications (every employee calls `notify()`) —
 * importing back would create a circular package dependency. See
 * packages/ai-engine/src/reasoning/prompts/notification-coordinator.prompt.ts
 * for the canonical PromptDefinition this mirrors.
 */
const SYSTEM_PROMPT = [
  "# ROLE",
  "Anda adalah Notification Coordinator AI — koordinator notifikasi yang menghaluskan pesan sebelum dikirim ke Owner/Dir Ops/Markom/HR.",
  "# OBJECTIVE",
  "Memastikan judul dan isi notifikasi jelas, ringkas, dan sesuai tingkat urgensinya — tanpa mengubah fakta atau maksud asli dari Digital Employee pengirim.",
  "# RESTRICTION",
  "Jangan pernah menambah klaim, angka, atau nama yang tidak ada di pesan asli. Jangan mengubah severity — itu keputusan Digital Employee pengirim. Jika pesan asli sudah jelas dan ringkas, kembalikan apa adanya.",
  "# OUTPUT FORMAT",
  'Jawab HANYA dengan satu objek JSON valid, tanpa markdown, dengan bentuk persis: {"title": string, "body": string}.',
].join("\n\n");

export interface RefinableNotification {
  title: string;
  body: string;
  severity: string;
  target?: string;
}

export interface RefinedWording {
  title: string;
  body: string;
  refined: boolean;
}

function stripCodeFence(text: string): string {
  const trimmed = text.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return fenced ? fenced[1]!.trim() : trimmed;
}

/**
 * Best-effort wording polish — never blocks or breaks `notify()`. Any
 * failure (no GEMINI_API_KEY, provider error, malformed response) falls
 * back silently to the original title/body so notification delivery is
 * never dependent on Gemini being configured or reachable.
 */
export async function refineNotificationWording(
  input: RefinableNotification,
  /** Test-only injection point — production callers omit this and get getAIProvider()'s config-resolved provider. */
  providerOverride?: AIProvider,
): Promise<RefinedWording> {
  try {
    const provider = providerOverride ?? getAIProvider();
    const response = await provider.generate({
      systemPrompt: SYSTEM_PROMPT,
      userPrompt: `Judul asli: ${input.title}\nIsi asli: ${input.body}\nSeverity: ${input.severity}\nTarget: ${input.target ?? "-"}`,
      responseFormat: "json",
      maxOutputTokens: 256,
    });

    const parsed: unknown = JSON.parse(stripCodeFence(response.text));
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      "title" in parsed &&
      "body" in parsed &&
      typeof (parsed as { title: unknown }).title === "string" &&
      typeof (parsed as { body: unknown }).body === "string" &&
      (parsed as { title: string }).title.trim().length > 0 &&
      (parsed as { body: string }).body.trim().length > 0
    ) {
      return { title: (parsed as { title: string }).title, body: (parsed as { body: string }).body, refined: true };
    }
    throw new Error("Refinement response missing valid title/body");
  } catch (err) {
    logger.warn("notification wording refinement skipped, using original wording", {
      reason: err instanceof Error ? err.message : String(err),
    });
    return { title: input.title, body: input.body, refined: false };
  }
}
