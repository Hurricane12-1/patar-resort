-- ============================================================================
-- Rock View Beach Resort — APPLY-NOW migration (live Supabase: owhodkhzldygavuwnqfg)
-- ----------------------------------------------------------------------------
-- One paste-ready script for the Supabase SQL editor. It matches the pipeline
-- the code now expects against the LIVE schema (get_auth_role(), is_approved,
-- "Public can view approved reviews"). It bundles, in order:
--
--   A. reviews_moderation.sql  — adds the moderation + admin-reply columns the
--      review console and POST /api/reviews now write to. Without this the
--      moderation queue errors with "column moderation_status does not exist".
--   B. security_hardening.sql  — blocks self-service role escalation and stops
--      profiles being world-readable.
--   C. reservations_rls.sql    — lets a guest insert/read their own booking.
--   D. room_availability view  — PII-free source for the booking calendar.
--   E. booking_code.sql        — fills the NOT NULL booking_code on every insert.
--
-- Idempotent: safe to run more than once. Run as the project owner (the SQL
-- editor runs with full rights). After running, restart / redeploy the API so
-- new reviews land as 'pending'.
--
-- NOT included (needs a code change first — see security_hardening.sql footer):
-- enabling RLS on employee_accounts / audit_logs, because the browser still
-- reads them directly with the anon key.
-- ============================================================================


-- ============================================================================
-- A. REVIEW MODERATION + ADMIN REPLY
-- ============================================================================

alter table public.reviews
  add column if not exists moderation_status text not null default 'pending',
  add column if not exists moderation_note   text,
  add column if not exists moderated_at      timestamptz,
  add column if not exists moderated_by      uuid references auth.users(id) on delete set null,
  add column if not exists admin_reply       text,
  add column if not exists admin_reply_at    timestamptz,
  add column if not exists admin_reply_by    uuid references auth.users(id) on delete set null;

alter table public.reviews drop constraint if exists reviews_moderation_status_chk;
alter table public.reviews
  add constraint reviews_moderation_status_chk
  check (moderation_status in ('pending', 'approved', 'rejected', 'flagged'));

-- Backfill from the legacy is_approved flag so existing reviews keep visibility.
update public.reviews
   set moderation_status = case when is_approved is true then 'approved' else 'pending' end
 where moderation_status is null
    or moderation_status not in ('pending', 'approved', 'rejected', 'flagged');

update public.reviews
   set is_approved = (moderation_status = 'approved');

create index if not exists reviews_moderation_status_idx
  on public.reviews (moderation_status, created_at desc);

-- Public wall shows approved only; a guest still sees their own pending review;
-- staff see everything for the queue. Replaces the live SELECT policy by name.
drop policy if exists "Public can view approved reviews" on public.reviews;
create policy "Public can view approved reviews" on public.reviews for select
  using (
    is_approved = true
    or guest_id = auth.uid()
    or public.get_auth_role() = any (array['staff','receptionist','accounting','administrator'])
  );


-- ============================================================================
-- B. SECURITY HARDENING
-- ============================================================================

-- B1. Block self-service role escalation. Only the service role may change role.
create or replace function public.prevent_role_escalation()
  returns trigger
  language plpgsql
  security definer
  set search_path = public
as $$
begin
  if NEW.role is distinct from OLD.role
     and coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'Changing profile role is not permitted; roles are managed by staff tooling.'
      using errcode = 'insufficient_privilege';
  end if;
  return NEW;
end;
$$;

drop trigger if exists trg_prevent_role_escalation on public.profiles;
create trigger trg_prevent_role_escalation
  before update on public.profiles
  for each row execute function public.prevent_role_escalation();

-- B2. Stop exposing every profile to the public. Owner or staff only.
drop policy if exists "Public profiles read" on public.profiles;
create policy "Profiles readable by owner or staff" on public.profiles for select
  using (
    auth.uid() = id
    or public.get_auth_role() = any (array['staff','receptionist','accounting','administrator'])
  );

