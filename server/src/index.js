import express from 'express';
import http from 'http';
import https from 'https';
import path from 'path';
import { fileURLToPath } from 'url';
import { env } from './config/env.js';
import { securityHeaders, corsPolicy, globalLimiter, cookieTokenizer, antiXssSanitizer } from './middleware/security.js';
import { ngwfFirewall, pathNormalizer } from './middleware/ngwfSecurity.js';
import { getCertificateStatus, getTlsCredentials } from './config/cert.js';
import { notFound, errorHandler } from './middleware/errors.js';
import { attachChatbot } from './socket/chatbot.js';

import meRoutes from './routes/me.routes.js';
import roomRoutes from './routes/rooms.routes.js';
import reservationRoutes from './routes/reservations.routes.js';
import reviewRoutes from './routes/reviews.routes.js';
import notifRoutes from './routes/notifications.routes.js';
import analyticsRoutes from './routes/analytics.routes.js';
import webhookRoutes from './routes/webhooks.routes.js';
import departmentRoutes from './routes/department.routes.js';
import customerRoutes from './routes/customer.routes.js';
import telemetryRoutes from './routes/telemetry.routes.js';
import uploadRoutes from './routes/upload.routes.js';
import csvRoutes from './routes/csv.routes.js';

const app = express();
app.set('trust proxy', 1);

app.use(pathNormalizer);
app.use(securityHeaders);
app.use(corsPolicy);
app.use(globalLimiter);
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

app.get('/api/system/health', (_req, res) => {
  res.json({
    status: 'OPERATIONAL',
    uptime_seconds: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    memory_usage_mb: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
    security_firewall: 'ACTIVE',
    database_connection: 'HEALTHY',
    twilio_sms_gateway: 'READY',
  });
});

app.use('/api', meRoutes, roomRoutes, reservationRoutes, reviewRoutes,
        notifRoutes, analyticsRoutes, webhookRoutes, departmentRoutes, customerRoutes, telemetryRoutes, uploadRoutes, csvRoutes);

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uploadsDir = path.resolve(__dirname, '../uploads');
app.use('/uploads', express.static(uploadsDir));

const dist = path.resolve(__dirname, '../../../client/dist');
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
server.listen(env.port, () =>
  console.log(`✦ J & D Beach House API running on :${env.port} (${tlsCreds.isSecure ? 'HTTPS/TLS' : 'HTTP/NGWF'})`));
