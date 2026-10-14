-- ==============================================================================
-- J & D Beach House · Complete Supabase Resort Seed Dataset
-- Location: Brgy. Patar, Bolinao, Pangasinan (16.3042° N, 119.7821° E)
--
-- Tables Seeded:
--   1. rooms               (All 9 Physical Accommodations)
--   2. auth.users          (Admin, Staff, Accounting & Verified Guests)
--   3. public.profiles     (Linked Profiles with Production RBAC Roles)
--   4. reservations        (Real Checked-In, Confirmed & Checked-Out Stays)
--   5. reviews             (Verified Guest Feedback & Star Ratings)
--   6. department_tasks    (Operational Housekeeping, Kitchen, Maintenance, Tours)
--   7. resort_inventory    (Real Stock, Units & Reorder Thresholds)
--   8. resort_orders       (Guest In-Room Dining & Tour Orders)
--   9. notifications       (SMS Booking Confirmation Logs)
--
-- Usage:
--   Open Supabase Dashboard -> SQL Editor -> New Query -> Paste & Run.
-- ==============================================================================

-- 1. Ensure required extensions exist
create extension if not exists "pgcrypto";
create extension if not exists "btree_gist";

-- ==============================================================================
-- 1. PHYSICAL ROOMS & ACCOMMODATIONS
-- ==============================================================================
insert into public.rooms (id, name, slug, category, description, capacity, units, rate_php, amenities, is_active, rating_avg, rating_count) values
  ('fa8eb760-8662-4cbf-9553-1046d6cbd4f1', 'Unit TEV Grand Villa', 'unit-tev', 'Villa', 'Grand beachfront group villa for large gatherings, family reunions, and corporate retreats. Sleeps up to 60 guests.', 60, 1, 18000, '{AC,Sea view,Kitchen,Grill,Karaoke,Porch}', true, 5.0, 42),
  ('fa8eb760-8662-4cbf-9553-1046d6cbd4f2', 'Unit GEL Premier Suite', 'unit-gel', 'Suite', 'Spacious group suite overlooking the Patar white beach coastline. Sleeps up to 25 guests.', 25, 1, 12000, '{AC,Balcony,Hot shower,WiFi,Kitchenette}', true, 4.9, 36),
  ('fa8eb760-8662-4cbf-9553-1046d6cbd4f3', 'Unit CAT Cottage (Unit Papang)', 'unit-cat', 'Cottage', 'Native beachfront cottage with direct sand access. Also known in logbooks as Unit Papang. Sleeps up to 10 guests.', 10, 1, 6000, '{Fan,AC,WiFi,Porch,Hot shower}', true, 4.8, 29),
  ('fa8eb760-8662-4cbf-9553-1046d6cbd4f4', 'Habagat Sea-View Suite', 'habagat-suite', 'Suite', 'Front suite with private balcony hanging over the turquoise ocean.', 3, 4, 2950, '{AC,Sea view,Balcony,WiFi,Breakfast}', true, 4.9, 38),
  ('fa8eb760-8662-4cbf-9553-1046d6cbd4f5', 'Sunset Pavilion Suite', 'sunset-pavilion', 'Suite', 'Premium king suite facing the Cape Bolinao sunset.', 2, 2, 3600, '{AC,Sea view,King bed,Bathtub,Breakfast}', true, 5.0, 31),
  ('fa8eb760-8662-4cbf-9553-1046d6cbd4f6', 'Duyan Family Villa', 'duyan-villa', 'Villa', 'Two-bedroom family villa with private outdoor hammock deck & barbecue grill.', 6, 3, 4800, '{AC,Kitchenette,2 bedrooms,WiFi,Grill deck}', true, 5.0, 24),
  ('fa8eb760-8662-4cbf-9553-1046d6cbd4f7', 'Nipa Cove Cottage', 'nipa-cove', 'Cottage', 'Native nipa cottage steps from the sand with fan cooling and hammock porch.', 2, 6, 1450, '{Fan,Hot shower,WiFi,Porch}', true, 4.8, 52),
  ('fa8eb760-8662-4cbf-9553-1046d6cbd4f8', 'Garden Breeze Room', 'garden-breeze', 'Garden', 'Air-conditioned room looking out onto lush mango gardens. Queen bed, breakfast included.', 2, 8, 1850, '{AC,WiFi,Hot shower,Breakfast}', true, 4.9, 41),
  ('fa8eb760-8662-4cbf-9553-1046d6cbd4f9', 'Backpacker Bunk Dorm', 'backpacker-bunk', 'Dorm', 'Cozy air-conditioned shared bunk suite steps away from Patar beach front.', 1, 10, 650, '{WiFi,Locker,Fan,Shared bath}', true, 4.7, 65)
