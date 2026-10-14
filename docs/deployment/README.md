# 🚀 Version-Controlled Deployment Architecture

J & D Beach House separates deployment artifacts into dedicated, version-segregated directories under [`deployments/`](file:///c:/Users/Sheep/OneDrive/Documents/Capstone%201%20sided/deployments). This enables precise rollback capabilities, deployment audits, and targeted debugging sessions.

---

## 📂 Deployment Directory Structure

```
deployments/
├── v1.0/                        # Version 1.0 Baseline Deployment
│   ├── manifest.json            # Architecture blueprint & commit signature
│   ├── docker-compose.yml       # Single-container application deployment
│   ├── env.template             # v1.0 environment variables
│   └── debug_session_log.md     # v1.0 root-cause analysis & debug runbook
│
├── v1.1/                        # Version 1.1 Enterprise Deployment
│   ├── manifest.json            # v1.1 metadata (Tri-API, Redis, Cluster LB)
│   ├── docker-compose.yml       # Multi-service compose (app, redis, nginx lb)
│   ├── env.template             # Full v1.1 environment template
│   ├── architecture_diff.md     # Differential log from v1.0 to v1.1
│   └── debug_session_log.md     # Troubleshooting runbook (Redis, GraphQL, LB)
│
└── nginx.conf                   # High-availability Nginx load balancer config
```

---

## 🛠️ Deployment Manager CLI

Inspect and diagnose any version deployment using the Deployment Manager:

```bash
# List all active deployment versions:
node scripts/deployment_manager.js --list

# View the architectural diff between v1.0 and v1.1:
node scripts/deployment_manager.js --diff

# Run automated deployment integrity diagnostics for v1.1:
node scripts/deployment_manager.js --diagnose --version=v1.1

# Run automated deployment integrity diagnostics for v1.0:
node scripts/deployment_manager.js --diagnose --version=v1.0
```

---

## ⚖️ High-Availability Load Balancing

### Option A: Node.js Cluster Load Balancer (Built-In)
Executes a master process with a worker pool distributing traffic using Round-Robin (`SCHED_RR`):
```bash
# Launch multi-worker cluster:
node scripts/load_balancer.js
```

### Option B: Nginx Reverse Proxy & Load Balancer
Production configuration located at [`deployments/nginx.conf`](file:///c:/Users/Sheep/OneDrive/Documents/Capstone%201%20sided/deployments/nginx.conf):
- Listens on Port 80 (HTTP ➔ HTTPS 301 redirect).
- Listens on Port 443 with TLS v1.3 termination.
- Upstream backend cluster: `least_conn` routing to Node.js instances.
- Native WebSocket proxying with connection upgrade headers.

---

## 🔍 Debugging Sessions & Root-Cause Analysis

When an unexpected issue occurs during development or deployment, consult the version-specific runbook:
- For v1.0 issues: [`deployments/v1.0/debug_session_log.md`](file:///c:/Users/Sheep/OneDrive/Documents/Capstone%201%20sided/deployments/v1.0/debug_session_log.md)
- For v1.1 issues: [`deployments/v1.1/debug_session_log.md`](file:///c:/Users/Sheep/OneDrive/Documents/Capstone%201%20sided/deployments/v1.1/debug_session_log.md)
