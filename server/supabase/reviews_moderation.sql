-- ============================================================================
-- Rock View Beach Resort — Guest Review Moderation & Admin Reply
-- ----------------------------------------------------------------------------
-- Adds a moderation workflow (pending -> approved / rejected / flagged) and an
-- official management reply to the public reviews table.
--
-- Written against the LIVE schema: reviews.is_approved defaults true, the public
-- read policy is "Public can view approved reviews", and staff are identified by
-- public.get_auth_role() (NOT jd_is_staff). Safe to run more than once.
-- Apply in the Supabase SQL editor, then restart the API so new reviews land as
-- 'pending'.
-- ============================================================================

alter table public.reviews
  add column if not exists moderation_status text not null default 'pending',
  add column if not exists moderation_note   text,
  add column if not exists moderated_at      timestamptz,
  add column if not exists moderated_by      uuid references auth.users(id) on delete set null,
  add column if not exists admin_reply       text,
  add column if not exists admin_reply_at    timestamptz,
  add column if not exists admin_reply_by    uuid references auth.users(id) on delete set null;

-- Constrain moderation_status to the known states.
alter table public.reviews drop constraint if exists reviews_moderation_status_chk;
alter table public.reviews
  add constraint reviews_moderation_status_chk
  check (moderation_status in ('pending', 'approved', 'rejected', 'flagged'));

-- Backfill from the legacy is_approved flag (which defaults true on this schema)
-- so existing reviews keep their current visibility.
update public.reviews
   set moderation_status = case when is_approved is true then 'approved' else 'pending' end
 where moderation_status is null
    or moderation_status not in ('pending', 'approved', 'rejected', 'flagged');

-- Keep is_approved as the single source of truth for public visibility.
update public.reviews
   set is_approved = (moderation_status = 'approved');

create index if not exists reviews_moderation_status_idx
  on public.reviews (moderation_status, created_at desc);

-- ----------------------------------------------------------------------------
-- RLS: the public wall shows approved reviews only. A guest still sees their own
-- pending review (so "Reviewed" shows in My Bookings), and staff see everything
-- for the moderation queue. This REPLACES the live "Public can view approved
-- reviews" SELECT policy by name.
-- ----------------------------------------------------------------------------
drop policy if exists "Public can view approved reviews" on public.reviews;
create policy "Public can view approved reviews" on public.reviews for select
  using (
    is_approved = true
    or guest_id = auth.uid()
    or public.get_auth_role() = any (array['staff','receptionist','accounting','administrator'])
  );
