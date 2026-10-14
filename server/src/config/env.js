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

const getEnv = (k, fallback = '') => {
  const v = process.env[k];
  if (!v) {
    console.warn(`[J & D Beach House Env Warning] ${k} is not set. Using fallback/mock value.`);
    return fallback;
  }
  return v;
};

export const env = {
  port: parseInt(process.env.PORT || '8000', 10),
  CLIENT_ORIGIN: process.env.CLIENT_ORIGIN || 'http://localhost:5173',
  SUPABASE_URL: getEnv('SUPABASE_URL', 'https://owhodkhzldygavuwnqfg.supabase.co'),
  SUPABASE_ANON_KEY: getEnv('SUPABASE_ANON_KEY', ''),
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || 'demo-service-role-key',
  SUPABASE_JWT_SECRET: getEnv('SUPABASE_JWT_SECRET', 'demo-jwt-secret-key-32-chars-long-min'),
  PUBLIC_API_URL: process.env.PUBLIC_API_URL || 'https://localhost:8000',
  TWILIO_ACCOUNT_SID: process.env.TWILIO_ACCOUNT_SID || '',
  TWILIO_AUTH_TOKEN: process.env.TWILIO_AUTH_TOKEN || '',
  TWILIO_FROM: process.env.TWILIO_FROM || '',
  SMTP_HOST: process.env.SMTP_HOST || process.env.GOOGLE_SMTP_HOST || 'smtp.gmail.com',
  SMTP_PORT: parseInt(process.env.SMTP_PORT || '465', 10),
  SMTP_SECURE: process.env.SMTP_SECURE !== 'false',
  SMTP_USER: process.env.SMTP_USER || process.env.GOOGLE_SMTP_USER || process.env.GMAIL_USER || '',
  SMTP_PASS: process.env.SMTP_PASS || process.env.GOOGLE_SMTP_PASS || process.env.GMAIL_APP_PASSWORD || '',
  SMTP_FROM: process.env.SMTP_FROM || process.env.GOOGLE_SMTP_FROM || 'J & D Beach House <noreply@jdbeachhouse.ph>',
  REDIS_URL: process.env.REDIS_URL || 'redis://127.0.0.1:6379',
  REDIS_ENABLED: process.env.REDIS_ENABLED !== 'false',
  LOAD_BALANCER_PORT: process.env.LOAD_BALANCER_PORT || 8080,
  CLUSTER_WORKERS: parseInt(process.env.CLUSTER_WORKERS || '2', 10),
  GEMINI_API_KEY: process.env.GEMINI_API_KEY || 'AQ.Ab8RN6KrqmseA37LVXLF7T6yxkgmlDDQVa5MZQhGg6Xxx38Qew',
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

