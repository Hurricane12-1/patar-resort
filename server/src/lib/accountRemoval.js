import { ApiError } from '../middleware/errors.js';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MISSING_SCHEMA_CODES = new Set(['42P01', '42703', 'PGRST204', 'PGRST205']);

const uniq = (values) => [...new Set(values.filter(Boolean).map(String))];
const uuidsOnly = (values) => uniq(values).filter((value) => UUID_PATTERN.test(value));
const isMissingSchema = (error) => MISSING_SCHEMA_CODES.has(error?.code);
const isNotFound = (error) => error?.status === 404 || /not found/i.test(error?.message || '');

const stepError = (action, error) =>
  new ApiError(
    409,
    `Could not ${action}: ${error?.message || 'unknown database error'}. Refresh the list and check whether the account is still there.`
  );

export async function removeAccountRecords(client, userId) {
  const id = String(userId || '').trim();
  if (!id) throw new ApiError(400, 'Account id is required.');

  const { data: profile, error: profileError } = await client
    .from('profiles')
    .select('id, full_name, email, role')
    .eq('id', id)
    .maybeSingle();
  if (profileError) throw stepError('read the profile', profileError);

  const emailClause = profile?.email ? `,email.eq.${profile.email}` : '';
  const { data: staffRows, error: staffError } = await client
    .from('employee_accounts')
    .select('id, auth_user_id, email, full_name, role')
    .or(`id.eq.${id},auth_user_id.eq.${id}${emailClause}`);
  if (staffError) throw stepError('read the staff record', staffError);

  const staff = staffRows || [];
  if (!profile && staff.length === 0) {
    throw new ApiError(404, 'Account not found. It may already be removed.');
  }

  const staffIds = uniq(staff.map((row) => row.id));
  const profileIds = uuidsOnly([id, profile?.id]);
  const authIds = uuidsOnly([id, profile?.id, ...staff.map((row) => row.auth_user_id)]);

  for (const table of ['reservations', 'resort_orders', 'reviews']) {
    if (authIds.length === 0) break;
    const { error } = await client.from(table).update({ guest_id: null }).in('guest_id', authIds);
    if (error && !isMissingSchema(error)) throw stepError(`keep the ${table} records`, error);
  }

  const dependents = [
    ['user_confirmations', 'user_id', authIds],
    ['chat_messages', 'profile_id', profileIds],
    ['notifications', 'profile_id', profileIds],
  ];
  for (const [table, column, ids] of dependents) {
    if (ids.length === 0) continue;
    const { error } = await client.from(table).delete().in(column, ids);
    if (error && !isMissingSchema(error)) throw stepError(`clear ${table}`, error);
  }

  if (staffIds.length > 0) {
    const { error } = await client.from('employee_accounts').delete().in('id', staffIds);
    if (error) throw stepError('remove the staff record', error);
  }

  for (const table of ['customers', 'users', 'profiles']) {
    if (profileIds.length === 0) break;
    const { error } = await client.from(table).delete().in('id', profileIds);
    if (error && !isMissingSchema(error)) throw stepError(`remove the ${table} record`, error);
  }

  if (authIds.length > 0 && !client.auth?.admin) {
    throw new ApiError(409, 'The server cannot remove sign-in accounts. Set SUPABASE_SERVICE_ROLE_KEY on the server.');
  }
  for (const authId of authIds) {
    const { error } = await client.auth.admin.deleteUser(authId);
    if (error && !isNotFound(error)) throw stepError('remove the sign-in account', error);
  }

  if (profileIds.length > 0) {
    const { data: leftProfiles, error: leftProfileError } = await client
      .from('profiles')
      .select('id')
      .in('id', profileIds);
    if (leftProfileError) throw stepError('confirm the profile was removed', leftProfileError);
    if ((leftProfiles || []).length > 0) throw remainingError();
  }
  if (staffIds.length > 0) {
    const { data: leftStaff, error: leftStaffError } = await client
      .from('employee_accounts')
      .select('id')
      .in('id', staffIds);
    if (leftStaffError) throw stepError('confirm the staff record was removed', leftStaffError);
    if ((leftStaff || []).length > 0) throw remainingError();
  }

  return {
    id,
    full_name: profile?.full_name || staff[0]?.full_name || '',
    email: profile?.email || staff[0]?.email || '',
    role: profile?.role || staff[0]?.role || '',
  };
}

function remainingError() {
  return new ApiError(
    409,
    'The account is still in the database after removal. Make sure SUPABASE_SERVICE_ROLE_KEY is set on the server, then try again.'
  );
}
