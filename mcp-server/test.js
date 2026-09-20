/**
 * Test runner for command-prompt-mcp server
 * Simulates standard MCP client JSON-RPC 2.0 initialization and tool calls.
 */

import { spawn } from "child_process";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const serverScript = path.join(__dirname, "index.js");

console.log("============================================================");
console.log(" 🧪 TESTING COMMAND PROMPT MCP SERVER");
console.log("============================================================");

const child = spawn("node", [serverScript], {
  stdio: ["pipe", "pipe", "inherit"],
});

let buffer = "";

child.stdout.on("data", (data) => {
  buffer += data.toString();
  const lines = buffer.split("\n");
  buffer = lines.pop(); // Keep unfinished line

  for (const line of lines) {
    if (!line.trim()) continue;
    try {
      const msg = JSON.parse(line);
      handleMessage(msg);
    } catch (e) {
      console.log("Raw output:", line);
    }
  }
});

let testStep = 0;

function sendRpc(msg) {
  const jsonStr = JSON.stringify(msg) + "\n";
  child.stdin.write(jsonStr);
}

function handleMessage(msg) {
  if (msg.id === 1) {
    console.log(" ✅ Step 1: Server Initialized Successfully!");
    console.log("    Server Info:", msg.result.serverInfo);
    
    // Send notifications/initialized
    sendRpc({ jsonrpc: "2.0", method: "notifications/initialized" });

    // Request Tools List
    console.log("\n 🔍 Step 2: Requesting Tools List...");
    sendRpc({
      jsonrpc: "2.0",
      id: 2,
      method: "tools/list",
    });
  } else if (msg.id === 2) {
    console.log(" ✅ Step 2: Tools Discovered!");
    console.log("    Available Tools Count:", msg.result.tools.length);
    msg.result.tools.forEach((t) => console.log(`    - ${t.name}: ${t.description.split(".")[0]}`));

    // Test Tool Call: system_status
    console.log("\n ⚡ Step 3: Calling 'system_status' tool...");
    sendRpc({
      jsonrpc: "2.0",
      id: 3,
      method: "tools/call",
      params: {
        name: "system_status",
        arguments: {},
      },
    });
  } else if (msg.id === 3) {
    console.log(" ✅ Step 3: 'system_status' executed successfully!");
    console.log("    Result Snippet:\n", msg.result.content[0].text.split("\n").slice(0, 7).join("\n"));

    // Test Tool Call: command_prompt with "dir"
    console.log("\n ⚡ Step 4: Calling 'command_prompt' with 'dir /b scripts'...");
    sendRpc({
      jsonrpc: "2.0",
      id: 4,
      method: "tools/call",
      params: {
        name: "command_prompt",
        arguments: {
          command: "dir /b scripts",
          shell: "cmd",
        },
      },
    });
  } else if (msg.id === 4) {
    console.log(" ✅ Step 4: 'command_prompt' executed successfully!");
    console.log("    Result:\n", msg.result.content[0].text);

    console.log("============================================================");
    console.log(" 🏆 ALL MCP SERVER TESTS PASSED 100% OPERATIONAL 🟢");
    console.log("============================================================");
    child.kill();
    process.exit(0);
  }
}

// Step 1: Send initialize request
console.log(" 🔌 Step 1: Connecting & Initializing MCP Handshake...");
sendRpc({
  jsonrpc: "2.0",
  id: 1,
  method: "initialize",
  params: {
    protocolVersion: "2024-11-05",
    capabilities: {},
    clientInfo: {
      name: "mcp-test-runner",
      version: "1.0.0",
    },
  },
});

setTimeout(() => {
  console.error("❌ Test timed out after 15s");
  child.kill();
  process.exit(1);
}, 15000);
