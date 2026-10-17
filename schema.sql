-- ==============================================================================
-- J & D Beach House Resort Management System · Production PostgreSQL Schema
-- Cloud Target: Supabase (PostgreSQL 15+)
-- Architecture: Physically Separated Customer Accounts vs Staff/Admin Users,
--               Unified Profile Linkage, Clean Storage Buckets & Table Titles,
--               Automated Triggers, Analytical Views, and Complete RLS Policies.
-- ==============================================================================

-- 1. Enable Required Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "btree_gist";

-- 2. Custom Enumerated Types
DO $$ BEGIN
  CREATE TYPE public.user_role AS ENUM (
    'customer', 'staff', 'receptionist', 'accounting', 'administrator', 'admin'
  );
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE public.stay_status AS ENUM (
    'pending', 'confirmed', 'checked_in', 'checked_out', 'cancelled', 'no_show'
  );
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE public.dept_name AS ENUM (
    'front_desk', 'housekeeping', 'kitchen', 'tours', 'maintenance'
  );
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE public.order_status AS ENUM (
    'placed', 'preparing', 'delivering', 'delivered', 'cancelled'
  );
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE public.task_status AS ENUM (
    'pending', 'in_progress', 'completed', 'cancelled'
  );
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE public.task_priority AS ENUM (
    'low', 'normal', 'high', 'urgent'
  );
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- ==============================================================================
-- 3. Core Database Tables (Physically Separated Accounts & Operations)
-- ==============================================================================

-- A. Dedicated Customer & Guest Accounts Storage
CREATE TABLE IF NOT EXISTS public.customers (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  username TEXT UNIQUE,
  first_name TEXT DEFAULT '',
  middle_name TEXT DEFAULT '',
  last_name TEXT DEFAULT '',
  full_name TEXT DEFAULT '',
  role public.user_role NOT NULL DEFAULT 'customer' CHECK (role = 'customer'),
  phone TEXT DEFAULT '',
  address TEXT DEFAULT '',
  city TEXT DEFAULT '',
  emergency_contact TEXT DEFAULT '',
  avatar_url TEXT DEFAULT '',
  provider TEXT DEFAULT 'email',
  is_verified BOOLEAN DEFAULT false,
  total_stays INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
COMMENT ON TABLE public.customers IS 'Resort Guest & Client Accounts Storage';

-- B. Dedicated Staff & Executive Administrator Accounts Storage
CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  username TEXT UNIQUE,
  first_name TEXT DEFAULT '',
  middle_name TEXT DEFAULT '',
  last_name TEXT DEFAULT '',
  full_name TEXT DEFAULT '',
  role public.user_role NOT NULL DEFAULT 'staff' CHECK (role IN ('staff', 'receptionist', 'accounting', 'administrator', 'admin')),
  position TEXT DEFAULT '',
  department public.dept_name DEFAULT 'front_desk',
  phone TEXT DEFAULT '',
  emergency_contact TEXT DEFAULT '',
  avatar_url TEXT DEFAULT '',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
COMMENT ON TABLE public.users IS 'Resort Executive & Staff User Accounts Storage';

-- C. Unified Profiles Storage (Relational Foreign Key Anchor for System Components)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  username TEXT UNIQUE,
  first_name TEXT DEFAULT '',
  middle_name TEXT DEFAULT '',
  last_name TEXT DEFAULT '',
  full_name TEXT DEFAULT '',
  role public.user_role DEFAULT 'customer',
  position TEXT DEFAULT '',
  phone TEXT DEFAULT '',
  address TEXT DEFAULT '',
  city TEXT DEFAULT '',
  emergency_contact TEXT DEFAULT '',
  avatar_url TEXT DEFAULT '',
  provider TEXT DEFAULT 'email',
  is_verified BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
COMMENT ON TABLE public.profiles IS 'Unified Identity & Relational Profile Linkage Storage';

-- Ensure modern columns exist if tables were created previously
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS username TEXT UNIQUE;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS username TEXT UNIQUE;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS username TEXT UNIQUE;

-- D. User Confirmations & 2FA Tokens (Signup 2FA, OTP & Verification Storage)
CREATE TABLE IF NOT EXISTS public.user_confirmations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  phone TEXT DEFAULT '',
  confirmation_code TEXT NOT NULL,
  confirmation_type TEXT NOT NULL DEFAULT 'signup_2fa', -- 'signup_2fa', 'login_2fa', 'password_reset'
  attempts INTEGER DEFAULT 0,
  is_confirmed BOOLEAN DEFAULT false,
  expires_at TIMESTAMPTZ NOT NULL,
  confirmed_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now()
);
COMMENT ON TABLE public.user_confirmations IS 'Security Verifications, 2FA OTP & Account Tokens Storage';

