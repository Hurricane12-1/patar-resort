-- ============================================================================
-- Rock View Beach Resort — Upgraded Reservations Schema & Migration
-- ============================================================================
-- Run this in the Supabase SQL Editor:
-- https://supabase.com/dashboard/project/owhodkhzldygavuwnqfg/sql
--
-- This script contains:
--   PART 1: Idempotent Migration (Safe to run on existing tables without data loss)
--   PART 2: Full Definitive Table Definition (For fresh setups / reference)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- PART 1: IDEMPOTENT MIGRATION FOR EXISTING DATABASE
-- ----------------------------------------------------------------------------

-- 1. Ensure extensions exist
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Add missing columns safely
ALTER TABLE public.reservations 
  ADD COLUMN IF NOT EXISTS offering_type text NOT NULL DEFAULT 'room',
  ADD COLUMN IF NOT EXISTS is_maintenance boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS check_in_time text NULL DEFAULT '14:00',
  ADD COLUMN IF NOT EXISTS check_out_time text NULL DEFAULT '12:00',
  ADD COLUMN IF NOT EXISTS balance_php numeric(10, 2) NOT NULL DEFAULT 0.00,
  ADD COLUMN IF NOT EXISTS cancellation_reason text NULL,
  ADD COLUMN IF NOT EXISTS refund_amount_php numeric(10, 2) NOT NULL DEFAULT 0.00;

-- 3. Upgrade Status Check Constraint
-- Allows: pending, confirmed, checked_in, checked_out, cancelled, on_hold, maintenance, disputed, escalated, no_show
ALTER TABLE public.reservations 
  DROP CONSTRAINT IF EXISTS reservations_status_check;

ALTER TABLE public.reservations 
  ADD CONSTRAINT reservations_status_check CHECK (
    status = ANY (
      ARRAY[
        'pending'::text,
        'confirmed'::text,
        'checked_in'::text,
        'checked_out'::text,
        'cancelled'::text,
        'on_hold'::text,
        'maintenance'::text,
        'disputed'::text,
        'escalated'::text,
        'no_show'::text
      ]
    )
  );

-- 4. Upgrade Payment Status Check Constraint
-- Allows: unpaid, partially_paid, paid, refund_pending, refunded
ALTER TABLE public.reservations 
  DROP CONSTRAINT IF EXISTS reservations_payment_status_check;

ALTER TABLE public.reservations 
  ADD CONSTRAINT reservations_payment_status_check CHECK (
    payment_status = ANY (
      ARRAY[
        'unpaid'::text,
        'partially_paid'::text,
        'paid'::text,
        'refund_pending'::text,
        'refunded'::text
      ]
    )
  );

-- 5. Fix Check-in / Check-out Date Constraint for Day-Use Cottages & Tours
-- Changes (check_out > check_in) to (check_out >= check_in) so same-day rentals do not fail.
ALTER TABLE public.reservations 
  DROP CONSTRAINT IF EXISTS chk_reservation_dates;

ALTER TABLE public.reservations 
  ADD CONSTRAINT chk_reservation_dates CHECK (
    check_out >= check_in
  );

-- 6. Add Performance Indexes
CREATE INDEX IF NOT EXISTS idx_reservations_checkin ON public.reservations USING btree (check_in, check_out);
CREATE INDEX IF NOT EXISTS idx_reservations_status ON public.reservations USING btree (status);
CREATE INDEX IF NOT EXISTS idx_reservations_guest ON public.reservations USING btree (guest_id);
CREATE INDEX IF NOT EXISTS idx_reservations_room ON public.reservations USING btree (room_id);
CREATE INDEX IF NOT EXISTS idx_reservations_offering_type ON public.reservations USING btree (offering_type);
CREATE INDEX IF NOT EXISTS idx_reservations_payment_status ON public.reservations USING btree (payment_status);

-- 7. Ensure Row Level Security is Enabled
ALTER TABLE public.reservations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enable insert for all" ON public.reservations;
CREATE POLICY "Enable insert for all" ON public.reservations FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Enable select for all" ON public.reservations;
CREATE POLICY "Enable select for all" ON public.reservations FOR SELECT USING (true);

DROP POLICY IF EXISTS "Staff manage reservations" ON public.reservations;
CREATE POLICY "Staff manage reservations" ON public.reservations FOR UPDATE USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Enable delete for all" ON public.reservations;
CREATE POLICY "Enable delete for all" ON public.reservations FOR DELETE USING (true);


