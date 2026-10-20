import crypto from 'crypto';

/**
 * Derives a cryptographically secure, salted scrypt password hash.
 * Output format: scrypt:<salt-hex>:<hash-hex>
 */
export function hashPassword(plainPassword) {
  if (!plainPassword || typeof plainPassword !== 'string') return '';
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(plainPassword, salt, 64).toString('hex');
  return `scrypt:${salt}:${hash}`;
}

/**
 * Constant-time password verification supporting scrypt hashes with legacy plain fallback.
 */
export function verifyPassword(plainPassword, storedPassword) {
  if (!storedPassword || !plainPassword) return false;
  const strStored = String(storedPassword).trim();
  const strPlain = String(plainPassword).trim();

  if (strStored.startsWith('scrypt:')) {
    const parts = strStored.split(':');
    if (parts.length !== 3) return false;
    const [, salt, originalHash] = parts;
    try {
      const computedHash = crypto.scryptSync(strPlain, salt, 64).toString('hex');
      return crypto.timingSafeEqual(Buffer.from(computedHash, 'hex'), Buffer.from(originalHash, 'hex'));
    } catch {
      return false;
    }
  }

  // Backward compatibility with unhashed legacy passwords
  return strPlain === strStored;
}
