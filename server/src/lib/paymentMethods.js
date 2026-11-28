import { ApiError } from '../middleware/errors.js';
import { getSystemAdminClient } from './supabase.js';
import { MAX_PAYMENT_METHODS, paymentMethodLabel } from './paymentSecurity.js';
import { simulatedPaymentsEnabled } from './paymentHolds.js';

// Only these columns ever leave the server. provider_token stays inside.
const PUBLIC_COLUMNS = 'id, type, label, brand, last4, exp_month, exp_year, holder_name, is_default, created_at';

export async function listPaymentMethods(userId) {
  const client = await getSystemAdminClient();
  const { data, error } = await client
    .from('payment_methods')
    .select(PUBLIC_COLUMNS)
    .eq('user_id', userId)
    .is('revoked_at', null)
    .order('created_at', { ascending: false });
  if (error) throw new ApiError(500, error.message);
  return data ?? [];
}

async function clearDefault(client, userId) {
  const { error } = await client
    .from('payment_methods')
    .update({ is_default: false })
    .eq('user_id', userId)
    .is('revoked_at', null)
    .eq('is_default', true);
  if (error) throw new ApiError(500, error.message);
}

export async function registerPaymentMethod(userId, value) {
  if (value.type === 'card' && simulatedPaymentsEnabled()) {
    throw new ApiError(503, 'Card payments are not connected yet. Use GCash or Maya for now.', { code: 'CARDS_NOT_CONNECTED' });
  }

  const client = await getSystemAdminClient();
  const { count, error: countError } = await client
    .from('payment_methods')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .is('revoked_at', null);
  if (countError) throw new ApiError(500, countError.message);
  if ((count ?? 0) >= MAX_PAYMENT_METHODS) {
    throw new ApiError(409, `You can save up to ${MAX_PAYMENT_METHODS} payment methods. Remove one first.`, { code: 'TOO_MANY_METHODS' });
  }

  const makeDefault = value.make_default === true || (count ?? 0) === 0;
  if (makeDefault) await clearDefault(client, userId);

  const isCard = value.type === 'card';
  const row = {
    user_id: userId,
    type: value.type,
    provider: isCard ? (process.env.PAYMENT_PROVIDER || '').toLowerCase() : 'wallet',
    provider_token: isCard ? value.provider_token : null,
    label: paymentMethodLabel(value),
    brand: isCard ? value.brand : null,
    last4: isCard ? value.last4 : value.mobile.slice(-4),
    exp_month: isCard ? value.exp_month : null,
    exp_year: isCard ? value.exp_year : null,
    holder_name: value.holder_name,
    is_default: makeDefault,
  };

  const { data, error } = await client.from('payment_methods').insert(row).select(PUBLIC_COLUMNS).single();
  if (error) {
    if (error.code === '23505') throw new ApiError(409, 'This payment method is already saved.', { code: 'DUPLICATE_METHOD' });
    throw new ApiError(500, error.message);
  }
  return data;
}

async function ownedActiveMethod(client, userId, methodId) {
  const { data, error } = await client
    .from('payment_methods')
    .select('id, is_default')
    .eq('id', methodId)
    .eq('user_id', userId)
    .is('revoked_at', null)
    .maybeSingle();
  if (error) throw new ApiError(500, error.message);
  // Someone else's method answers the same as a missing one, so ids cannot be probed.
  if (!data) throw new ApiError(404, 'Payment method not found.');
  return data;
}

export async function setDefaultPaymentMethod(userId, methodId) {
  const client = await getSystemAdminClient();
  await ownedActiveMethod(client, userId, methodId);
  await clearDefault(client, userId);
  const { data, error } = await client
    .from('payment_methods')
    .update({ is_default: true })
    .eq('id', methodId)
    .eq('user_id', userId)
    .select(PUBLIC_COLUMNS)
    .single();
  if (error) throw new ApiError(500, error.message);
  return data;
}

export async function revokePaymentMethod(userId, methodId) {
  const client = await getSystemAdminClient();
  const method = await ownedActiveMethod(client, userId, methodId);
  const { error } = await client
    .from('payment_methods')
    .update({ revoked_at: new Date().toISOString(), is_default: false, provider_token: null })
    .eq('id', methodId)
    .eq('user_id', userId);
  if (error) throw new ApiError(500, error.message);

  if (method.is_default) {
    const { data: next } = await client
      .from('payment_methods')
      .select('id')
      .eq('user_id', userId)
      .is('revoked_at', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (next) await client.from('payment_methods').update({ is_default: true }).eq('id', next.id);
  }
}
