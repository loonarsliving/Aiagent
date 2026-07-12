#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { AI_MODULE_IDS, createLogger } from "@mkh/shared";
import { getRepository } from "@mkh/database";
import { MODULE_REGISTRY } from "@mkh/ai-engine";

const logger = createLogger("mcp-server");

/**
 * Read-only MCP server exposing the AI Operating System's current state to
 * any MCP client (Claude Desktop, Claude Code, etc). Deliberately has no
 * write tools yet — approving/executing Meta Ads actions stays behind the
 * dashboard's approval workflow (@mkh/security) until that's explicitly
 * extended to MCP.
 */
const server = new McpServer({
  name: "mkh-ai-os",
  version: "0.1.0",
});

server.tool(
  "list_ai_status",
  "List every AI module (digital employee) with its latest run status and summary.",
  {},
  async () => {
    const repo = getRepository();
    const statuses = await Promise.all(
      AI_MODULE_IDS.map(async (id) => {
        const report = await repo.getLatestReport(id);
        const module = MODULE_REGISTRY[id];
        return {
          moduleId: id,
          name: module.name,
          description: module.description,
          lastRunAt: report?.generatedAt ?? null,
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
  "Get the full latest AIReport (summary + structured data) for one AI module.",
  { moduleId: z.enum(AI_MODULE_IDS) },
  async ({ moduleId }) => {
    const report = await getRepository().getLatestReport(moduleId);
    return { content: [{ type: "text", text: JSON.stringify(report, null, 2) }] };
  },
);

server.tool(
  "list_recent_reports",
  "List recent AIReports, optionally filtered to one module.",
  { moduleId: z.enum(AI_MODULE_IDS).optional(), limit: z.number().int().min(1).max(100).default(10) },
  async ({ moduleId, limit }) => {
    const reports = await getRepository().listReports(moduleId, limit);
    return { content: [{ type: "text", text: JSON.stringify(reports, null, 2) }] };
  },
);

server.tool(
  "list_pending_approvals",
  "List Meta Ads actions currently awaiting Owner approval (Stage 2 approval workflow).",
  {},
  async () => {
    const approvals = await getRepository().listApprovals("pending");
    return { content: [{ type: "text", text: JSON.stringify(approvals, null, 2) }] };
  },
);

server.tool(
  "list_recent_notifications",
  "List recent notifications raised by the AI modules for the Owner/Dir Ops/Markom.",
  { limit: z.number().int().min(1).max(100).default(20) },
  async ({ limit }) => {
    const notifications = await getRepository().listNotifications(limit);
    return { content: [{ type: "text", text: JSON.stringify(notifications, null, 2) }] };
  },
);

server.tool(
  "list_action_logs",
  "List the audit log of Meta Ads actions actually executed after Owner approval.",
  { limit: z.number().int().min(1).max(100).default(20) },
  async ({ limit }) => {
    const logs = await getRepository().listActionLogs(limit);
    return { content: [{ type: "text", text: JSON.stringify(logs, null, 2) }] };
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