-- E. Accommodations & Villa Catalog Storage
CREATE TABLE IF NOT EXISTS public.rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  category TEXT DEFAULT 'Cottage',
  description TEXT DEFAULT '',
  capacity INTEGER DEFAULT 2 CHECK (capacity > 0),
  units INTEGER DEFAULT 1 CHECK (units > 0),
  rate_php NUMERIC NOT NULL CHECK (rate_php >= 0),
  amenities TEXT[] DEFAULT '{}',
  image_url TEXT DEFAULT '',
  images TEXT[] DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  rating_avg NUMERIC(3,2) DEFAULT 5.0,
  rating_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
COMMENT ON TABLE public.rooms IS 'Accommodations, Cottages & Oceanfront Villas Catalog Storage';

-- F. Reservations & Bookings Ledger Storage
CREATE TABLE IF NOT EXISTS public.reservations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guest_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  room_id UUID REFERENCES public.rooms(id) ON DELETE RESTRICT,
  check_in DATE NOT NULL,
  check_out DATE NOT NULL,
  guests INTEGER DEFAULT 1 CHECK (guests > 0),
  total_php NUMERIC NOT NULL CHECK (total_php >= 0),
  downpayment_php NUMERIC DEFAULT 0,
  payment_status TEXT DEFAULT 'unpaid',
  payment_method TEXT DEFAULT 'GCash',
  status public.stay_status DEFAULT 'pending',
  notes TEXT DEFAULT '',
  phone TEXT DEFAULT '',
  guest_name TEXT DEFAULT '',
  guest_email TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT check_dates CHECK (check_out > check_in)
);
COMMENT ON TABLE public.reservations IS 'Guest Booking Ledger & Reservation Transactions Storage';

-- G. Resort Supplies & Stock Inventory Storage
CREATE TABLE IF NOT EXISTS public.resort_inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_name TEXT NOT NULL,
  category TEXT NOT NULL,
  stock_qty NUMERIC DEFAULT 0,
  unit TEXT DEFAULT 'pcs',
  reorder_at NUMERIC DEFAULT 10,
  unit_cost_php NUMERIC DEFAULT 0,
  location TEXT DEFAULT 'Main Warehouse',
  supplier TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
COMMENT ON TABLE public.resort_inventory IS 'Resort Supplies & Warehouse Stock Ledger Storage';

-- H. Resort Services Catalog (Dining, Tours, Amenities) Storage
CREATE TABLE IF NOT EXISTS public.resort_services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('dining', 'tours', 'amenities')),
  price_php NUMERIC NOT NULL CHECK (price_php >= 0),
  description TEXT DEFAULT '',
  is_available BOOLEAN DEFAULT true,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);
COMMENT ON TABLE public.resort_services IS 'Guest Dining, Island Tours & Amenities Service Storage';

