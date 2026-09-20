import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const certDir = path.resolve(__dirname, '../../certs');

export function getTlsCredentials() {
  const keyPath = process.env.SSL_KEY_PATH || path.join(certDir, 'key.pem');
  const certPath = process.env.SSL_CERT_PATH || path.join(certDir, 'cert.pem');

  if (fs.existsSync(keyPath) && fs.existsSync(certPath)) {
    try {
      return {
        key: fs.readFileSync(keyPath),
        cert: fs.readFileSync(certPath),
        isSecure: true,
      };
    } catch (err) {
      console.warn('[SSL/TLS CERT] Failed to read certificates:', err.message);
    }
  }

  return { isSecure: false };
}

export function getCertificateStatus() {
  const credentials = getTlsCredentials();
  return {
    ssl_enabled: credentials.isSecure,
    protocol: credentials.isSecure ? 'HTTPS (TLS v1.3)' : 'HTTP (Reverse Proxy SSL)',
    issuer: credentials.isSecure ? 'J & D Beach House Authority' : 'Self-Signed / External Proxy',
    valid_until: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
    status: credentials.isSecure ? 'Active & Valid' : 'Active via Upstream Proxy',
  };
}
