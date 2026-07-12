#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { AI_MODULE_IDS, createLogger } from "@mkh/shared";
import { getRepository } from "@mkh/database";
import { EMPLOYEE_REGISTRY } from "@mkh/ai-engine";

const logger = createLogger("mcp-server");

/**
 * Read-only MCP server exposing the AI Workforce Engine's current state to
 * any MCP client (Claude Desktop, Claude Code, MK Connect, etc). No write
 * tools yet — approving Meta Ads actions stays behind the approval
 * workflow in @mkh/ai-engine (proposeAction/decideOnApproval) until that's
 * explicitly extended to MCP or MK Connect.
 */
const server = new McpServer({
  name: "mkh-ai-os",
  version: "0.2.0",
});

server.tool(
  "list_ai_status",
  "List every AI employee with its latest run status and summary.",
  {},
  async () => {
    const repo = getRepository();
    const statuses = await Promise.all(
      AI_MODULE_IDS.map(async (id) => {
        const report = await repo.getLatestReport(id);
        const employee = EMPLOYEE_REGISTRY[id];
        return {
          moduleId: id,
          name: employee.name,
          role: employee.role,
          description: employee.description,
          lastRunAt: report?.generatedAt ?? null,
          lastCadence: report?.cadence ?? null,
          lastStatus: report?.status ?? "never_run",
          lastSummary: report?.summary ?? null,
        };
      }),
    );
    return { content: [{ type: "text", text: JSON.stringify(statuses, null, 2) }] };
  },
);

server.tool(
  "get_latest_report",
  "Get the full latest AIReport (summary + structured data) for one AI employee.",
  { moduleId: z.enum(AI_MODULE_IDS) },
  async ({ moduleId }) => {
    const report = await getRepository().getLatestReport(moduleId);
    return { content: [{ type: "text", text: JSON.stringify(report, null, 2) }] };
  },
);

server.tool(
  "list_recent_reports",
  "List recent AIReports, optionally filtered to one employee.",
  { moduleId: z.enum(AI_MODULE_IDS).optional(), limit: z.number().int().min(1).max(100).default(10) },
  async ({ moduleId, limit }) => {
    const reports = await getRepository().listReports(moduleId, limit);
    return { content: [{ type: "text", text: JSON.stringify(reports, null, 2) }] };
  },
);

server.tool(
  "list_pending_approvals",
  "List Meta Ads actions currently awaiting Owner approval (proposeAction/decideOnApproval workflow).",
  {},
  async () => {
    const approvals = await getRepository().listApprovals("pending");
    return { content: [{ type: "text", text: JSON.stringify(approvals, null, 2) }] };
  },
);

server.tool(
  "list_recent_notifications",
  "List recent notifications raised by the AI employees for the Owner/Dir Ops/Markom.",
  { limit: z.number().int().min(1).max(100).default(20) },
  async ({ limit }) => {
    const notifications = await getRepository().listNotifications(limit);
    return { content: [{ type: "text", text: JSON.stringify(notifications, null, 2) }] };
  },
);

server.tool(
  "list_knowledge_base",
  "List Marketing Intelligence's accumulated knowledge base — viral content, competitor activity, and trend signals discovered over time, deduplicated with a timesSeen count.",
  { category: z.string().optional(), limit: z.number().int().min(1).max(500).default(50) },
  async ({ category, limit }) => {
    const items = await getRepository().listKnowledgeItems({ moduleId: "marketing-intelligence", category }, limit);
    return { content: [{ type: "text", text: JSON.stringify(items, null, 2) }] };
  },
);

server.tool(
  "list_work_log",
  "List the granular SOP step trail (e.g. \"Started\", \"Research Completed\", \"Saved Memory\", \"Finished\") for one employee or one specific run.",
  { moduleId: z.enum(AI_MODULE_IDS).optional(), runId: z.string().optional(), limit: z.number().int().min(1).max(200).default(50) },
  async ({ moduleId, runId, limit }) => {
    const entries = await getRepository().listWorkLog({ moduleId, runId }, limit);
    return { content: [{ type: "text", text: JSON.stringify(entries, null, 2) }] };
  },
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  logger.info("mkh-ai-os MCP server running on stdio");
}

main().catch((err) => {
  logger.error("MCP server failed to start", { error: String(err) });
  process.exit(1);
});
