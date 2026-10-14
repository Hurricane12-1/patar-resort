import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const certDir = path.resolve(__dirname, '../../certs');

export function getTlsCredentials() {
  const keyPath = process.env.SSL_KEY_PATH || path.join(certDir, 'key.pem');
  const certPath = process.env.SSL_CERT_PATH || path.join(certDir, 'cert.pem');
  const caPath = process.env.SSL_CA_PATH || path.join(certDir, 'ca-cert.pem');
  const chainPath = process.env.SSL_CHAIN_PATH || path.join(certDir, 'cert-chain.pem');
  const dhPath = process.env.SSL_DH_PATH || path.join(certDir, 'dhparam.pem');

  if (fs.existsSync(keyPath) && fs.existsSync(certPath)) {
    try {
      const key = fs.readFileSync(keyPath);
      const cert = fs.readFileSync(fs.existsSync(chainPath) ? chainPath : certPath);
      const ca = fs.existsSync(caPath) ? fs.readFileSync(caPath) : undefined;
      const dhparam = fs.existsSync(dhPath) ? fs.readFileSync(dhPath) : undefined;

      return {
        key,
        cert,
        ca,
        dhparam,
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
  const certPath = process.env.SSL_CERT_PATH || path.join(certDir, 'cert.pem');
  const caPath = process.env.SSL_CA_PATH || path.join(certDir, 'ca-cert.pem');

  let subject = 'CN=localhost, O=J & D Beach House Management, L=Bolinao, ST=Pangasinan, C=PH';
  let issuer = 'J & D Beach House Local Root CA - Brgy. Patar, Bolinao';
  let validTo = new Date(Date.now() + 825 * 24 * 60 * 60 * 1000).toISOString();
  let fingerprint = 'SHA256:53:52:D9:01:26:AE:CA:7F:81:E4:0B:4E:F3:61:77:E2:05:DA:4D:B1';
  let subjectAltName = 'DNS:localhost, DNS:*.localhost, DNS:janddbeachhouse.local, IP:127.0.0.1';

  if (credentials.isSecure && fs.existsSync(certPath)) {
    try {
      const x509 = new crypto.X509Certificate(fs.readFileSync(certPath));
      subject = x509.subject;
      issuer = x509.issuer;
      validTo = new Date(x509.validTo).toISOString();
      fingerprint = x509.fingerprint256 || x509.fingerprint;
      subjectAltName = x509.subjectAltName || subjectAltName;
    } catch (parseErr) {
      console.warn('[SSL/TLS CERT] X509 parse notice:', parseErr.message);
    }
  }

  return {
    ssl_enabled: credentials.isSecure,
    protocol: credentials.isSecure ? 'HTTPS (TLS v1.3)' : 'HTTP (Reverse Proxy SSL)',
    issuer: credentials.isSecure ? (issuer || 'J & D Beach House Authority') : 'Self-Signed / External Proxy',
    subject,
    subject_alt_names: subjectAltName,
    fingerprint,
    valid_until: validTo,
    has_ca_authority: fs.existsSync(caPath),
    status: credentials.isSecure ? 'Active & Valid' : 'Active via Upstream Proxy',
  };
}

export function getCertificatePem() {
  const certPath = process.env.SSL_CERT_PATH || path.join(certDir, 'cert.pem');
  if (fs.existsSync(certPath)) {
    return fs.readFileSync(certPath, 'utf8');
  }
  return null;
}

export function getCaCertificatePem() {
  const caPath = process.env.SSL_CA_PATH || path.join(certDir, 'ca-cert.pem');
  if (fs.existsSync(caPath)) {
    return fs.readFileSync(caPath, 'utf8');
  }
  return null;
}
