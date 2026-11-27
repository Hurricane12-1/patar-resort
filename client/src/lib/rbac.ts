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
    value: 'staff',
    role: 'staff',
    department: 'front_desk' as EmployeeDepartmentId,
    label: 'Staff (Operations, Reception & Execution)',
    shortLabel: 'Staff',
    portalPath: '/staff/reception',
  },
  {
    value: 'administrator',
    role: 'administrator',
    department: 'management' as EmployeeDepartmentId,
    label: 'Administrator (Executive Governance & Approvals)',
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
      return role === 'administrator' || role === 'staff' || dept === 'front_desk';
    case 'accounting':
      return role === 'administrator' || role === 'staff' || dept === 'accounting';
    case 'operations':
      return (
        role === 'administrator' ||
        role === 'staff' ||
        dept === 'front_desk' ||
        dept === 'housekeeping' ||
        dept === 'kitchen' ||
        dept === 'tours'
      );
    case 'recovery':
      return role === 'administrator' || role === 'staff' || dept === 'front_desk' || dept === 'accounting';
    case 'client':
      return role === 'customer';
    default:
      return false;
  }
}

export function getDefaultStaffPath(profile: any): string {
  const role = normalizeRole(profile?.role);
  if (role === 'administrator') return '/admin';
  if (role === 'accounting') return '/staff/accounting';
  return '/staff/operations?view=dashboard';
}

export function canViewFrontDeskOverview(profile: any): boolean {
  const role = normalizeRole(profile?.role);
  return role === 'administrator' || role === 'staff' || role === 'receptionist';
}

export function getAllowedOperationalDepartments(profile: any): DepartmentOption[] {
  const role = normalizeRole(profile?.role);
  const dept = normalizeDepartment(profile);
  if (role === 'administrator' || role === 'staff') return OPERATIONAL_DEPARTMENTS;
  return OPERATIONAL_DEPARTMENTS.filter((d) => d.id === dept);
}

export function canUseRoomReadiness(profile: any): boolean {
  const role = normalizeRole(profile?.role);
  const dept = normalizeDepartment(profile);
  return role === 'administrator' || role === 'staff' || dept === 'front_desk' || dept === 'housekeeping';
}

export function canRequestPriceChange(profile: any): boolean {
  const role = normalizeRole(profile?.role);
  const dept = normalizeDepartment(profile);
  return role === 'administrator' || role === 'staff' || dept === 'accounting' || dept === 'front_desk';
}

export function canEscalateToRecovery(profile: any): boolean {
  const role = normalizeRole(profile?.role);
  const dept = normalizeDepartment(profile);
  return role === 'administrator' || role === 'staff' || dept === 'front_desk' || dept === 'accounting';
}

export function formatDepartmentBadge(profile: any): string {
  const role = normalizeRole(profile?.role);
  if (role === 'administrator') return 'Administrator';
  if (role === 'staff') return 'Staff';
  const dept = normalizeDepartment(profile);
  if (dept === 'management') return 'Administrator';
  if (['front_desk', 'accounting', 'housekeeping', 'kitchen', 'tours'].includes(dept)) return 'Staff';
  return 'Guest';
}
