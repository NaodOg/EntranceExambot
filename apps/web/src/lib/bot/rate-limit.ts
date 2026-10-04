/**
 * Best-effort in-memory token-bucket rate limiter.
 *
 * Serverless instances are ephemeral, so this is a first line of defense that
 * mitigates bursts hitting a warm instance. It is intentionally cheap and
 * bounded to avoid unbounded memory growth.
 */
type Bucket = { tokens: number; updated: number };

const buckets = new Map<string, Bucket>();
const MAX_BUCKETS = 5000;

export function allow(key: string, options: { rate: number; burst: number }): boolean {
  const now = Date.now();
  const bucket = buckets.get(key) ?? { tokens: options.burst, updated: now };
  const elapsedSec = Math.max(0, now - bucket.updated) / 1000;
  bucket.tokens = Math.min(options.burst, bucket.tokens + elapsedSec * options.rate);
  bucket.updated = now;

  if (bucket.tokens < 1) {
    buckets.set(key, bucket);
    return false;
  }
  bucket.tokens -= 1;
  buckets.set(key, bucket);

  if (buckets.size > MAX_BUCKETS) {
    // Drop the oldest ~10% to keep memory bounded.
    const entries = [...buckets.entries()].sort((a, b) => a[1].updated - b[1].updated);
    for (const [k] of entries.slice(0, Math.floor(MAX_BUCKETS / 10))) {
      buckets.delete(k);
    }
  }
  return true;
}
