import { describe, expect, it } from "vitest";
import { parseReasoningOutput } from "./output-schema";

function validOutput(overrides: Record<string, unknown> = {}) {
  return {
    priority: "medium",
    summary: "Ringkasan singkat.",
    recommendation: "Lakukan X.",
    reason: "Karena Y.",
    confidenceScore: 0.8,
    needApproval: false,
    escalation: null,
    nextAction: "Tunggu hasil besok.",
    ...overrides,
  };
}

describe("parseReasoningOutput", () => {
  it("parses a valid, well-formed JSON response", () => {
    const result = parseReasoningOutput(JSON.stringify(validOutput()));
    expect(result.success).toBe(true);
    expect(result.output?.priority).toBe("medium");
    expect(result.output?.escalation).toBeNull();
  });

  it("strips a ```json fenced response before parsing", () => {
    const fenced = "```json\n" + JSON.stringify(validOutput()) + "\n```";
    const result = parseReasoningOutput(fenced);
    expect(result.success).toBe(true);
  });

  it("strips a bare ``` fence (no json language tag)", () => {
    const fenced = "```\n" + JSON.stringify(validOutput()) + "\n```";
    const result = parseReasoningOutput(fenced);
    expect(result.success).toBe(true);
  });

  it("accepts a non-null escalation string", () => {
    const result = parseReasoningOutput(JSON.stringify(validOutput({ escalation: "Owner", needApproval: true })));
    expect(result.success).toBe(true);
    expect(result.output?.escalation).toBe("Owner");
  });

  it("fails gracefully (does not throw) on non-JSON text", () => {
    const result = parseReasoningOutput("Sorry, I cannot help with that.");
    expect(result.success).toBe(false);
    expect(result.error).toContain("not valid JSON");
  });

  it("fails gracefully on JSON missing a required field", () => {
    const { summary: _summary, ...incomplete } = validOutput();
    const result = parseReasoningOutput(JSON.stringify(incomplete));
    expect(result.success).toBe(false);
    expect(result.error).toContain("schema");
  });

  it("fails gracefully on an out-of-range confidenceScore", () => {
    const result = parseReasoningOutput(JSON.stringify(validOutput({ confidenceScore: 1.5 })));
    expect(result.success).toBe(false);
  });

  it("fails gracefully on an invalid priority value", () => {
    const result = parseReasoningOutput(JSON.stringify(validOutput({ priority: "super-urgent" })));
    expect(result.success).toBe(false);
  });

  it("fails gracefully on an empty string", () => {
    const result = parseReasoningOutput("");
    expect(result.success).toBe(false);
  });
});
