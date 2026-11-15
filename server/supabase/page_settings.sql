-- =====================================================================
-- Page Adjustment: site_settings table (admin-managed public page media)
-- Run this in the Supabase SQL editor once.
-- =====================================================================

create table if not exists public.site_settings (
  key         text primary key,
  value       jsonb not null default '{}'::jsonb,
  updated_by  uuid,
  updated_at  timestamptz not null default now()
);

alter table public.site_settings enable row level security;

-- Public (anon + signed-in) may READ only the curated 'page_media' row.
-- It holds display image URLs only — never secrets.
drop policy if exists site_settings_public_read on public.site_settings;
create policy site_settings_public_read
  on public.site_settings
  for select
  to anon, authenticated
  using (key = 'page_media');

-- No INSERT / UPDATE / DELETE policies are defined for anon/authenticated,
-- so RLS denies all client-side writes. The API server writes exclusively
-- through the Supabase service-role key (which bypasses RLS) AFTER it has
-- verified the caller is an administrator. This keeps the write path
-- end-to-end admin-only and tamper-proof from the browser.

-- Seed the row so the first read always succeeds.
insert into public.site_settings (key, value)
values ('page_media', '{}'::jsonb)
on conflict (key) do nothing;
