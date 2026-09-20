# 🔌 J & D Beach House — Command Prompt MCP Server

A Model Context Protocol (MCP) server that provides direct Windows Command Prompt (`cmd.exe`) and PowerShell execution capabilities, alongside project tools access (backups, test verifications, git & system status, file read/list).

---

## 🚀 Features & Exposed Tools

| Tool Name | Parameters | Description |
| :--- | :--- | :--- |
| `command_prompt` | `command` (str, required), `shell` ('cmd' \| 'powershell', opt), `cwd` (str, opt), `timeout_ms` (num, opt) | Executes any command in Windows Command Prompt (`cmd.exe`) or PowerShell. Captures stdout, stderr, exit code, and execution time. |
| `run_backup` | `label` (str, optional) | Automatically triggers the project database and configuration backup runner (`scripts/backup.js`). |
| `run_verification` | *none* | Executes the full project integrity test suite: 5/5 backend tests and Vite production client build. |
| `system_status` | *none* | Reports Node.js runtime, OS info, git branch, working directory status, and latest git commit. |
| `read_file` | `relative_path` (str, required) | Safely reads the text content of any project repository file. |
| `list_files` | `relative_path` (str, optional) | Lists directory contents with file sizes and directory designations. |

---

## 🛠️ Requirements & Installation

- **Node.js**: v18.0.0 or higher (Tested on Node.js v24.11.1)
- **Dependencies**: `@modelcontextprotocol/sdk` (installed in `mcp-server/node_modules`)

```bash
# To install dependencies (already pre-installed)
cd mcp-server
npm install
```

---

## 🧪 Testing the Server

An automated test suite (`test.js`) simulates an MCP client connecting via standard I/O (stdio), completing the JSON-RPC 2.0 handshake, discovering available tools, and executing test commands:

```bash
cd mcp-server
node test.js
```

Expected output:
```text
 🔌 Step 1: Connecting & Initializing MCP Handshake...
 ✅ Step 1: Server Initialized Successfully!
 🔍 Step 2: Requesting Tools List...
 ✅ Step 2: Tools Discovered! Available Tools Count: 6
 ⚡ Step 3: Calling 'system_status' tool...
 ✅ Step 3: 'system_status' executed successfully!
 ⚡ Step 4: Calling 'command_prompt' with 'dir /b scripts'...
 ✅ Step 4: 'command_prompt' executed successfully!
 🏆 ALL MCP SERVER TESTS PASSED 100% OPERATIONAL 🟢
```

---

## ⚙️ Configuration & Client Setup

### 1. Antigravity / Gemini Configuration
The server is registered in your local MCP config (`C:\Users\Sheep\.gemini\config\mcp_config.json`):

```json
{
  "mcpServers": {
    "command-prompt": {
      "command": "node",
      "args": [
        "c:/Users/Sheep/OneDrive/Documents/Capstone 1 sided/mcp-server/index.js"
      ],
      "env": {}
    }
  }
}
```

### 2. Claude Desktop Setup (`claude_desktop_config.json`)
Location: `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "jnd-command-prompt": {
      "command": "node",
      "args": [
        "c:/Users/Sheep/OneDrive/Documents/Capstone 1 sided/mcp-server/index.js"
      ]
    }
  }
}
```

### 3. Cursor Setup (`.cursor/mcp.json`)
```json
{
  "mcpServers": {
    "command-prompt": {
      "command": "node",
      "args": [
        "c:/Users/Sheep/OneDrive/Documents/Capstone 1 sided/mcp-server/index.js"
      ]
    }
  }
}
```

---

## 🏃 Running Standalone

To run the server manually for debugging or direct stdio streaming:
```cmd
cd mcp-server
start-mcp.bat
```
Or directly:
```bash
node index.js
```

---

## 🔒 Security Notes
- The server runs under the permissions of the current logged-in user.
- Commands default to the repository root directory (`Capstone 1 sided/`).
- Stdio isolation ensures diagnostics are routed strictly to `process.stderr`, preserving JSON-RPC 2.0 streaming on `process.stdout`.
