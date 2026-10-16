-- ==============================================================================
-- J & D Beach House Resort · Production Cloud Seed Accounts
-- Cloud Target: Supabase Dashboard SQL Editor (PostgreSQL 15+)
--
-- This script safely provisions live authentication accounts directly in:
--   1. auth.users & auth.identities (Supabase GoTrue Engine)
--   2. public.profiles (Unified Relational Identity Anchor)
--   3. public.users (Physically Separated Staff & Executive Accounts)
--   4. public.customers (Physically Separated Client & Guest Accounts)
--
-- Accounts Included:
--   • Administrator : admin@janddbeachhouse.ph        (username: admin)
--   • Receptionist  : receptionist@janddbeachhouse.ph (username: receptionist)
--   • Other Staff:
--       - Accounting   : accounting@janddbeachhouse.ph   (username: accountant)
--       - Housekeeping : housekeeping@janddbeachhouse.ph (username: staff_housekeeping)
--       - Kitchen      : kitchen@janddbeachhouse.ph      (username: staff_kitchen)
--   • One User (Customer) : guest.juan@gmail.com     (username: juan_delacruz)
-- ==============================================================================

-- 1. Ensure Required Cryptographic Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. Define Idempotent Provisioning Routine
CREATE OR REPLACE FUNCTION public.provision_system_account(
  p_email TEXT,
  p_password TEXT,
  p_username TEXT,
  p_first_name TEXT,
  p_middle_name TEXT,
  p_last_name TEXT,
  p_role public.user_role,
  p_position TEXT DEFAULT '',
  p_department public.dept_name DEFAULT 'front_desk',
  p_phone TEXT DEFAULT '',
  p_address TEXT DEFAULT '',
  p_city TEXT DEFAULT '',
  p_emergency TEXT DEFAULT ''
)
RETURNS UUID AS $$
DECLARE
  v_user_id UUID;
  v_encrypted_pw TEXT;
  v_full_name TEXT;
  v_user_meta JSONB;
  v_app_meta JSONB;
