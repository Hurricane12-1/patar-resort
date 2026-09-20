# 🔌 Model Context Protocol (MCP) Server Guide

**Server Package**: `mcp-server/`  
**Protocol Version**: Model Context Protocol JSON-RPC 2.0 (via `@modelcontextprotocol/sdk`)  
**Transport**: Standard Input/Output (`stdio`)  

---

## Overview

The J & D Beach House MCP Server enables AI coding assistants (such as Antigravity, Gemini, Claude Desktop, and Cursor) to directly invoke local development tools and execute Windows Command Prompt (`cmd.exe`) and PowerShell commands without leaving the model context.

### Key Capabilities
- **Direct Terminal Execution**: Execute `dir`, `git`, `npm`, `node`, `curl`, and custom scripts via `cmd.exe` or `powershell.exe`.
- **System Integrity Testing**: Trigger project-wide automated verification with a single MCP tool call (`run_verification`).
- **One-Click Backups**: Invoke the project disaster recovery engine (`run_backup`) before major changes.
- **Repository Inspection**: Inspect active branch, git diff status, commit history, and runtime stats (`system_status`).
- **File System Operations**: Direct safe read and directory listing tools (`read_file`, `list_files`).

---

## 🛠️ Tool Specifications & Schema

### 1. `command_prompt`
Runs any command inside Windows Command Prompt (`cmd.exe`) or PowerShell.

- **Parameters**:
  - `command` *(string, required)*: The command line string to execute (e.g. `dir`, `git status`, `npm test`).
  - `shell` *(string, optional, default: `'cmd'`)*: Either `'cmd'` or `'powershell'`.
  - `cwd` *(string, optional, default: repository root)*: Working directory relative to project root or absolute path.
  - `timeout_ms` *(number, optional, default: `60000`)*: Execution timeout in milliseconds (max: `300000`).
- **Output**: Returns formatted execution metadata including command, shell, cwd, elapsed time, exit code, `stdout`, and `stderr`.

### 2. `run_backup`
Executes `node scripts/backup.js [label]` to capture timestamped SQL database schema snapshots and system configs into `backups/database/`.

- **Parameters**:
  - `label` *(string, optional)*: Optional descriptive label (e.g. `pre-deployment`, `payment-gateway-upgrade`).

### 3. `run_verification`
Executes `node scripts/verify.js` which runs the 5/5 backend unit & integration tests plus the Vite frontend production build.

- **Parameters**: None.

### 4. `system_status`
Returns high-level project telemetry:
- Project Root & Current Directory
- Node.js Version & OS Platform
- Git Active Branch & Latest Commit
- Working Tree Cleanliness (Modified / Untracked files count)

- **Parameters**: None.

### 5. `read_file`
Reads the raw text content of any project file.

- **Parameters**:
  - `relative_path` *(string, required)*: Path relative to repository root (e.g. `server/src/index.js`).

### 6. `list_files`
Lists directory contents with file size and type (file vs directory).

- **Parameters**:
  - `relative_path` *(string, optional, default: `'.'`)*: Path relative to repository root.

---

## ⚙️ Configuration Across Environments

### Antigravity / Gemini Configuration
The server is configured in `C:\Users\Sheep\.gemini\config\mcp_config.json`:

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

### Claude Desktop Setup
Open `%APPDATA%\Claude\claude_desktop_config.json` and add:

```json
{
  "mcpServers": {
    "beachhouse-cmd": {
      "command": "node",
      "args": [
        "c:/Users/Sheep/OneDrive/Documents/Capstone 1 sided/mcp-server/index.js"
      ]
    }
  }
}
```

### Cursor Setup
Open `.cursor/mcp.json` or project settings:

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

## 🧪 Testing & Verification

Run the built-in MCP client verification script:
```cmd
cd mcp-server
node test.js
```

This tests:
1. JSON-RPC handshake (`initialize` -> `notifications/initialized`).
2. Tools query (`tools/list`).
3. Tool execution (`tools/call` for `system_status` and `command_prompt dir /b scripts`).

All outputs flow through stdio streams and are verified 100% compliant.

---

## 🚀 Quick Launch via Batch Script
Double click or execute `mcp-server\start-mcp.bat`:
```cmd
cd mcp-server
start-mcp.bat
```
