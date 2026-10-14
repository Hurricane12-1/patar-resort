#!/usr/bin/env node

/**
 * J & D Beach House — Command Prompt & Terminal Tools MCP Server
 * 
 * Provides direct terminal/command prompt tool access via the Model Context Protocol (MCP).
 * Compatible with Antigravity, Claude Desktop, Cursor, and any MCP-compliant client.
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { exec } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, "..");

// Initialize MCP Server
const server = new Server(
  {
    name: "command-prompt-mcp",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Define Exposed Tools
const TOOLS = [
  {
    name: "command_prompt",
    description: "Execute any command directly in Windows Command Prompt (cmd.exe) or PowerShell.",
    inputSchema: {
      type: "object",
      properties: {
        command: {
          type: "string",
          description: "The command string to execute (e.g., 'dir', 'git status', 'npm test').",
        },
        shell: {
          type: "string",
          enum: ["cmd", "powershell"],
          default: "cmd",
          description: "Shell environment to execute the command in. Defaults to 'cmd'.",
        },
        cwd: {
          type: "string",
          description: "Working directory for execution. Defaults to the Capstone project root.",
        },
        timeout: {
          type: "number",
          default: 30000,
          description: "Maximum execution time in milliseconds (default: 30000ms).",
        },
      },
      required: ["command"],
    },
  },
  {
    name: "run_backup",
    description: "Trigger automated backups: creates version patch snapshots (code, manifests, certs, checksums) and/or database schema backups.",
    inputSchema: {
      type: "object",
      properties: {
        type: {
          type: "string",
          enum: ["patch", "database", "all"],
          default: "patch",
          description: "Type of backup to generate: 'patch' (version snapshot with SHA-256 manifest), 'database' (schema SQL), or 'all'.",
        },
        version: {
          type: "string",
          description: "Target release version for patch snapshot (e.g. '1.1.0'). Defaults to current version.",
        },
        label: {
          type: "string",
          description: "Optional label for the backup snapshot (e.g., 'pre_release').",
        },
      },
    },
  },
  {
    name: "run_verification",
    description: "Run the full J & D Beach House system integrity suite (5/5 backend tests + Vite client build).",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "system_status",
    description: "Inspect project status, Git branch, latest commit, and Node.js environment information.",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "read_file",
    description: "Read the text content of any file within the project repository.",
    inputSchema: {
      type: "object",
      properties: {
        filePath: {
          type: "string",
          description: "Path to file (relative to project root or absolute).",
        },
      },
      required: ["filePath"],
    },
  },
  {
    name: "list_files",
    description: "List directory contents including filenames, sizes, and subdirectories.",
    inputSchema: {
      type: "object",
      properties: {
        directory: {
          type: "string",
          description: "Directory path relative to project root or absolute. Defaults to project root.",
        },
      },
    },
  },
  {
    name: "diagram_handler",
    description: "Generate, normalize, and render architectural diagram suites (Frontend API, Data Hierarchy, ER Diagram) into Draw.io XML, SVG, and 4K PNG.",
    inputSchema: {
      type: "object",
      properties: {
        target: {
          type: "string",
          enum: ["all", "api", "data-hierarchy", "er"],
          default: "all",
          description: "Specific diagram suite to build ('all', 'api', 'data-hierarchy', 'er').",
        },
      },
    },
  },
  {
    name: "run_gatekeeper",
    description: "Run the J & D Beach House Version 1.0 Release Gatekeeper (checks semantic versions, TLS certs, CSP/headers, backend green suite, and Vite client build).",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "run_performance_benchmark",
    description: "Execute high-throughput 10,000 users concurrency benchmark (HTTP keep-alive stress test on analytics and catalog) plus Playwright browser DOM performance audit.",
    inputSchema: {
      type: "object",
      properties: {
        total: {
          type: "number",
          default: 10000,
          description: "Total number of simulated user requests (default: 10000).",
        },
        concurrency: {
          type: "number",
          default: 200,
          description: "Number of concurrent parallel worker sockets (default: 200).",
        },
        endpoint: {
          type: "string",
          default: "/api/analytics/overview",
          description: "Target API route to benchmark (e.g., '/api/analytics/overview', '/api/rooms', '/api/system/health').",
        },
        includePlaywright: {
          type: "boolean",
          default: true,
          description: "Whether to execute Playwright Chromium DOM/Web Vitals audit alongside load test.",
        },
      },
    },
  },
  {
    name: "inspect_data_analytics",
    description: "Inspect resort analytics engine: measures Redis cache hit/miss ratio, active TTLs, query execution latency, memory footprint, and table stats.",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "optimize_analytics",
    description: "Execute performance optimizations on data analytics: purges stale keys, pre-warms /api/analytics/overview and /api/rooms in Redis, checks database indexes, and ensures sub-millisecond response.",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "deploy_1m_fake_users",
    description: "Deploy and stress test against 1,000,000 synthetic fake users with automated circuit breakers (auto-stops if memory, latency, lag, or errors exceed safety thresholds).",
    inputSchema: {
      type: "object",
      properties: {
        total: {
          type: "number",
          default: 1000000,
          description: "Total fake users target (default: 1000000).",
        },
        concurrency: {
          type: "number",
          default: 250,
          description: "Number of concurrent parallel worker sockets (default: 250).",
        },
        endpoint: {
          type: "string",
          default: "/api/analytics/overview",
          description: "Target API route to test.",
        },
      },
    },
  },
  {
    name: "test_load_balancer_and_limiter",
    description: "Run the full Load Balancer Gateway and Adaptive Rate Limiter test suite (verifies 429 rate limiting, token refill, in-flight concurrency tracking, and multi-node upstream traffic distribution).",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
];

// Handle ListTools Request
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return { tools: TOOLS };
});

// Helper: Run command asynchronously
function runCommand(commandStr, shellType = "cmd", workingDir = PROJECT_ROOT, timeoutMs = 30000) {
  return new Promise((resolve) => {
    const shellExe = shellType === "powershell" ? "powershell.exe" : "cmd.exe";
    const shellArgs = shellType === "powershell" ? ["-NoProfile", "-Command", commandStr] : ["/d", "/s", "/c", commandStr];
    const fullCmd = shellType === "powershell" 
      ? `powershell -NoProfile -Command "${commandStr.replace(/"/g, '`"')}"`
      : commandStr;

    const startTime = Date.now();
    exec(fullCmd, { cwd: workingDir, timeout: timeoutMs, maxBuffer: 10 * 1024 * 1024 }, (error, stdout, stderr) => {
      const durationMs = Date.now() - startTime;
      resolve({
        command: commandStr,
        shell: shellType,
        cwd: workingDir,
        durationMs,
        exitCode: error ? (error.code ?? 1) : 0,
        stdout: stdout ? stdout.toString() : "",
        stderr: stderr ? stderr.toString() : "",
        timedOut: error?.killed ?? false,
      });
    });
  });
}

// Handle CallTool Request
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case "command_prompt": {
        const cmd = args.command;
        const shell = args.shell || "cmd";
        const cwd = args.cwd ? path.resolve(PROJECT_ROOT, args.cwd) : PROJECT_ROOT;
        const timeout = args.timeout || 30000;

        const result = await runCommand(cmd, shell, cwd, timeout);
        const outputText = [
          `[Command]: ${result.command}`,
          `[Shell]: ${result.shell} | [Cwd]: ${result.cwd} | [Exit Code]: ${result.exitCode} (${result.durationMs}ms)`,
          result.timedOut ? "⚠️ WARNING: Command timed out!" : "",
          result.stdout ? `\n--- STDOUT ---\n${result.stdout}` : "",
          result.stderr ? `\n--- STDERR ---\n${result.stderr}` : "",
        ].filter(Boolean).join("\n");

        return {
          content: [{ type: "text", text: outputText }],
          isError: result.exitCode !== 0,
        };
      }

      case "run_backup": {
        const backupType = args?.type || "patch";
        const label = args?.label ? `"${args.label}"` : "";
        const version = args?.version ? `"${args.version}"` : "";
        const outputs = [];
        let isError = false;

        if (backupType === "patch" || backupType === "all") {
          const patchCmd = version ? `node scripts/backup_patch.js ${version} ${label}` : `node scripts/backup_patch.js ${label}`;
          const res = await runCommand(patchCmd, "cmd", PROJECT_ROOT, 30000);
          outputs.push(res.stdout || res.stderr);
          if (res.exitCode !== 0) isError = true;
        }

        if (backupType === "database" || backupType === "all") {
          const dbRes = await runCommand(`node scripts/backup.js ${label}`, "cmd", PROJECT_ROOT, 30000);
          outputs.push(dbRes.stdout || dbRes.stderr);
          if (dbRes.exitCode !== 0) isError = true;
        }

        return {
          content: [{ type: "text", text: outputs.join("\n\n") }],
          isError,
        };
      }

      case "run_verification": {
        const result = await runCommand("node scripts/verify.js", "cmd", PROJECT_ROOT, 60000);
        return {
          content: [{ type: "text", text: result.stdout || result.stderr }],
          isError: result.exitCode !== 0,
        };
      }

      case "system_status": {
        const gitResult = await runCommand("git status -s; git branch --show-current; git log -n 1 --oneline", "powershell", PROJECT_ROOT, 10000);
        const statusReport = [
          "============================================================",
          " 🌊 J & D BEACH HOUSE · SYSTEM & MCP STATUS",
          "============================================================",
          `Project Root: ${PROJECT_ROOT}`,
          `Node Version: ${process.version}`,
          `Platform: ${process.platform} (${process.arch})`,
          `MCP Server: command-prompt-mcp v1.0.0 (active)`,
          "------------------------------------------------------------",
          "Git Repository State:",
          gitResult.stdout || "Git output unavailable",
          "============================================================",
        ].join("\n");

        return {
          content: [{ type: "text", text: statusReport }],
          isError: false,
        };
      }

      case "read_file": {
        const targetPath = path.isAbsolute(args.filePath) 
          ? args.filePath 
          : path.resolve(PROJECT_ROOT, args.filePath);

        if (!fs.existsSync(targetPath)) {
          return {
            content: [{ type: "text", text: `Error: File not found at ${targetPath}` }],
            isError: true,
          };
        }

        const content = fs.readFileSync(targetPath, "utf-8");
        return {
          content: [{ type: "text", text: content }],
          isError: false,
        };
      }

      case "list_files": {
        const targetDir = args?.directory 
          ? (path.isAbsolute(args.directory) ? args.directory : path.resolve(PROJECT_ROOT, args.directory))
          : PROJECT_ROOT;

        if (!fs.existsSync(targetDir)) {
          return {
            content: [{ type: "text", text: `Error: Directory not found at ${targetDir}` }],
            isError: true,
          };
        }

        const items = fs.readdirSync(targetDir, { withFileTypes: true });
        const listOutput = items.map((item) => {
          const typeLabel = item.isDirectory() ? "[DIR]" : "[FILE]";
          let sizeStr = "";
          try {
            if (item.isFile()) {
              const stat = fs.statSync(path.join(targetDir, item.name));
              sizeStr = `(${stat.size} bytes)`;
            }
          } catch {}
          return `${typeLabel.padEnd(7)} ${item.name} ${sizeStr}`;
        }).join("\n");

        return {
          content: [{ type: "text", text: `Directory: ${targetDir}\n\n${listOutput}` }],
          isError: false,
        };
      }

      case "diagram_handler": {
        const target = args?.target || "all";
        const result = await runCommand(`node scripts/diagram-tool.js --target=${target}`, "cmd", PROJECT_ROOT, 60000);
        return {
          content: [{ type: "text", text: result.stdout || result.stderr }],
          isError: result.exitCode !== 0,
        };
      }

      case "run_gatekeeper": {
        const result = await runCommand("node scripts/gatekeeper.js", "cmd", PROJECT_ROOT, 60000);
        return {
          content: [{ type: "text", text: result.stdout || result.stderr }],
          isError: result.exitCode !== 0,
        };
      }

      case "run_performance_benchmark": {
        const total = args?.total || 10000;
        const concurrency = args?.concurrency || 200;
        const endpoint = args?.endpoint || "/api/analytics/overview";
        const includePlaywright = args?.includePlaywright !== false;

        const benchmarkCmd = `node scripts/benchmark_10k_users.js --total=${total} --concurrency=${concurrency} --endpoint=${endpoint}`;
        const loadResult = await runCommand(benchmarkCmd, "cmd", PROJECT_ROOT, 120000);

        let playwrightOutput = "";
        if (includePlaywright) {
          const pwResult = await runCommand("node scripts/playwright_audit.js", "cmd", PROJECT_ROOT, 120000);
          playwrightOutput = `\n\n--- PLAYWRIGHT DOM AUDIT ---\n${pwResult.stdout || pwResult.stderr}`;
        }

        const fullOutput = [
          loadResult.stdout || loadResult.stderr,
          playwrightOutput,
        ].filter(Boolean).join("\n");

        return {
          content: [{ type: "text", text: fullOutput }],
          isError: loadResult.exitCode !== 0,
        };
      }

      case "inspect_data_analytics": {
        const result = await runCommand("node scripts/inspect_analytics.js", "cmd", PROJECT_ROOT, 30000);
        return {
          content: [{ type: "text", text: result.stdout || result.stderr }],
          isError: result.exitCode !== 0,
        };
      }

      case "optimize_analytics": {
        const result = await runCommand("node scripts/optimize_analytics.js", "cmd", PROJECT_ROOT, 30000);
        return {
          content: [{ type: "text", text: result.stdout || result.stderr }],
          isError: result.exitCode !== 0,
        };
      }

      case "deploy_1m_fake_users": {
        const total = args?.total || 1000000;
        const concurrency = args?.concurrency || 250;
        const endpoint = args?.endpoint || "/api/analytics/overview";
        const cmd = `node scripts/deploy_1m_fake_users.js --total=${total} --concurrency=${concurrency} --endpoint=${endpoint}`;
        const result = await runCommand(cmd, "cmd", PROJECT_ROOT, 300000);
        return {
          content: [{ type: "text", text: result.stdout || result.stderr }],
          isError: result.exitCode !== 0,
        };
      }

      case "test_load_balancer_and_limiter": {
        const result = await runCommand("node scripts/test_load_balancer_and_limiter.js", "cmd", PROJECT_ROOT, 60000);
        return {
          content: [{ type: "text", text: result.stdout || result.stderr }],
          isError: result.exitCode !== 0,
        };
      }

      default:
        return {
          content: [{ type: "text", text: `Unknown tool requested: ${name}` }],
          isError: true,
        };
    }
  } catch (err) {
    return {
      content: [{ type: "text", text: `Tool execution failed: ${err.message}` }],
      isError: true,
    };
  }
});

// Start Server Transport
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  process.stderr.write("[command-prompt-mcp] MCP Server running on stdio\n");
}

main().catch((err) => {
  process.stderr.write(`[command-prompt-mcp] Fatal error: ${err.message}\n`);
  process.exit(1);
});
