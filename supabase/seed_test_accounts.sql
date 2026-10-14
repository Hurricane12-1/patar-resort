-- ==============================================================================
-- J & D Beach House · Supabase Fake / Test Accounts Seed Script
-- Location: Brgy. Patar, Bolinao, Pangasinan (16.3042° N, 119.7821° E)
--
-- ACCOUNTS CREATED:
-- 1. Administrator : admin@janddbeachhouse.ph / AdminPassword123!
-- 2. Client / Guest: client.guest@gmail.com   / GuestPassword123!
-- 3. Staff / Desk  : staff@janddbeachhouse.ph  / StaffPassword123!
--
-- USAGE:
-- Copy and paste this script directly into your Supabase Dashboard -> SQL Editor,
-- then click "Run".
-- ==============================================================================

-- Enable pgcrypto for password hashing
create extension if not exists "pgcrypto";

do $$
declare
  v_admin_id uuid := 'a1111111-1111-1111-1111-111111111111'::uuid;
  v_guest_id uuid := 'b2222222-2222-2222-2222-222222222222'::uuid;
  v_staff_id uuid := 'c3333333-3333-3333-3333-333333333333'::uuid;
begin

  -- ============================================================================
  -- 1. ADMINISTRATOR ACCOUNT
  -- ============================================================================
  if not exists (select 1 from auth.users where email = 'admin@janddbeachhouse.ph') then
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
      'admin@janddbeachhouse.ph',
      crypt('AdminPassword123!', gen_salt('bf')),
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"first_name":"System","last_name":"Admin","full_name":"Resort Administrator","role":"administrator","phone":"+639175550100"}'::jsonb,
      now(),
      now(),
      '',
      ''
    );
  else
    select id into v_admin_id from auth.users where email = 'admin@janddbeachhouse.ph';
    update auth.users
    set encrypted_password = crypt('AdminPassword123!', gen_salt('bf')),
        email_confirmed_at = coalesce(email_confirmed_at, now()),
        raw_user_meta_data = '{"first_name":"System","last_name":"Admin","full_name":"Resort Administrator","role":"administrator","phone":"+639175550100"}'::jsonb
    where id = v_admin_id;
  end if;

  -- Ensure Administrator profile exists with administrator role
  insert into public.profiles (id, first_name, last_name, full_name, phone, address, city, role)
  values (v_admin_id, 'System', 'Admin', 'Resort Administrator', '+63 917 555 0100', 'Cape Bolinao Road', 'Bolinao, Pangasinan', 'administrator')
  on conflict (id) do update set
    role = 'administrator',
    full_name = 'Resort Administrator',
    phone = '+63 917 555 0100';


  -- ============================================================================
  -- 2. CLIENT / GUEST ACCOUNT
  -- ============================================================================
  if not exists (select 1 from auth.users where email = 'client.guest@gmail.com') then
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
      v_guest_id,
      'authenticated',
      'authenticated',
      'client.guest@gmail.com',
      crypt('GuestPassword123!', gen_salt('bf')),
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"first_name":"Juan","last_name":"Dela Cruz","full_name":"Juan Dela Cruz","role":"customer","phone":"+639185550101"}'::jsonb,
      now(),
      now(),
      '',
      ''
    );
  else
    select id into v_guest_id from auth.users where email = 'client.guest@gmail.com';
    update auth.users
    set encrypted_password = crypt('GuestPassword123!', gen_salt('bf')),
        email_confirmed_at = coalesce(email_confirmed_at, now()),
        raw_user_meta_data = '{"first_name":"Juan","last_name":"Dela Cruz","full_name":"Juan Dela Cruz","role":"customer","phone":"+639185550101"}'::jsonb
    where id = v_guest_id;
  end if;

  -- Ensure Client profile exists with customer role
  insert into public.profiles (id, first_name, last_name, full_name, phone, address, city, role)
  values (v_guest_id, 'Juan', 'Dela Cruz', 'Juan Dela Cruz', '+63 918 555 0101', 'Barangay Patar', 'Bolinao, Pangasinan', 'customer')
  on conflict (id) do update set
    role = 'customer',
    full_name = 'Juan Dela Cruz',
    phone = '+63 918 555 0101';


  -- ============================================================================
  -- 3. STAFF / RECEPTIONIST ACCOUNT (FOR OPERATIONS TESTING)
  -- ============================================================================
  if not exists (select 1 from auth.users where email = 'staff@janddbeachhouse.ph') then
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
      v_staff_id,
      'authenticated',
      'authenticated',
      'staff@janddbeachhouse.ph',
      crypt('StaffPassword123!', gen_salt('bf')),
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"first_name":"FrontDesk","last_name":"Staff","full_name":"Front Desk Officer (Reception)","role":"receptionist","phone":"+639195550102"}'::jsonb,
      now(),
      now(),
      '',
      ''
    );
  else
    select id into v_staff_id from auth.users where email = 'staff@janddbeachhouse.ph';
    update auth.users
    set encrypted_password = crypt('StaffPassword123!', gen_salt('bf')),
        email_confirmed_at = coalesce(email_confirmed_at, now()),
        raw_user_meta_data = '{"first_name":"FrontDesk","last_name":"Staff","full_name":"Front Desk Officer (Reception)","role":"receptionist","phone":"+639195550102"}'::jsonb
    where id = v_staff_id;
  end if;

  -- Ensure Staff profile exists with receptionist role
  insert into public.profiles (id, first_name, last_name, full_name, phone, address, city, role)
  values (v_staff_id, 'FrontDesk', 'Staff', 'Front Desk Officer (Reception)', '+63 919 555 0102', 'Patar Road', 'Bolinao, Pangasinan', 'receptionist')
  on conflict (id) do update set
    role = 'receptionist',
    full_name = 'Front Desk Officer (Reception)',
    phone = '+63 919 555 0102';

end $$;

-- Verify created accounts
select 
  u.id,
  u.email,
  p.full_name,
  p.role,
  u.email_confirmed_at
from auth.users u
left join public.profiles p on p.id = u.id
where u.email in ('admin@janddbeachhouse.ph', 'client.guest@gmail.com', 'staff@janddbeachhouse.ph')
order by p.role;
