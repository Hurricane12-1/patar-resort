-- ============================================================================
-- Rock View Beach Resort — reservations.booking_code (fixes "null value in
-- column booking_code ... violates not-null constraint")
-- ----------------------------------------------------------------------------
-- The live `reservations` table has `booking_code text NOT NULL` with no
-- default, but none of the four insert paths set it (booking route, GraphQL
-- resolver, ledger agent, client fallback). Every booking therefore failed.
--
-- This BEFORE INSERT trigger fills booking_code for all of them at once:
--   1. Reuse the reference the guest already sees on their voucher — the
--      online booking flow writes it into notes as "Ref RV-BOL-2026-6276".
--   2. If there is none (desk / admin / ledger inserts) or it is already
--      taken, mint a fresh RV-BOL-<year>-<6 hex> code and point the notes'
--      "Ref" at it, so notes, booking_code, and the dashboard all agree.
-- An explicit booking_code on the insert is always kept as-is.
--
-- SECURITY DEFINER so the uniqueness check sees every reservation, not just
-- the inserting guest's own rows under RLS. Idempotent; run in the SQL editor.
-- ============================================================================

create or replace function public.set_booking_code()
  returns trigger
  language plpgsql
  security definer
  set search_path = public
as $$
declare
  noted_ref text;
  candidate text;
begin
  if NEW.booking_code is not null and btrim(NEW.booking_code) <> '' then
    return NEW;
  end if;

  noted_ref := substring(coalesce(NEW.notes, '') from 'Ref\s+(RV-[A-Z0-9-]+)');
  candidate := noted_ref;

  while candidate is null
     or exists (select 1 from public.reservations r where r.booking_code = candidate) loop
    candidate := 'RV-BOL-'
      || to_char(coalesce(NEW.check_in, (now() at time zone 'Asia/Manila')::date), 'YYYY')
      || '-'
      || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));
  end loop;

  if noted_ref is not null and noted_ref <> candidate then
    NEW.notes := regexp_replace(NEW.notes, 'Ref\s+RV-[A-Z0-9-]+', 'Ref ' || candidate);
  end if;

  NEW.booking_code := candidate;
  return NEW;
end;
$$;

drop trigger if exists trg_set_booking_code on public.reservations;
create trigger trg_set_booking_code
  before insert on public.reservations
  for each row execute function public.set_booking_code();
