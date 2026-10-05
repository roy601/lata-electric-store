-- ════════════════════════════════════════════════════════════════════
-- Migration 07 — pop-up banner (shown once to each visitor)
--
-- Adds 'popup' as a banner placement. Includes migration 06, so it is
-- fine to run this one even if 06 was never run. Safe to run more than once.
-- ════════════════════════════════════════════════════════════════════

alter table public.banners add column if not exists placement text not null default 'slider';
alter table public.banners add column if not exists link_url  text;

alter table public.banners drop constraint if exists banners_placement_check;
alter table public.banners add constraint banners_placement_check
  check (placement in ('slider', 'side_wide', 'side_small', 'popup'));

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'banners_link_url_check') then
    -- only site paths or http(s) links (never javascript: and the like)
    alter table public.banners add constraint banners_link_url_check
      check (link_url is null or link_url ~ '^(/[^/]|https?://)' or link_url = '/');
  end if;
end $$;

notify pgrst, 'reload schema';
