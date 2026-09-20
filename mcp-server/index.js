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
    description: "Trigger the automated J & D Beach House database schema and configuration backup.",
    inputSchema: {
      type: "object",
      properties: {
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
        const label = args?.label ? `"${args.label}"` : "";
        const result = await runCommand(`node scripts/backup.js ${label}`, "cmd", PROJECT_ROOT, 30000);
        return {
          content: [{ type: "text", text: result.stdout || result.stderr }],
          isError: result.exitCode !== 0,
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
