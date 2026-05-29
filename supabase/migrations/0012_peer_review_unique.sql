-- =============================================================================
-- Migration 0012 — Peer review: one review per (reviewer, reviewee, period)
-- Peer reviews are behavioural (style / treatment / communication /
-- collaboration / professionalism), submitted by colleagues — not random.
-- A reviewer may review a given colleague once per monthly period; submitting
-- again updates the existing review (upsert on this constraint).
-- =============================================================================

alter table public.peer_reviews
  add constraint peer_reviews_unique_per_period
  unique (reviewer_id, reviewee_id, period_start);
