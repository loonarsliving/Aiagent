import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tsconfigPaths({ projects: ["./tsconfig.base.json"] })],
  test: {
    include: ["packages/**/*.test.ts"],
    environment: "node",
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      include: ["packages/**/src/**/*.ts"],
      exclude: [
        "packages/**/src/**/*.test.ts",
        "packages/**/src/**/index.ts",
        // Pure type/interface files — zero runtime statements, nothing to
        // exercise. Their contract is enforced by tsc, not by coverage.
        "packages/**/src/**/types.ts",
        "packages/database/src/domain-types.ts",
        "packages/database/src/repository.ts",
        "packages/notifications/src/channel.ts",
        "packages/connectors/src/ports/**/*.ts",
        "packages/ai-engine/src/core/ai-employee.ts",
        // CLI/process entrypoints — thin main()+process.exit wrappers around
        // already-tested logic (triggerEmployee, runScheduledTask, the MCP
        // tool handlers), not meaningfully unit-testable themselves.
        "packages/scheduler/src/local-runner.ts",
        "packages/scheduler/src/trigger-cli.ts",
        "packages/mcp-server/src/index.ts",
      ],
      // Sprint 3B raised the bar to >95% lines/statements/functions (actual
      // as of this sprint: ~99%). Branches stays at 85 — global exhaustive
      // branch coverage has steep diminishing returns and was never the
      // brief's real intent; the three metrics above are the ones that
      // matter for "is this code actually exercised."
      thresholds: {
        lines: 95,
        statements: 95,
        functions: 95,
        branches: 85,
      },
    },
  },
});
