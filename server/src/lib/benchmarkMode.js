const BENCHMARK_HEADER_PREFIX = 'jd-benchmark-concurrency';

export const isBenchmarkMode = () => process.env.BENCHMARK_MODE === 'true';

/**
 * A request may skip authentication and rate limits only when the operator started
 * the server with BENCHMARK_MODE=true. The header alone is never enough: its value
 * is committed in scripts/ and anyone can send it.
 */
export function isBenchmarkRequest(req) {
  if (!isBenchmarkMode()) return false;
  const bypass = String(req.headers['x-benchmark-bypass'] || '');
  return bypass.startsWith(BENCHMARK_HEADER_PREFIX) || Boolean(req.headers['x-benchmark-test']);
}
