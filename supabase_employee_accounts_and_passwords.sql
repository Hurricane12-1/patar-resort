-- ==============================================================================
-- J & D BEACH HOUSE RESORT · SUPABASE POSTGRESQL MIGRATION
-- Task: 1. Add encrypted password column to public.profiles (no redundant password_hash)
--       2. Create dedicated, isolated public.employee_accounts collection/table
--       3. Auto-encrypt plain passwords directly inside the `password` column
--       4. Remove/Drop any legacy `password_hash` columns
-- Target: Supabase Dashboard -> SQL Editor -> New Query -> Run
-- ==============================================================================

-- Step 1: Ensure required extensions exist in Supabase
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Step 1.1: Ensure 'manager' is added to public.user_role ENUM if it exists
DO $$ BEGIN
  ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'manager';
EXCEPTION WHEN undefined_object THEN null;
END $$;


-- ==============================================================================
-- PART 1: ENCRYPTED PASSWORD COLUMN SA PROFILES (DROP REDUNDANT PASSWORD_HASH)
-- ==============================================================================

-- 1.1 Add single encrypted password column to public.profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS password TEXT DEFAULT '';
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS password TEXT DEFAULT '';
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS password TEXT DEFAULT '';

-- 1.2 I-drop ang lumang password_hash column dahil direktang encrypted na ang password column
ALTER TABLE public.profiles DROP COLUMN IF EXISTS password_hash;
ALTER TABLE public.customers DROP COLUMN IF EXISTS password_hash;
ALTER TABLE public.users DROP COLUMN IF EXISTS password_hash;

COMMENT ON COLUMN public.profiles.password IS 'Encrypted/bcrypt-hashed password for authentication';

-- 1.3 Automatic password encryption trigger for public.profiles
-- Kapag nag-insert o nag-update ng plain text password, kusa itong ine-encrypt
-- gamit ang pgcrypto crypt (bcrypt) direkta sa loob ng password column mismo.
CREATE OR REPLACE FUNCTION public.handle_profile_password_encryption()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.password IS NOT NULL AND TRIM(NEW.password) <> '' THEN
    -- Kung hindi pa naka-encrypt bilang bcrypt hash (nagsisimula sa $2a$, $2b$, o $2y$)
    IF NEW.password NOT LIKE '$2%' THEN
      NEW.password = crypt(NEW.password, gen_salt('bf', 10));
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_profile_password_hash ON public.profiles;
DROP TRIGGER IF EXISTS trg_profile_password_encryption ON public.profiles;

CREATE TRIGGER trg_profile_password_encryption
  BEFORE INSERT OR UPDATE OF password ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.handle_profile_password_encryption();


-- ==============================================================================
-- PART 2: DEDICATED ISOLATED EMPLOYEE ACCOUNTS COLLECTION / TABLE
-- ==============================================================================

-- 2.1 Create the dedicated public.employee_accounts table (walang password_hash column)
CREATE TABLE IF NOT EXISTS public.employee_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  employee_id TEXT UNIQUE NOT NULL,
  first_name TEXT NOT NULL DEFAULT '',
  middle_name TEXT DEFAULT '',
  last_name TEXT NOT NULL DEFAULT '',
  full_name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password TEXT DEFAULT '',                               -- Dito na mismo naka-store ang encrypted password
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

-- Kung dati nang nagawa ang table at may password_hash, i-drop ito:
ALTER TABLE public.employee_accounts DROP COLUMN IF EXISTS password_hash;

COMMENT ON TABLE public.employee_accounts IS 'Isolated Employee Accounts Collection for Staff, Management, and Executive Administration';
COMMENT ON COLUMN public.employee_accounts.employee_id IS 'Unique company employee code (e.g. EMP-2026-001)';
COMMENT ON COLUMN public.employee_accounts.password IS 'Encrypted/bcrypt password for employee operations';

-- 2.2 Create indexes for fast lookup and filtering
CREATE INDEX IF NOT EXISTS idx_employee_accounts_email ON public.employee_accounts(email);
CREATE INDEX IF NOT EXISTS idx_employee_accounts_employee_id ON public.employee_accounts(employee_id);
CREATE INDEX IF NOT EXISTS idx_employee_accounts_role ON public.employee_accounts(role);
CREATE INDEX IF NOT EXISTS idx_employee_accounts_department ON public.employee_accounts(department);
CREATE INDEX IF NOT EXISTS idx_employee_accounts_status ON public.employee_accounts(status);
CREATE INDEX IF NOT EXISTS idx_employee_accounts_auth_user ON public.employee_accounts(auth_user_id);

-- 2.3 Automatic timestamp & direct password encryption trigger for employee_accounts
CREATE OR REPLACE FUNCTION public.handle_employee_account_lifecycle()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();

  IF (NEW.full_name IS NULL OR TRIM(NEW.full_name) = '') THEN
    NEW.full_name = TRIM(CONCAT(NEW.first_name, ' ', NEW.middle_name, ' ', NEW.last_name));
    IF NEW.full_name = '' THEN
      NEW.full_name = SPLIT_PART(NEW.email, '@', 1);
    END IF;
  END IF;

  -- Awtomatikong ine-encrypt ang password direkta sa password column
  IF NEW.password IS NOT NULL AND TRIM(NEW.password) <> '' THEN
    IF NEW.password NOT LIKE '$2%' THEN
      NEW.password = crypt(NEW.password, gen_salt('bf', 10));
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_employee_accounts_lifecycle ON public.employee_accounts;
CREATE TRIGGER trg_employee_accounts_lifecycle
  BEFORE INSERT OR UPDATE ON public.employee_accounts
  FOR EACH ROW EXECUTE FUNCTION public.handle_employee_account_lifecycle();


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
-- PART 4: SEED STANDARD RESORT EMPLOYEE ACCOUNTS (AUTO-ENCRYPTED IN PASSWORD)
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

-- Update existing profiles with initial password (which triggers auto-encryption)
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

DO $$ BEGIN
  RAISE NOTICE '✅ Migration complete: password encrypted directly in password column, password_hash dropped, and employee_accounts isolated!';
END $$;
