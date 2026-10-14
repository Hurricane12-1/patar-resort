import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';
import crypto from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const certsDir = path.join(rootDir, 'server', 'certs');

const caKeyPath = path.join(certsDir, 'ca-key.pem');
const caCertPath = path.join(certsDir, 'ca-cert.pem');
const keyPath = path.join(certsDir, 'key.pem');
const certPath = path.join(certsDir, 'cert.pem');
const chainPath = path.join(certsDir, 'cert-chain.pem');
const dhParamPath = path.join(certsDir, 'dhparam.pem');

console.log('\n============================================================');
console.log(' 🔐 J & D BEACH HOUSE TLS/SSL CERTIFICATE PROVISIONER');
console.log('    Location: Brgy. Patar, Bolinao, Pangasinan');
console.log('============================================================\n');

// Ensure destination directory exists
if (!fs.existsSync(certsDir)) {
  fs.mkdirSync(certsDir, { recursive: true });
  console.log(`[Cert] Created certificate directory: ${certsDir}`);
}

function findOpenSsl() {
  const candidates = [
    'openssl',
    'C:\\Program Files\\Git\\usr\\bin\\openssl.exe',
    'C:\\Program Files (x86)\\Git\\usr\\bin\\openssl.exe',
    'C:\\OpenSSL-Win64\\bin\\openssl.exe',
    'C:\\OpenSSL\\bin\\openssl.exe',
  ];

  for (const bin of candidates) {
    try {
      execSync(`"${bin}" version`, { stdio: 'ignore' });
      return bin;
    } catch {}
  }
  return null;
}