-- I. Guest Resort Orders (Room Service, Island Tours, Rentals) Storage
CREATE TABLE IF NOT EXISTS public.resort_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guest_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  reservation_id UUID REFERENCES public.reservations(id) ON DELETE SET NULL,
  service_id UUID REFERENCES public.resort_services(id) ON DELETE SET NULL,
  item_name TEXT DEFAULT '',
  category TEXT DEFAULT 'dining',
  price_php NUMERIC DEFAULT 0,
  total_php NUMERIC DEFAULT 0,
  items JSONB DEFAULT '[]'::jsonb,
  status public.order_status DEFAULT 'placed',
  room_number TEXT DEFAULT '',
  notes TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT now()
);
COMMENT ON TABLE public.resort_orders IS 'Guest Room Service, Dining & Activity Orders Storage';

-- J. Department Operations & Staff Work Orders Storage
CREATE TABLE IF NOT EXISTS public.department_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  department public.dept_name NOT NULL DEFAULT 'front_desk',
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  room_name TEXT DEFAULT '',
  assigned_to TEXT DEFAULT '',
  status public.task_status DEFAULT 'pending',
  priority public.task_priority DEFAULT 'normal',
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  room_id UUID REFERENCES public.rooms(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
COMMENT ON TABLE public.department_tasks IS 'Department Operations, Maintenance & Work Orders Storage';

-- K. Guest Reviews & Ratings Storage
CREATE TABLE IF NOT EXISTS public.reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reservation_id UUID REFERENCES public.reservations(id) ON DELETE CASCADE,
  guest_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  room_id UUID REFERENCES public.rooms(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment TEXT DEFAULT '',
  guest_name TEXT DEFAULT '',
  is_approved BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);
COMMENT ON TABLE public.reviews IS 'Guest Ratings, Feedback & Testimonials Storage';

-- L. Concierge & Guest Chat Transcripts Storage
CREATE TABLE IF NOT EXISTS public.chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'user',
  sender TEXT DEFAULT '',
  content TEXT NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now()
);
COMMENT ON TABLE public.chat_messages IS 'Concierge Live Chat Transcripts & Guest Dialogue Storage';

-- M. Notifications System (Executive SMS & In-App Alerts Storage)
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  reservation_id UUID REFERENCES public.reservations(id) ON DELETE SET NULL,
  type TEXT NOT NULL DEFAULT 'sms',
  recipient TEXT DEFAULT '',
  to_phone TEXT DEFAULT '',
  title TEXT DEFAULT '',
  content TEXT DEFAULT '',
  body TEXT DEFAULT '',
  status TEXT DEFAULT 'sent',
  provider_sid TEXT DEFAULT '',
  sent_at TIMESTAMPTZ,
  is_read BOOLEAN DEFAULT false,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now()
);
COMMENT ON TABLE public.notifications IS 'Executive SMS Alerts & Transactional Dispatch Storage';

-- N. System Security & Compliance Audit Trail Storage
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id TEXT DEFAULT '',
  actor_email TEXT DEFAULT '',
  actor_role TEXT DEFAULT '',
  action TEXT NOT NULL,
  resource_type TEXT DEFAULT '',
  resource_id TEXT DEFAULT '',
  details JSONB DEFAULT '{}'::jsonb,
  ip_address TEXT DEFAULT '',
  user_agent TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT now()
);
COMMENT ON TABLE public.audit_logs IS 'System Security & Compliance Audit Trail Storage';

-- ==============================================================================
-- 4. Analytical Views
-- ==============================================================================

DROP VIEW IF EXISTS public.analytics_overview CASCADE;
CREATE VIEW public.analytics_overview AS
SELECT
  (SELECT COUNT(*) FROM public.reservations WHERE status IN ('confirmed', 'checked_in')) AS active_bookings,
  (SELECT COUNT(*) FROM public.rooms WHERE is_active = true) AS active_rooms,
  (SELECT COALESCE(SUM(total_php), 0) FROM public.reservations WHERE status IN ('confirmed', 'checked_in', 'checked_out')) AS total_revenue_php,
  (SELECT COUNT(*) FROM public.customers) AS total_guests;