on conflict (slug) do update set
  name = excluded.name,
  category = excluded.category,
  description = excluded.description,
  capacity = excluded.capacity,
  units = excluded.units,
  rate_php = excluded.rate_php,
  amenities = excluded.amenities,
  rating_avg = excluded.rating_avg,
  rating_count = excluded.rating_count;


-- ==============================================================================
-- 2. AUTHENTICATED USERS & PROFILES
-- ==============================================================================
do $$
declare
  v_admin_id  uuid := '11111111-1111-1111-1111-111111111111'::uuid;
  v_staff_id  uuid := '22222222-2222-2222-2222-222222222222'::uuid;
  v_acct_id   uuid := '33333333-3333-3333-3333-333333333333'::uuid;
  v_guest1_id uuid := '44444444-4444-4444-4444-444444444441'::uuid;
  v_guest2_id uuid := '44444444-4444-4444-4444-444444444442'::uuid;
  v_guest3_id uuid := '44444444-4444-4444-4444-444444444443'::uuid;
  v_guest4_id uuid := '44444444-4444-4444-4444-444444444444'::uuid;
begin

  -- Helper to upsert auth.users record safely
  -- Admin
  insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  values ('00000000-0000-0000-0000-000000000000', v_admin_id, 'authenticated', 'authenticated', 'admin@janddbeachhouse.ph', crypt('AdminPassword123!', gen_salt('bf', 10)), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{"first_name":"Johannes","last_name":"Von Shicksal","full_name":"Johannes Von Shicksal","role":"administrator"}'::jsonb, now(), now())
  on conflict (id) do update set encrypted_password = crypt('AdminPassword123!', gen_salt('bf', 10));

  insert into public.profiles (id, first_name, last_name, full_name, phone, address, city, role)
  values (v_admin_id, 'Johannes', 'Von Shicksal', 'Johannes Von Shicksal', '+63 917 555 0100', 'Cape Bolinao Road', 'Bolinao, Pangasinan', 'administrator')
  on conflict (id) do update set role = 'administrator', full_name = 'Johannes Von Shicksal';

  -- Staff / Reception
  insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  values ('00000000-0000-0000-0000-000000000000', v_staff_id, 'authenticated', 'authenticated', 'staff@janddbeachhouse.ph', crypt('StaffPassword123!', gen_salt('bf', 10)), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{"first_name":"FrontDesk","last_name":"Staff","full_name":"Front Desk Officer (Reception)","role":"receptionist"}'::jsonb, now(), now())
  on conflict (id) do update set encrypted_password = crypt('StaffPassword123!', gen_salt('bf', 10));

  insert into public.profiles (id, first_name, last_name, full_name, phone, address, city, role)
  values (v_staff_id, 'FrontDesk', 'Staff', 'Front Desk Officer (Reception)', '+63 919 555 0102', 'Patar Road', 'Bolinao, Pangasinan', 'receptionist')
  on conflict (id) do update set role = 'receptionist', full_name = 'Front Desk Officer (Reception)';

  -- Accounting
  insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  values ('00000000-0000-0000-0000-000000000000', v_acct_id, 'authenticated', 'authenticated', 'accounting@janddbeachhouse.ph', crypt('AccountingPassword123!', gen_salt('bf', 10)), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{"first_name":"Finance","last_name":"Lead","full_name":"Resort Accounting Officer","role":"accounting"}'::jsonb, now(), now())
  on conflict (id) do update set encrypted_password = crypt('AccountingPassword123!', gen_salt('bf', 10));

  insert into public.profiles (id, first_name, last_name, full_name, phone, address, city, role)
  values (v_acct_id, 'Finance', 'Lead', 'Resort Accounting Officer', '+63 920 555 0103', 'Poblacion', 'Bolinao, Pangasinan', 'accounting')
  on conflict (id) do update set role = 'accounting', full_name = 'Resort Accounting Officer';

  -- Guest 1: Juan Dela Cruz
  insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  values ('00000000-0000-0000-0000-000000000000', v_guest1_id, 'authenticated', 'authenticated', 'juan.cruz@gmail.com', crypt('GuestPassword123!', gen_salt('bf', 10)), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{"first_name":"Juan","last_name":"Dela Cruz","full_name":"Juan Dela Cruz","role":"customer"}'::jsonb, now(), now())
  on conflict (id) do update set encrypted_password = crypt('GuestPassword123!', gen_salt('bf', 10));

  insert into public.profiles (id, first_name, last_name, full_name, phone, address, city, role)
  values (v_guest1_id, 'Juan', 'Dela Cruz', 'Juan Dela Cruz', '+63 918 555 0101', 'Barangay Patar', 'Bolinao, Pangasinan', 'customer')
  on conflict (id) do update set role = 'customer', full_name = 'Juan Dela Cruz';

  -- Guest 2: David Christopher Reyes
  insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  values ('00000000-0000-0000-0000-000000000000', v_guest2_id, 'authenticated', 'authenticated', 'david.reyes@gmail.com', crypt('GuestPassword123!', gen_salt('bf', 10)), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{"first_name":"David Christopher","last_name":"Reyes","full_name":"David Christopher Reyes","role":"customer"}'::jsonb, now(), now())
  on conflict (id) do update set encrypted_password = crypt('GuestPassword123!', gen_salt('bf', 10));

  insert into public.profiles (id, first_name, last_name, full_name, phone, address, city, role)
  values (v_guest2_id, 'David Christopher', 'Reyes', 'David Christopher Reyes', '+63 922 555 0104', 'Quezon City', 'Metro Manila', 'customer')
  on conflict (id) do update set role = 'customer', full_name = 'David Christopher Reyes';

  -- Guest 3: Sofia Lopez
  insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  values ('00000000-0000-0000-0000-000000000000', v_guest3_id, 'authenticated', 'authenticated', 'sofia.lopez@yahoo.com', crypt('GuestPassword123!', gen_salt('bf', 10)), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{"first_name":"Sofia","last_name":"Lopez","full_name":"Sofia Lopez","role":"customer"}'::jsonb, now(), now())
  on conflict (id) do update set encrypted_password = crypt('GuestPassword123!', gen_salt('bf', 10));

  insert into public.profiles (id, first_name, last_name, full_name, phone, address, city, role)
  values (v_guest3_id, 'Sofia', 'Lopez', 'Sofia Lopez', '+63 925 555 0105', 'Makati City', 'Metro Manila', 'customer')
  on conflict (id) do update set role = 'customer', full_name = 'Sofia Lopez';

  -- Guest 4: Mateo Garcia
  insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  values ('00000000-0000-0000-0000-000000000000', v_guest4_id, 'authenticated', 'authenticated', 'mateo.garcia@gmail.com', crypt('GuestPassword123!', gen_salt('bf', 10)), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{"first_name":"Mateo","last_name":"Garcia","full_name":"Mateo Garcia","role":"customer"}'::jsonb, now(), now())
  on conflict (id) do update set encrypted_password = crypt('GuestPassword123!', gen_salt('bf', 10));

  insert into public.profiles (id, first_name, last_name, full_name, phone, address, city, role)
  values (v_guest4_id, 'Mateo', 'Garcia', 'Mateo Garcia', '+63 927 555 0106', 'Alaminos', 'Pangasinan', 'customer')
  on conflict (id) do update set role = 'customer', full_name = 'Mateo Garcia';

end $$;


-- ==============================================================================
-- 3. RESERVATIONS (CHECKED-IN, CONFIRMED & PAST COMPLETED STAYS)
-- ==============================================================================
insert into public.reservations (id, guest_id, room_id, check_in, check_out, guests, status, payment_status, downpayment_php, total_php, notes) values
  -- Active Checked-in Guest 1 (Unit TEV)
  ('a0000000-0000-0000-0000-000000000001', '44444444-4444-4444-4444-444444444441', 'fa8eb760-8662-4cbf-9553-1046d6cbd4f1', current_date - 1, current_date + 2, 45, 'checked_in', 'paid', 18000, 54000, 'Family reunion and beach volleyball event. Fully paid in advance.'),
  -- Active Checked-in Guest 2 (Habagat Suite)
  ('a0000000-0000-0000-0000-000000000002', '44444444-4444-4444-4444-444444444442', 'fa8eb760-8662-4cbf-9553-1046d6cbd4f4', current_date, current_date + 3, 2, 'checked_in', 'partial', 3000, 8850, 'Anniversary getaway. Requested Cape Bolinao sunset wine setup.'),
  -- Confirmed Upcoming (Unit GEL)
  ('a0000000-0000-0000-0000-000000000003', '44444444-4444-4444-4444-444444444443', 'fa8eb760-8662-4cbf-9553-1046d6cbd4f2', current_date + 4, current_date + 6, 20, 'confirmed', 'partial', 12000, 24000, 'College barkada trip. Advance deposit verified via GCash.'),
  -- Confirmed Upcoming (Sunset Pavilion)
  ('a0000000-0000-0000-0000-000000000004', '44444444-4444-4444-4444-444444444444', 'fa8eb760-8662-4cbf-9553-1046d6cbd4f5', current_date + 7, current_date + 9, 2, 'confirmed', 'paid', 7200, 7200, 'Honeymoon couple. Welcome fresh buko basket requested.'),
  -- Past Completed Stay (Duyan Family Villa)
  ('a0000000-0000-0000-0000-000000000005', '44444444-4444-4444-4444-444444444441', 'fa8eb760-8662-4cbf-9553-1046d6cbd4f6', current_date - 14, current_date - 11, 5, 'checked_out', 'paid', 5000, 14400, 'Weekend family retreat. Clean checkout with zero incident.'),
  -- Past Completed Stay (Nipa Cove Cottage)
  ('a0000000-0000-0000-0000-000000000006', '44444444-4444-4444-4444-444444444442', 'fa8eb760-8662-4cbf-9553-1046d6cbd4f7', current_date - 20, current_date - 18, 2, 'checked_out', 'paid', 1450, 2900, 'Backpacker weekend on Patar white sand.'),
  -- Past Completed Stay (Unit CAT Cottage)
  ('a0000000-0000-0000-0000-000000000007', '44444444-4444-4444-4444-444444444443', 'fa8eb760-8662-4cbf-9553-1046d6cbd4f3', current_date - 30, current_date - 28, 8, 'checked_out', 'paid', 6000, 12000, 'Unit Papang barkada celebration.')
on conflict (id) do update set
  status = excluded.status,
  payment_status = excluded.payment_status,
  total_php = excluded.total_php;


-- ==============================================================================
-- 4. VERIFIED REVIEWS
-- ==============================================================================
insert into public.reviews (id, reservation_id, guest_id, room_id, rating, comment, created_at) values
  ('b0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000005', '44444444-4444-4444-4444-444444444441', 'fa8eb760-8662-4cbf-9553-1046d6cbd4f6', 5, 'Duyan Family Villa was incredible! The hammock deck facing the Patar waves gave us the most peaceful morning coffee. Staff were warm and attentive.', now() - interval '10 days'),
  ('b0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000006', '44444444-4444-4444-4444-444444444442', 'fa8eb760-8662-4cbf-9553-1046d6cbd4f7', 5, 'Best sunset view in Bolinao. Steps away from Cape Bolinao lighthouse and the white sand beach. Nipa Cove was breezy, authentic, and spotless.', now() - interval '16 days'),
  ('b0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000007', '44444444-4444-4444-4444-444444444443', 'fa8eb760-8662-4cbf-9553-1046d6cbd4f3', 5, 'Unit CAT / Unit Papang is the ultimate native beachfront experience. Great grilling facilities, karaoke was fun, and the grilled bangus was delicious.', now() - interval '25 days')
on conflict (reservation_id) do update set
  rating = excluded.rating,
  comment = excluded.comment;


-- ==============================================================================
-- 5. DEPARTMENT OPERATIONS TASKS
-- ==============================================================================
insert into public.department_tasks (id, department, title, room_name, priority, status, assigned_to, created_at) values
  ('c0000000-0000-0000-0000-000000000001', 'housekeeping', 'Turn-down and linen refresh for Unit TEV Grand Villa', 'Unit TEV Grand Villa', 'urgent', 'in_progress', 'Aria (Housekeeping Lead)', now() - interval '2 hours'),
  ('c0000000-0000-0000-0000-000000000002', 'kitchen', 'Prepare 45-pax Bolinao grilled bangus buffet dinner', 'Dining Pavilion', 'high', 'in_progress', 'Chef Marco', now() - interval '3 hours'),
  ('c0000000-0000-0000-0000-000000000003', 'maintenance', 'Inspect outdoor porch lanterns and hammock fixtures', 'Duyan Family Villa', 'normal', 'completed', 'Ramon (Facilities)', now() - interval '1 day'),
  ('c0000000-0000-0000-0000-000000000004', 'tours', 'Prepare Patar Island Hopping outrigger boat & 10 life vests', 'Beachfront Dock', 'high', 'pending', 'Capt. Danilo', now() - interval '4 hours'),
  ('c0000000-0000-0000-0000-000000000005', 'front_desk', 'Verify check-in digital passes and welcome RFID wristbands', 'Front Reception', 'normal', 'completed', 'Front Desk Lead', now() - interval '6 hours')
on conflict (id) do update set
  status = excluded.status,
  title = excluded.title;


-- ==============================================================================
-- 6. RESORT INVENTORY TRACKER
-- ==============================================================================
insert into public.resort_inventory (id, item_name, category, stock_qty, unit, reorder_at) values
  ('d0000000-0000-0000-0000-000000000001', 'Beach Towel Sets', 'housekeeping', 85, 'sets', 20),
  ('d0000000-0000-0000-0000-000000000002', 'Fresh Linen Sets (King/Queen)', 'housekeeping', 42, 'sets', 10),
  ('d0000000-0000-0000-0000-000000000003', 'Bolinao Fresh Bangus', 'kitchen', 60, 'pcs', 15),
  ('d0000000-0000-0000-0000-000000000004', 'Young Coconuts (Fresh Buko)', 'kitchen', 120, 'pcs', 25),
  ('d0000000-0000-0000-0000-000000000005', 'Outrigger Life Jackets', 'tours', 35, 'pcs', 10),
  ('d0000000-0000-0000-0000-000000000006', 'AC Air Filters & R410A Gas', 'maintenance', 14, 'units', 4),
  ('d0000000-0000-0000-0000-000000000007', 'Beachfront Bonfire Wood Bundles', 'maintenance', 50, 'bundles', 15)
on conflict (item_name) do update set
  stock_qty = excluded.stock_qty,
  reorder_at = excluded.reorder_at;


-- ==============================================================================
-- 7. RESORT CUSTOMER ORDERS
-- ==============================================================================
insert into public.resort_orders (id, guest_id, item_name, category, price_php, notes, status, created_at) values
  ('e0000000-0000-0000-0000-000000000001', '44444444-4444-4444-4444-444444444441', 'Bolinao Grilled Bangus Platter (Large)', 'Dining', 1850, 'For Unit TEV dinner gathering. Extra calamansi.', 'delivering', now() - interval '45 minutes'),
  ('e0000000-0000-0000-0000-000000000002', '44444444-4444-4444-4444-444444444441', 'Fresh Buko Juice in Shell (x6)', 'Dining', 720, 'Chilled with bamboo straws', 'delivered', now() - interval '2 hours'),
  ('e0000000-0000-0000-0000-000000000003', '44444444-4444-4444-4444-444444444442', 'Beachside Bonfire & Marshmallow Setup', 'Amenity', 850, 'Setup at beachfront area in front of Habagat Suite', 'preparing', now() - interval '1 hour'),
  ('e0000000-0000-0000-0000-000000000004', '44444444-4444-4444-4444-444444444442', 'Patar Island Hopping Outrigger (Half-day)', 'Tour', 2200, 'Departure tomorrow 8:00 AM from Patar dock', 'placed', now() - interval '3 hours')
on conflict (id) do update set
  status = excluded.status,
  price_php = excluded.price_php;


-- ==============================================================================
-- 8. SMS NOTIFICATIONS LOGS
-- ==============================================================================
insert into public.notifications (id, profile_id, reservation_id, channel, to_phone, body, status, sent_at) values
  ('f0000000-0000-0000-0000-000000000001', '44444444-4444-4444-4444-444444444441', 'a0000000-0000-0000-0000-000000000001', 'sms', '+63 918 555 0101', 'Mabuhay Juan! Your stay at J & D Beach House (Unit TEV Grand Villa) is confirmed. Your digital check-in pass is ready.', 'delivered', now() - interval '2 days'),
  ('f0000000-0000-0000-0000-000000000002', '44444444-4444-4444-4444-444444444442', 'a0000000-0000-0000-0000-000000000002', 'sms', '+63 922 555 0104', 'Mabuhay David! Your reservation for Habagat Sea-View Suite is confirmed. Front desk is open 24/7.', 'delivered', now() - interval '1 day')
on conflict (id) do update set
  status = excluded.status;

-- ==============================================================================
-- 9. RESORT SERVICES CATALOG
-- ==============================================================================
create table if not exists public.resort_services (
  id           uuid primary key default gen_random_uuid(),
  category     text not null,
  name         text not null unique,
  price_php    int not null default 0,
  icon         text not null default '✨',
  is_active    boolean not null default true,
  created_at   timestamptz not null default now()
);

alter table public.resort_services enable row level security;
drop policy if exists "services: public read active" on public.resort_services;
create policy "services: public read active" on public.resort_services for select using (is_active or is_admin_or_staff());

insert into public.resort_services (id, name, category, price_php, icon, is_active) values
  ('70000000-0000-0000-0000-000000000001', 'Bolinao Grilled Bangus Breakfast', 'Dining', 380, '🐟', true),
  ('70000000-0000-0000-0000-000000000002', 'Fresh Buko Juice in Shell', 'Dining', 120, '🥥', true),
  ('70000000-0000-0000-0000-000000000003', 'Extra Beach Towels (Set of 2)', 'Amenity', 0, '🧺', true),
  ('70000000-0000-0000-0000-000000000004', 'Beachside Bonfire & Marshmallow Setup', 'Amenity', 850, '🔥', true),
  ('70000000-0000-0000-0000-000000000005', 'Patar Island Hopping Outrigger (Half-day)', 'Tour', 2200, '⛵', true),
  ('70000000-0000-0000-0000-000000000006', 'Cape Bolinao & Falls Guided Shuttle', 'Tour', 1400, '🗺️', true),
  ('70000000-0000-0000-0000-000000000007', 'Beachfront Sunset Kayak Rental (1 hr)', 'Tour', 450, '🚣', true),
  ('70000000-0000-0000-0000-000000000008', 'Bolinao Seafood Boodle Fight (Good for 6-8)', 'Dining', 3200, '🍤', true)
on conflict (name) do update set
  price_php = excluded.price_php,
  icon = excluded.icon,
  category = excluded.category,
  is_active = excluded.is_active;

-- Summary query to verify everything is populated
select 'rooms' as entity, count(*) as count from public.rooms
union all
select 'profiles', count(*) from public.profiles
union all
select 'reservations', count(*) from public.reservations
union all
select 'reviews', count(*) from public.reviews
union all
select 'department_tasks', count(*) from public.department_tasks
union all
select 'resort_inventory', count(*) from public.resort_inventory
union all
select 'resort_orders', count(*) from public.resort_orders
union all
select 'notifications', count(*) from public.notifications
union all
select 'resort_services', count(*) from public.resort_services;
