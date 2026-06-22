/**
 * Best-effort in-memory rate limiting for public endpoints.
 *
 * State lives in the function instance, so this is intentionally "light": it
 * deters scripted guessing without any external store. Limits reset on cold
 * start and are per-instance, which is acceptable for low-volume forms.
 */

interface Bucket {
  count: number;
  reset: number;
}

const buckets = new Map<string, Bucket>();

/** Returns true if the call is allowed, false if the limit is exceeded. */
export function rateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();

  // Opportunistic cleanup to keep the map bounded.
  if (buckets.size > 5000) {
    for (const [k, b] of buckets) if (now > b.reset) buckets.delete(k);
  }

  const bucket = buckets.get(key);
  if (!bucket || now > bucket.reset) {
    buckets.set(key, { count: 1, reset: now + windowMs });
    return true;
  }
  if (bucket.count >= limit) return false;
  bucket.count++;
  return true;
}

/** Best-effort client IP from Netlify / proxy headers. */
export function clientIp(req: Request): string {
  return (
    req.headers.get("x-nf-client-connection-ip") ||
    (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() ||
    "unknown"
  );
}
