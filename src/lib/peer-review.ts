import type { Json } from "@/types/database";

// Behavioural peer-review criteria. Each is rated 1–5 by a colleague. These
// keys are stored in peer_reviews.ratings (jsonb) and translated in the UI via
// the "peerReview" namespace.
export const PEER_CRITERIA = [
  "style",
  "treatment",
  "communication",
  "collaboration",
  "professionalism",
] as const;

export type PeerCriterion = (typeof PEER_CRITERIA)[number];

export type PeerRatings = Record<PeerCriterion, number>;

// Current monthly period (1st → last day) as ISO dates. Peer reviews are
// scoped to one submission per colleague per month.
export function currentReviewPeriod(ref: Date = new Date()): {
  start: string;
  end: string;
} {
  const start = new Date(Date.UTC(ref.getUTCFullYear(), ref.getUTCMonth(), 1));
  const end = new Date(Date.UTC(ref.getUTCFullYear(), ref.getUTCMonth() + 1, 0));
  return {
    start: start.toISOString().slice(0, 10),
    end: end.toISOString().slice(0, 10),
  };
}

// Clamps a raw rating to the valid 1–5 integer range; returns null if absent.
export function normalizeRating(value: unknown): number | null {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return Math.min(5, Math.max(1, Math.round(n)));
}

// Builds a validated ratings object from form values. Missing/invalid criteria
// are dropped so partial submissions still work.
export function buildRatings(get: (key: string) => unknown): PeerRatings {
  const out = {} as PeerRatings;
  for (const c of PEER_CRITERIA) {
    const r = normalizeRating(get(c));
    if (r !== null) out[c] = r;
  }
  return out;
}

// Average of the provided criterion ratings (0 if none), rounded to 1 dp.
export function ratingsAverage(ratings: Json | null | undefined): number {
  if (!ratings || typeof ratings !== "object" || Array.isArray(ratings)) {
    return 0;
  }
  const values = PEER_CRITERIA.map((c) => Number((ratings as Record<string, unknown>)[c])).filter(
    (n) => Number.isFinite(n),
  );
  if (values.length === 0) return 0;
  const avg = values.reduce((s, n) => s + n, 0) / values.length;
  return Math.round(avg * 10) / 10;
}
