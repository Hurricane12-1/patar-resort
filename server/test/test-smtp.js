import { getTransporter, sendRecoveryOTP } from '../src/lib/mailer.js';
import { env } from '../src/config/env.js';

async function testGoogleSMTP() {
  console.log('Testing Google SMTP with user:', env.SMTP_USER);

  if (!env.SMTP_USER || !env.SMTP_PASS) {
    console.error('❌ Missing SMTP_USER or SMTP_PASS');
    process.exit(1);
  }

  const transporter = getTransporter();

  try {
    await transporter.verify();
    console.log('✅ Google SMTP connection verified successfully!');

    console.log('📨 Sending live test OTP email to:', env.SMTP_USER);
    const result = await sendRecoveryOTP({
      to: env.SMTP_USER,
      code: '849201',
      name: 'J & D Administrator',
    });
    console.log('✅ Email dispatched successfully! Message ID:', result.messageId);
    console.log('Response:', result.response);
  } catch (err) {
    console.error('❌ Google SMTP Verification/Send Error:', err.message);
  }
}

testGoogleSMTP();

