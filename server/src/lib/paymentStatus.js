/**
 * The reservations table only accepts these payment statuses. Forms and older code also send words such as
 * "confirmed" or "Paid", which the table refuses with a check-constraint error, so every value goes through here.
 */
export const PAYMENT_STATUSES = ['unpaid', 'partially_paid', 'paid', 'refund_pending', 'refunded'];

export function normalizePaymentStatus(value) {
  const key = String(value ?? '').trim().toLowerCase().replace(/[\s-]+/g, '_');
  if (PAYMENT_STATUSES.includes(key)) return key;
  if (['partial', 'partial_payment', 'down_payment', 'downpayment', 'deposit'].includes(key)) return 'partially_paid';
  return 'unpaid';
}
