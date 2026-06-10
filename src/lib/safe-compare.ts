import { createHash, timingSafeEqual } from "node:crypto";

// Constant-time string comparison for secrets (e.g. cron bearer tokens).
// Hashing both sides first equalizes buffer lengths, which timingSafeEqual
// requires, and avoids leaking the secret's length through early returns.
export function safeCompare(a: string, b: string): boolean {
  const ha = createHash("sha256").update(a).digest();
  const hb = createHash("sha256").update(b).digest();
  return timingSafeEqual(ha, hb);
}
