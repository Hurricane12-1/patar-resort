# 🔍 Deployment Debug Session & Root Cause Runbook · Version 1.0

This runbook documents diagnostic steps, common failure modes, and verification procedures for the **Version 1.0 Baseline Deployment**.

---

## 🛠️ Verification Checklist for Debugging Sessions

During a debug session for v1.0, execute the following commands in order:

```bash
# 1. Inspect TLS Certificate Expiry and Subject Alternative Names:
node -e "import('./server/src/config/cert.js').then(m => console.log(m.getCertificateStatus()))"

# 2. Verify Backend Core Integrity:
npm run server:test

# 3. Verify Static Production Bundle:
npm run client:build
```

---

## ⚠️ Common Failure Modes & Diagnoses

### Issue 1: `res.removeHeader is not a function` during test runs
- **Symptoms**: Test suite crashes when executing securityHeaders middleware.
- **Root Cause**: Helmet middleware calls `res.removeHeader()` on response mocks.
- **Resolution**: Ensure mock response objects in unit tests implement `removeHeader(name)` and `getHeader(name)` alongside `setHeader(name, val)`.

### Issue 2: Browser blocks FontAwesome or Google Fonts
- **Symptoms**: Icons appear as missing rectangles or fonts fall back to default sans-serif.
- **Root Cause**: Content Security Policy (CSP) headers omitting `https://cdnjs.cloudflare.com` or `https://fonts.gstatic.com`.
- **Resolution**: Verify `server/src/middleware/security.js` includes `cdnjs.cloudflare.com` in both `style-src` and `font-src`.

### Issue 3: Ingress 403 Threat Block on Normal Queries
- **Symptoms**: Customer searches blocked with 403 `NGWF_THREAT_BLOCKED`.
- **Root Cause**: Overly strict regex in NGWF Layer 7 filter matching ordinary conversational English words.
- **Resolution**: Tune NGWF patterns to require bounded SQL command signatures (e.g. `UNION\s+SELECT`).

---
*Archived as part of Version 1.0 Baseline Deployment control.*
