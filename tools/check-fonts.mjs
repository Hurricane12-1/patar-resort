// Fails when a font family outside the two allowed in docs/design/typography.md appears in the code.
import fs from 'node:fs';
import path from 'node:path';

const ALLOWED = new Set([
  'playfair display',
  'plus jakarta sans',
  'georgia',
  'arial',
  'system-ui',
  'sans-serif',
  'serif',
  'inherit',
  'initial',
  'unset',
]);

const root = path.resolve(process.argv[2] || '.');
const targets = [
  path.join(root, 'client', 'src'),
  path.join(root, 'server', 'src', 'lib'),
];

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (/\.(css|ts|tsx|js)$/.test(entry.name)) out.push(full);
  }
  return out;
}

const DECLARATIONS = [
  /font-family\s*:\s*([^;}"`]+)/g,
  /--font-[a-z-]+\s*:\s*([^;}"`]+)/g,
  /fontFamily\s*[:=]\s*(["'])(.*?)\1/g,
  /fontFamily\s*[:=]\s*\{?\s*(["'])(.*?)\1/g,
];

const violations = [];
for (const file of targets.flatMap((t) => walk(t))) {
  const text = fs.readFileSync(file, 'utf8');
  const seen = new Set();
  for (const pattern of DECLARATIONS) {
    for (const match of text.matchAll(pattern)) {
      const value = (match[2] ?? match[1]).replace(/var\([^)]*\)/g, '').replace(/!important/g, '');
      for (const raw of value.split(',')) {
        const name = raw.trim().replace(/^['"]|['"]$/g, '').trim().toLowerCase();
        if (!name || ALLOWED.has(name) || seen.has(name)) continue;
        seen.add(name);
        const line = text.slice(0, match.index).split('\n').length;
        violations.push(`${path.relative(root, file)}:${line}  "${raw.trim()}"`);
      }
    }
  }
}

if (violations.length) {
  console.error('Font rule broken. Only Playfair Display and Plus Jakarta Sans are allowed:');
  for (const v of violations) console.error('  ' + v);
  process.exit(1);
}
console.log('Font check passed: only Playfair Display and Plus Jakarta Sans are in use.');
