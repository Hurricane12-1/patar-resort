# 🔍 Deployment Debug Session & Root Cause Runbook · Version 1.1

This runbook serves as the primary diagnostic manual during debugging sessions for **Version 1.1 Enterprise** deployments (Tri-API, Redis Cache, Cluster Load Balancing, Network Status Control).

---

## 🚀 Quick Diagnostic Commands

Run these targeted commands from the project root during an active debugging session:

```bash
# 1. Check Full System Network & Circuit Status:
node -e "import('./server/src/routes/network.routes.js'); import('http').then(h => fetch('http://localhost:4000/api/network/status').then(r=>r.json()).then(console.log).catch(console.error))"

# 2. Test Native GraphQL Query Execution (Without Apollo):
curl -X POST http://localhost:4000/api/graphql \
  -H "Content-Type: application/json" \
  -d "{\"query\":\"query { rooms { id name rate_php } networkStatus { status latency_ms } }\"}"

# 3. Test Redis Cache Connection & Memory Fallback:
node -e "import('./server/src/lib/redis.js').then(async m => { console.log(await m.redis.ping()); console.log(m.redis.getStatus()); })"

# 4. Run Backend Test Verification (Including Joi, GraphQL & Headers):
npm run server:test

# 5. Run Cluster Load Balancer Test:
node scripts/load_balancer.js
```

---

## ⚠️ Diagnoses & Root-Cause Runbooks

### 1. Redis Connection Failures / Timeout
- **Symptoms**: Logs show `[REDIS] Retries exhausted. Falling back to in-memory store.`
- **Root Cause**: Redis daemon is offline, firewalled, or `REDIS_URL` points to an unreachable host.
- **Expected Resilient Behavior**: `server/src/lib/redis.js` catches the error and seamlessly routes all cache reads/writes to `in-memory-lru`. The server never crashes or drops requests.
- **Action**: Check `docker ps` for `jd_redis_cache_v1_1` or set `REDIS_ENABLED=false` in `.env` if Redis is not installed on the local developer machine.

### 2. GraphQL Schema Mismatches / Parse Errors
- **Symptoms**: API returns `{ errors: [{ message: "Cannot query field..." }] }` with HTTP 200/400.
- **Root Cause**: Query requests fields not declared in `server/src/graphql/schema.js`.
- **Diagnostic Step**: Inspect `server/src/graphql/schema.js` and verify field names against Supabase table schemas.
- **Remember**: This project strictly uses native `graphql` (`graphql({ schema, source, rootValue })`), NOT Apollo Server. Do not import Apollo packages.

### 3. Load Balancer Worker Node Crash / Restart
- **Symptoms**: Logs show `⚠️ [Worker Terminated] Worker 12345 died`.
- **Root Cause**: Unhandled exception in worker process (e.g. fatal syntax or out-of-memory).
- **Expected Resilient Behavior**: Master process in `scripts/load_balancer.js` automatically detects worker exit via `cluster.on('exit')` and immediately forks a replacement worker node.
- **Action**: Inspect worker stderr logs right before the exit timestamp to locate the offending request.

### 4. Client Shows Error Toast on Offline Backend
- **Symptoms**: Customer portal shows `ApiError: Failed to fetch (500)`.
- **Root Cause**: As requested in v1.1, all fake mock data (`FALLBACK_*`) has been eliminated. The UI now honestly reflects network/backend errors instead of quietly displaying dummy rooms or fake bookings.
- **Action**: Check server logs on port 4000 to resolve the underlying backend issue.

---
*Archived as part of Version 1.1 Enterprise Deployment control.*
