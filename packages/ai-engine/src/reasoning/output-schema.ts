import { z } from "zod";
import type { ReasoningOutput } from "@mkh/shared";

/**
 * The Output Engine's contract — every provider's raw text response is
 * validated against this before an employee ever sees it. Mirrors
 * ReasoningOutput (@mkh/shared) field-for-field; kept as a separate zod
 * schema here (not in @mkh/shared, which has no zod dependency) so
 * validation logic stays where it's used.
 */
export const reasoningOutputSchema = z.object({
  priority: z.enum(["low", "medium", "high", "urgent"]),
  summary: z.string().min(1),
  recommendation: z.string().min(1),
  reason: z.string().min(1),
  confidenceScore: z.number().min(0).max(1),
  needApproval: z.boolean(),
  escalation: z.string().nullable(),
  nextAction: z.string().min(1),
}) satisfies z.ZodType<ReasoningOutput>;

/** Strips a ```json ... ``` (or bare ```` ``` ````) fence some models wrap JSON in despite being asked not to. */
function stripCodeFence(text: string): string {
  const trimmed = text.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return fenced ? fenced[1]!.trim() : trimmed;
}

export interface ParseResult {
  success: boolean;
  output?: ReasoningOutput;
  error?: string;
}

/**
 * Parses + validates a provider's raw text response into a ReasoningOutput.
 * Never throws — a malformed/unparseable response is a normal, expected
 * failure mode the Reasoning Engine's error handling (retry -> audit log ->
 * structured error) already accounts for.
 */
export function parseReasoningOutput(rawText: string): ParseResult {
  let json: unknown;
  try {
    json = JSON.parse(stripCodeFence(rawText));
  } catch (err) {
    return { success: false, error: `Response is not valid JSON: ${err instanceof Error ? err.message : String(err)}` };
  }

  const result = reasoningOutputSchema.safeParse(json);
  if (!result.success) {
    return { success: false, error: `Response JSON does not match the Output Engine schema: ${result.error.message}` };
  }

  return { success: true, output: result.data };
}
