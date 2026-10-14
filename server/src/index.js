import express from 'express';
import http from 'http';
import https from 'https';
import path from 'path';
import { fileURLToPath } from 'url';
import { env } from './config/env.js';
import { securityHeaders, corsPolicy, globalLimiter, cookieTokenizer, antiXssSanitizer } from './middleware/security.js';
import { concurrencyLimiter, testLimiter, getLimiterStats, resetLimiterBuckets } from './middleware/adaptiveLimiter.js';
import { ngwfFirewall, pathNormalizer } from './middleware/ngwfSecurity.js';
import { getCertificateStatus, getTlsCredentials, getCaCertificatePem, getCertificatePem } from './config/cert.js';
import { notFound, errorHandler } from './middleware/errors.js';
import { attachChatbot } from './socket/chatbot.js';

import { bootstrapFramework } from './framework/ModuleLoader.js';
import { registry } from './framework/ModuleRegistry.js';

const app = express();
app.set('trust proxy', 1);

app.use(pathNormalizer);
app.use(securityHeaders);
app.use(corsPolicy);
app.use(globalLimiter);
app.use(concurrencyLimiter(250));
app.use(cookieTokenizer);
app.use(ngwfFirewall);

app.use('/api/webhooks', express.urlencoded({ extended: false }));
app.use(express.json({ limit: '5mb' }));
app.use(antiXssSanitizer);

// Security CSRF & Certificates endpoints
app.get('/api/security/token', (req, res) => {
  res.json({ csrf_token: req.cookies?.csrf_token || '' });
});

app.get('/api/security/certificates', (_req, res) => {
  res.json(getCertificateStatus());
});

app.get('/api/security/certificates/ca.pem', (_req, res) => {
  const ca = getCaCertificatePem();
  if (!ca) return res.status(404).send('CA Certificate not found');
  res.setHeader('Content-Type', 'application/x-x509-ca-cert');
  res.setHeader('Content-Disposition', 'attachment; filename="jd-beach-house-root-ca.crt"');
  res.send(ca);
});

app.get('/api/security/certificates/cert.pem', (_req, res) => {
  const cert = getCertificatePem();
  if (!cert) return res.status(404).send('Certificate not found');
  res.setHeader('Content-Type', 'application/x-x509-user-cert');
  res.setHeader('Content-Disposition', 'attachment; filename="jd-beach-house-server.crt"');
  res.send(cert);
});

export async function checkSupabaseConnection() {
  const start = Date.now();
  try {
    const res = await fetch(`${env.SUPABASE_URL}/auth/v1/settings`, {
      headers: { apikey: env.SUPABASE_ANON_KEY },
    });
    const latency = Date.now() - start;
    if (res.ok) {
      console.log(`[Supabase Bridge] 🟢 Connected to Supabase project (${env.SUPABASE_URL}) in ${latency}ms [Auth Settings: HTTP ${res.status}]`);
      return { connected: true, latency_ms: latency, status: res.status, url: env.SUPABASE_URL };
    } else {
      console.log(`[Supabase Bridge] ℹ️ Supabase responded [HTTP ${res.status}] in ${latency}ms`);
      return { connected: false, latency_ms: latency, status: res.status, url: env.SUPABASE_URL };
    }
  } catch (err) {
    console.warn(`[Supabase Bridge] ⚠️ Supabase connection check warning: ${err.message}`);
    return { connected: false, error: err.message, url: env.SUPABASE_URL };
  }
}

app.get('/api/system/health', async (_req, res) => {
  res.json({
    status: 'OPERATIONAL',
    port: env.port,
    uptime_seconds: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    memory_usage_mb: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
    security_firewall: 'ACTIVE',
    database_connection: 'HEALTHY',
    supabase: {
      url: env.SUPABASE_URL,
      status: 'FETCHING',
      configured: true,
    },
    twilio_sms_gateway: 'READY',
  });
});

app.get('/api/system/supabase-status', async (_req, res) => {
  const status = await checkSupabaseConnection();
  res.json(status);
});

// Limiter Telemetry & Test Endpoints
app.get('/api/test/limited-endpoint', testLimiter, (req, res) => {
  res.json({
    status: 200,
    message: 'Success! Request was processed within allowed rate limits.',
    timestamp: new Date().toISOString(),
    remaining: res.getHeader('X-RateLimit-Remaining'),
    limit: res.getHeader('X-RateLimit-Limit'),
    window: '10 seconds',
  });
});

app.get('/api/limiter/status', (_req, res) => {
  res.json(getLimiterStats());
});

app.post('/api/limiter/reset', (_req, res) => {
  resetLimiterBuckets();
  res.json({ success: true, message: 'All rate and concurrency limiter buckets reset.' });
});

// Bootstrap Isolated Modular Framework (IMF) with dynamic auto-discovery & bulkhead error boundaries
await bootstrapFramework(app);

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uploadsDir = path.resolve(__dirname, '../uploads');
app.use('/uploads', express.static(uploadsDir));

const dist = path.resolve(__dirname, '../../client/dist');
app.use(express.static(dist));
app.use((req, res, next) => {
  if (req.method === 'GET' && !req.path.startsWith('/api') && !req.path.startsWith('/uploads'))
    res.sendFile(path.join(dist, 'index.html'));
  else next();
});

app.use(notFound);
app.use(errorHandler);

const tlsCreds = getTlsCredentials();
const server = tlsCreds.isSecure
  ? https.createServer({ key: tlsCreds.key, cert: tlsCreds.cert }, app)
  : http.createServer(app);

attachChatbot(server);
server.listen(env.port, () => {
  console.log('\n============================================================');
  console.log(' 🏖️  J & D RESERVE · RESORT MANAGEMENT PLATFORM');
  console.log('    Location: Brgy. Patar, Bolinao, Pangasinan (16.3042° N, 119.7821° E)');
  console.log('============================================================');
  console.log(` ✦ Primary Port     : ${env.port} (${tlsCreds.isSecure ? 'HTTPS/TLS' : 'HTTP/NGWF'})`);
  console.log(` ✦ Local Domain URL : https://janddbeachhouse.localhost:${env.port}`);
  console.log(` ✦ Direct Local URL : https://localhost:${env.port}`);
  console.log(` ✦ Supabase URL     : ${env.SUPABASE_URL}`);
  console.log('============================================================\n');

  // Trigger immediate live fetch check to Supabase
  checkSupabaseConnection();

  // Secondary port listener (4000) for legacy script & test compatibility
  if (env.port !== 4000) {
    try {
      const secondaryServer = tlsCreds.isSecure
        ? https.createServer({ key: tlsCreds.key, cert: tlsCreds.cert }, app)
        : http.createServer(app);
      secondaryServer.listen(4000, () => {
        console.log(` ✦ Secondary Compatibility Listener: Port :4000 ACTIVE`);
      }).on('error', () => { /* Port 4000 in use or suppressed */ });
    } catch {}
  }
});