-- ============================================================================
-- C. RESERVATIONS RLS  — fixes "bookings don't register"
-- ----------------------------------------------------------------------------
-- reservations had RLS enabled but NO insert policy, so guest bookings were
-- rejected (42501) and silently dropped into an in-memory store. Let a guest
-- create/read only their own reservation; staff see/manage all.
-- ============================================================================

alter table public.reservations enable row level security;

drop policy if exists "Guests create own reservations" on public.reservations;
create policy "Guests create own reservations" on public.reservations for insert
  with check (
    guest_id = auth.uid()
    or public.get_auth_role() = any (array['staff','receptionist','accounting','administrator'])
  );

drop policy if exists "Reservations visible to owner or staff" on public.reservations;
create policy "Reservations visible to owner or staff" on public.reservations for select
  using (
    guest_id = auth.uid()
    or public.get_auth_role() = any (array['staff','receptionist','accounting','administrator'])
  );

drop policy if exists "Staff manage reservations" on public.reservations;
create policy "Staff manage reservations" on public.reservations for update
  using (public.get_auth_role() = any (array['staff','receptionist','accounting','administrator']))
  with check (public.get_auth_role() = any (array['staff','receptionist','accounting','administrator']));


-- ============================================================================
-- D. ROOM AVAILABILITY VIEW  — fixes the booking calendar's 404
-- ----------------------------------------------------------------------------
-- The client greys out taken dates by reading public.room_availability, but the
-- view was never created in the live DB, so the request 404s. This PII-free view
-- exposes only room_id + dates + status (never guest identity) and runs as its
-- owner, so anon/guest can read availability without opening up reservations.
-- ============================================================================

create or replace view public.room_availability
  with (security_invoker = false) as
  select room_id, check_in, check_out, status
  from public.reservations
  where status in ('pending', 'confirmed', 'checked_in');
grant select on public.room_availability to anon, authenticated;


-- ============================================================================
-- E. BOOKING CODE  — fixes "null value in column booking_code"
-- ----------------------------------------------------------------------------
-- booking_code is NOT NULL with no default, and no insert path sets it. This
-- trigger reuses the voucher reference from notes ("Ref RV-BOL-2026-6276"), or
-- mints a fresh code when there is none or it is taken. Same as booking_code.sql.
-- ============================================================================

create or replace function public.set_booking_code()
  returns trigger
  language plpgsql
  security definer
  set search_path = public
as $$
declare
  noted_ref text;
  candidate text;
begin
  if NEW.booking_code is not null and btrim(NEW.booking_code) <> '' then
    return NEW;
  end if;

  noted_ref := substring(coalesce(NEW.notes, '') from 'Ref\s+(RV-[A-Z0-9-]+)');
  candidate := noted_ref;

  while candidate is null
     or exists (select 1 from public.reservations r where r.booking_code = candidate) loop
    candidate := 'RV-BOL-'
      || to_char(coalesce(NEW.check_in, (now() at time zone 'Asia/Manila')::date), 'YYYY')
      || '-'
      || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));
  end loop;

  if noted_ref is not null and noted_ref <> candidate then
    NEW.notes := regexp_replace(NEW.notes, 'Ref\s+RV-[A-Z0-9-]+', 'Ref ' || candidate);
  end if;

  NEW.booking_code := candidate;
  return NEW;
end;
$$;

drop trigger if exists trg_set_booking_code on public.reservations;
create trigger trg_set_booking_code
  before insert on public.reservations
  for each row execute function public.set_booking_code();


-- ============================================================================
-- End. Verify as an anon/guest token (NOT the service role):
--   update public.profiles set role='administrator' where id=auth.uid();  -- must FAIL
--   select email from public.profiles where id <> auth.uid();             -- 0 rows
--   select * from public.reviews where is_approved = false;               -- only your own
-- ============================================================================
