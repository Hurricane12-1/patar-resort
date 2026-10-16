-- ==============================================================================
-- J & D Beach House Resort · Admin Password Setup & Reset Script
-- Target: Supabase Dashboard -> SQL Editor -> New query -> Run
--
-- Account: admin@janddbeachhouse.ph
-- Password: AdminPassword2026!
-- ==============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

DO $$
DECLARE
  v_admin_id UUID := '11111111-1111-1111-1111-111111111111';
  v_email TEXT := 'admin@janddbeachhouse.ph';
  v_password TEXT := 'AdminPassword2026!';
  v_hashed_password TEXT;
BEGIN
  -- 1. I-hash ang password gamit ang bcrypt (Standard ng Supabase Auth)
  v_hashed_password := crypt(v_password, gen_salt('bf', 10));

  -- 2. Kung existing na ang admin sa auth.users, i-update ang password
  IF EXISTS (SELECT 1 FROM auth.users WHERE email = v_email) THEN
    SELECT id INTO v_admin_id FROM auth.users WHERE email = v_email;

    UPDATE auth.users
    SET 
      encrypted_password = v_hashed_password,
      email_confirmed_at = COALESCE(email_confirmed_at, now()),
      raw_app_meta_data = '{"provider":"email","providers":["email"]}'::jsonb,
      raw_user_meta_data = jsonb_build_object('full_name', 'Executive Director', 'username', 'admin', 'role', 'administrator'),
      updated_at = now()
    WHERE id = v_admin_id;
  ELSE
    -- Kung wala pa sa auth.users, ipasok bilang bagong user
    INSERT INTO auth.users (
      instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
      last_sign_in_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
      confirmation_token, email_change, email_change_token_new, recovery_token
    )
    VALUES (
      '00000000-0000-0000-0000-000000000000',
      v_admin_id,
      'authenticated',
      'authenticated',
      v_email,
      v_hashed_password,
      now(),
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"full_name":"Executive Director","username":"admin","role":"administrator"}'::jsonb,
      now(),
      now(),
      '', '', '', ''
    );
  END IF;

  -- 3. Siguraduhing may record sa auth.identities para gumana ang GoTrue login
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'auth' AND table_name = 'identities') THEN
    DELETE FROM auth.identities WHERE user_id = v_admin_id AND provider = 'email';
    INSERT INTO auth.identities (id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at)
    VALUES (
      gen_random_uuid(),
      v_admin_id,
      jsonb_build_object('sub', v_admin_id::text, 'email', v_email),
      'email',
      v_admin_id::text,
      now(),
      now(),
      now()
    );
  END IF;

  -- 4. I-sync sa public.profiles
  INSERT INTO public.profiles (
    id, email, username, first_name, last_name, full_name, role, position, phone, updated_at
  )
  VALUES (
    v_admin_id,
    v_email,
    'admin',
    'Executive',
    'Admin',
    'Executive Director',
    'administrator',
    'General Manager',
    '09171112222',
    now()
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    username = EXCLUDED.username,
    role = 'administrator',
    full_name = EXCLUDED.full_name,
    updated_at = now();

  -- 5. I-sync sa public.users (Admin & Staff dedicated storage)
  INSERT INTO public.users (
    id, email, username, first_name, last_name, full_name, role, position, department, phone, is_active, updated_at
  )
  VALUES (
    v_admin_id,
    v_email,
    'admin',
    'Executive',
    'Admin',
    'Executive Director',
    'administrator',
    'General Manager',
    'front_desk',
    '09171112222',
    true,
    now()
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    username = EXCLUDED.username,
    role = 'administrator',
    is_active = true,
    updated_at = now();

  RAISE NOTICE 'SUCCESS: admin@janddbeachhouse.ph password has been set to AdminPassword2026!';
END $$;
