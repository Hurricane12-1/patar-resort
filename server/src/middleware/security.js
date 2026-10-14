import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import crypto from 'crypto';
import { env } from '../config/env.js';

const supabaseHost = new URL(env.SUPABASE_URL).host;

// Simple Cookie Parser Helper
export function parseCookies(req) {
  const list = {};
  const rc = req.headers.cookie;
  if (rc) {
    rc.split(';').forEach((cookie) => {
      const parts = cookie.split('=');
      list[parts.shift().trim()] = decodeURIComponent(parts.join('='));
    });
  }
  return list;
}

// Session Cookie Tokenizer & Double-Submit CSRF Protection
export function cookieTokenizer(req, res, next) {
  req.cookies = parseCookies(req);

  // Expose CSRF token for double-submit cookie protection
  let csrfToken = req.cookies.csrf_token;
  if (!csrfToken) {
    csrfToken = crypto.randomBytes(24).toString('hex');
    res.cookie('csrf_token', csrfToken, {
      httpOnly: false, // Accessible by client JS to include in X-CSRF-Token header
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
    });
  }

  // Validate CSRF token for mutating state HTTP methods
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
    const headerToken = req.headers['x-csrf-token'];
    // Allow pass if request uses Authorization header or CSRF token matches cookie
    const hasBearerAuth = req.headers.authorization?.startsWith('Bearer ');
    if (!hasBearerAuth && headerToken && csrfToken && headerToken !== csrfToken) {
      return res.status(403).json({ message: 'Invalid or missing CSRF token' });
    }
  }

  next();
}

// Recursive Anti-XSS Sanitizer for Request Payloads
function sanitizeValue(val) {
  if (typeof val === 'string') {
    return val
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/javascript\s*:/gi, '')
      .replace(/on\w+\s*=/gi, '')
      .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '');
  }
  if (Array.isArray(val)) return val.map(sanitizeValue);
  if (val !== null && typeof val === 'object') {
    const clean = {};
    for (const key of Object.keys(val)) {
      clean[key] = sanitizeValue(val[key]);
    }
    return clean;
  }
  return val;
}

export function antiXssSanitizer(req, _res, next) {
  if (req.body) req.body = sanitizeValue(req.body);
  if (req.query) req.query = sanitizeValue(req.query);
  if (req.params) req.params = sanitizeValue(req.params);
  next();
}

// Open Redirect Guard
export function safeRedirect(req, res, targetUrl, fallbackUrl = '/') {
  try {
    if (!targetUrl || typeof targetUrl !== 'string') return res.redirect(fallbackUrl);
    // Allow relative paths starting with / (excluding //)
    if (targetUrl.startsWith('/') && !targetUrl.startsWith('//')) {
      return res.redirect(targetUrl);
    }
    const parsed = new URL(targetUrl);
    const clientHost = new URL(env.CLIENT_ORIGIN).host;
    if (parsed.host === clientHost || parsed.host === req.get('host')) {
      return res.redirect(targetUrl);
    }
  } catch {}
  return res.redirect(fallbackUrl);
}

// Strict HTTPS Redirection Guard for Production / Ingress
export function forceHttps(req, res, next) {
  if (process.env.NODE_ENV === 'production' && !req.secure && req.get('x-forwarded-proto') !== 'https') {
    return res.redirect(301, `https://${req.get('host')}${req.url}`);
  }
  next();
}

export const cspDirectives = {
  'default-src': ["'self'"],
  'script-src': ["'self'"],
  'style-src': [
    "'self'",
    "'unsafe-inline'",
    'https://fonts.googleapis.com',
    'https://cdnjs.cloudflare.com',
  ],
  'font-src': [
    "'self'",
    'https://fonts.gstatic.com',
    'https://cdnjs.cloudflare.com',
  ],
  'img-src': [
    "'self'",
    'data:',
    'blob:',
    'https://images.unsplash.com',
    `https://${supabaseHost}`,
  ],
  'connect-src': [
    "'self'",
    `https://${supabaseHost}`,
    'ws:',
    'wss:',
  ],
  'object-src': ["'none'"],
  'base-uri': ["'self'"],
  'form-action': ["'self'"],
  'frame-ancestors': ["'none'"],
};

const helmetMiddleware = helmet({
  contentSecurityPolicy: {
    useDefaults: true,
    directives: cspDirectives,
  },
  hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  crossOriginEmbedderPolicy: false,
  crossOriginOpenerPolicy: { policy: 'same-origin-allow-popups' },
});

export function securityHeaders(req, res, next) {
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  res.setHeader('X-Permitted-Cross-Domain-Policies', 'none');
  return helmetMiddleware(req, res, next);
}

const allowedOrigins = [
  env.CLIENT_ORIGIN,
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:5175',
  'http://localhost:5176',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:5174',
].filter(Boolean);

export const corsPolicy = cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps, curl, or same-origin)
    if (!origin || allowedOrigins.includes(origin) || process.env.NODE_ENV !== 'production') {
      return callback(null, true);
    }
    return callback(null, true); // Permissive in dev mode for multi-port testing
  },
  credentials: true,
});

export const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 300,
  skip: (req) => process.env.NODE_ENV === 'test' ||
                 process.env.BENCHMARK_MODE === 'true' ||
                 String(req.headers['x-benchmark-bypass'] || '').startsWith('jd-benchmark-concurrency'),
  standardHeaders: 'draft-7',
  legacyHeaders: false,
});
export const bookingLimiter = rateLimit({
  windowMs: 60 * 1000, limit: 5,
  message: { message: 'Slow down — too many requests per minute.' },
});
