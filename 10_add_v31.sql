-- ============================================================
-- v31: recycle bin (deleted matches kept 30 days) + richer daily Telegram digest.
-- Run once in Supabase SQL Editor (after the earlier files). Safe to run again.
-- ============================================================
create table if not exists public.deleted_matches (
  id          bigint generated always as identity primary key,
  match_id    text,
  series      text,
  match_name  text,
  match_date  date,
  data        jsonb not null,
  deleted_at  timestamptz not null default now(),
  deleted_by  uuid default auth.uid()
);
alter table public.deleted_matches enable row level security;
drop policy if exists "bin insert" on public.deleted_matches;
create policy "bin insert" on public.deleted_matches for insert to authenticated with check (true);
drop policy if exists "bin admin read" on public.deleted_matches;
create policy "bin admin read" on public.deleted_matches for select to authenticated using (public.is_admin());
drop policy if exists "bin admin delete" on public.deleted_matches;
create policy "bin admin delete" on public.deleted_matches for delete to authenticated using (public.is_admin());

-- Daily digest: today's matches + tomorrow's count + pending uploads
create or replace function public.send_telegram_schedule() returns text
language plpgsql security definer set search_path = public, extensions as $$
declare tok text; chat text; tz text := 'Asia/Kolkata'; txt text; today date; rec record; n int := 0; tom int; pend int;
begin
  select value into tok  from public.app_settings where key = 'tg_token';
  select value into chat from public.app_settings where key = 'tg_chat';
  if tok is null or chat is null then return 'Telegram is not configured'; end if;
  today := (now() at time zone tz)::date;
  txt := 'Matches today (' || to_char(today, 'DD Mon YYYY') || ')' || E'\n';
  for rec in select * from public.matches
             where match_date = today and coalesce(status,'Scheduled') not in ('Cancelled','Postponed','Abandoned')
             order by match_time loop
    n := n + 1;
    txt := txt || E'\n' || left(rec.match_time::text, 5) || ' - ' || rec.match || ' (' || rec.series || ')'
        || case when coalesce(rec.camera,'') <> ''           then ' | ' || rec.camera else '' end
        || case when coalesce(rec.operator,'') <> ''         then ' | ' || split_part(rec.operator, '@', 1) else '' end
        || case when coalesce(rec.stream_platforms,'') <> '' then ' | Live: ' || rec.stream_platforms else '' end;
  end loop;
  if n = 0 then txt := txt || E'\nNo matches today.'; end if;
  select count(*) into tom from public.matches
    where match_date = today + 1 and coalesce(status,'Scheduled') not in ('Cancelled','Postponed','Abandoned');
  select count(*) into pend from public.matches
    where match_date < today and uploaded <> 'Done' and coalesce(status,'Scheduled') not in ('Cancelled','Postponed','Abandoned','Uploaded');
  txt := txt || E'\n\nTomorrow: ' || tom || ' match(es)' || E'\nUpload pending: ' || pend;
  perform net.http_post(
    url     := 'https://api.telegram.org/bot' || tok || '/sendMessage',
    headers := '{"Content-Type":"application/json"}'::jsonb,
    body    := jsonb_build_object('chat_id', chat, 'text', txt));
  return 'sent (' || n || ' matches today, ' || tom || ' tomorrow, ' || pend || ' pending)';
end; $$;

-- Supabase (from 30 Oct 2026): new tables need an explicit GRANT for the Data API.
grant select, insert, update, delete on public.deleted_matches to authenticated;
grant select, insert, update, delete on public.deleted_matches to service_role;
grant usage, select on all sequences in schema public to authenticated, service_role;
