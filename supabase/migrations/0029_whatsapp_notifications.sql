-- =============================================================================
-- Migration 0029 — WhatsApp notification preference
-- Per-user opt-out flag for WhatsApp delivery (the channel itself activates
-- only when WHATSAPP_ACCESS_TOKEN / WHATSAPP_PHONE_NUMBER_ID are configured).
-- =============================================================================

alter table public.notification_preferences
  add column if not exists whatsapp_notifications boolean not null default true;
