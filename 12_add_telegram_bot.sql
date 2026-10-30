-- ============================================================
-- v35: Telegram bot (two-way). Run once in Supabase SQL Editor.
-- Table maps a Telegram chat to an approved app user. Only the bot (service role) touches it.
-- ============================================================
create table if not exists public.telegram_links (
  chat_id    bigint primary key,
  email      text not null,
  created_at timestamptz not null default now()
);
alter table public.telegram_links enable row level security;   -- no policies: app users cannot read or write it
grant select, insert, update, delete on public.telegram_links to service_role;   -- needed for tables created after 30 Oct 2026

-- The bot is allowed to write to these through service_role
grant select, insert, update on public.matches      to service_role;
grant select, insert         on public.activity_log to service_role;
grant select                 on public.profiles     to service_role;
grant usage, select on all sequences in schema public to service_role;