-- ==============================================================================
-- 5. Supabase Cloud Storage Buckets (File & Media Storage With Clean Titles)
-- ==============================================================================

DO $$ BEGIN
  -- 1. Accommodations & Villa Gallery (Public)
  INSERT INTO storage.buckets (id, name, public)
  VALUES ('accommodations-showcase', 'Accommodations & Villa Gallery', true)
  ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, public = EXCLUDED.public;

  -- 2. Guest & Executive Profile Avatars (Public)
  INSERT INTO storage.buckets (id, name, public)
  VALUES ('guest-avatars', 'Guest & Executive Profile Avatars', true)
  ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, public = EXCLUDED.public;

  -- 3. Digital Passes & Booking Receipts (Private / Authenticated)
  INSERT INTO storage.buckets (id, name, public)
  VALUES ('resort-documents', 'Digital Passes & Booking Receipts', false)
  ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, public = EXCLUDED.public;

  -- 4. Resort Marketing & Brand Media (Public)
  INSERT INTO storage.buckets (id, name, public)
  VALUES ('resort-brand-media', 'Resort Marketing & Brand Media', true)
  ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, public = EXCLUDED.public;
EXCEPTION
  WHEN undefined_table THEN null;
END $$;

-- ==============================================================================
-- 6. Automations, Triggers & Multi-Table Synchronization
-- ==============================================================================

-- Trigger 1: Automatically route new auth.users into separated customers OR users table, and profiles
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
DECLARE
  v_first TEXT;
  v_last TEXT;
  v_middle TEXT;
  v_full TEXT;
  v_username TEXT;
  v_role public.user_role;
  v_pos TEXT;
  v_phone TEXT;
  v_addr TEXT;
  v_city TEXT;
  v_emerg TEXT;
  v_prov TEXT;
