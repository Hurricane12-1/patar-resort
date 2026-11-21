import { spawn } from 'node:child_process';
import http from 'node:http';
import https from 'node:https';
import net from 'node:net';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const serverDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

export const BYPASS_HEADERS = { 'x-benchmark-bypass': 'jd-benchmark-concurrency-route-test' };

function freePort() {
  return new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.on('error', reject);
    probe.listen(0, '127.0.0.1', () => {
      const { port } = probe.address();
      probe.close(() => resolve(port));
    });
  });
}

/**
 * Starts the real server as a child process with an isolated data folder and no usable
 * Supabase, so tests never touch real data. Resolves once the server prints its port line.
 */
export async function startServer({ benchmark }) {
  const port = await freePort();
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'server-test-'));
  const child = spawn(process.execPath, ['server.js'], {
    cwd: serverDir,
    env: {
      ...process.env,
      PORT: String(port),
      SERVER_DB_DIR: dataDir,
      SUPABASE_URL: 'http://127.0.0.1:9',
      SUPABASE_SERVICE_ROLE_KEY: '',
      NODE_ENV: 'development',
      BENCHMARK_MODE: benchmark ? 'true' : 'false',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  let output = '';
  child.stdout.on('data', (chunk) => { output += chunk; });
  child.stderr.on('data', (chunk) => { output += chunk; });
  const exited = new Promise((resolve) => child.once('exit', resolve));

  const deadline = Date.now() + 30000;
  while (!/Primary Port\s*:/.test(output)) {
    if (child.exitCode !== null) throw new Error(`server exited early:\n${output}`);
    if (Date.now() > deadline) throw new Error(`server did not start:\n${output}`);
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  return {
    port,
    secure: /Primary Port\s*:.*HTTPS/.test(output),
    async stop() {
      child.kill();
      await Promise.race([exited, new Promise((resolve) => setTimeout(resolve, 5000))]);
      fs.rmSync(dataDir, { recursive: true, force: true });
    },
  };
}

export function request(server, { method = 'GET', urlPath, headers = {}, body } = {}) {
  return new Promise((resolve, reject) => {
    const payload = body === undefined ? null : JSON.stringify(body);
    const transport = server.secure ? https : http;
    const req = transport.request(
      {
        host: '127.0.0.1',
        port: server.port,
        method,
        path: urlPath,
        rejectUnauthorized: false,
        headers: {
          ...(payload ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) } : {}),
          ...headers,
        },
      },
      (res) => {
        const chunks = [];
        res.on('data', (chunk) => chunks.push(chunk));
        res.on('end', () => {
          const text = Buffer.concat(chunks).toString('utf8');
          let json = null;
          try {
            json = JSON.parse(text);
          } catch {
            json = null;
          }
          resolve({ status: res.statusCode, headers: res.headers, text, json });
        });
      },
    );
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

/** Any path works: the cookie middleware issues the CSRF pair before routing. */
export async function csrfHeaders(server) {
  const res = await request(server, { urlPath: '/robots.txt' });
  const cookie = (res.headers['set-cookie'] || []).map((c) => c.split(';')[0]).join('; ');
  return { 'X-CSRF-Token': res.headers['x-csrf-token'], Cookie: cookie };
}
