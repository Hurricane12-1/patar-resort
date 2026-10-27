import assert from 'assert';
import { z } from 'zod';

const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

const createSchema = z.object({
  roomId: z.string().optional(),
  room_id: z.string().optional(),
  check_in: dateStr,
  check_out: dateStr,
  check_in_time: z.string().max(30).optional(),
  check_out_time: z.string().max(30).optional(),
  guests: z.coerce.number().int().min(1, 'Number of guests must be at least 1').max(12, 'Maximum 12 guests allowed per room').default(1),
  notes: z.string().max(500).default(''),
  phone: z.string().min(1, 'Mobile phone is required'),
  guest_name: z.string().optional(),
  guestName: z.string().optional(),
  guest_email: z.string().optional(),
  email: z.string().optional(),
  total_php: z.coerce.number().optional(),
  downpayment_php: z.coerce.number().optional(),
  payment_method: z.string().min(1, 'Preferred downpayment method is required'),
  payment_status: z.string().max(50).optional(),
  status: z.string().max(50).optional(),
}).refine((d) => Boolean(d.roomId || d.room_id), { message: 'Room selection is required (roomId or room_id)' })
  .refine((d) => d.check_out > d.check_in, { message: 'Check-out date must be strictly after check-in date' })
  .refine((d) => {
    const name = (d.guest_name || d.guestName || '').trim();
    return name.length >= 2;
  }, { message: 'Primary guest name is required for booking manifest (minimum 2 characters)' })
  .refine((d) => {
    const raw = String(d.phone || '').replace(/\D/g, '').replace(/^63(?=\d{10})/, '0');
    return /^09\d{9}$/.test(raw);
  }, { message: 'Mobile phone must be strictly an 11-digit Philippine mobile number starting with 09 (e.g. 09171234567)' })
  .refine((d) => {
    const mail = (d.email || d.guest_email || '').trim();
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mail);
  }, { message: 'A valid email address is required for official booking voucher delivery' })
  .refine((d) => Boolean(d.payment_method && d.payment_method.trim().length > 0), { message: 'Preferred downpayment method is required' });

console.log('Testing createSchema:');

// Test 1: Complete Valid Reservation
const validPayload = {
  roomId: 'room-123',
  check_in: '2026-10-28',
  check_out: '2026-10-30',
  guests: 2,
  guest_name: 'Juan Dela Cruz',
  phone: '09171234567',
  guest_email: 'juan@gmail.com',
  payment_method: 'GCash',
};
const parsed = createSchema.safeParse(validPayload);
assert.strictEqual(parsed.success, true, 'Valid payload must pass');
console.log('✅ Test 1 Passed: Complete Valid Reservation passes schema');

// Test 2: Missing Guest Name
const noName = { ...validPayload, guest_name: '' };
const parsedNoName = createSchema.safeParse(noName);
assert.strictEqual(parsedNoName.success, false, 'Missing guest_name must fail');
console.log('✅ Test 2 Passed: Missing guest name rejected');

// Test 3: Invalid Mobile (not 11 digits)
const badPhone = { ...validPayload, phone: '091712345' };
const parsedBadPhone = createSchema.safeParse(badPhone);
assert.strictEqual(parsedBadPhone.success, false, 'Short phone must fail');
console.log('✅ Test 3 Passed: Short phone rejected');

// Test 4: Invalid Mobile (not starting with 09)
const badPrefix = { ...validPayload, phone: '08123456789' };
const parsedBadPrefix = createSchema.safeParse(badPrefix);
assert.strictEqual(parsedBadPrefix.success, false, 'Non-09 phone must fail');
console.log('✅ Test 4 Passed: Non-09 phone prefix rejected');

// Test 5: Missing Email
const noEmail = { ...validPayload, guest_email: 'invalid-email' };
const parsedNoEmail = createSchema.safeParse(noEmail);
assert.strictEqual(parsedNoEmail.success, false, 'Invalid email must fail');
console.log('✅ Test 5 Passed: Invalid email rejected');

// Test 6: Check-out before Check-in
const badDates = { ...validPayload, check_in: '2026-10-30', check_out: '2026-10-28' };
const parsedBadDates = createSchema.safeParse(badDates);
assert.strictEqual(parsedBadDates.success, false, 'Check-out before check-in must fail');
console.log('✅ Test 6 Passed: Bad dates rejected');

// Test 7: Missing Payment Method
const noPayment = { ...validPayload, payment_method: '' };
const parsedNoPayment = createSchema.safeParse(noPayment);
assert.strictEqual(parsedNoPayment.success, false, 'Missing payment method must fail');
console.log('✅ Test 7 Passed: Missing payment method rejected');

console.log('🎉 ALL 7 RESERVATION VALIDATION TESTS PASSED!');
