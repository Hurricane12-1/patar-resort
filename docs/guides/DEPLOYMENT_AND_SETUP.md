# J & D Beach House — Deployment & Setup Guide

This guide provides instructions to run, configure, build, and deploy the **J & D Beach House** full-stack system.

---

## 1. Prerequisites
- **Node.js**: v18.0.0 or higher
- **npm**: v9.0.0 or higher
- **Supabase Account**: PostgreSQL database instance with RLS enabled
- **Twilio Account** (Optional for live SMS pings): Account SID, Auth Token, and Sender Number

---

## 2. Environment Variables

### Backend Configuration (`server/.env`)
```env
PORT=5000
NODE_ENV=development
CLIENT_ORIGIN=http://localhost:5173

# Supabase Credentials
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
SUPABASE_JWT_SECRET=your-jwt-secret

# Twilio SMS (Optional; console mock used if omitted)
TWILIO_ACCOUNT_SID=ACxxxx
TWILIO_AUTH_TOKEN=your-token
TWILIO_FROM=+1234567890
```

### Frontend Configuration (`client/.env`)
```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

---

## 3. Quick Start (Development Mode)

### Step 1: Install Dependencies
```bash
cd client && npm install
cd ../server && npm install
```

### Step 2: Database Initialization
Run the complete SQL DDL in your Supabase SQL Editor:
```bash
# File located at: supabase/schema.sql
```

### Step 3: Launch Local Servers
- **Terminal 1 (Backend API & WebSockets)**:
  ```bash
  cd server
  npm start
  # Running on http://localhost:5000
  ```
- **Terminal 2 (Frontend Client)**:
  ```bash
  cd client
  npm run dev
  # Running on http://localhost:5173
  ```

---

## 4. Production Build & Serving

1. **Build the Client**:
   ```bash
   cd client
   npm run build
   ```
   This generates the optimized production bundle in `client/dist/`.

2. **Serve from Express**:
   The Express server in `server/src/index.js` automatically serves `client/dist/` for all non-API GET routes in production mode.
   ```bash
   cd server
   npm start
   ```

---

## 5. Automated Verification
Always verify system integrity with:
```bash
node scripts/verify.js
```
Expected output: **5/5 tests passed** and clean Vite compilation.
