-- ==============================================================================
-- J & D BEACH HOUSE RESORT · SUPABASE POSTGRESQL MIGRATION
-- Task: 1. Add password column to public.profiles (and related account tables)
--       2. Create dedicated, isolated public.employee_accounts collection/table
--       3. Set up automated bcrypt password hashing, triggers, RLS, and seed data
-- Target: Supabase Dashboard -> SQL Editor -> New Query -> Run
-- ==============================================================================

-- Step 1: Ensure required extensions exist in Supabase
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ==============================================================================
-- PART 1: ADD PASSWORD COLUMNS TO PROFILES (AND CUSTOMERS/USERS)
-- ==============================================================================

-- 1.1 Add password and password_hash to public.profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS password TEXT DEFAULT '';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS password_hash TEXT DEFAULT '';

COMMENT ON COLUMN public.profiles.password IS 'Plain/initial password for user accounts';
COMMENT ON COLUMN public.profiles.password_hash IS 'Encrypted/bcrypt hashed password for profile authentication';

-- 1.2 Also ensure customers and users tables have password columns for consistency
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS password TEXT DEFAULT '';
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS password_hash TEXT DEFAULT '';

ALTER TABLE public.users ADD COLUMN IF NOT EXISTS password TEXT DEFAULT '';
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS password_hash TEXT DEFAULT '';

-- 1.3 Automatic password hashing trigger for public.profiles
CREATE OR REPLACE FUNCTION public.handle_profile_password_hash()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.password IS NOT NULL AND NEW.password <> '' AND (TG_OP = 'INSERT' OR NEW.password IS DISTINCT FROM OLD.password) THEN
    NEW.password_hash = crypt(NEW.password, gen_salt('bf', 10));
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_profile_password_hash ON public.profiles;
CREATE TRIGGER trg_profile_password_hash
  BEFORE INSERT OR UPDATE OF password ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.handle_profile_password_hash();


-- ==============================================================================
-- PART 2: DEDICATED ISOLATED EMPLOYEE ACCOUNTS COLLECTION / TABLE
-- ==============================================================================

-- 2.1 Create the dedicated public.employee_accounts table
CREATE TABLE IF NOT EXISTS public.employee_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  employee_id TEXT UNIQUE NOT NULL,
  first_name TEXT NOT NULL DEFAULT '',
  middle_name TEXT DEFAULT '',
  last_name TEXT NOT NULL DEFAULT '',
  full_name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password TEXT DEFAULT '',
  password_hash TEXT DEFAULT '',
  role TEXT NOT NULL DEFAULT 'staff' CHECK (role IN (
    'administrator', 'admin', 'manager', 'receptionist', 'frontdesk',
    'staff', 'accounting', 'housekeeping', 'kitchen', 'maintenance', 'security'
  )),
  department TEXT NOT NULL DEFAULT 'front_desk' CHECK (department IN (
    'front_desk', 'housekeeping', 'kitchen', 'tours', 'maintenance',
    'accounting', 'management', 'security'
  )),
  position TEXT NOT NULL DEFAULT 'Staff',
  phone TEXT DEFAULT '',
  emergency_contact TEXT DEFAULT '',
  avatar_url TEXT DEFAULT '',
  salary_rate_php NUMERIC DEFAULT 0 CHECK (salary_rate_php >= 0),
  hire_date DATE DEFAULT CURRENT_DATE,
  shift TEXT DEFAULT 'Day Shift' CHECK (shift IN (
    'Day Shift', 'Night Shift', 'Graveyard Shift', 'Rotating', 'On Call'
  )),
  is_active BOOLEAN DEFAULT true,
  status TEXT DEFAULT 'active' CHECK (status IN (
    'active', 'on_leave', 'suspended', 'resigned', 'terminated'
  )),
  notes TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

COMMENT ON TABLE public.employee_accounts IS 'Isolated Employee Accounts Collection for Staff, Management, and Executive Administration';
COMMENT ON COLUMN public.employee_accounts.employee_id IS 'Unique company employee code (e.g. EMP-2026-001)';
COMMENT ON COLUMN public.employee_accounts.password IS 'Plain/initial employee password';
COMMENT ON COLUMN public.employee_accounts.password_hash IS 'Secure bcrypt hash of employee password';

