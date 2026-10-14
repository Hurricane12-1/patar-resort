-- ============================================================
-- J & D Beach House · Bolinao · Full Schema with Rooms, Stays,
-- Department Tasks, Customer Orders, Analytics, RLS & Multi-Role Staff
-- ============================================================
create extension if not exists "pgcrypto";
create extension if not exists "btree_gist";

-- ---------- ENUMS ----------
create type stay_status       as enum ('pending','confirmed','checked_in','checked_out','cancelled','no_show');
create type notif_status      as enum ('queued','sent','delivered','failed');
create type user_role         as enum ('customer','staff','receptionist','accounting','administrator');
create type chat_role         as enum ('user','bot');
create type dept_name         as enum ('front_desk','housekeeping','kitchen','tours','maintenance');
create type task_priority     as enum ('low','normal','high','urgent');
create type task_status       as enum ('pending','in_progress','completed','cancelled');
create type order_status      as enum ('placed','preparing','delivering','delivered','cancelled');

-- ---------- TABLES ----------
create table profiles (
  id                 uuid primary key references auth.users(id) on delete cascade,
  first_name         text not null default '',
  middle_name        text not null default '',
  last_name          text not null default '',
  full_name          text not null default '',
  phone              text,
  address            text not null default '',
  city               text not null default '',
  emergency_contact  text not null default '',
  role               user_role not null default 'customer',
  created_at         timestamptz not null default now()
);

create table rooms (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  slug         text unique not null,
  category     text not null,               -- Cottage | Garden | Suite | Villa | Dorm
  description  text not null default '',
  capacity     int  not null check (capacity > 0),   -- sleeps N
  units        int  not null check (units > 0),      -- physical rooms of this type
  rate_php     int  not null check (rate_php > 0),   -- per night
  amenities    text[] not null default '{}',
  is_active    boolean not null default true,
  rating_avg   numeric(3,2) not null default 0,      -- denormalized by trigger
  rating_count int not null default 0,
  created_at   timestamptz not null default now()
);

create table reservations (
  id          uuid primary key default gen_random_uuid(),
  guest_id    uuid not null references profiles(id) on delete cascade,
  room_id     uuid not null references rooms(id),
  check_in    date not null,
  check_out   date not null,
  nights          int  generated always as (check_out - check_in) stored,
  guests          int  not null check (guests > 0),
  status          stay_status not null default 'pending',
  payment_status  text not null default 'unpaid' check (payment_status in ('unpaid','partial','paid')),
  downpayment_php int  not null default 0 check (downpayment_php >= 0),
  total_php       int  not null check (total_php >= 0),
  co_guests       text[] not null default '{}',
  sub_unit_note   text,
  notes           text not null default '',
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  check (check_out > check_in)
);
create index res_guest_idx   on reservations(guest_id);
create index res_room_idx    on reservations(room_id);
create index res_checkin_idx on reservations(check_in);

-- HARD OVERBOOKING GUARD — one unit per room-type per night, enforced by Postgres
alter table reservations add constraint no_overbooking
  exclude using gist (
    room_id with =,
    daterange(check_in, check_out) with &&
  ) where (status in ('pending','confirmed','checked_in'));

create table reviews (
  id             uuid primary key default gen_random_uuid(),
  reservation_id uuid not null unique references reservations(id) on delete cascade,
  guest_id       uuid not null references profiles(id) on delete cascade,
  room_id        uuid not null references rooms(id) on delete cascade,
  rating         int  not null check (rating between 1 and 5),
  comment        text not null default '',
  created_at     timestamptz not null default now()
);

create table notifications (
  id             uuid primary key default gen_random_uuid(),
  profile_id     uuid not null references profiles(id) on delete cascade,
  reservation_id uuid references reservations(id) on delete cascade,
  channel        text not null default 'sms',
  to_phone       text not null,
  body           text not null,
  status         notif_status not null default 'queued',
  provider_sid   text,
  created_at     timestamptz not null default now(),
  sent_at        timestamptz
);

create table chat_messages (
  id         uuid primary key default gen_random_uuid(),
  profile_id uuid references profiles(id) on delete cascade,
  role       chat_role not null,
  content    text not null,
  created_at timestamptz not null default now()
);

