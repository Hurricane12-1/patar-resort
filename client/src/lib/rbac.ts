export type PortalKey = 'admin' | 'reception' | 'accounting' | 'operations' | 'recovery' | 'client';
export type OperationalDepartmentId = 'front_desk' | 'housekeeping' | 'kitchen' | 'tours';
export type EmployeeDepartmentId = OperationalDepartmentId | 'accounting' | 'management';

export interface DepartmentOption {
  id: OperationalDepartmentId;
  label: string;
  gatekept?: boolean;
}

export const OPERATIONAL_DEPARTMENTS: DepartmentOption[] = [
  { id: 'front_desk', label: 'Front Desk' },
  { id: 'housekeeping', label: 'Housekeeping' },
  { id: 'kitchen', label: 'Kitchen & Dining' },
  { id: 'tours', label: 'Tours & Island Hopping (Gatekept)', gatekept: true },
];

export const EMPLOYEE_ROLE_PRESETS = [
  {
    value: 'receptionist',
    role: 'receptionist',
    department: 'front_desk' as EmployeeDepartmentId,
    label: 'Front Desk / Receptionist (Check-In, Chat & Front Desk Tasks)',
    shortLabel: 'Front Desk',
    portalPath: '/staff/reception',
  },
  {
    value: 'accounting',
    role: 'accounting',
    department: 'accounting' as EmployeeDepartmentId,
    label: 'Accounting & Finance (Ledger, Audit & Rate Requests)',
    shortLabel: 'Accounting & Finance',
    portalPath: '/staff/accounting',
  },
  {
    value: 'housekeeping',
    role: 'housekeeping',
    department: 'housekeeping' as EmployeeDepartmentId,
    label: 'Housekeeping (Room Readiness, Turn-down & Linen Stock)',
    shortLabel: 'Housekeeping',
    portalPath: '/staff/operations',
  },
  {
    value: 'kitchen',
    role: 'kitchen',
    department: 'kitchen' as EmployeeDepartmentId,
    label: 'Kitchen & Dining (Kitchen Queue & Culinary Supplies)',
    shortLabel: 'Kitchen & Dining',
    portalPath: '/staff/operations',
  },
  {
    value: 'tours',
    role: 'tours',
    department: 'tours' as EmployeeDepartmentId,
    label: 'Tours & Island Hopping [Gatekept] (Admin-Restricted Dispatch)',
    shortLabel: 'Island Hopping (Gatekept)',
    portalPath: '/staff/operations',
  },
  {
    value: 'administrator',
    role: 'administrator',
    department: 'management' as EmployeeDepartmentId,
    label: 'Administrator (Full Governance, Pricing & Approvals)',
    shortLabel: 'Administrator',
    portalPath: '/admin',
  },
];

const INTERNAL_ROLES = new Set([
  'administrator',
  'admin',
  'staff',
  'receptionist',
  'accounting',
  'housekeeping',
  'kitchen',
  'tours',
]);

export function normalizeRole(rawRole?: string | null): string {
  const r = String(rawRole || '').trim().toLowerCase();
  if (r === 'admin' || r === 'administrator') return 'administrator';
  if (r === 'frontdesk' || r === 'front_desk') return 'receptionist';
  if (INTERNAL_ROLES.has(r)) return r;
  return 'customer';
}

export function normalizeDepartment(profile: any): EmployeeDepartmentId | 'customer' {
  const role = normalizeRole(profile?.role);
  if (role === 'customer') return 'customer';
  if (role === 'administrator') return 'management';
  if (role === 'accounting') return 'accounting';
  if (role === 'receptionist') return 'front_desk';
  if (role === 'housekeeping') return 'housekeeping';
  if (role === 'kitchen') return 'kitchen';
  if (role === 'tours') return 'tours';

  const rawDept = String(profile?.department || '').trim().toLowerCase().replace(/[\s-]+/g, '_');
  if (rawDept === 'frontdesk' || rawDept === 'front_desk') return 'front_desk';
  if (rawDept === 'housekeeping') return 'housekeeping';
  if (rawDept === 'kitchen') return 'kitchen';
  if (rawDept === 'tours') return 'tours';
  if (rawDept === 'accounting') return 'accounting';
  if (rawDept === 'management') return 'management';
  return 'housekeeping';
}

export function isAdministrator(profile: any): boolean {
  return normalizeRole(profile?.role) === 'administrator';
}

export function isInternalEmployee(profile: any): boolean {
  return normalizeRole(profile?.role) !== 'customer';
}

export function canAccessPortal(profile: any, portal: PortalKey): boolean {
  const role = normalizeRole(profile?.role);
  const dept = normalizeDepartment(profile);

  switch (portal) {
    case 'admin':
      return role === 'administrator';
    case 'reception':
      return role === 'administrator' || dept === 'front_desk';
    case 'accounting':
      return role === 'administrator' || dept === 'accounting';
    case 'operations':
      return (
        role === 'administrator' ||
        dept === 'front_desk' ||
        dept === 'housekeeping' ||
        dept === 'kitchen' ||
        dept === 'tours'
      );
    case 'recovery':
      return role === 'administrator' || dept === 'front_desk' || dept === 'accounting';
    case 'client':
      return role === 'customer';
    default:
      return false;
  }
}

export function getDefaultStaffPath(profile: any): string {
  const role = normalizeRole(profile?.role);
  const dept = normalizeDepartment(profile);
  if (role === 'administrator') return '/admin';
  if (dept === 'accounting') return '/staff/accounting';
  if (dept === 'front_desk') return '/staff/reception';
  return '/staff/operations';
}

export function getAllowedOperationalDepartments(profile: any): DepartmentOption[] {
  const role = normalizeRole(profile?.role);
  const dept = normalizeDepartment(profile);
  if (role === 'administrator') return OPERATIONAL_DEPARTMENTS;
  return OPERATIONAL_DEPARTMENTS.filter((d) => d.id === dept);
}

export function canUseRoomReadiness(profile: any): boolean {
  const role = normalizeRole(profile?.role);
  const dept = normalizeDepartment(profile);
  return role === 'administrator' || dept === 'front_desk' || dept === 'housekeeping';
}

export function canRequestPriceChange(profile: any): boolean {
  const role = normalizeRole(profile?.role);
  const dept = normalizeDepartment(profile);
  return role === 'administrator' || dept === 'accounting' || dept === 'front_desk';
}

export function canEscalateToRecovery(profile: any): boolean {
  const role = normalizeRole(profile?.role);
  const dept = normalizeDepartment(profile);
  return role === 'administrator' || dept === 'front_desk' || dept === 'accounting';
}

export function formatDepartmentBadge(profile: any): string {
  const dept = normalizeDepartment(profile);
  if (dept === 'management') return 'Executive Admin';
  if (dept === 'front_desk') return 'Front Desk';
  if (dept === 'accounting') return 'Accounting & Finance';
  if (dept === 'housekeeping') return 'Housekeeping';
  if (dept === 'kitchen') return 'Kitchen & Dining';
  if (dept === 'tours') return 'Island Hopping (Gatekept)';
  return 'Guest';
}