-- 2.2 Create indexes for fast lookup and filtering
CREATE INDEX IF NOT EXISTS idx_employee_accounts_email ON public.employee_accounts(email);
CREATE INDEX IF NOT EXISTS idx_employee_accounts_employee_id ON public.employee_accounts(employee_id);
CREATE INDEX IF NOT EXISTS idx_employee_accounts_role ON public.employee_accounts(role);
CREATE INDEX IF NOT EXISTS idx_employee_accounts_department ON public.employee_accounts(department);
CREATE INDEX IF NOT EXISTS idx_employee_accounts_status ON public.employee_accounts(status);
CREATE INDEX IF NOT EXISTS idx_employee_accounts_auth_user ON public.employee_accounts(auth_user_id);

-- 2.3 Automatic timestamp & password hashing trigger for employee_accounts
CREATE OR REPLACE FUNCTION public.handle_employee_account_lifecycle()
RETURNS TRIGGER AS $$
BEGIN
  -- Always keep updated_at in sync
  NEW.updated_at = now();

  -- Auto-generate full_name if missing
  IF (NEW.full_name IS NULL OR TRIM(NEW.full_name) = '') THEN
    NEW.full_name = TRIM(CONCAT(NEW.first_name, ' ', NEW.middle_name, ' ', NEW.last_name));
    IF NEW.full_name = '' THEN
      NEW.full_name = SPLIT_PART(NEW.email, '@', 1);
    END IF;
  END IF;

  -- Auto-hash password if plain password is provided or modified
  IF NEW.password IS NOT NULL AND NEW.password <> '' AND (TG_OP = 'INSERT' OR NEW.password IS DISTINCT FROM OLD.password) THEN
    NEW.password_hash = crypt(NEW.password, gen_salt('bf', 10));
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_employee_accounts_lifecycle ON public.employee_accounts;
CREATE TRIGGER trg_employee_accounts_lifecycle
  BEFORE INSERT OR UPDATE ON public.employee_accounts
  FOR EACH ROW EXECUTE FUNCTION public.handle_employee_account_lifecycle();


-- Step 1.1: Ensure 'manager' is added to public.user_role ENUM if it exists
DO $$ BEGIN
  ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'manager';
EXCEPTION WHEN undefined_object THEN null;
END $$;

-- ==============================================================================
-- PART 3: ROW LEVEL SECURITY (RLS) POLICIES
-- ==============================================================================

ALTER TABLE public.employee_accounts ENABLE ROW LEVEL SECURITY;

-- 3.1 Service role has full unrestricted access
DROP POLICY IF EXISTS "Service role full access to employee_accounts" ON public.employee_accounts;
CREATE POLICY "Service role full access to employee_accounts"
  ON public.employee_accounts FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- 3.2 Administrators and Managers can view and manage all employee records
DROP POLICY IF EXISTS "Admins can manage all employee_accounts" ON public.employee_accounts;
CREATE POLICY "Admins can manage all employee_accounts"
  ON public.employee_accounts FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role::text IN ('administrator', 'admin', 'manager')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role::text IN ('administrator', 'admin', 'manager')
    )
  );

-- 3.3 Individual employee can view their own profile
DROP POLICY IF EXISTS "Employee can view own record" ON public.employee_accounts;
CREATE POLICY "Employee can view own record"
  ON public.employee_accounts FOR SELECT
  TO authenticated
  USING (
    auth_user_id = auth.uid()
    OR email = (auth.jwt() ->> 'email')
  );


-- ==============================================================================
-- PART 4: SEED STANDARD RESORT EMPLOYEE ACCOUNTS (READY TO MANAGE)
-- ==============================================================================