-- ----------------------------------------------------------------------------
-- PART 2: DEFINITIVE FULL CREATE TABLE SCRIPT (FOR REFERENCE & NEW TABLES)
-- ----------------------------------------------------------------------------
/*
CREATE TABLE IF NOT EXISTS public.reservations (
  id uuid NOT NULL DEFAULT extensions.uuid_generate_v4 (),
  booking_code text NOT NULL,
  guest_id uuid NULL,
  room_id uuid NULL,
  offering_type text NOT NULL DEFAULT 'room'::text,
  guest_name text NOT NULL,
  phone text NULL,
  email text NULL,
  check_in date NOT NULL,
  check_out date NOT NULL,
  check_in_time text NULL DEFAULT '14:00'::text,
  check_out_time text NULL DEFAULT '12:00'::text,
  guests integer NOT NULL DEFAULT 1,
  total_php numeric(10, 2) NOT NULL DEFAULT 0.00,
  downpayment_php numeric(10, 2) NOT NULL DEFAULT 0.00,
  balance_php numeric(10, 2) NOT NULL DEFAULT 0.00,
  payment_method text NULL DEFAULT 'GCash'::text,
  payment_status text NOT NULL DEFAULT 'unpaid'::text,
  payment_proof_url text NULL,
  status text NOT NULL DEFAULT 'pending'::text,
  is_maintenance boolean NOT NULL DEFAULT false,
  cancellation_reason text NULL,
  refund_amount_php numeric(10, 2) NOT NULL DEFAULT 0.00,
  notes text NULL,
  qr_code_url text NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  
  CONSTRAINT reservations_pkey PRIMARY KEY (id),
  CONSTRAINT reservations_booking_code_key UNIQUE (booking_code),
  CONSTRAINT reservations_room_id_fkey FOREIGN KEY (room_id) REFERENCES public.rooms (id) ON DELETE RESTRICT,
  CONSTRAINT reservations_guest_id_fkey FOREIGN KEY (guest_id) REFERENCES public.profiles (id) ON DELETE SET NULL,
  
  -- Supported statuses including maintenance, on hold, dispute, and no-show
  CONSTRAINT reservations_status_check CHECK (
    status = ANY (
      ARRAY[
        'pending'::text,
        'confirmed'::text,
        'checked_in'::text,
        'checked_out'::text,
        'cancelled'::text,
        'on_hold'::text,
        'maintenance'::text,
        'disputed'::text,
        'escalated'::text,
        'no_show'::text
      ]
    )
  ),
  
  -- Supports same-day checkout (check_out >= check_in) for day-use cottages & tours
  CONSTRAINT chk_reservation_dates CHECK (check_out >= check_in),
  
  -- Financial integrity checks
  CONSTRAINT reservations_total_php_check CHECK (total_php >= (0)::numeric),
  CONSTRAINT reservations_downpayment_php_check CHECK (downpayment_php >= (0)::numeric),
  CONSTRAINT reservations_balance_php_check CHECK (balance_php >= (0)::numeric),
  CONSTRAINT reservations_guests_check CHECK (guests >= 1),
  
  -- Supported payment statuses including refund pending
  CONSTRAINT reservations_payment_status_check CHECK (
    payment_status = ANY (
      ARRAY[
        'unpaid'::text,
        'partially_paid'::text,
        'paid'::text,
        'refund_pending'::text,
        'refunded'::text
      ]
    )
  )
) TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_reservations_checkin ON public.reservations USING btree (check_in, check_out) TABLESPACE pg_default;
CREATE INDEX IF NOT EXISTS idx_reservations_status ON public.reservations USING btree (status) TABLESPACE pg_default;
CREATE INDEX IF NOT EXISTS idx_reservations_guest ON public.reservations USING btree (guest_id) TABLESPACE pg_default;
CREATE INDEX IF NOT EXISTS idx_reservations_room ON public.reservations USING btree (room_id) TABLESPACE pg_default;
CREATE INDEX IF NOT EXISTS idx_reservations_offering_type ON public.reservations USING btree (offering_type) TABLESPACE pg_default;
CREATE INDEX IF NOT EXISTS idx_reservations_payment_status ON public.reservations USING btree (payment_status) TABLESPACE pg_default;
*/