BEGIN
  v_full_name := TRIM(CONCAT_WS(' ', NULLIF(p_first_name, ''), NULLIF(p_middle_name, ''), NULLIF(p_last_name, '')));
  IF v_full_name = '' THEN
    v_full_name := p_username;
  END IF;

  -- Locate existing auth record or generate fresh UUID
  SELECT id INTO v_user_id FROM auth.users WHERE LOWER(email) = LOWER(TRIM(p_email)) LIMIT 1;
  IF v_user_id IS NULL THEN
    v_user_id := gen_random_uuid();
  END IF;

  -- Encrypt password via bcrypt
  v_encrypted_pw := crypt(p_password, gen_salt('bf', 10));

  v_user_meta := jsonb_build_object(
    'first_name', p_first_name,
    'middle_name', p_middle_name,
    'last_name', p_last_name,
    'full_name', v_full_name,
    'username', LOWER(TRIM(p_username)),
    'role', p_role::text,
    'position', p_position,
    'department', p_department::text,
    'phone', p_phone,
    'address', p_address,
    'city', p_city,
    'emergency_contact', p_emergency
  );

  v_app_meta := jsonb_build_object(
    'provider', 'email',
    'providers', jsonb_build_array('email')
  );

  -- A. Insert or update Supabase Auth Core (auth.users)
  INSERT INTO auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at,
    confirmation_token,
    recovery_token,
    email_change_token_new
  )
  VALUES (
    '00000000-0000-0000-0000-000000000000',
    v_user_id,
    'authenticated',
    'authenticated',
    LOWER(TRIM(p_email)),
    v_encrypted_pw,
    now(),
    v_app_meta,
    v_user_meta,
    now(),
    now(),
    '',
    '',
    ''
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    encrypted_password = EXCLUDED.encrypted_password,
    email_confirmed_at = COALESCE(auth.users.email_confirmed_at, now()),
    raw_app_meta_data = EXCLUDED.raw_app_meta_data,
    raw_user_meta_data = EXCLUDED.raw_user_meta_data,
    updated_at = now();

  -- B. Provision Supabase GoTrue Identity Record (auth.identities)
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'auth' AND table_name = 'identities') THEN
    IF NOT EXISTS (SELECT 1 FROM auth.identities WHERE user_id = v_user_id AND provider = 'email') THEN
      INSERT INTO auth.identities (
        id,
        user_id,
        identity_data,
        provider,
        provider_id,
        last_sign_in_at,
        created_at,
        updated_at
      )
      VALUES (
        v_user_id::text,
        v_user_id,
        jsonb_build_object('sub', v_user_id::text, 'email', LOWER(TRIM(p_email))),
        'email',
        LOWER(TRIM(p_email)),
        now(),
        now(),
        now()
      );
    ELSE
      UPDATE auth.identities
      SET identity_data = jsonb_build_object('sub', v_user_id::text, 'email', LOWER(TRIM(p_email))),
          updated_at = now()
      WHERE user_id = v_user_id AND provider = 'email';
    END IF;
  END IF;

  -- C. Upsert into Unified Relational Anchor (public.profiles)
  INSERT INTO public.profiles (
    id, email, username, first_name, middle_name, last_name, full_name,
    role, position, phone, address, city, emergency_contact, provider, updated_at
  )
  VALUES (
    v_user_id, LOWER(TRIM(p_email)), LOWER(TRIM(p_username)),
    p_first_name, p_middle_name, p_last_name, v_full_name,
    p_role, p_position, p_phone, p_address, p_city, p_emergency, 'email', now()
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    username = EXCLUDED.username,
    first_name = EXCLUDED.first_name,
    middle_name = EXCLUDED.middle_name,
    last_name = EXCLUDED.last_name,
    full_name = EXCLUDED.full_name,
    role = EXCLUDED.role,
    position = EXCLUDED.position,
    phone = EXCLUDED.phone,
    address = EXCLUDED.address,
    city = EXCLUDED.city,
    emergency_contact = EXCLUDED.emergency_contact,
    updated_at = now();

  -- D. Physical Isolation: Route to public.customers OR public.users
  IF p_role = 'customer' THEN
    INSERT INTO public.customers (
      id, email, username, first_name, middle_name, last_name, full_name,
      role, phone, address, city, emergency_contact, provider, is_verified, total_stays, updated_at
    )
    VALUES (
      v_user_id, LOWER(TRIM(p_email)), LOWER(TRIM(p_username)),
      p_first_name, p_middle_name, p_last_name, v_full_name,
      'customer', p_phone, p_address, p_city, p_emergency, 'email', true, 2, now()
    )
    ON CONFLICT (id) DO UPDATE SET
      email = EXCLUDED.email,
      username = EXCLUDED.username,
      first_name = EXCLUDED.first_name,
      middle_name = EXCLUDED.middle_name,
      last_name = EXCLUDED.last_name,
      full_name = EXCLUDED.full_name,
      phone = EXCLUDED.phone,
      address = EXCLUDED.address,
      city = EXCLUDED.city,
      emergency_contact = EXCLUDED.emergency_contact,
      is_verified = true,
      updated_at = now();
  ELSE
    INSERT INTO public.users (
      id, email, username, first_name, middle_name, last_name, full_name,
      role, position, department, phone, emergency_contact, is_active, updated_at
    )
    VALUES (
      v_user_id, LOWER(TRIM(p_email)), LOWER(TRIM(p_username)),
      p_first_name, p_middle_name, p_last_name, v_full_name,
      p_role, p_position, p_department, p_phone, p_emergency, true, now()
    )
    ON CONFLICT (id) DO UPDATE SET
      email = EXCLUDED.email,
      username = EXCLUDED.username,
      first_name = EXCLUDED.first_name,
      middle_name = EXCLUDED.middle_name,
      last_name = EXCLUDED.last_name,
      full_name = EXCLUDED.full_name,
      role = EXCLUDED.role,
      position = EXCLUDED.position,
      department = EXCLUDED.department,
      phone = EXCLUDED.phone,
      emergency_contact = EXCLUDED.emergency_contact,
      is_active = true,
      updated_at = now();
  END IF;

  RETURN v_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==============================================================================
-- 3. Execute Account Provisioning
-- ==============================================================================

-- Account 1: Executive Administrator
SELECT public.provision_system_account(
  'admin@janddbeachhouse.ph',
  'AdminPassword2026!',
  'admin',
  'Executive',
  'Director',
  'Administrator',
  'administrator'::public.user_role,
  'Managing Director & General Manager',
  'front_desk'::public.dept_name,
  '09171112222',
  'Patar Beachfront',
  'Bolinao, Pangasinan',
  '09170000001'
);

-- Account 2: Front Desk Receptionist
SELECT public.provision_system_account(
  'receptionist@janddbeachhouse.ph',
  'Receptionist2026!',
  'receptionist',
  'Maria',
  'Clara',
  'Santos',
  'receptionist'::public.user_role,
  'Head Front Desk Receptionist',
  'front_desk'::public.dept_name,
  '09173334444',
  'Patar Highway',
  'Bolinao, Pangasinan',
  '09170000002'
);

-- Account 3: Accounting & Finance Staff
SELECT public.provision_system_account(
  'accounting@janddbeachhouse.ph',
  'Accounting2026!',
  'accountant',
  'Carlos',
  'Jose',
  'Dalisay',
  'accounting'::public.user_role,
  'Chief Resort Accountant',
  'front_desk'::public.dept_name,
  '09175556666',
  'Poblacion',
  'Bolinao, Pangasinan',
  '09170000003'
);

-- Account 4: Housekeeping Staff
SELECT public.provision_system_account(
  'housekeeping@janddbeachhouse.ph',
  'StaffPass2026!',
  'staff_housekeeping',
  'Elena',
  'Mae',
  'Reyes',
  'staff'::public.user_role,
  'Housekeeping Operations Supervisor',
  'housekeeping'::public.dept_name,
  '09177778888',
  'Barangay Patar',
  'Bolinao, Pangasinan',
  '09170000004'
);

-- Account 5: Kitchen & Dining Staff
SELECT public.provision_system_account(
  'kitchen@janddbeachhouse.ph',
  'StaffPass2026!',
  'staff_kitchen',
  'Ramon',
  'Lee',
  'Bautista',
  'staff'::public.user_role,
  'Executive Head Chef',
  'kitchen'::public.dept_name,
  '09178889999',
  'Barangay Patar',
  'Bolinao, Pangasinan',
  '09170000005'
);

-- Account 6: Customer / Guest Account (One User)
SELECT public.provision_system_account(
  'guest.juan@gmail.com',
  'GuestPass2026!',
  'juan_delacruz',
  'Juan',
  'Ramos',
  'Dela Cruz',
  'customer'::public.user_role,
  'VIP Resort Guest',
  'front_desk'::public.dept_name,
  '09171234567',
  'Patar Coastal Road',
  'Bolinao, Pangasinan',
  '09179998888'
);

-- Optional: Remove internal provisioning function after completion
DROP FUNCTION IF EXISTS public.provision_system_account;

-- ==============================================================================
-- 4. Instant Output & Verification
-- ==============================================================================

-- Staff and Admin accounts in dedicated public.users storage
SELECT 
  'USERS (Staff/Admins)' AS storage,
  id,
  email,
  username,
  role,
  position,
  department,
  full_name,
  phone,
  is_active
FROM public.users
ORDER BY created_at ASC;

-- Customer accounts in dedicated public.customers storage
SELECT 
  'CUSTOMERS (Guests)' AS storage,
  id,
  email,
  username,
  role,
  full_name,
  phone,
  city,
  is_verified,
  total_stays
FROM public.customers
ORDER BY created_at ASC;