INSERT INTO public.employee_accounts (
  employee_id, first_name, last_name, full_name, email, password, role, department, position, phone, salary_rate_php, shift, status
)
VALUES
  (
    'EMP-2026-001',
    'Executive',
    'Director',
    'Executive Director',
    'admin@janddbeachhouse.ph',
    'AdminPassword2026!',
    'administrator',
    'management',
    'General Manager & Owner',
    '09171234567',
    75000.00,
    'Day Shift',
    'active'
  ),
  (
    'EMP-2026-002',
    'Maria',
    'Santos',
    'Maria Santos (Front Desk)',
    'receptionist@janddbeachhouse.ph',
    'StaffPassword2026!',
    'receptionist',
    'front_desk',
    'Head Receptionist & Concierge',
    '09181234567',
    28000.00,
    'Day Shift',
    'active'
  ),
  (
    'EMP-2026-003',
    'Carlos',
    'Reyes',
    'Carlos Reyes (Accounting)',
    'accounting@janddbeachhouse.ph',
    'StaffPassword2026!',
    'accounting',
    'accounting',
    'Senior Resort Accountant & Cashier',
    '09191234567',
    35000.00,
    'Day Shift',
    'active'
  ),
  (
    'EMP-2026-004',
    'Elena',
    'Cruz',
    'Elena Cruz (Housekeeping)',
    'housekeeping@janddbeachhouse.ph',
    'StaffPassword2026!',
    'housekeeping',
    'housekeeping',
    'Housekeeping & Villa Care Supervisor',
    '09201234567',
    24000.00,
    'Day Shift',
    'active'
  ),
  (
    'EMP-2026-005',
    'Ramon',
    'Bautista',
    'Ramon Bautista (Kitchen)',
    'kitchen@janddbeachhouse.ph',
    'StaffPassword2026!',
    'kitchen',
    'kitchen',
    'Executive Head Chef',
    '09211234567',
    38000.00,
    'Day Shift',
    'active'
  ),
  (
    'EMP-2026-006',
    'Danilo',
    'Mendoza',
    'Danilo Mendoza (Maintenance)',
    'maintenance@janddbeachhouse.ph',
    'StaffPassword2026!',
    'maintenance',
    'maintenance',
    'Facilities & Safety Lead',
    '09221234567',
    26000.00,
    'Day Shift',
    'active'
  )
ON CONFLICT (employee_id) DO UPDATE SET
  full_name = EXCLUDED.full_name,
  password = EXCLUDED.password,
  role = EXCLUDED.role,
  department = EXCLUDED.department,
  position = EXCLUDED.position,
  phone = EXCLUDED.phone,
  salary_rate_php = EXCLUDED.salary_rate_php,
  status = EXCLUDED.status,
  updated_at = now();

-- Also update existing profiles if they exist with the initial password
UPDATE public.profiles SET password = 'AdminPassword2026!' WHERE email = 'admin@janddbeachhouse.ph' AND (password IS NULL OR password = '');
UPDATE public.profiles SET password = 'StaffPassword2026!' WHERE email = 'receptionist@janddbeachhouse.ph' AND (password IS NULL OR password = '');
UPDATE public.profiles SET password = 'StaffPassword2026!' WHERE email = 'accounting@janddbeachhouse.ph' AND (password IS NULL OR password = '');
UPDATE public.profiles SET password = 'StaffPassword2026!' WHERE email = 'housekeeping@janddbeachhouse.ph' AND (password IS NULL OR password = '');
UPDATE public.profiles SET password = 'StaffPassword2026!' WHERE email = 'kitchen@janddbeachhouse.ph' AND (password IS NULL OR password = '');
UPDATE public.profiles SET password = 'StaffPassword2026!' WHERE email = 'maintenance@janddbeachhouse.ph' AND (password IS NULL OR password = '');


-- ==============================================================================
-- PART 5: CLEAN AUDIT VIEW FOR ACTIVE EMPLOYEES
-- ==============================================================================

CREATE OR REPLACE VIEW public.v_active_employees AS
SELECT
  id,
  employee_id,
  full_name,
  email,
  role,
  department,
  position,
  phone,
  shift,
  status,
  hire_date,
  is_active,
  created_at
FROM public.employee_accounts
WHERE status = 'active'
ORDER BY department ASC, full_name ASC;

-- Success confirmation notice
DO $$ BEGIN
  RAISE NOTICE '✅ Migration complete: password columns added to profiles, and public.employee_accounts collection isolated successfully!';
END $$;
