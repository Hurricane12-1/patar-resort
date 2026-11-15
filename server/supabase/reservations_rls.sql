-- ============================================================================
-- Rock View Beach Resort — reservations RLS (fixes "bookings don't register")
-- ----------------------------------------------------------------------------
-- The live `reservations` table has RLS ENABLED but NO INSERT policy, so a
-- signed-in guest's booking (sent with their Supabase token) is rejected with
--   42501 "new row violates row-level security policy for table reservations"
-- and the server silently drops it into an in-memory store that never persists.
--
-- These policies let an authenticated guest create and read back ONLY their own
-- reservation, and let staff see/manage all. The server's service-role key (when
-- configured) still bypasses RLS, so staff/admin tooling is unaffected.
--
-- Matched to the live schema's public.get_auth_role(). Idempotent. Run in the
-- Supabase SQL editor.
-- ============================================================================

alter table public.reservations enable row level security;

-- A guest creates their OWN reservation (guest_id must be their uid); staff may
-- create a booking for any guest (walk-in desk).
drop policy if exists "Guests create own reservations" on public.reservations;
create policy "Guests create own reservations" on public.reservations for insert
  with check (
    guest_id = auth.uid()
    or public.get_auth_role() = any (array['staff','receptionist','accounting','administrator'])
  );

-- A guest reads their OWN reservations (needed so the booking row can be read
-- back right after insert, and for "My Bookings"); staff read all.
drop policy if exists "Reservations visible to owner or staff" on public.reservations;
create policy "Reservations visible to owner or staff" on public.reservations for select
  using (
    guest_id = auth.uid()
    or public.get_auth_role() = any (array['staff','receptionist','accounting','administrator'])
  );

-- Status changes / desk edits (staff only). Guest cancellations go through the
-- server (service role), so no guest UPDATE policy is granted here.
drop policy if exists "Staff manage reservations" on public.reservations;
create policy "Staff manage reservations" on public.reservations for update
  using (public.get_auth_role() = any (array['staff','receptionist','accounting','administrator']))
  with check (public.get_auth_role() = any (array['staff','receptionist','accounting','administrator']));

-- ----------------------------------------------------------------------------
-- IMPORTANT companion check (not SQL): the server must have a real
-- SUPABASE_SERVICE_ROLE_KEY set in its hosting env. "My Bookings" and the admin
-- reservation lists read through the service-role client; without that key they
-- fall back to the anon key and return nothing. Set it on Render and redeploy.
-- ----------------------------------------------------------------------------
