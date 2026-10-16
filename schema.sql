-- ==============================================================================
-- J & D Beach House Resort Management System · Production PostgreSQL Schema
-- Cloud Target: Supabase (PostgreSQL 15+)
-- Description: Complete production schema with RLS security policies,
--              triggers, constraints, and relational integrity.
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

-- 3. Core Tables

-- A. Public Profiles (Linked to Supabase auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  first_name TEXT DEFAULT '',
  last_name TEXT DEFAULT '',
  full_name TEXT DEFAULT '',
  role public.user_role DEFAULT 'customer',
  phone TEXT DEFAULT '',
  address TEXT DEFAULT '',
  city TEXT DEFAULT '',
  position TEXT DEFAULT '',
  emergency_contact TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- B. Accommodations Catalog (Rooms, Villas, Cottages)
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
  is_active BOOLEAN DEFAULT true,
  rating_avg NUMERIC(3,2) DEFAULT 5.0,
  rating_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- C. Reservations & Bookings
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

-- D. Resort Supplies & Stock Ledger
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

-- E. Resort Services (Dining, Tours, Amenities)
CREATE TABLE IF NOT EXISTS public.resort_services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('dining', 'tours', 'amenities')),
  price_php NUMERIC NOT NULL CHECK (price_php >= 0),
  description TEXT DEFAULT '',
  is_available BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- F. Guest Resort Orders
CREATE TABLE IF NOT EXISTS public.resort_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guest_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  reservation_id UUID REFERENCES public.reservations(id) ON DELETE SET NULL,
  items JSONB DEFAULT '[]'::jsonb,
  total_php NUMERIC NOT NULL CHECK (total_php >= 0),
  status public.order_status DEFAULT 'placed',
  room_number TEXT DEFAULT '',
  notes TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- G. Department Operations Hub (Tasks)
CREATE TABLE IF NOT EXISTS public.department_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  department public.dept_name NOT NULL DEFAULT 'front_desk',
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  status public.task_status DEFAULT 'pending',
  priority public.task_priority DEFAULT 'normal',
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  room_id UUID REFERENCES public.rooms(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- H. Guest Reviews & Ratings
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

-- I. AI Concierge & Executive Chat Messages
CREATE TABLE IF NOT EXISTS public.chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  sender TEXT NOT NULL,
  content TEXT NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- J. Notifications Audit Log (SMS / Email)
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  reservation_id UUID REFERENCES public.reservations(id) ON DELETE CASCADE,
  type TEXT NOT NULL DEFAULT 'sms',
  recipient TEXT NOT NULL,
  content TEXT NOT NULL,
  status TEXT DEFAULT 'sent',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- K. Security & Audit Auto-Logger
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

-- 4. Analytical Views

DROP VIEW IF EXISTS public.analytics_overview CASCADE;
CREATE VIEW public.analytics_overview AS
SELECT
  (SELECT COUNT(*) FROM public.reservations WHERE status IN ('confirmed', 'checked_in')) AS active_bookings,
  (SELECT COUNT(*) FROM public.rooms WHERE is_active = true) AS active_rooms,
  (SELECT COALESCE(SUM(total_php), 0) FROM public.reservations WHERE status IN ('confirmed', 'checked_in', 'checked_out')) AS total_revenue_php,
  (SELECT COUNT(*) FROM public.profiles WHERE role = 'customer') AS total_guests;

-- 5. Automations & Triggers

-- Trigger: Automatically provision public.profiles upon auth.users signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (
    new.id,
    new.email,
    COALESCE(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    COALESCE((new.raw_user_meta_data->>'role')::public.user_role, 'customer'::public.user_role)
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = CASE WHEN profiles.full_name = '' THEN EXCLUDED.full_name ELSE profiles.full_name END;
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- Trigger: Update room rating average upon new review
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

-- 6. Row Level Security (RLS) Enablement
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.resort_inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.resort_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.resort_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.department_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- 7. Row Level Security Policies

-- Profiles Policies
DROP POLICY IF EXISTS "Public can view basic profiles" ON public.profiles;
CREATE POLICY "Public can view basic profiles" ON public.profiles FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);

DROP POLICY IF EXISTS "Admins can manage all profiles" ON public.profiles;
CREATE POLICY "Admins can manage all profiles" ON public.profiles FOR ALL USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('administrator', 'admin'))
);

