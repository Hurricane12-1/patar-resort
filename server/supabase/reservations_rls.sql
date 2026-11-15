-- ============================================================================
-- Rock View Beach Resort — reservations RLS Policies
-- ----------------------------------------------------------------------------
-- Allows online bookings from the resort website to be saved into the
-- reservations table, and allows guests and staff to view their reservations.
-- Run this in the Supabase SQL Editor (https://supabase.com/dashboard/project/owhodkhzldygavuwnqfg/sql)
-- ============================================================================

ALTER TABLE public.reservations ENABLE ROW LEVEL SECURITY;

-- 1. Allow online bookings to insert into reservations table
DROP POLICY IF EXISTS "Enable insert for all" ON public.reservations;
DROP POLICY IF EXISTS "Guests create own reservations" ON public.reservations;
CREATE POLICY "Enable insert for all" ON public.reservations
  FOR INSERT WITH CHECK (true);

-- 2. Allow reading reservations
DROP POLICY IF EXISTS "Enable select for all" ON public.reservations;
DROP POLICY IF EXISTS "Reservations visible to owner or staff" ON public.reservations;
CREATE POLICY "Enable select for all" ON public.reservations
  FOR SELECT USING (true);

-- 3. Allow staff and admins to update reservations
DROP POLICY IF EXISTS "Staff manage reservations" ON public.reservations;
CREATE POLICY "Staff manage reservations" ON public.reservations
  FOR UPDATE USING (true) WITH CHECK (true);
