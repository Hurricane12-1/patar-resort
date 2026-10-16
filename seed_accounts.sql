-- ==============================================================================
-- J & D Beach House Resort · Production Cloud Seed Script (With Auto-Cleanup)
-- Cloud Target: Supabase Dashboard SQL Editor (PostgreSQL 15+)
--
-- This script fixes "duplicate key value violates unique constraint" by first
-- cleaning up any existing conflicting accounts, then inserting fresh, working credentials.
-- ==============================================================================

-- Step 1: Ensure cryptographic extension
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Step 2: Clean up any old duplicate auth records to guarantee a clean slate
DELETE FROM auth.users 
WHERE email IN (
  'admin@janddbeachhouse.ph',
  'receptionist@janddbeachhouse.ph',
  'accounting@janddbeachhouse.ph',
  'housekeeping@janddbeachhouse.ph',
  'kitchen@janddbeachhouse.ph',
  'guest.juan@gmail.com'
);

-- Step 3: Insert into Supabase Auth Core (auth.users)
INSERT INTO auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
VALUES
  (
    '00000000-0000-0000-0000-000000000000',
    '11111111-1111-1111-1111-111111111111',
    'authenticated',
    'authenticated',
    'admin@janddbeachhouse.ph',
    crypt('AdminPassword2026!', gen_salt('bf', 10)),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"full_name":"Executive Director","username":"admin","role":"administrator"}'::jsonb,
    now(),
    now()
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '22222222-2222-2222-2222-222222222222',
    'authenticated',
    'authenticated',
    'receptionist@janddbeachhouse.ph',
    crypt('Receptionist2026!', gen_salt('bf', 10)),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"full_name":"Maria Santos","username":"receptionist","role":"receptionist"}'::jsonb,
    now(),
    now()
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '33333333-3333-3333-3333-333333333333',
    'authenticated',
    'authenticated',
    'accounting@janddbeachhouse.ph',
    crypt('Accounting2026!', gen_salt('bf', 10)),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"full_name":"Carlos Dalisay","username":"accountant","role":"accounting"}'::jsonb,
    now(),
    now()
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '44444444-4444-4444-4444-444444444444',
    'authenticated',
    'authenticated',
    'housekeeping@janddbeachhouse.ph',
    crypt('StaffPass2026!', gen_salt('bf', 10)),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"full_name":"Elena Reyes","username":"staff_housekeeping","role":"staff"}'::jsonb,
    now(),
    now()
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '55555555-5555-5555-5555-555555555555',
    'authenticated',
    'authenticated',
    'kitchen@janddbeachhouse.ph',
    crypt('StaffPass2026!', gen_salt('bf', 10)),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"full_name":"Ramon Bautista","username":"staff_kitchen","role":"staff"}'::jsonb,
    now(),
    now()
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '99999999-9999-9999-9999-999999999999',
    'authenticated',
    'authenticated',
    'guest.juan@gmail.com',
    crypt('GuestPass2026!', gen_salt('bf', 10)),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"full_name":"Juan Dela Cruz","username":"juan_delacruz","role":"customer"}'::jsonb,
    now(),
    now()
  )
ON CONFLICT (id) DO UPDATE SET
  email = EXCLUDED.email,
  encrypted_password = EXCLUDED.encrypted_password,
  email_confirmed_at = COALESCE(auth.users.email_confirmed_at, now()),
  raw_user_meta_data = EXCLUDED.raw_user_meta_data,
  updated_at = now();

-- Step 4: Provision identities if auth.identities exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'auth' AND table_name = 'identities') THEN
    INSERT INTO auth.identities (id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at)
    VALUES
      ('11111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', jsonb_build_object('sub', '11111111-1111-1111-1111-111111111111', 'email', 'admin@janddbeachhouse.ph'), 'email', 'admin@janddbeachhouse.ph', now(), now(), now()),
      ('22222222-2222-2222-2222-222222222222', '22222222-2222-2222-2222-222222222222', jsonb_build_object('sub', '22222222-2222-2222-2222-222222222222', 'email', 'receptionist@janddbeachhouse.ph'), 'email', 'receptionist@janddbeachhouse.ph', now(), now(), now()),
      ('33333333-3333-3333-3333-333333333333', '33333333-3333-3333-3333-333333333333', jsonb_build_object('sub', '33333333-3333-3333-3333-333333333333', 'email', 'accounting@janddbeachhouse.ph'), 'email', 'accounting@janddbeachhouse.ph', now(), now(), now()),
      ('44444444-4444-4444-4444-444444444444', '44444444-4444-4444-4444-444444444444', jsonb_build_object('sub', '44444444-4444-4444-4444-444444444444', 'email', 'housekeeping@janddbeachhouse.ph'), 'email', 'housekeeping@janddbeachhouse.ph', now(), now(), now()),
      ('55555555-5555-5555-5555-555555555555', '55555555-5555-5555-5555-555555555555', jsonb_build_object('sub', '55555555-5555-5555-5555-555555555555', 'email', 'kitchen@janddbeachhouse.ph'), 'email', 'kitchen@janddbeachhouse.ph', now(), now(), now()),
      ('99999999-9999-9999-9999-999999999999', '99999999-9999-9999-9999-999999999999', jsonb_build_object('sub', '99999999-9999-9999-9999-999999999999', 'email', 'guest.juan@gmail.com'), 'email', 'guest.juan@gmail.com', now(), now(), now())
    ON CONFLICT DO NOTHING;
  END IF;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- Step 5: Insert into Unified Identity Anchor (public.profiles)
