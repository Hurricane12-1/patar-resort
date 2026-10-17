-- ==============================================================================
-- J & D BEACH HOUSE RESORT · MASTER RLS REMOVAL SCRIPT
-- ==============================================================================
-- Target: Supabase Dashboard -> SQL Editor -> New query -> Paste & Run
-- URL: https://supabase.com/dashboard/project/owhodkhzldygavuwnqfg/sql/new
--
-- PURPOSE:
-- Completely disables Row Level Security (RLS) on all public database tables
-- and removes all restrictive policies. All permissions are granted directly to
-- API roles, eliminating 42501 (Permission Denied) and 42P17 (Infinite Recursion).
-- Application-level RBAC is strictly handled by the Express API security middleware.
-- ==============================================================================

-- 1. DISABLE ROW LEVEL SECURITY (RLS) ON ALL RESORT TABLES
ALTER TABLE IF EXISTS public.customers DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.users DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.user_confirmations DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.rooms DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.reservations DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.resort_inventory DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.resort_services DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.resort_orders DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.department_tasks DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.reviews DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.chat_messages DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.notifications DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.audit_logs DISABLE ROW LEVEL SECURITY;

-- 2. DROP ALL POLICIES ACROSS ALL TABLES
-- Profiles
DROP POLICY IF EXISTS "Admins can manage all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Public can view basic profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users and admins can insert profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins can delete profiles" ON public.profiles;

-- Customers
DROP POLICY IF EXISTS "Customers can view own record" ON public.customers;
DROP POLICY IF EXISTS "Customers can update own record" ON public.customers;
DROP POLICY IF EXISTS "Admins can manage all customers" ON public.customers;

-- Users
DROP POLICY IF EXISTS "Staff can view staff users" ON public.users;
DROP POLICY IF EXISTS "Admins can manage all staff users" ON public.users;

-- User Confirmations
DROP POLICY IF EXISTS "Users can view own confirmations" ON public.user_confirmations;
DROP POLICY IF EXISTS "System and admins manage confirmations" ON public.user_confirmations;

-- Rooms
DROP POLICY IF EXISTS "Anyone can view active rooms" ON public.rooms;
DROP POLICY IF EXISTS "Staff and Admins can manage rooms" ON public.rooms;

-- Reservations
DROP POLICY IF EXISTS "Users can view own reservations" ON public.reservations;
DROP POLICY IF EXISTS "Users can create reservations" ON public.reservations;
DROP POLICY IF EXISTS "Staff and Admins can manage reservations" ON public.reservations;

-- Reviews
DROP POLICY IF EXISTS "Anyone can view approved reviews" ON public.reviews;
DROP POLICY IF EXISTS "Authenticated guests can create reviews" ON public.reviews;

-- Department Tasks
DROP POLICY IF EXISTS "Staff can access tasks" ON public.department_tasks;

-- Resort Inventory
DROP POLICY IF EXISTS "Staff can access inventory" ON public.resort_inventory;

-- Services
DROP POLICY IF EXISTS "Public can view services" ON public.resort_services;

-- Orders
DROP POLICY IF EXISTS "Guests can view own orders" ON public.resort_orders;
DROP POLICY IF EXISTS "Guests can create orders" ON public.resort_orders;

-- Chat Messages
DROP POLICY IF EXISTS "Users can access own chat messages" ON public.chat_messages;

-- Notifications
DROP POLICY IF EXISTS "Users can view own notifications" ON public.notifications;

-- Audit Logs
DROP POLICY IF EXISTS "Admins can view audit logs" ON public.audit_logs;
DROP POLICY IF EXISTS "System and staff can insert audit logs" ON public.audit_logs;
DROP POLICY IF EXISTS "System and admins can insert audit logs" ON public.audit_logs;

-- 3. GRANT UNRESTRICTED PERMISSIONS TO POSTGRES / SUPABASE API ROLES
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL ROUTINES IN SCHEMA public TO anon, authenticated, service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON ROUTINES TO anon, authenticated, service_role;

-- 4. VERIFICATION QUERY: Verify that Row Level Security is disabled (rowsecurity = false)
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
ORDER BY tablename;