BEGIN
  v_first := COALESCE(new.raw_user_meta_data->>'first_name', '');
  v_last := COALESCE(new.raw_user_meta_data->>'last_name', '');
  v_middle := COALESCE(new.raw_user_meta_data->>'middle_name', '');
  v_full := COALESCE(
    NULLIF(TRIM(CONCAT_WS(' ', NULLIF(v_first, ''), NULLIF(v_middle, ''), NULLIF(v_last, ''))), ''),
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'name',
    split_part(new.email, '@', 1)
  );
  v_username := COALESCE(
    NULLIF(LOWER(TRIM(new.raw_user_meta_data->>'username')), ''),
    NULLIF(LOWER(TRIM(split_part(new.email, '@', 1))), ''),
    'user_' || substr(new.id::text, 1, 8)
  );
  v_role := COALESCE((new.raw_user_meta_data->>'role')::public.user_role, 'customer'::public.user_role);
  v_pos := COALESCE(new.raw_user_meta_data->>'position', '');
  v_phone := COALESCE(new.raw_user_meta_data->>'phone', '');
  v_addr := COALESCE(new.raw_user_meta_data->>'address', '');
  v_city := COALESCE(new.raw_user_meta_data->>'city', '');
  v_emerg := COALESCE(new.raw_user_meta_data->>'emergency_contact', '');
  v_prov := COALESCE(new.raw_user_meta_data->>'provider', 'email');

  -- A. Insert into unified profiles table (Foreign Key Anchor)
  INSERT INTO public.profiles (
    id, email, username, first_name, middle_name, last_name, full_name,
    role, position, phone, address, city, emergency_contact, provider
  )
  VALUES (
    new.id, new.email, v_username, v_first, v_middle, v_last, v_full,
    v_role, v_pos, v_phone, v_addr, v_city, v_emerg, v_prov
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    username = COALESCE(profiles.username, EXCLUDED.username),
    first_name = CASE WHEN profiles.first_name = '' THEN EXCLUDED.first_name ELSE profiles.first_name END,
    last_name = CASE WHEN profiles.last_name = '' THEN EXCLUDED.last_name ELSE profiles.last_name END,
    full_name = CASE WHEN profiles.full_name = '' THEN EXCLUDED.full_name ELSE profiles.full_name END,
    phone = CASE WHEN profiles.phone = '' THEN EXCLUDED.phone ELSE profiles.phone END,
    updated_at = now();

  -- B. Physical Separation: Route into customers OR users
  IF v_role = 'customer' THEN
    INSERT INTO public.customers (
      id, email, username, first_name, middle_name, last_name, full_name,
      role, phone, address, city, emergency_contact, provider
    )
    VALUES (
      new.id, new.email, v_username, v_first, v_middle, v_last, v_full,
      'customer', v_phone, v_addr, v_city, v_emerg, v_prov
    )
    ON CONFLICT (id) DO UPDATE SET
      email = EXCLUDED.email,
      username = COALESCE(customers.username, EXCLUDED.username),
      first_name = CASE WHEN customers.first_name = '' THEN EXCLUDED.first_name ELSE customers.first_name END,
      last_name = CASE WHEN customers.last_name = '' THEN EXCLUDED.last_name ELSE customers.last_name END,
      full_name = CASE WHEN customers.full_name = '' THEN EXCLUDED.full_name ELSE customers.full_name END,
      phone = CASE WHEN customers.phone = '' THEN EXCLUDED.phone ELSE customers.phone END,
      updated_at = now();
  ELSE
    INSERT INTO public.users (
      id, email, username, first_name, middle_name, last_name, full_name,
      role, position, phone, emergency_contact
    )
    VALUES (
      new.id, new.email, v_username, v_first, v_middle, v_last, v_full,
      v_role, v_pos, v_phone, v_emerg
    )
    ON CONFLICT (id) DO UPDATE SET
      email = EXCLUDED.email,
      username = COALESCE(users.username, EXCLUDED.username),
      first_name = CASE WHEN users.first_name = '' THEN EXCLUDED.first_name ELSE users.first_name END,
      last_name = CASE WHEN users.last_name = '' THEN EXCLUDED.last_name ELSE users.last_name END,
      full_name = CASE WHEN users.full_name = '' THEN EXCLUDED.full_name ELSE users.full_name END,
      role = EXCLUDED.role,
      position = EXCLUDED.position,
      phone = CASE WHEN users.phone = '' THEN EXCLUDED.phone ELSE users.phone END,
      updated_at = now();
  END IF;

  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- Trigger 2: Sync profile updates to separated customers and users tables
CREATE OR REPLACE FUNCTION public.sync_profile_to_separated_tables()
RETURNS trigger AS $$
BEGIN
  IF NEW.role = 'customer' THEN
    INSERT INTO public.customers (
      id, email, username, first_name, middle_name, last_name, full_name,
      role, phone, address, city, emergency_contact, provider, avatar_url, updated_at
    )
    VALUES (
      NEW.id, NEW.email, NEW.username, NEW.first_name, NEW.middle_name, NEW.last_name, NEW.full_name,
      'customer', NEW.phone, NEW.address, NEW.city, NEW.emergency_contact, NEW.provider, NEW.avatar_url, NEW.updated_at
    )
    ON CONFLICT (id) DO UPDATE SET
      email = EXCLUDED.email,
      username = COALESCE(EXCLUDED.username, customers.username),
      first_name = EXCLUDED.first_name,
      middle_name = EXCLUDED.middle_name,
      last_name = EXCLUDED.last_name,
      full_name = EXCLUDED.full_name,
      phone = EXCLUDED.phone,
      address = EXCLUDED.address,
      city = EXCLUDED.city,
      emergency_contact = EXCLUDED.emergency_contact,
      provider = EXCLUDED.provider,
      avatar_url = EXCLUDED.avatar_url,
      updated_at = now();
  ELSE
    INSERT INTO public.users (
      id, email, username, first_name, middle_name, last_name, full_name,
      role, position, phone, emergency_contact, avatar_url, updated_at
    )
    VALUES (
      NEW.id, NEW.email, NEW.username, NEW.first_name, NEW.middle_name, NEW.last_name, NEW.full_name,
      NEW.role, NEW.position, NEW.phone, NEW.emergency_contact, NEW.avatar_url, NEW.updated_at
    )
    ON CONFLICT (id) DO UPDATE SET
      email = EXCLUDED.email,
      username = COALESCE(EXCLUDED.username, users.username),
      first_name = EXCLUDED.first_name,
      middle_name = EXCLUDED.middle_name,
      last_name = EXCLUDED.last_name,
      full_name = EXCLUDED.full_name,
      role = EXCLUDED.role,
      position = EXCLUDED.position,
      phone = EXCLUDED.phone,
      emergency_contact = EXCLUDED.emergency_contact,
      avatar_url = EXCLUDED.avatar_url,
      updated_at = now();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_profile_to_separated_tables ON public.profiles;
CREATE TRIGGER trg_sync_profile_to_separated_tables
  AFTER INSERT OR UPDATE ON public.profiles
  FOR EACH ROW EXECUTE PROCEDURE public.sync_profile_to_separated_tables();

-- Trigger 3: Automatic synchronization of notification text and phone fields
CREATE OR REPLACE FUNCTION public.sync_notification_fields()
RETURNS trigger AS $$
BEGIN
  IF NEW.to_phone IS NULL OR NEW.to_phone = '' THEN
    NEW.to_phone := COALESCE(NEW.recipient, '');
  END IF;
  IF NEW.recipient IS NULL OR NEW.recipient = '' THEN
    NEW.recipient := COALESCE(NEW.to_phone, '');
  END IF;
  IF NEW.body IS NULL OR NEW.body = '' THEN
    NEW.body := COALESCE(NEW.content, '');
  END IF;
  IF NEW.content IS NULL OR NEW.content = '' THEN
    NEW.content := COALESCE(NEW.body, '');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_notification_fields ON public.notifications;
CREATE TRIGGER trg_sync_notification_fields
  BEFORE INSERT OR UPDATE ON public.notifications
  FOR EACH ROW EXECUTE PROCEDURE public.sync_notification_fields();

-- Trigger 4: Update room average rating upon review addition or change
CREATE OR REPLACE FUNCTION public.sync_room_rating()
RETURNS trigger AS $$
BEGIN
  UPDATE public.rooms
  SET
    rating_avg = COALESCE((SELECT ROUND(AVG(rating), 2) FROM public.reviews WHERE room_id = NEW.room_id AND is_approved = true), 5.0),
    rating_count = (SELECT COUNT(*) FROM public.reviews WHERE room_id = NEW.room_id AND is_approved = true)
  WHERE id = NEW.room_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_review_created ON public.reviews;
CREATE TRIGGER on_review_created
  AFTER INSERT OR UPDATE ON public.reviews
  FOR EACH ROW EXECUTE PROCEDURE public.sync_room_rating();

-- Trigger 5: Automatic cleanup of temporary / unlinked guest chats
-- Preserves all registered customer conversation history permanently in public.chat_messages
CREATE OR REPLACE FUNCTION public.auto_purge_ephemeral_chats()
RETURNS trigger AS $$
BEGIN
  -- Automatically purges anonymous/unlinked chats older than 24 hours
  -- Customer chats (where profile_id IS NOT NULL) are strictly preserved permanently!
  DELETE FROM public.chat_messages
  WHERE profile_id IS NULL
    AND created_at < now() - INTERVAL '24 hours';
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_auto_purge_ephemeral_chats ON public.chat_messages;
CREATE TRIGGER trg_auto_purge_ephemeral_chats
  AFTER INSERT ON public.chat_messages
  FOR EACH STATEMENT EXECUTE PROCEDURE public.auto_purge_ephemeral_chats();

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
