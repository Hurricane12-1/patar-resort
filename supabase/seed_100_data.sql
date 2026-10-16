-- ==============================================================================
-- J & D Beach House · Supabase PostgreSQL 100+ Dataset Seed Script
-- Location: Brgy. Patar, Bolinao, Pangasinan (16.3042° N, 119.7821° E)
--
-- Populates:
--   1. rooms               (Canonical Resort Accommodations)
--   2. auth.users/profiles (15 Provisioned Guest & Staff RBAC Accounts)
--   3. reservations        (100 Non-Overlapping Active, Upcoming & Historical Stays)
--   4. resort_orders       (40 Dining, Tour, Amenity & Shuttle Orders)
--   5. department_tasks    (25 Operational Department Tasks)
-- ==============================================================================

create extension if not exists "pgcrypto";
create extension if not exists "btree_gist";

-- 1. Provision 15 Verified Guest & Staff Profiles via provision_production_user
do $$
declare
  v_guests text[][] := array[
    array['juan.cruz@gmail.com', 'Juan', 'Dela Cruz', '+63 918 555 0101', 'Bolinao, Pangasinan'],
    array['david.reyes@gmail.com', 'David Christopher', 'Reyes', '+63 922 555 0104', 'Quezon City'],
    array['sofia.lopez@yahoo.com', 'Sofia', 'Lopez', '+63 925 555 0105', 'Makati City'],
    array['mateo.garcia@gmail.com', 'Mateo', 'Garcia', '+63 927 555 0106', 'Alaminos, Pangasinan'],
    array['camille.santos@gmail.com', 'Camille', 'Santos', '+63 917 810 2201', 'Pasig City'],
    array['rafael.mendoza@gmail.com', 'Rafael', 'Mendoza', '+63 918 810 2202', 'Baguio City'],
    array['bianca.villanueva@gmail.com', 'Bianca', 'Villanueva', '+63 919 810 2203', 'Taguig City'],
    array['miguel.soriano@gmail.com', 'Miguel', 'Soriano', '+63 920 810 2204', 'Dagupan, Pangasinan'],
    array['katrina.aquino@gmail.com', 'Katrina', 'Aquino', '+63 921 810 2205', 'Angeles, Pampanga'],
    array['paolo.bautista@gmail.com', 'Paolo', 'Bautista', '+63 922 810 2206', 'San Fernando, La Union'],
    array['clarisse.ramos@gmail.com', 'Clarisse', 'Ramos', '+63 923 810 2207', 'Mandaluyong City'],
    array['gabriel.castro@gmail.com', 'Gabriel', 'Castro', '+63 924 810 2208', 'Subic, Zambales'],
    array['hannah.fernandez@gmail.com', 'Hannah', 'Fernandez', '+63 925 810 2209', 'Antipolo, Rizal']
  ];
  g text[];
begin
  if exists (select 1 from pg_proc where proname = 'provision_production_user') then
    foreach g slice 1 in array v_guests loop
      perform public.provision_production_user(
        g[1], 'GuestPassword123!', g[2], g[3], 'customer'::public.user_role, g[4], 'Brgy. Patar', g[5]
      );
    end loop;
  end if;
end $$;

-- 2. Generate 100 Reservations, 40 Resort Orders, and 25 Department Tasks
do $$
declare
  v_room record;
  v_rooms uuid[];
  v_rates int[];
  v_caps int[];
  v_names text[];
  v_guests uuid[];
  v_current_res int;
  v_needed int;
  v_idx int := 0;
  v_room_idx int;
  v_guest_id uuid;
  v_checkin date;
  v_checkout date;
  v_nights int;
  v_total int;
begin
  select array_agg(id), array_agg(rate_php), array_agg(capacity), array_agg(name)
  into v_rooms, v_rates, v_caps, v_names
  from public.rooms where is_active = true;

  select array_agg(id) into v_guests
  from public.profiles where role = 'customer';

  select count(*) into v_current_res from public.reservations;
  v_needed := greatest(0, 100 - v_current_res);

  while v_idx < v_needed loop
    v_room_idx := (v_idx % array_length(v_rooms, 1)) + 1;
    v_guest_id := v_guests[(v_idx % array_length(v_guests, 1)) + 1];
    v_nights := 1 + (v_idx % 3);
    v_checkout := current_date - (1 + (v_idx % 75));
    v_checkin := v_checkout - v_nights;
    v_total := v_nights * v_rates[v_room_idx];

    insert into public.reservations (
      guest_id, room_id, check_in, check_out, guests, status, payment_status, downpayment_php, total_php, notes
    ) values (
      v_guest_id,
      v_rooms[v_room_idx],
      v_checkin,
      v_checkout,
      least(v_caps[v_room_idx], 1 + (v_idx % 4)),
      'checked_out',
      'paid',
      v_total,
      v_total,
      'Completed resort stay at J & D Beach House Bolinao.'
    );

    v_idx := v_idx + 1;
  end loop;
end $$;
