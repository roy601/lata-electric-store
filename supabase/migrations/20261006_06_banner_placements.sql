-- ════════════════════════════════════════════════════════════════════
-- Migration 06 — banner placements and links
--
-- Run BEFORE deploying the matching server (it saves these two columns).
-- Safe to run more than once. Existing banners stay in the main slider.
--
--   placement  'slider'      big rotating banner (1600×700)
--              'side_wide'   right column, wide tiles (two of them)
--              'side_small'  right column, small tiles (two side by side)
--   link_url   optional: where a click goes — a page on the site
--              (e.g. /products?cat=13, /flash-sale) or a full https:// link.
--              When empty, the banner's product (product_id) is used.
-- ════════════════════════════════════════════════════════════════════

alter table public.banners add column if not exists placement text not null default 'slider';
alter table public.banners add column if not exists link_url  text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'banners_placement_check') then
    alter table public.banners add constraint banners_placement_check
      check (placement in ('slider', 'side_wide', 'side_small'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'banners_link_url_check') then
    -- only site paths or http(s) links (never javascript: and the like)
    alter table public.banners add constraint banners_link_url_check
      check (link_url is null or link_url ~ '^(/[^/]|https?://)' or link_url = '/');
  end if;
end $$;

notify pgrst, 'reload schema';
