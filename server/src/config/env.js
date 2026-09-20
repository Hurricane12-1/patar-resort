import 'dotenv/config';

const getEnv = (k, fallback = '') => {
  const v = process.env[k];
  if (!v) {
    console.warn(`[J & D Beach House Env Warning] ${k} is not set. Using fallback/mock value.`);
    return fallback;
  }
  return v;
};

export const env = {
  port: process.env.PORT || 4000,
  CLIENT_ORIGIN: process.env.CLIENT_ORIGIN || 'http://localhost:5173',
  SUPABASE_URL: getEnv('SUPABASE_URL', 'https://demo-project.supabase.co'),
  SUPABASE_ANON_KEY: getEnv('SUPABASE_ANON_KEY', 'demo-anon-key'),
  SUPABASE_SERVICE_ROLE_KEY: getEnv('SUPABASE_SERVICE_ROLE_KEY', 'demo-service-role-key'),
  SUPABASE_JWT_SECRET: getEnv('SUPABASE_JWT_SECRET', 'demo-jwt-secret-key-32-chars-long-min'),
  PUBLIC_API_URL: process.env.PUBLIC_API_URL || '',
  TWILIO_ACCOUNT_SID: process.env.TWILIO_ACCOUNT_SID || '',
  TWILIO_AUTH_TOKEN: process.env.TWILIO_AUTH_TOKEN || '',
  TWILIO_FROM: process.env.TWILIO_FROM || '',
};

export const isSupabaseConfigured = Boolean(
  process.env.SUPABASE_URL &&
  process.env.SUPABASE_SERVICE_ROLE_KEY &&
  !process.env.SUPABASE_URL.includes('YOUR-PROJECT')
);

export const smsEnabled = Boolean(env.TWILIO_ACCOUNT_SID && env.TWILIO_AUTH_TOKEN && env.TWILIO_FROM);
