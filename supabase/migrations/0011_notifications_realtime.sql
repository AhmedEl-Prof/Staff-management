-- =============================================================================
-- Migration 0011 — Notifications realtime
-- Adds the notifications table to the supabase_realtime publication so the
-- bell badge + notifications page can stream in-app updates live.
-- =============================================================================

alter publication supabase_realtime add table public.notifications;
