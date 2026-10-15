import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Seamlessly load .env from root, server/, or current working directory
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });
dotenv.config();

const cleanVal = (val) => {
  if (typeof val !== 'string') return val;
  return val.trim().replace(/^["']|["']$/g, '');
};

const getEnv = (k, fallback = '') => {
  const raw = process.env[k];
  if (!raw) {
    return fallback;
  }
  return cleanVal(raw);
};

const isRender = Boolean(process.env.RENDER);

const DEFAULT_SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im93aG9ka2h6bGR5Z2F2dXducWZnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODkyNzg4NTMsImV4cCI6MjEwNDg1NDg1M30.NyRQYrpcROhnlfEXq83eqnAIYhegCZl_b08YV-G9J_c';
const isRealKey = (val) => Boolean(val && typeof val === 'string' && val.length > 50 && !val.includes('demo-'));

export const env = {
  port: parseInt(process.env.PORT || '8000', 10),
  CLIENT_ORIGIN: (isRender && (!process.env.CLIENT_ORIGIN || process.env.CLIENT_ORIGIN.includes('localhost')))
    ? '*'
    : (getEnv('CLIENT_ORIGIN') || '*'),
  SUPABASE_URL: getEnv('SUPABASE_URL', 'https://owhodkhzldygavuwnqfg.supabase.co').replace(/\/+$/, ''),
  SUPABASE_ANON_KEY: isRealKey(getEnv('SUPABASE_ANON_KEY')) ? getEnv('SUPABASE_ANON_KEY') : DEFAULT_SUPABASE_KEY,
  SUPABASE_SERVICE_ROLE_KEY: isRealKey(getEnv('SUPABASE_SERVICE_ROLE_KEY'))
    ? getEnv('SUPABASE_SERVICE_ROLE_KEY')
    : (isRealKey(getEnv('SUPABASE_ANON_KEY')) ? getEnv('SUPABASE_ANON_KEY') : DEFAULT_SUPABASE_KEY),
  SUPABASE_JWT_SECRET: getEnv('SUPABASE_JWT_SECRET', 'demo-jwt-secret-key-32-chars-long-min'),
  PUBLIC_API_URL: getEnv('PUBLIC_API_URL', 'https://localhost:8000'),
  TWILIO_ACCOUNT_SID: getEnv('TWILIO_ACCOUNT_SID', ''),
  TWILIO_AUTH_TOKEN: getEnv('TWILIO_AUTH_TOKEN', ''),
  TWILIO_FROM: getEnv('TWILIO_FROM', ''),
  SMTP_HOST: getEnv('SMTP_HOST') || getEnv('GOOGLE_SMTP_HOST') || 'smtp.gmail.com',
  SMTP_PORT: parseInt(process.env.SMTP_PORT || '465', 10),
  SMTP_SECURE: process.env.SMTP_SECURE !== 'false',
  SMTP_USER: getEnv('SMTP_USER') || getEnv('GOOGLE_SMTP_USER') || getEnv('GMAIL_USER') || '',
  SMTP_PASS: getEnv('SMTP_PASS') || getEnv('GOOGLE_SMTP_PASS') || getEnv('GMAIL_APP_PASSWORD') || '',
  SMTP_FROM: getEnv('SMTP_FROM') || getEnv('GOOGLE_SMTP_FROM') || 'J & D Beach House <noreply@jdbeachhouse.ph>',
  REDIS_URL: getEnv('REDIS_URL', 'redis://127.0.0.1:6379'),
  REDIS_ENABLED: process.env.REDIS_ENABLED === 'true' || (!isRender && process.env.REDIS_ENABLED !== 'false' && Boolean(process.env.REDIS_URL)),
  LOAD_BALANCER_PORT: parseInt(process.env.LOAD_BALANCER_PORT || '8080', 10),
  CLUSTER_WORKERS: parseInt(process.env.CLUSTER_WORKERS || '2', 10),
  GEMINI_API_KEY: getEnv('GEMINI_API_KEY', 'AQ.Ab8RN6KrqmseA37LVXLF7T6yxkgmlDDQVa5MZQhGg6Xxx38Qew'),
};

export const isSupabaseConfigured = Boolean(
  env.SUPABASE_URL &&
  (env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_ANON_KEY) &&
  !env.SUPABASE_URL.includes('YOUR-PROJECT') &&
  !env.SUPABASE_URL.includes('demo-project')
);

export const smsEnabled = Boolean(env.TWILIO_ACCOUNT_SID && env.TWILIO_AUTH_TOKEN && env.TWILIO_FROM);
export const emailEnabled = Boolean(env.SMTP_USER && env.SMTP_PASS);
export const geminiEnabled = Boolean(env.GEMINI_API_KEY);