-- DEPARTMENT OPERATIONS TASKS
create table department_tasks (
  id           uuid primary key default gen_random_uuid(),
  department   dept_name not null,
  title        text not null,
  room_id      uuid references rooms(id) on delete set null,
  room_name    text,
  priority     task_priority not null default 'normal',
  status       task_status not null default 'pending',
  assigned_to  text,
  created_by   uuid references profiles(id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- RESORT CUSTOMER SERVICE ORDERS
create table resort_orders (
  id           uuid primary key default gen_random_uuid(),
  guest_id     uuid not null references profiles(id) on delete cascade,
  item_name    text not null,
  category     text not null,               -- Dining | Amenity | Tour | Shuttle
  price_php    int  not null default 0,
  notes        text not null default '',
  status       order_status not null default 'placed',
  created_at   timestamptz not null default now()
);

-- RESORT INVENTORY TRACKER
create table resort_inventory (
  id           uuid primary key default gen_random_uuid(),
  item_name    text not null unique,
  category     dept_name not null,
  stock_qty    int not null check (stock_qty >= 0),
  unit         text not null default 'pcs',
  reorder_at   int not null default 10,
  updated_at   timestamptz not null default now()
);

-- ---------- TRIGGERS ----------
create or replace function handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_first text;
  v_middle text;
  v_last text;
  v_full text;
begin
  v_first  := coalesce(new.raw_user_meta_data->>'first_name', '');
  v_middle := coalesce(new.raw_user_meta_data->>'middle_name', '');
  v_last   := coalesce(new.raw_user_meta_data->>'last_name', '');
  v_full   := coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', trim(concat(v_first, ' ', v_middle, ' ', v_last)));

  insert into public.profiles (id, first_name, middle_name, last_name, full_name, phone, address, city, emergency_contact, role)
  values (new.id,
          v_first,
          v_middle,
          v_last,
          v_full,
          coalesce(new.raw_user_meta_data->>'phone', ''),
          coalesce(new.raw_user_meta_data->>'address', ''),
          coalesce(new.raw_user_meta_data->>'city', ''),
          coalesce(new.raw_user_meta_data->>'emergency_contact', ''),
          coalesce((new.raw_user_meta_data->>'role')::user_role, 'customer'));
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function handle_new_user();

create or replace function touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;
create trigger trg_res_touch before update on reservations
  for each row execute function touch_updated_at();

create or replace function sync_room_rating()
returns trigger language plpgsql security definer set search_path = public as $$
declare target uuid;
begin
  target := coalesce(new.room_id, old.room_id);
  update rooms r set
    rating_avg   = coalesce((select round(avg(rating)::numeric,2) from reviews v where v.room_id = target),0),
    rating_count = (select count(*) from reviews v where v.room_id = target)
  where r.id = target;
  return null;
end $$;
create trigger trg_sync_rating after insert or delete on reviews
  for each row execute function sync_room_rating();

-- ---------- AVAILABILITY RPC ----------
create or replace function available_rooms(
  p_check_in  date,
  p_check_out date,
  p_guests    int default 1
)
returns table (room_id uuid, name text, category text, capacity int,
               rate_php int, units_left int, rating_avg numeric)
language sql stable as $$
  select r.id, r.name, r.category, r.capacity, r.rate_php,
         (r.units - coalesce(peak.busy, 0))::int as units_left,
         r.rating_avg
  from rooms r
  left join lateral (
    select max(per_night.c) as busy from (
      select count(*) as c
      from generate_series(p_check_in, p_check_out - 1, interval '1 day') n(night)
      join reservations res
        on res.room_id = r.id
       and res.status in ('pending','confirmed','checked_in')
       and n.night::date >= res.check_in
       and n.night::date <  res.check_out
      group by n.night
    ) per_night
  ) peak on true
  where r.is_active
    and r.capacity >= p_guests
    and p_check_out > p_check_in
    and p_check_in >= current_date
  order by r.rate_php;
$$;

-- ---------- ANALYTICS VIEWS ----------
create or replace view analytics_overview as
select
  (select count(*) from reservations
     where check_in = current_date  and status in ('confirmed','checked_in'))            as arrivals_today,
  (select count(*) from reservations
     where check_out = current_date and status in ('confirmed','checked_in'))            as departures_today,
  (select coalesce(round(100.0 * count(*) /
     nullif((select sum(units) from rooms where is_active), 0)), 0)::int
     from reservations
     where status in ('confirmed','checked_in')
       and current_date >= check_in and current_date < check_out)                        as occupancy_pct,
  (select coalesce(sum(total_php),0)::int from reservations
     where status in ('confirmed','checked_in','checked_out')
       and check_in >= date_trunc('week', now()))                                        as revenue_week_php,
  (select coalesce(avg(rating),0)::numeric(3,2) from reviews)                            as avg_rating,
  (select count(*) from notifications where status = 'delivered')                        as sms_delivered,
  (select count(*) from reservations where status <> 'cancelled')                        as stays_total;

create or replace view analytics_daily as
select d::date as day,
       d::date >= current_date as is_forecast,
       count(res.id)::int as nights_sold,
       coalesce(sum(round(res.total_php::numeric
         / nullif(res.check_out - res.check_in, 0))), 0)::int as revenue_php
from generate_series(current_date - 13, current_date + 6, interval '1 day') d
left join reservations res
  on res.status in ('confirmed','checked_in','checked_out')
 and d::date >= res.check_in and d::date < res.check_out
group by 1, 2 order by 1;

create or replace view analytics_top_rooms as
select r.id, r.name,
       count(res.id)::int as stays,
       coalesce(sum(res.total_php)
         filter (where res.status in ('confirmed','checked_in','checked_out')), 0)::int as revenue_php
from rooms r left join reservations res on res.room_id = r.id
group by r.id, r.name order by stays desc limit 5;

-- ---------- ROW LEVEL SECURITY ----------
alter table profiles         enable row level security;
alter table rooms            enable row level security;
alter table reservations     enable row level security;
alter table reviews          enable row level security;
alter table notifications    enable row level security;
alter table chat_messages    enable row level security;
alter table department_tasks enable row level security;
alter table resort_orders    enable row level security;
alter table resort_inventory enable row level security;

create or replace function public.is_admin_or_staff()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role in ('administrator','receptionist','accounting','staff'));
$$;

create policy "profiles: self or admin read"   on profiles for select using (id = auth.uid() or is_admin_or_staff());
create policy "profiles: self update"          on profiles for update using (id = auth.uid());

create policy "rooms: public read active"      on rooms for select using (is_active or is_admin_or_staff());
create policy "rooms: admin write"             on rooms for all using (is_admin_or_staff()) with check (is_admin_or_staff());

create policy "res: own or admin read"         on reservations for select using (guest_id = auth.uid() or is_admin_or_staff());
create policy "res: create own"                on reservations for insert with check (guest_id = auth.uid());
create policy "res: own or admin update"       on reservations for update using (guest_id = auth.uid() or is_admin_or_staff());

create policy "reviews: public read"           on reviews for select using (true);
create policy "reviews: own insert"            on reviews for insert
  with check (guest_id = auth.uid()
    and exists (select 1 from reservations r where r.id = reservation_id and r.guest_id = auth.uid()));

create policy "notifications: own or admin"    on notifications for select using (profile_id = auth.uid() or is_admin_or_staff());

create policy "tasks: staff read write"        on department_tasks for all using (is_admin_or_staff()) with check (is_admin_or_staff());
create policy "orders: own or staff read"      on resort_orders for select using (guest_id = auth.uid() or is_admin_or_staff());
create policy "orders: own insert"             on resort_orders for insert with check (guest_id = auth.uid());
create policy "inventory: staff read write"    on resort_inventory for all using (is_admin_or_staff());

-- ---------- REALTIME ----------
alter publication supabase_realtime add table reservations;
alter publication supabase_realtime add table department_tasks;
alter publication supabase_realtime add table resort_orders;

-- ---------- SEEDS · ROOM INVENTORY ----------
insert into rooms (name, slug, category, description, capacity, units, rate_php, amenities) values
 ('Unit TEV Grand Villa','unit-tev','Villa','Grand beachfront group villa for large gatherings, family reunions, and corporate retreats. Sleeps up to 60 guests.',60,1,18000,'{AC,Sea view,Kitchen,Grill,Karaoke,Porch}'),
 ('Unit GEL Premier Suite','unit-gel','Suite','Spacious group suite overlooking the Patar white beach coastline. Sleeps up to 25 guests.',25,1,12000,'{AC,Balcony,Hot shower,WiFi,Kitchenette}'),
 ('Unit CAT Cottage (Unit Papang)','unit-cat','Cottage','Native beachfront cottage with direct sand access. Also known in physical logbooks as Unit Papang. Sleeps up to 10 guests.',10,1,6000,'{Fan,AC,WiFi,Porch,Hot shower}'),
 ('Nipa Cove Cottage','nipa-cove','Cottage','Native nipa cottage steps from the sand. Fan-cooled, porch with hammock.',2,6,1450,'{Fan,Hot shower,WiFi,Porch}'),
 ('Garden Breeze Room','garden-breeze','Garden','AC room facing the mango garden. Queen bed, breakfast included.',2,8,1850,'{AC,WiFi,Hot shower,Breakfast}'),
 ('Habagat Sea-View Suite','habagat-suite','Suite','Front suite with private balcony hanging over the water.',3,4,2950,'{AC,Sea view,Balcony,WiFi,Breakfast}'),
 ('Sunset Pavilion','sunset-pavilion','Suite','Premium king suite facing the Cape Bolinao sunset.',2,2,3600,'{AC,Sea view,King bed,Bathtub,Breakfast}'),
 ('Duyan Family Villa','duyan-villa','Villa','Two-bedroom villa with kitchenette and outdoor hammock deck.',6,3,4800,'{AC,Kitchenette,2 bedrooms,WiFi,Grill deck}'),
 ('Backpacker Bunk','backpacker-bunk','Dorm','Shared bunk for island hoppers. Locker and shared bath.',1,10,650,'{WiFi,Locker,Fan,Shared bath}');

-- ---------- SEEDS · INVENTORY ITEMS ----------
insert into resort_inventory (item_name, category, stock_qty, unit, reorder_at) values
 ('Beach Towel Sets', 'housekeeping', 85, 'sets', 20),
 ('Fresh Linen Sets (King/Queen)', 'housekeeping', 42, 'sets', 10),
 ('Bolinao Fresh Bangus', 'kitchen', 60, 'pcs', 15),
 ('Young Coconuts (Buko)', 'kitchen', 120, 'pcs', 25),
 ('Outrigger Life Jackets', 'tours', 35, 'pcs', 10),
 ('AC Air Filters & Gas', 'maintenance', 14, 'units', 4);
