-- ==============================================================================
-- J & D Beach House · Supabase Administrator Injection Script
-- Location: Brgy. Patar, Bolinao, Pangasinan (16.3042° N, 119.7821° E)
--
-- INSTRUCTIONS:
-- 1. Open your Supabase Dashboard: https://supabase.com/dashboard/project/owhodkhzldygavuwnqfg
-- 2. Navigate to "SQL Editor" on the left menu.
-- 3. Click "New query", paste this entire script, and click "RUN".
-- ==============================================================================

-- 1. Enable Cryptographic Extensions
create extension if not exists "pgcrypto";

-- 2. Inject or Update Administrator Account in auth.users and public.profiles
do $$
declare
  v_admin_email text := 'admin@janddbeachhouse.ph'; -- Set your preferred administrator email here
  v_admin_pass  text := 'AdminPassword123!';        -- Set your preferred administrator password here
  v_admin_id    uuid := '4f40532f-b2e3-4aaa-ae5d-06e135a8576c'::uuid;
  v_existing_id uuid;
begin

  -- Check if user already exists in auth.users
  select id into v_existing_id from auth.users where email = v_admin_email;

  if v_existing_id is not null then
    -- Update existing user's password, ensure email is confirmed, and set administrator metadata
    update auth.users
    set encrypted_password = crypt(v_admin_pass, gen_salt('bf')),
        email_confirmed_at = coalesce(email_confirmed_at, now()),
        raw_app_meta_data = '{"provider":"email","providers":["email"]}'::jsonb,
        raw_user_meta_data = jsonb_build_object(
          'first_name', 'Resort',
          'last_name', 'Administrator',
          'full_name', 'Resort Administrator',
          'role', 'administrator',
          'phone', '09005550123'
        ),
        updated_at = now()
    where id = v_existing_id;
    
    v_admin_id := v_existing_id;
  else
    -- Insert new confirmed administrator user into auth.users
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
      recovery_token
    ) values (
      '00000000-0000-0000-0000-000000000000'::uuid,
      v_admin_id,
      'authenticated',
      'authenticated',
      v_admin_email,
      crypt(v_admin_pass, gen_salt('bf')),
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      jsonb_build_object(
        'first_name', 'Resort',
        'last_name', 'Administrator',
        'full_name', 'Resort Administrator',
        'role', 'administrator',
        'phone', '09005550123'
      ),
      now(),
      now(),
      '',
      ''
    );
  end if;

  -- 3. Upsert linked Administrator Profile into public.profiles
  insert into public.profiles (
    id,
    first_name,
    middle_name,
    last_name,
    full_name,
    phone,
    address,
    city,
    emergency_contact,
    role,
    created_at
  ) values (
    v_admin_id,
    'Resort',
    '',
    'Administrator',
    'Resort Administrator',
    '09005550123',
    'Cape Bolinao Road',
    'Bolinao',
    '09171234567',
    'administrator',
    now()
  )
  on conflict (id) do update set
    role = 'administrator',
    first_name = 'Resort',
    last_name = 'Administrator',
    full_name = 'Resort Administrator',
    phone = '09005550123',
    city = 'Bolinao';

  raise notice 'Administrator injected successfully with ID: %', v_admin_id;

end $$;

-- 4. Ensure RLS Policies Permit Profile Self-Insert and Admin Reads
do $$
begin
  if not exists (
    select 1 from pg_policies where tablename = 'profiles' and policyname = 'profiles: self insert'
  ) then
    create policy "profiles: self insert" on public.profiles for insert with check (id = auth.uid());
  end if;
end $$;

-- 5. Verification Query: Confirm Administrator Status
select 
  u.id,
  u.email,
  u.email_confirmed_at,
  p.full_name,
  p.role,
  p.phone
from auth.users u
join public.profiles p on p.id = u.id
where u.email = 'admin@janddbeachhouse.ph';
