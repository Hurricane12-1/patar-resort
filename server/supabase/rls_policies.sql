-- ============================================================================
-- J & D Beach House — Row-Level Security policies
-- ============================================================================
-- Your repository shipped with NO row-level security. The Express API protects
-- itself with the service-role key (which bypasses RLS), but anything the
-- browser does with the ANON key — the guest portal reading rooms, writing
-- audit_logs, flipping a reservation to "disputed" — is only as safe as the
-- policies below. This file adds them.
--
-- HOW TO APPLY
--   1. Review it. Do NOT run it blind against production.
--   2. Run in a staging project first (Supabase SQL editor), or — once the
--      Supabase MCP is connected — have it apply and verify each policy.
--   3. It is idempotent: every policy is dropped-if-exists then recreated, so
--      you can re-run after edits.
--
-- BEHAVIOUR CHANGES YOU MUST KNOW ABOUT (these intentionally close holes):
--   • audit_logs: the browser can no longer INSERT. Audit entries must be
--     written by the server (service role). Move the client-side
--     supabase.from('audit_logs').insert(...) in GuestPortalContext to a
--     server endpoint.
--   • reservations: the browser can no longer UPDATE (e.g. set 'disputed').
--     Route the dispute action through a server endpoint instead.
--   • reservations SELECT is now owner/staff only, so the public availability
--     calendar must read the PII-free `public.room_availability` VIEW defined
--     below instead of selecting from `reservations` directly.
-- Each of these is a small follow-up; until done, those specific client calls
-- will start returning permission errors (which is the point — they were the
-- vulnerability).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 0. Role helpers  (SECURITY DEFINER so policies on `profiles` that call them
--    do not recurse into `profiles`' own RLS).
-- ----------------------------------------------------------------------------
create or replace function public.jd_role()
returns text language sql stable security definer set search_path = public as $$
  select coalesce(
    (select lower(role) from public.profiles where id = auth.uid()),
    (select lower(role) from public.employee_accounts
       where auth_user_id = auth.uid() and is_active = true limit 1),
    'anon'
  );
$$;

create or replace function public.jd_is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select public.jd_role() in ('administrator', 'admin');
$$;

create or replace function public.jd_is_staff()
returns boolean language sql stable security definer set search_path = public as $$
  select public.jd_role() in (
    'administrator','admin','accounting','receptionist','staff',
    'housekeeping','kitchen','tours','maintenance','front_desk'
  );
$$;

create or replace function public.jd_is_finance()
returns boolean language sql stable security definer set search_path = public as $$
  select public.jd_role() in ('administrator','admin','accounting');
$$;

-- ----------------------------------------------------------------------------
-- 1. profiles  — users see/edit only their own row; admins see all.
--    A trigger stops a non-admin from escalating their own `role`.
-- ----------------------------------------------------------------------------
alter table public.profiles enable row level security;

drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles for select
  using (id = auth.uid() or public.jd_is_staff());

drop policy if exists profiles_insert on public.profiles;
create policy profiles_insert on public.profiles for insert
  with check (id = auth.uid() or public.jd_is_admin());

drop policy if exists profiles_update on public.profiles;
create policy profiles_update on public.profiles for update
  using (id = auth.uid() or public.jd_is_admin())
  with check (id = auth.uid() or public.jd_is_admin());

drop policy if exists profiles_delete on public.profiles;
create policy profiles_delete on public.profiles for delete
  using (public.jd_is_admin());

-- Prevent privilege escalation: only an admin may change a profile's role.
create or replace function public.jd_guard_profile_role()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.role is distinct from old.role and not public.jd_is_admin() then
    new.role := old.role; -- silently keep the old role for non-admins
  end if;
  return new;
end;
$$;
drop trigger if exists jd_guard_profile_role on public.profiles;
create trigger jd_guard_profile_role before update on public.profiles
  for each row execute function public.jd_guard_profile_role();

-- ----------------------------------------------------------------------------
-- 2. employee_accounts — holds password hashes: readable only by the owner
--    (their own row) or an admin. Only admins may write.
-- ----------------------------------------------------------------------------
alter table public.employee_accounts enable row level security;

drop policy if exists employee_accounts_select on public.employee_accounts;
create policy employee_accounts_select on public.employee_accounts for select
  using (auth_user_id = auth.uid() or public.jd_is_admin());

drop policy if exists employee_accounts_write on public.employee_accounts;
create policy employee_accounts_write on public.employee_accounts for all
  using (public.jd_is_admin())
  with check (public.jd_is_admin());

-- ----------------------------------------------------------------------------
-- 3. rooms — public catalog: anyone may read; staff edit, admins add/remove.
-- ----------------------------------------------------------------------------
alter table public.rooms enable row level security;

drop policy if exists rooms_select on public.rooms;
create policy rooms_select on public.rooms for select using (true);

drop policy if exists rooms_update on public.rooms;
create policy rooms_update on public.rooms for update
  using (public.jd_is_staff()) with check (public.jd_is_staff());

drop policy if exists rooms_insert on public.rooms;
create policy rooms_insert on public.rooms for insert
  with check (public.jd_is_admin());

drop policy if exists rooms_delete on public.rooms;
create policy rooms_delete on public.rooms for delete
  using (public.jd_is_admin());

-- ----------------------------------------------------------------------------
-- 4. reservations — a guest sees/creates only their own; staff act on any.
--    No direct guest UPDATE (cancellations/disputes go through the server).
-- ----------------------------------------------------------------------------
alter table public.reservations enable row level security;

drop policy if exists reservations_select on public.reservations;
create policy reservations_select on public.reservations for select
  using (guest_id = auth.uid() or public.jd_is_staff());

drop policy if exists reservations_insert on public.reservations;
create policy reservations_insert on public.reservations for insert
  with check (guest_id = auth.uid() or public.jd_is_staff());

drop policy if exists reservations_update on public.reservations;
create policy reservations_update on public.reservations for update
  using (public.jd_is_staff()) with check (public.jd_is_staff());

drop policy if exists reservations_delete on public.reservations;
create policy reservations_delete on public.reservations for delete
  using (public.jd_is_admin());

-- PII-free availability source for the public booking calendar. Exposes only
-- what is needed to grey out taken dates — never guest identity. The booking
-- UI should read this instead of selecting from `reservations` directly.
create or replace view public.room_availability
  with (security_invoker = false) as
  select room_id, check_in, check_out, status
  from public.reservations
  where status in ('pending', 'confirmed', 'checked_in');
grant select on public.room_availability to anon, authenticated;

-- ----------------------------------------------------------------------------
-- 5. resort_orders (dining & tours) — owner or staff.
-- ----------------------------------------------------------------------------
alter table public.resort_orders enable row level security;

drop policy if exists resort_orders_select on public.resort_orders;
create policy resort_orders_select on public.resort_orders for select
  using (guest_id = auth.uid() or public.jd_is_staff());

drop policy if exists resort_orders_insert on public.resort_orders;
create policy resort_orders_insert on public.resort_orders for insert
  with check (guest_id = auth.uid() or public.jd_is_staff());

drop policy if exists resort_orders_modify on public.resort_orders;
create policy resort_orders_modify on public.resort_orders for update
  using (public.jd_is_staff()) with check (public.jd_is_staff());

-- ----------------------------------------------------------------------------
-- 6. chat_messages — a guest sees only their own transcript; staff see all.
-- ----------------------------------------------------------------------------
alter table public.chat_messages enable row level security;

drop policy if exists chat_messages_select on public.chat_messages;
create policy chat_messages_select on public.chat_messages for select
  using (profile_id = auth.uid() or public.jd_is_staff());

drop policy if exists chat_messages_insert on public.chat_messages;
create policy chat_messages_insert on public.chat_messages for insert
  with check (profile_id = auth.uid() or public.jd_is_staff());

-- ----------------------------------------------------------------------------
-- 7. reviews — public to read; a guest may write/edit only their own.
-- ----------------------------------------------------------------------------
alter table public.reviews enable row level security;

drop policy if exists reviews_select on public.reviews;
create policy reviews_select on public.reviews for select using (true);

drop policy if exists reviews_insert on public.reviews;
create policy reviews_insert on public.reviews for insert
  with check (guest_id = auth.uid());

drop policy if exists reviews_update on public.reviews;
create policy reviews_update on public.reviews for update
  using (guest_id = auth.uid() or public.jd_is_staff())
  with check (guest_id = auth.uid() or public.jd_is_staff());

drop policy if exists reviews_delete on public.reviews;
create policy reviews_delete on public.reviews for delete
  using (public.jd_is_staff());

-- ----------------------------------------------------------------------------
-- 8. notifications — a guest reads only their own; the server creates them.
-- ----------------------------------------------------------------------------
alter table public.notifications enable row level security;

drop policy if exists notifications_select on public.notifications;
create policy notifications_select on public.notifications for select
  using (profile_id = auth.uid() or public.jd_is_staff());

drop policy if exists notifications_update on public.notifications;
create policy notifications_update on public.notifications for update
  using (profile_id = auth.uid() or public.jd_is_staff())
  with check (profile_id = auth.uid() or public.jd_is_staff());

drop policy if exists notifications_insert on public.notifications;
create policy notifications_insert on public.notifications for insert
  with check (public.jd_is_staff()); -- the server (service role) bypasses RLS

-- ----------------------------------------------------------------------------
-- 9. Staff-only operational tables.
-- ----------------------------------------------------------------------------
alter table public.department_tasks enable row level security;
drop policy if exists department_tasks_rw on public.department_tasks;
create policy department_tasks_rw on public.department_tasks for all
  using (public.jd_is_staff()) with check (public.jd_is_staff());

alter table public.resort_inventory enable row level security;
drop policy if exists resort_inventory_rw on public.resort_inventory;
create policy resort_inventory_rw on public.resort_inventory for all
  using (public.jd_is_staff()) with check (public.jd_is_staff());

-- price_change_requests: staff create & view, only admins approve/delete.
alter table public.price_change_requests enable row level security;
drop policy if exists pcr_select on public.price_change_requests;
create policy pcr_select on public.price_change_requests for select
  using (public.jd_is_staff());
drop policy if exists pcr_insert on public.price_change_requests;
create policy pcr_insert on public.price_change_requests for insert
  with check (public.jd_is_staff());
drop policy if exists pcr_update on public.price_change_requests;
create policy pcr_update on public.price_change_requests for update
  using (public.jd_is_admin()) with check (public.jd_is_admin());
drop policy if exists pcr_delete on public.price_change_requests;
create policy pcr_delete on public.price_change_requests for delete
  using (public.jd_is_admin());

-- ----------------------------------------------------------------------------
-- 10. ledger_entries — finance & admin only.
-- ----------------------------------------------------------------------------
alter table public.ledger_entries enable row level security;
drop policy if exists ledger_entries_rw on public.ledger_entries;
create policy ledger_entries_rw on public.ledger_entries for all
  using (public.jd_is_finance()) with check (public.jd_is_finance());

-- ----------------------------------------------------------------------------
-- 11. audit_logs — APPEND-ONLY, server-written, admin-readable.
--     Clients (anon/authenticated) may do nothing; the server's service-role
--     key bypasses RLS, so server-side logging keeps working.
-- ----------------------------------------------------------------------------
alter table public.audit_logs enable row level security;

drop policy if exists audit_logs_select on public.audit_logs;
create policy audit_logs_select on public.audit_logs for select
  using (public.jd_is_admin());

drop policy if exists audit_logs_no_insert on public.audit_logs;
create policy audit_logs_no_insert on public.audit_logs for insert
  with check (false);

drop policy if exists audit_logs_no_update on public.audit_logs;
create policy audit_logs_no_update on public.audit_logs for update
  using (false);

drop policy if exists audit_logs_no_delete on public.audit_logs;
create policy audit_logs_no_delete on public.audit_logs for delete
  using (false);

-- ============================================================================
-- End. After applying, verify with (as an anon/guest token, NOT service role):
--   select * from public.reservations;        -- should return only your own
--   insert into public.audit_logs (...) ...;   -- should be denied
--   update public.profiles set role='admin';   -- role must stay unchanged
-- The Supabase MCP can run these checks for you once connected.
-- ============================================================================
