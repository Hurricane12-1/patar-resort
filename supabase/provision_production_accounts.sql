-- ==============================================================================
-- J & D Beach House · Production-Grade Account Provisioning Script
-- Location: Brgy. Patar, Bolinao, Pangasinan (16.3042° N, 119.7821° E)
--
-- This script provides a production-grade stored procedure to provision real
-- accounts in Supabase. It uses:
--   1. Dynamic UUIDs (gen_random_uuid())
--   2. Real Blowfish/Bcrypt salted password hashing (crypt(..., gen_salt('bf', 10)))
--   3. Synchronized auth.users + public.profiles linking
--   4. Instant email confirmation (email_confirmed_at = now())
--   5. Full RBAC role assignment ('administrator' vs 'customer')
-- ==============================================================================

-- 1. Ensure required extensions exist
create extension if not exists "pgcrypto";

-- 2. Create the production provisioning function
create or replace function public.provision_production_user(
  p_email text,
  p_password text,
  p_first_name text,
  p_last_name text,
  p_role public.user_role default 'customer',
  p_phone text default '',
  p_address text default 'Brgy. Patar',
  p_city text default 'Bolinao, Pangasinan'
)
returns uuid
language plpgsql
security definer
set search_path = auth, public, extensions
as $$
declare
  v_user_id uuid;
  v_encrypted_pw text;
  v_full_name text;
begin
  -- Validate password strength
  if length(p_password) < 8 then
    raise exception 'Password must be at least 8 characters long for production security.';
  end if;

  v_full_name := trim(concat(p_first_name, ' ', p_last_name));
  -- Generate standard Blowfish crypt hash with work factor 10 (GoTrue standard)
  v_encrypted_pw := extensions.crypt(p_password, extensions.gen_salt('bf', 10));

  -- Check if user already exists in auth.users
  select id into v_user_id from auth.users where email = lower(trim(p_email));

  if v_user_id is null then
    -- Generate new random UUID
    v_user_id := gen_random_uuid();

    insert into auth.users (
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
      email_change,
      email_change_token_new,
      recovery_token
    ) values (
      '00000000-0000-0000-0000-000000000000',
      v_user_id,
      'authenticated',
      'authenticated',
      lower(trim(p_email)),
      v_encrypted_pw,
      now(),
      '{"provider": "email", "providers": ["email"]}'::jsonb,
      jsonb_build_object(
        'first_name', p_first_name,
        'last_name', p_last_name,
        'full_name', v_full_name,
        'role', p_role,
        'phone', p_phone
      ),
      now(),
      now(),
      '',
      '',
      '',
      ''
    );
  else
    -- Update existing auth record
    update auth.users
    set encrypted_password = v_encrypted_pw,
        email_confirmed_at = coalesce(email_confirmed_at, now()),
        raw_user_meta_data = jsonb_build_object(
          'first_name', p_first_name,
          'last_name', p_last_name,
          'full_name', v_full_name,
          'role', p_role,
          'phone', p_phone
        ),
        updated_at = now()
    where id = v_user_id;
  end if;

  -- Upsert corresponding public profile with RBAC role
  insert into public.profiles (
    id,
    first_name,
    last_name,
    full_name,
    phone,
    address,
    city,
    role,
    created_at
  ) values (
    v_user_id,
    p_first_name,
    p_last_name,
    v_full_name,
    p_phone,
    p_address,
    p_city,
    p_role,
    now()
  )
  on conflict (id) do update set
    first_name = excluded.first_name,
    last_name = excluded.last_name,
    full_name = excluded.full_name,
    phone = excluded.phone,
    address = excluded.address,
    city = excluded.city,
    role = excluded.role;

  return v_user_id;
end;
$$;

-- ==============================================================================
-- 3. EXECUTE PROVISIONING CALLS (CUSTOMIZE CREDENTIALS BELOW)
-- ==============================================================================

-- A. Provision Administrator Account
select public.provision_production_user(
  'admin@janddbeachhouse.ph',     -- Replace with your real production admin email
  'AdminSecurePass2026!',         -- Replace with your real production admin password (min 8 chars)
  'Executive',                    -- First Name
  'Admin',                        -- Last Name
  'administrator',                -- Role: 'administrator'
  '+63 917 555 0100',             -- Phone
  'Cape Bolinao Road',            -- Address
  'Bolinao, Pangasinan'           -- City
) as admin_user_id;

-- B. Provision Client / Customer Account
select public.provision_production_user(
  'client@gmail.com',             -- Replace with your real client / customer email
  'ClientSecurePass2026!',        -- Replace with your real client password (min 8 chars)
  'Juan',                         -- First Name
  'Dela Cruz',                    -- Last Name
  'customer',                     -- Role: 'customer'
  '+63 918 555 0101',             -- Phone
  'Brgy. Patar',                  -- Address
  'Bolinao, Pangasinan'           -- City
) as client_user_id;

-- 4. Verify created accounts
select 
  u.id,
  u.email,
  p.full_name,
  p.role,
  u.email_confirmed_at,
  u.created_at
from auth.users u
join public.profiles p on p.id = u.id
where u.email in ('admin@janddbeachhouse.ph', 'client@gmail.com')
order by p.role;
