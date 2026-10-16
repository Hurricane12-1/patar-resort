-- ==============================================================================
-- J&D BEACH HOUSE RESORT - RLS INFINITE RECURSION FIX SCRIPT
-- ==============================================================================
-- Run this script in the Supabase SQL Editor:
-- https://supabase.com/dashboard/project/owhodkhzldygavuwnqfg/sql/new
--
-- PURPOSE:
-- 1. Creates SECURITY DEFINER functions is_admin() and is_staff() to bypass
--    Row Level Security when looking up user roles.
-- 2. Drops the recursive "Admins can manage all profiles" policy on public.profiles.
-- 3. Re-creates non-recursive policies on profiles, customers, users, rooms,
--    reservations, audit logs, and tasks.
-- ==============================================================================

-- 1. Create Security Definer Role Lookup Helpers (Bypasses RLS to avoid 42P17 recursion)
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND role IN ('administrator', 'admin')
  );
$$;

CREATE OR REPLACE FUNCTION public.is_staff()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND role IN ('administrator', 'admin', 'staff', 'receptionist', 'accounting')
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.is_staff() TO authenticated, anon;

-- 2. Drop the recursive ALL policy on profiles
DROP POLICY IF EXISTS "Admins can manage all profiles" ON public.profiles;

-- 3. Recreate clean, non-recursive policies on public.profiles
DROP POLICY IF EXISTS "Public can view basic profiles" ON public.profiles;
CREATE POLICY "Public can view basic profiles" ON public.profiles FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (
  auth.uid() = id OR public.is_admin()
);

DROP POLICY IF EXISTS "Users and admins can insert profiles" ON public.profiles;
CREATE POLICY "Users and admins can insert profiles" ON public.profiles FOR INSERT WITH CHECK (
  auth.uid() = id OR public.is_admin()
);

DROP POLICY IF EXISTS "Admins can delete profiles" ON public.profiles;
CREATE POLICY "Admins can delete profiles" ON public.profiles FOR DELETE USING (
  public.is_admin()
);

-- 4. Clean up Customers policies using helper functions
DROP POLICY IF EXISTS "Customers can view own record" ON public.customers;
CREATE POLICY "Customers can view own record" ON public.customers FOR SELECT USING (
  auth.uid() = id OR public.is_staff()
);

DROP POLICY IF EXISTS "Customers can update own record" ON public.customers;
CREATE POLICY "Customers can update own record" ON public.customers FOR UPDATE USING (
  auth.uid() = id OR public.is_admin()
);

DROP POLICY IF EXISTS "Admins can manage all customers" ON public.customers;
CREATE POLICY "Admins can manage all customers" ON public.customers FOR ALL USING (
  public.is_admin()
);

-- 5. Clean up Users (Staff) policies using helper functions
DROP POLICY IF EXISTS "Staff can view staff users" ON public.users;
CREATE POLICY "Staff can view staff users" ON public.users FOR SELECT USING (
  auth.uid() = id OR public.is_staff()
);

DROP POLICY IF EXISTS "Admins can manage all staff users" ON public.users;
CREATE POLICY "Admins can manage all staff users" ON public.users FOR ALL USING (
  public.is_admin()
);

-- 6. Clean up User Confirmations policies
DROP POLICY IF EXISTS "Users can view own confirmations" ON public.user_confirmations;
CREATE POLICY "Users can view own confirmations" ON public.user_confirmations FOR SELECT USING (
  auth.uid() = user_id OR public.is_admin()
);

DROP POLICY IF EXISTS "System and admins manage confirmations" ON public.user_confirmations;
CREATE POLICY "System and admins manage confirmations" ON public.user_confirmations FOR ALL USING (
  public.is_admin()
);

-- 7. Clean up Rooms policies
DROP POLICY IF EXISTS "Anyone can view active rooms" ON public.rooms;
CREATE POLICY "Anyone can view active rooms" ON public.rooms FOR SELECT USING (true);

DROP POLICY IF EXISTS "Staff and Admins can manage rooms" ON public.rooms;
CREATE POLICY "Staff and Admins can manage rooms" ON public.rooms FOR ALL USING (
  public.is_staff()
);

-- 8. Clean up Reservations policies
DROP POLICY IF EXISTS "Users can view own reservations" ON public.reservations;
CREATE POLICY "Users can view own reservations" ON public.reservations FOR SELECT USING (
  auth.uid() = guest_id OR public.is_staff()
);

DROP POLICY IF EXISTS "Users can create reservations" ON public.reservations;
CREATE POLICY "Users can create reservations" ON public.reservations FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Staff and Admins can manage reservations" ON public.reservations;
CREATE POLICY "Staff and Admins can manage reservations" ON public.reservations FOR ALL USING (
  public.is_staff()
);

-- 9. Clean up Department Tasks & Inventory policies
DROP POLICY IF EXISTS "Staff can access tasks" ON public.department_tasks;
CREATE POLICY "Staff can access tasks" ON public.department_tasks FOR ALL USING (
  public.is_staff()
);

DROP POLICY IF EXISTS "Staff can access inventory" ON public.resort_inventory;
CREATE POLICY "Staff can access inventory" ON public.resort_inventory FOR ALL USING (
  public.is_staff()
);

-- 10. Clean up Orders, Chat Messages, Notifications & Audit Logs
DROP POLICY IF EXISTS "Guests can view own orders" ON public.resort_orders;
CREATE POLICY "Guests can view own orders" ON public.resort_orders FOR SELECT USING (
  auth.uid() = guest_id OR public.is_staff()
);

DROP POLICY IF EXISTS "Guests can create orders" ON public.resort_orders;
CREATE POLICY "Guests can create orders" ON public.resort_orders FOR INSERT WITH CHECK (auth.uid() = guest_id);

DROP POLICY IF EXISTS "Users can access own chat messages" ON public.chat_messages;
CREATE POLICY "Users can access own chat messages" ON public.chat_messages FOR ALL USING (
  auth.uid() = profile_id OR public.is_staff()
);

DROP POLICY IF EXISTS "Users can view own notifications" ON public.notifications;
CREATE POLICY "Users can view own notifications" ON public.notifications FOR SELECT USING (
  auth.uid() = profile_id OR public.is_admin()
);

DROP POLICY IF EXISTS "Admins can view audit logs" ON public.audit_logs;
CREATE POLICY "Admins can view audit logs" ON public.audit_logs FOR SELECT USING (
  public.is_admin()
);
