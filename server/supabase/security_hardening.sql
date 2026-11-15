-- ============================================================================
-- Rock View Beach Resort — RLS Security Hardening
-- ----------------------------------------------------------------------------
-- Closes two holes found in the live schema:
--   1. A customer could promote themselves to administrator by updating their
--      own profiles.role (the UPDATE policy has no column guard).
--   2. profiles were world-readable (Public profiles read USING (true)), exposing
--      every user's email, role, and phone.
--
-- Safe to run on the live database now — it does not touch employee_accounts or
-- audit_logs (see the note at the bottom; those need a code change first).
-- Apply in the Supabase SQL editor. Idempotent.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Block self-service role escalation.
--    Only the service role (the API server's key) may change a profile's role.
--    A normal signed-in user can still edit their own name/phone/avatar, but any
--    attempt to change `role` is rejected. Promote staff through the server.
-- ----------------------------------------------------------------------------
create or replace function public.prevent_role_escalation()
  returns trigger
  language plpgsql
  security definer
  set search_path = public
as $$
begin
  if NEW.role is distinct from OLD.role
     and coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'Changing profile role is not permitted; roles are managed by staff tooling.'
      using errcode = 'insufficient_privilege';
  end if;
  return NEW;
end;
$$;

drop trigger if exists trg_prevent_role_escalation on public.profiles;
create trigger trg_prevent_role_escalation
  before update on public.profiles
  for each row execute function public.prevent_role_escalation();

-- ----------------------------------------------------------------------------
-- 2. Stop exposing every profile to the public.
--    A profile is readable by its owner and by staff; the server (service role)
--    bypasses RLS, so review/reservation joins done server-side are unaffected.
--    Public review cards already carry the reviewer's name in reviews.guest_name,
--    so they do not need to read other users' profiles.
-- ----------------------------------------------------------------------------
drop policy if exists "Public profiles read" on public.profiles;
create policy "Profiles readable by owner or staff" on public.profiles for select
  using (
    auth.uid() = id
    or public.get_auth_role() = any (array['staff','receptionist','accounting','administrator'])
  );

-- ----------------------------------------------------------------------------
-- NOT INCLUDED HERE — needs a code change first, do not paste blindly:
--
--   employee_accounts (and audit_logs) are currently read/written directly from
--   the browser with the anon key as a fallback (see client/src/lib/api.ts and
--   client/src/context/AuthContext.tsx). employee_accounts holds staff logins
--   and a `password` column. If RLS is disabled on it, those rows are readable
--   by anyone with the public anon key.
--
--   The fix is two-part and must land together:
--     a) Route ALL employee_accounts / audit_logs access through the server
--        (service role) and delete the supabase-direct fallbacks in the client.
--     b) THEN run, in a follow-up migration:
--           alter table public.employee_accounts enable row level security;
--           alter table public.audit_logs       enable row level security;
--        (no permissive policy — the service role still has full access, the
--         browser gets none.)
--
--   Running (b) before (a) will break staff login, staff management, and audit
--   logging, so it is intentionally left out of this file.
-- ----------------------------------------------------------------------------