export function generateCertificates(force = false) {
  if (!force && fs.existsSync(keyPath) && fs.existsSync(certPath) && fs.existsSync(caCertPath)) {
    const keyStat = fs.statSync(keyPath);
    const certStat = fs.statSync(certPath);
    if (keyStat.size > 0 && certStat.size > 0) {
      console.log(' ✅ TLS Certificates already exist and are non-empty:');
      console.log(`    Root CA:     ${caCertPath} (${fs.statSync(caCertPath).size} bytes)`);
      console.log(`    Server Key:  ${keyPath} (${keyStat.size} bytes)`);
      console.log(`    Server Cert: ${certPath} (${certStat.size} bytes)`);
      return { success: true, keyPath, certPath, caCertPath, chainPath, status: 'Existing Valid' };
    }
  }

  const opensslBin = findOpenSsl();
  if (!opensslBin) {
    throw new Error('OpenSSL binary not found on the system. Cannot generate X.509 certificates.');
  }

  console.log(`[Cert] Using OpenSSL binary at: ${opensslBin}`);

  // 1. Generate Root CA Key and Certificate (4096-bit RSA)
  const caCnfPath = path.join(certsDir, 'ca_openssl.cnf');
  const caCnf = `[req]
distinguished_name = req_distinguished_name
x509_extensions = v3_ca
prompt = no

[req_distinguished_name]
C = PH
ST = Pangasinan
L = Bolinao
O = J & D Beach House Local Root CA
OU = Security Infrastructure
CN = J & D Beach House Root CA - Brgy. Patar, Bolinao

[v3_ca]
subjectKeyIdentifier = hash
authorityKeyIdentifier = keyid:always,issuer
basicConstraints = critical, CA:true
keyUsage = critical, digitalSignature, cRLSign, keyCertSign
`;
  fs.writeFileSync(caCnfPath, caCnf, 'utf8');

  console.log('[Cert] Step 1: Generating 4096-bit Root CA certificate...');
  const genCaCmd = `"${opensslBin}" req -x509 -new -nodes -newkey rsa:4096 -keyout "${caKeyPath}" -out "${caCertPath}" -days 3650 -config "${caCnfPath}"`;
  execSync(genCaCmd, { stdio: 'inherit' });

  try {
    fs.unlinkSync(caCnfPath);
  } catch {}

  // 2. Generate Server Private Key and Certificate Signing Request (CSR)
  const serverCnfPath = path.join(certsDir, 'server_openssl.cnf');
  const serverCnf = `[req]
distinguished_name = req_distinguished_name
req_extensions = v3_req
prompt = no

[req_distinguished_name]
C = PH
ST = Pangasinan
L = Bolinao
O = J & D Beach House Management
OU = Security & Ledger Operations
CN = localhost

[v3_req]
keyUsage = critical, digitalSignature, keyEncipherment
extendedKeyUsage = serverAuth, clientAuth
subjectAltName = @alt_names

[alt_names]
DNS.1 = localhost
DNS.2 = *.localhost
DNS.3 = janddbeachhouse.local
DNS.4 = *.janddbeachhouse.local
DNS.5 = patar.janddbeachhouse.ph
DNS.6 = resort.janddbeachhouse.ph
DNS.7 = api.janddbeachhouse.ph
IP.1 = 127.0.0.1
IP.2 = ::1
`;
  fs.writeFileSync(serverCnfPath, serverCnf, 'utf8');

  console.log('[Cert] Step 2: Generating 2048-bit Server Private Key & Certificate...');
  const csrPath = path.join(certsDir, 'server.csr');
  const genCsrCmd = `"${opensslBin}" req -new -nodes -newkey rsa:2048 -keyout "${keyPath}" -out "${csrPath}" -config "${serverCnfPath}"`;
  execSync(genCsrCmd, { stdio: 'inherit' });

  // 3. Sign the Server Certificate with the Root CA
  const extCnfPath = path.join(certsDir, 'v3_ext.cnf');
  const extCnf = `basicConstraints = CA:FALSE
subjectKeyIdentifier = hash
authorityKeyIdentifier = keyid,issuer
keyUsage = critical, digitalSignature, keyEncipherment
extendedKeyUsage = serverAuth, clientAuth
subjectAltName = @alt_names

[alt_names]
DNS.1 = localhost
DNS.2 = *.localhost
DNS.3 = janddbeachhouse.local
DNS.4 = *.janddbeachhouse.local
DNS.5 = patar.janddbeachhouse.ph
DNS.6 = resort.janddbeachhouse.ph
DNS.7 = api.janddbeachhouse.ph
IP.1 = 127.0.0.1
IP.2 = ::1
`;
  fs.writeFileSync(extCnfPath, extCnf, 'utf8');

  console.log('[Cert] Step 3: Signing Server Certificate with Root CA (valid for 825 days)...');
  const signCmd = `"${opensslBin}" x509 -req -in "${csrPath}" -CA "${caCertPath}" -CAkey "${caKeyPath}" -CAcreateserial -out "${certPath}" -days 825 -extfile "${extCnfPath}"`;
  execSync(signCmd, { stdio: 'inherit' });

  // Clean up intermediate files
  try {
    fs.unlinkSync(serverCnfPath);
    fs.unlinkSync(extCnfPath);
    fs.unlinkSync(csrPath);
    const srlPath = path.join(certsDir, 'ca-cert.srl');
    if (fs.existsSync(srlPath)) fs.unlinkSync(srlPath);
  } catch {}

  // 4. Create Certificate Chain (Server Cert + CA Cert)
  console.log('[Cert] Step 4: Generating full certificate chain...');
  const serverCert = fs.readFileSync(certPath, 'utf8');
  const caCert = fs.readFileSync(caCertPath, 'utf8');
  fs.writeFileSync(chainPath, `${serverCert}\n${caCert}`, 'utf8');

  // 5. Generate Diffie-Hellman Parameters (fast 2048-bit or prime generator)
  if (!fs.existsSync(dhParamPath) || force) {
    try {
      console.log('[Cert] Step 5: Generating 2048-bit Diffie-Hellman parameters (dhparam.pem)...');
      execSync(`"${opensslBin}" dhparam -out "${dhParamPath}" 2048`, { stdio: 'ignore' });
    } catch (dhErr) {
      console.warn('[Cert] Note: Diffie-Hellman generation skipped or non-critical:', dhErr.message);
    }
  }

  const keyStat = fs.statSync(keyPath);
  const certStat = fs.statSync(certPath);
  const caStat = fs.statSync(caCertPath);

  console.log('\n============================================================');
  console.log(' ✅ TLS/SSL CERTIFICATE SUITE GENERATED SUCCESSFULLY 🟢');
  console.log('============================================================');
  console.log(`    Root CA:        ${caCertPath} (${caStat.size} bytes)`);
  console.log(`    Server Key:     ${keyPath} (${keyStat.size} bytes)`);
  console.log(`    Server Cert:    ${certPath} (${certStat.size} bytes)`);
  console.log(`    Full Chain:     ${chainPath}`);
  console.log('    Subject:        CN=localhost, O=J & D Beach House Management, L=Bolinao, ST=Pangasinan, C=PH');
  console.log('    SANs:           localhost, *.localhost, janddbeachhouse.local, patar.janddbeachhouse.ph, 127.0.0.1');
  console.log('    Validity:       Server (825 days) | CA (10 years)');
  console.log('============================================================\n');

  return { success: true, keyPath, certPath, caCertPath, chainPath, status: 'Freshly Generated' };
}

// Auto-run if executed as script
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(__filename)) {
  try {
    const isForce = process.argv.includes('--force');
    generateCertificates(isForce);
  } catch (err) {
    console.error('\n❌ Certificate generation failed:', err.message);
    process.exit(1);
  }
}