-- Rooms Policies
DROP POLICY IF EXISTS "Anyone can view active rooms" ON public.rooms;
CREATE POLICY "Anyone can view active rooms" ON public.rooms FOR SELECT USING (true);

DROP POLICY IF EXISTS "Staff and Admins can manage rooms" ON public.rooms;
CREATE POLICY "Staff and Admins can manage rooms" ON public.rooms FOR ALL USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('administrator', 'admin', 'staff', 'receptionist'))
);

-- Reservations Policies
DROP POLICY IF EXISTS "Users can view own reservations" ON public.reservations;
CREATE POLICY "Users can view own reservations" ON public.reservations FOR SELECT USING (
  auth.uid() = guest_id OR
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('administrator', 'admin', 'staff', 'receptionist', 'accounting'))
);

DROP POLICY IF EXISTS "Users can create reservations" ON public.reservations;
CREATE POLICY "Users can create reservations" ON public.reservations FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Staff and Admins can manage reservations" ON public.reservations;
CREATE POLICY "Staff and Admins can manage reservations" ON public.reservations FOR ALL USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('administrator', 'admin', 'staff', 'receptionist', 'accounting'))
);

-- Reviews Policies
DROP POLICY IF EXISTS "Anyone can view approved reviews" ON public.reviews;
CREATE POLICY "Anyone can view approved reviews" ON public.reviews FOR SELECT USING (is_approved = true);

DROP POLICY IF EXISTS "Authenticated guests can create reviews" ON public.reviews;
CREATE POLICY "Authenticated guests can create reviews" ON public.reviews FOR INSERT WITH CHECK (auth.uid() = guest_id);

-- Department Tasks Policies
DROP POLICY IF EXISTS "Staff can access tasks" ON public.department_tasks;
CREATE POLICY "Staff can access tasks" ON public.department_tasks FOR ALL USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('administrator', 'admin', 'staff', 'receptionist', 'accounting'))
);

-- Resort Inventory Policies
DROP POLICY IF EXISTS "Staff can access inventory" ON public.resort_inventory;
CREATE POLICY "Staff can access inventory" ON public.resort_inventory FOR ALL USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('administrator', 'admin', 'staff', 'accounting'))
);

-- Services Policies
DROP POLICY IF EXISTS "Public can view services" ON public.resort_services;
CREATE POLICY "Public can view services" ON public.resort_services FOR SELECT USING (is_available = true);

-- Orders Policies
DROP POLICY IF EXISTS "Guests can view own orders" ON public.resort_orders;
CREATE POLICY "Guests can view own orders" ON public.resort_orders FOR SELECT USING (
  auth.uid() = guest_id OR
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('administrator', 'admin', 'staff', 'receptionist', 'accounting'))
);

DROP POLICY IF EXISTS "Guests can create orders" ON public.resort_orders;
CREATE POLICY "Guests can create orders" ON public.resort_orders FOR INSERT WITH CHECK (auth.uid() = guest_id);

-- Chat Messages Policies
DROP POLICY IF EXISTS "Users can access own chat messages" ON public.chat_messages;
CREATE POLICY "Users can access own chat messages" ON public.chat_messages FOR ALL USING (
  auth.uid() = profile_id OR
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('administrator', 'admin', 'staff', 'receptionist'))
);

-- Notifications Policies
DROP POLICY IF EXISTS "Users can view own notifications" ON public.notifications;
CREATE POLICY "Users can view own notifications" ON public.notifications FOR SELECT USING (
  auth.uid() = profile_id OR
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('administrator', 'admin'))
);

-- Audit Logs Policies
DROP POLICY IF EXISTS "Admins can view audit logs" ON public.audit_logs;
CREATE POLICY "Admins can view audit logs" ON public.audit_logs FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('administrator', 'admin'))
);
