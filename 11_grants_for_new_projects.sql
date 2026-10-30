-- ============================================================
-- Run this ONCE on any NEW Supabase project / preview branch / after "supabase db reset",
-- AFTER the other SQL files. (Your existing project does not need it: existing tables keep their grants.)
-- Row Level Security policies in the other files still decide who can read or change what.
-- app_settings is deliberately NOT granted: only the security-definer functions may touch it.
-- ============================================================
grant select, insert, update, delete on public.matches                   to authenticated, service_role;
grant select, insert, update, delete on public.profiles                  to authenticated, service_role;
grant select, insert, update, delete on public.match_reschedule_history  to authenticated, service_role;
grant select, insert, update, delete on public.activity_log              to authenticated, service_role;
grant select, insert, update, delete on public.backups                   to authenticated, service_role;
grant select, insert, update, delete on public.shares                    to authenticated, service_role;
grant select, insert, update, delete on public.alert_log                 to authenticated, service_role;
grant select, insert, update, delete on public.deleted_matches           to authenticated, service_role;
grant usage, select on all sequences in schema public to authenticated, service_role;