INSERT INTO public.profiles (
  id, email, username, first_name, last_name, full_name, role, position, phone, updated_at
)
VALUES
  ('11111111-1111-1111-1111-111111111111', 'admin@janddbeachhouse.ph', 'admin', 'Executive', 'Admin', 'Executive Director', 'administrator', 'General Manager', '09171112222', now()),
  ('22222222-2222-2222-2222-222222222222', 'receptionist@janddbeachhouse.ph', 'receptionist', 'Maria', 'Santos', 'Maria Santos', 'receptionist', 'Head Receptionist', '09173334444', now()),
  ('33333333-3333-3333-3333-333333333333', 'accounting@janddbeachhouse.ph', 'accountant', 'Carlos', 'Dalisay', 'Carlos Dalisay', 'accounting', 'Chief Accountant', '09175556666', now()),
  ('44444444-4444-4444-4444-444444444444', 'housekeeping@janddbeachhouse.ph', 'staff_housekeeping', 'Elena', 'Reyes', 'Elena Reyes', 'staff', 'Housekeeping Supervisor', '09177778888', now()),
  ('55555555-5555-5555-5555-555555555555', 'kitchen@janddbeachhouse.ph', 'staff_kitchen', 'Ramon', 'Bautista', 'Ramon Bautista', 'staff', 'Executive Chef', '09178889999', now()),
  ('99999999-9999-9999-9999-999999999999', 'guest.juan@gmail.com', 'juan_delacruz', 'Juan', 'Dela Cruz', 'Juan Dela Cruz', 'customer', 'Resort Guest', '09171234567', now())
ON CONFLICT (id) DO UPDATE SET
  email = EXCLUDED.email,
  username = EXCLUDED.username,
  first_name = EXCLUDED.first_name,
  last_name = EXCLUDED.last_name,
  full_name = EXCLUDED.full_name,
  role = EXCLUDED.role,
  position = EXCLUDED.position,
  phone = EXCLUDED.phone,
  updated_at = now();

-- Step 6: Insert into Dedicated Staff & Admin Storage (public.users)
INSERT INTO public.users (
  id, email, username, first_name, last_name, full_name, role, position, department, phone, is_active, updated_at
)
VALUES
  ('11111111-1111-1111-1111-111111111111', 'admin@janddbeachhouse.ph', 'admin', 'Executive', 'Admin', 'Executive Director', 'administrator', 'General Manager', 'front_desk', '09171112222', true, now()),
  ('22222222-2222-2222-2222-222222222222', 'receptionist@janddbeachhouse.ph', 'receptionist', 'Maria', 'Santos', 'Maria Santos', 'receptionist', 'Head Receptionist', 'front_desk', '09173334444', true, now()),
  ('33333333-3333-3333-3333-333333333333', 'accounting@janddbeachhouse.ph', 'accountant', 'Carlos', 'Dalisay', 'Carlos Dalisay', 'accounting', 'Chief Accountant', 'front_desk', '09175556666', true, now()),
  ('44444444-4444-4444-4444-444444444444', 'housekeeping@janddbeachhouse.ph', 'staff_housekeeping', 'Elena', 'Reyes', 'Elena Reyes', 'staff', 'Housekeeping Supervisor', 'housekeeping', '09177778888', true, now()),
  ('55555555-5555-5555-5555-555555555555', 'kitchen@janddbeachhouse.ph', 'staff_kitchen', 'Ramon', 'Bautista', 'Ramon Bautista', 'staff', 'Executive Chef', 'kitchen', '09178889999', true, now())
ON CONFLICT (id) DO UPDATE SET
  email = EXCLUDED.email,
  username = EXCLUDED.username,
  first_name = EXCLUDED.first_name,
  last_name = EXCLUDED.last_name,
  full_name = EXCLUDED.full_name,
  role = EXCLUDED.role,
  position = EXCLUDED.position,
  department = EXCLUDED.department,
  phone = EXCLUDED.phone,
  is_active = true,
  updated_at = now();

-- Step 7: Insert into Dedicated Customer & Guest Storage (public.customers)
INSERT INTO public.customers (
  id, email, username, first_name, last_name, full_name, role, phone, address, city, is_verified, total_stays, updated_at
)
VALUES
  ('99999999-9999-9999-9999-999999999999', 'guest.juan@gmail.com', 'juan_delacruz', 'Juan', 'Dela Cruz', 'Juan Dela Cruz', 'customer', '09171234567', 'Patar Road', 'Bolinao, Pangasinan', true, 2, now())
ON CONFLICT (id) DO UPDATE SET
  email = EXCLUDED.email,
  username = EXCLUDED.username,
  first_name = EXCLUDED.first_name,
  last_name = EXCLUDED.last_name,
  full_name = EXCLUDED.full_name,
  phone = EXCLUDED.phone,
  address = EXCLUDED.address,
  city = EXCLUDED.city,
  is_verified = true,
  updated_at = now();
