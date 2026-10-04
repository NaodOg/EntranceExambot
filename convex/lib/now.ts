/**
 * Trusted clock for client-timestamped reads.
 *
 * Several queries take a client-supplied `nowMs` so Convex can memoise the
 * result for the rest of the minute (a clock read inside the handler would make
 * every response unique and permanently cold). A client clock is not trusted,
 * though: it is clamped to a small window around server time so nobody can gain
 * quota, keep a streak alive past expiry, or read Pro status after it lapsed by
 * setting their device clock forward.
 */

const MAX_DRIFT_MS = 5 * 60 * 1000;

export function resolveNowMs(nowMs: number | undefined): number {
  const serverNow = Date.now();
  if (typeof nowMs !== "number" || !Number.isFinite(nowMs)) return serverNow;
  return Math.min(Math.max(nowMs, serverNow - MAX_DRIFT_MS), serverNow + MAX_DRIFT_MS);
}