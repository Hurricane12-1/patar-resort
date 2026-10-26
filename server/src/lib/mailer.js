import nodemailer from 'nodemailer';
import { env, emailEnabled } from '../config/env.js';

let transporter = null;

export function getTransporter() {
  if (transporter) return transporter;

  if (emailEnabled) {
    transporter = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_SECURE,
      auth: {
        user: env.SMTP_USER,
        pass: env.SMTP_PASS,
      },
      tls: {
        rejectUnauthorized: false,
      },
    });
  } else {
    // Development / Test transporter stub that logs previews
    transporter = {
      sendMail: async (options) => {
        const previewId = `live-dispatch-${Date.now()}`;
        console.log('\n============================================================');
        console.log(' 📧 [Rock View Beach Resort Mailer - Development / Offline Preview]');
        console.log(` To:      ${options.to}`);
        console.log(` Subject: ${options.subject}`);
        console.log('------------------------------------------------------------');
        if (options.text) {
          console.log(options.text);
        }
        console.log('============================================================\n');
        return {
          messageId: previewId,
          response: 'Simulated 250 OK (SMTP not configured or in dev mode)',
          simulated: true,
        };
      },
      verify: async () => true,
    };
  }

  return transporter;
}

/**
 * Sends a 6-digit OTP verification code via Nodemailer (Google/SMTP)
 * for account recovery and password reset.
 */
export async function sendRecoveryOTP({ to, code, name = 'Guest' }) {
  const mail = getTransporter();

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Account Recovery Verification Code</title>
</head>
<body style="margin: 0; padding: 0; background-color: #0F172A; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #F8FAFC;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #0F172A; padding: 36px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width: 540px; background-color: #1E293B; border: 1px solid #334155; border-radius: 18px; overflow: hidden; box-shadow: 0 10px 25px rgba(0, 0, 0, 0.45);">
          <!-- Header Banner -->
          <tr>
            <td style="background: linear-gradient(135deg, #0284C7, #0EA5E9, #38BDF8); padding: 26px 30px; text-align: left;">
              <span style="font-size: 11px; letter-spacing: 0.15em; color: rgba(255,255,255,0.9); text-transform: uppercase; font-weight: 700;">Rock View Beach Resort · Patar Beach</span>
              <h1 style="margin: 6px 0 0; color: #FFFFFF; font-size: 22px; font-weight: 800; letter-spacing: -0.02em;">Account Security Verification</h1>
            </td>
          </tr>

          <!-- Main Content -->
          <tr>
            <td style="padding: 30px;">
              <p style="margin: 0 0 16px; font-size: 15px; color: #E2E8F0; line-height: 1.5;">
                Mabuhay, <strong>${name}</strong>!
              </p>
              <p style="margin: 0 0 24px; font-size: 14px; color: #94A3B8; line-height: 1.6;">
                We received a request to recover or reset the security credentials for your Rock View Beach Resort account. Please use the verification code below to authorize this request:
              </p>

              <!-- OTP Code Display Card -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-bottom: 24px;">
                <tr>
                  <td align="center" style="background-color: #0F172A; border: 1px solid #0284C7; border-radius: 12px; padding: 22px 16px;">
                    <span style="display: block; font-size: 11px; letter-spacing: 0.15em; color: #38BDF8; text-transform: uppercase; font-weight: 700; margin-bottom: 8px;">One-Time Verification Code (OTP)</span>
                    <span style="display: block; font-family: Consolas, 'Liberation Mono', Menlo, Courier, monospace; font-size: 36px; font-weight: 800; letter-spacing: 0.35em; color: #38BDF8;">
                      ${code}
                    </span>
                    <span style="display: block; font-size: 12px; color: #64748B; margin-top: 8px;">
                      ⏱️ Valid for 15 minutes · One-time use only
                    </span>
                  </td>
                </tr>
              </table>

              <p style="margin: 0 0 16px; font-size: 13px; color: #EF4444; line-height: 1.5; font-weight: 500;">
                ⚠️ <strong>Security Notice:</strong> Never share this code with anyone. Rock View Beach Resort staff will never ask you for your verification code or password.
              </p>

              <p style="margin: 0; font-size: 12px; color: #64748B; line-height: 1.5;">
                If you did not initiate this request, you can safely disregard this email. Your password remains unchanged.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #0F172A; border-top: 1px solid #334155; padding: 18px 30px; text-align: center;">
              <p style="margin: 0; font-size: 11px; color: #64748B; line-height: 1.5;">
                Rock View Beach Resort Management System<br>
                Brgy. Patar, Bolinao, Pangasinan, Philippines 2406<br>
                Direct Concierge Desk: +63 900 555 0123
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;

  const text = `
Rock View Beach Resort · Account Recovery Verification Code

Mabuhay, ${name}!

Your one-time verification code is: ${code}

This code is valid for 15 minutes. Never share this code with anyone.
If you did not request this, please ignore this email.

Rock View Beach Resort
Brgy. Patar, Bolinao, Pangasinan, Philippines
`;

  return await mail.sendMail({
    from: env.SMTP_FROM,
    to,
    subject: `Your Verification Code: ${code} · Rock View Beach Resort`,
    text,
    html,
  });
}

/**
 * Sends a password reset confirmation notice
 */
export async function sendPasswordResetSuccess({ to, name = 'Guest' }) {
  const mail = getTransporter();

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Password Reset Confirmation</title>
</head>
<body style="margin: 0; padding: 0; background-color: #0F172A; font-family: sans-serif; color: #F8FAFC;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="padding: 30px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width: 500px; background-color: #1E293B; border: 1px solid #334155; border-radius: 16px; padding: 24px;">
          <tr>
            <td>
              <h2 style="color: #10B981; margin: 0 0 12px;">✅ Password Successfully Reset</h2>
              <p style="color: #CBD5E1; font-size: 14px; line-height: 1.5;">
                Mabuhay, <strong>${name}</strong>. Your Rock View Beach Resort account password has been updated. You can now sign in with your new credentials.
              </p>
              <p style="color: #64748B; font-size: 12px; margin-top: 18px;">
                If you did not make this change, please contact the front desk immediately at +63 900 555 0123.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;

  return await mail.sendMail({
    from: env.SMTP_FROM,
    to,
    subject: 'Security Alert: Password Updated · Rock View Beach Resort',
    text: `Your password has been successfully reset. Rock View Beach Resort.`,
    html,
  });
}

/**
 * Sends a 6-digit Two-Factor Authentication (2FA) verification code
 * via Nodemailer (Google Mail / SMTP) to confirm client account creation before finalization.
 */
export async function sendSignup2FAOTP({ to, code, name = 'Guest', provider = 'email' }) {
  const mail = getTransporter();

  const isGoogle = provider === 'google' || provider === 'gmail';
  const providerLabel = provider === 'facebook'
    ? 'Facebook Integrated Sign-Up'
    : isGoogle
    ? 'Google Sign-In Entry'
    : 'Client Guest Registration';

  const actionHeadline = isGoogle
    ? 'Proposed Account Entry · 2FA Verification'
    : 'Finalize Account Sign-Up · 2FA Security';

  const introText = isGoogle
    ? `We received a proposal to access or register your account at <strong>Rock View Beach Resort</strong> via Google Sign-In. To authorize this entry and verify ownership of your Gmail, please enter the 6-digit verification code below:`
    : `Thank you for choosing Rock View Beach Resort. To finalize your client account creation and activate your reservation portal, please enter the two-factor authentication (2FA) verification code below:`;

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${actionHeadline}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #0F172A; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #F8FAFC;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #0F172A; padding: 36px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width: 540px; background-color: #1E293B; border: 1px solid #334155; border-radius: 18px; overflow: hidden; box-shadow: 0 10px 25px rgba(0, 0, 0, 0.45);">
          <!-- Header Banner -->
          <tr>
            <td style="background: linear-gradient(135deg, #0284C7, #0EA5E9, #38BDF8); padding: 26px 30px; text-align: left;">
              <span style="font-size: 11px; letter-spacing: 0.15em; color: rgba(255,255,255,0.9); text-transform: uppercase; font-weight: 700;">Rock View Beach Resort · Patar Beach, Bolinao</span>
              <h1 style="margin: 6px 0 0; color: #FFFFFF; font-size: 22px; font-weight: 800; letter-spacing: -0.02em;">${actionHeadline}</h1>
            </td>
          </tr>

          <!-- Main Content -->
          <tr>
            <td style="padding: 30px;">
              <p style="margin: 0 0 12px; font-size: 15px; color: #E2E8F0; line-height: 1.5;">
                Mabuhay, <strong>${name}</strong>!
              </p>
              <p style="margin: 0 0 12px; font-size: 14px; color: #38BDF8; font-weight: 600;">
                Authentication Method: ${providerLabel}
              </p>
              <p style="margin: 0 0 24px; font-size: 14px; color: #94A3B8; line-height: 1.6;">
                ${introText}
              </p>

              <!-- OTP Code Display Card -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-bottom: 24px;">
                <tr>
                  <td align="center" style="background-color: #0F172A; border: 1.5px solid #0284C7; border-radius: 14px; padding: 22px 16px;">
                    <span style="display: block; font-size: 11px; letter-spacing: 0.15em; color: #38BDF8; text-transform: uppercase; font-weight: 700; margin-bottom: 8px;">6-Digit Entry Verification Code</span>
                    <span style="display: block; font-family: Consolas, 'Liberation Mono', Menlo, Courier, monospace; font-size: 40px; font-weight: 800; letter-spacing: 0.35em; color: #38BDF8;">
                      ${code}
                    </span>
                    <span style="display: block; font-size: 12px; color: #64748B; margin-top: 8px;">
                      ⏱️ Strictly valid for 60 seconds · Proposed Account Entry Gate
                    </span>
                  </td>
                </tr>
              </table>

              <!-- Remember & Security Notice -->
              <div style="background-color: rgba(245, 158, 11, 0.1); border-left: 4px solid #F59E0B; padding: 14px 16px; border-radius: 6px; margin-bottom: 20px;">
                <span style="display: block; font-size: 12px; font-weight: 700; color: #F59E0B; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 6px;">
                  🔒 Remember Notice & Security Advisory
                </span>
                <ul style="margin: 0; padding-left: 18px; font-size: 12px; color: #CBD5E1; line-height: 1.6;">
                  <li><strong>Never share this code:</strong> Resort staff will never request your 2FA verification code.</li>
                  <li><strong>Strict time-window:</strong> Code expires in 60s. Unconfirmed entries are auto-purged.</li>
                  <li><strong>Unrecognized Attempt?</strong> If you did not propose this entry, please ignore this notice and secure your Google account immediately.</li>
                </ul>
              </div>

              <p style="margin: 0; font-size: 12px; color: #64748B; line-height: 1.5;">
                This message was automatically generated by the Rock View Beach Resort Security & Access Engine.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #0F172A; border-top: 1px solid #334155; padding: 18px 30px; text-align: center;">
              <p style="margin: 0; font-size: 11px; color: #64748B; line-height: 1.5;">
                Rock View Beach Resort Management System<br>
                Brgy. Patar, Bolinao, Pangasinan, Philippines 2406<br>
                Front Desk & Concierge: +63 900 555 0123
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;

  const text = `
Rock View Beach Resort · ${actionHeadline}

Mabuhay, ${name}!

Your 2FA verification code for proposed entry is: ${code}

This code is strictly valid for 60 seconds.
REMEMBER: Never share this verification code with anyone. Staff will never ask for your code.
If you did not request this account entry, please ignore this email.

Rock View Beach Resort
Brgy. Patar, Bolinao, Pangasinan, Philippines
`;

  const subject = isGoogle
    ? `Proposed Account Entry & 2FA Verification: ${code} · Rock View Beach Resort`
    : `Your 2FA Sign-Up Code: ${code} · Rock View Beach Resort`;

  return await mail.sendMail({
    from: env.SMTP_FROM,
    to,
    subject,
    text,
    html,
  });
}

/**
 * Dispatches an entry notification to the resort owners / admin Gmail
 * when a new account proposes entry or requests 2FA verification.
 */
export async function sendOwnerEntryAlert({ userEmail, name = 'Guest', provider = 'google' }) {
  const mail = getTransporter();
  const ownerEmail = env.SUPABASE_ADMIN_EMAIL || env.SMTP_USER || 'admin@rockviewresort.ph';
  if (!ownerEmail) return;

  const html = `
<!DOCTYPE html>
<html lang="en">
<body style="background-color: #0F172A; font-family: sans-serif; color: #F8FAFC; padding: 20px;">
  <div style="max-width: 500px; background-color: #1E293B; border: 1px solid #334155; border-radius: 12px; padding: 24px; margin: auto;">
    <h3 style="color: #38BDF8; margin-top: 0;">🔔 New Account Entry Proposed</h3>
    <p style="color: #E2E8F0; font-size: 14px; line-height: 1.5;">
      A new user has proposed entry to the guest portal:
    </p>
    <div style="background-color: #0F172A; border-left: 4px solid #0EA5E9; padding: 12px 16px; border-radius: 4px; font-size: 13px; line-height: 1.6;">
      <strong>Name:</strong> ${name}<br>
      <strong>Account Gmail:</strong> ${userEmail}<br>
      <strong>Provider:</strong> ${provider}<br>
      <strong>Timestamp:</strong> ${new Date().toISOString()}<br>
      <strong>Status:</strong> 2FA Verification Code Dispatched (60s gate)
    </div>
  </div>
</body>
</html>
  `;

  return await mail.sendMail({
    from: env.SMTP_FROM,
    to: ownerEmail,
    subject: `🔔 New Account Entry Proposed (${provider}): ${userEmail}`,
    text: `New Account Entry Proposed: User ${name} (${userEmail}) via ${provider}. 2FA verification code dispatched.`,
    html,
  }).catch((err) => {
    console.warn('[Mailer Warning] Could not dispatch owner entry alert:', err.message);
  });
}

/**
 * Sends an Account Finalized & Welcome email to newly verified client users
 */
export async function sendWelcomeClientEmail({ to, name = 'Guest', provider = 'email' }) {
  const mail = getTransporter();

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Welcome to Rock View Beach Resort</title>
</head>
<body style="margin: 0; padding: 0; background-color: #0F172A; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #F8FAFC;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="padding: 30px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width: 520px; background-color: #1E293B; border: 1px solid #334155; border-radius: 16px; padding: 26px;">
          <tr>
            <td>
              <h2 style="color: #38BDF8; margin: 0 0 12px;">🏖️ Welcome to Rock View Beach Resort!</h2>
              <p style="color: #E2E8F0; font-size: 15px; line-height: 1.5;">
                Mabuhay, <strong>${name}</strong>! Your client user account has been successfully verified and finalized with 2FA security.
              </p>
              <p style="color: #94A3B8; font-size: 14px; line-height: 1.6;">
                You can now browse oceanview villas, reserve cottages, order poolside dining, and manage your digital beach passes.
              </p>
              <div style="background-color: #0F172A; border-left: 4px solid #10B981; padding: 12px 16px; margin: 18px 0; border-radius: 4px;">
                <span style="color: #10B981; font-weight: 700; font-size: 13px;">✓ 2FA Verified & Guest Manifest Active</span><br>
                <span style="color: #94A3B8; font-size: 12px;">Linked to: ${to}</span>
              </div>
              <p style="color: #64748B; font-size: 12px; margin-top: 18px;">
                Need assistance? Our concierge is available 24/7 at +63 900 555 0123.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;

  return await mail.sendMail({
    from: env.SMTP_FROM,
    to,
    subject: 'Welcome to Rock View Beach Resort · Your Account is Finalized ✦',
    text: `Welcome to Rock View Beach Resort, ${name}! Your account has been verified and finalized.`,
    html,
  });
}

/**
 * Sends an email notification when a client account is not confirmed within the 1-minute time window.
 * Informs the user that the unconfirmed account was automatically removed and prompts them to try again.
 */
export async function sendSignupExpiredEmail({ to, name = 'Guest' }) {
  const mail = getTransporter();

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Account Not Confirmed · Rock View Beach Resort</title>
</head>
<body style="margin: 0; padding: 0; background-color: #0F172A; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #F8FAFC;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #0F172A; padding: 36px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width: 540px; background-color: #1E293B; border: 1px solid #334155; border-radius: 18px; overflow: hidden; box-shadow: 0 10px 25px rgba(0, 0, 0, 0.45);">
          <!-- Header Banner -->
          <tr>
            <td style="background: linear-gradient(135deg, #EF4444, #DC2626, #B91C1C); padding: 26px 30px; text-align: left;">
              <span style="font-size: 11px; letter-spacing: 0.15em; color: rgba(255,255,255,0.9); text-transform: uppercase; font-weight: 700;">Rock View Beach Resort · Patar Beach</span>
              <h1 style="margin: 6px 0 0; color: #FFFFFF; font-size: 22px; font-weight: 800; letter-spacing: -0.02em;">Account Not Confirmed · Time Limit Expired</h1>
            </td>
          </tr>

          <!-- Main Content -->
          <tr>
            <td style="padding: 30px;">
              <p style="margin: 0 0 12px; font-size: 15px; color: #E2E8F0; line-height: 1.5;">
                Mabuhay, <strong>${name}</strong>,
              </p>
              <p style="margin: 0 0 16px; font-size: 14px; color: #CBD5E1; line-height: 1.6;">
                Your account registration was not confirmed within the required <strong>1-minute (60 seconds)</strong> time window.
              </p>
              <p style="margin: 0 0 22px; font-size: 14px; color: #94A3B8; line-height: 1.6;">
                To maintain data integrity and protect guest manifests, the unconfirmed account credentials have been <strong>automatically removed</strong> from our resort database.
              </p>

              <!-- Prominent Notice Banner -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-bottom: 24px;">
                <tr>
                  <td align="center" style="background-color: #0F172A; border: 2px solid #EF4444; border-radius: 14px; padding: 20px 16px;">
                    <span style="display: block; font-size: 12px; letter-spacing: 0.12em; color: #F87171; text-transform: uppercase; font-weight: 700; margin-bottom: 6px;">Confirmation Window Closed (1 Minute)</span>
                    <span style="display: block; font-size: 20px; font-weight: 800; color: #FCA5A5; letter-spacing: -0.01em;">
                      Try Again, please make sure you confirm
                    </span>
                    <span style="display: block; font-size: 12px; color: #94A3B8; margin-top: 8px;">
                      Please initiate registration again and enter your 6-digit confirmation code within 1 minute.
                    </span>
                  </td>
                </tr>
              </table>

              <p style="margin: 0 0 16px; font-size: 12px; color: #64748B; line-height: 1.5;">
                If you did not initiate this account creation, you may disregard this notice. No permanent account was created.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #0F172A; border-top: 1px solid #334155; padding: 18px 30px; text-align: center;">
              <p style="margin: 0; font-size: 11px; color: #64748B; line-height: 1.5;">
                Rock View Beach Resort Management System<br>
                Brgy. Patar, Bolinao, Pangasinan, Philippines 2406<br>
                Direct Concierge Desk: +63 900 555 0123
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;

  const text = `
Rock View Beach Resort · Account Not Confirmed

Mabuhay, ${name},

Your account registration was not confirmed within the 1-minute time limit.
The unconfirmed account has been automatically removed from our system.

Try Again, please make sure you confirm.

Rock View Beach Resort
Brgy. Patar, Bolinao, Pangasinan, Philippines
`;

  return await mail.sendMail({
    from: env.SMTP_FROM,
    to,
    subject: 'Account Not Confirmed · Try Again · Rock View Beach Resort',
    text,
    html,
  });
}

/**
 * Sends immediate "Refund Request Received & In Process" email on the day requested.
 */
export async function sendRefundRequestedEmail({
  to,
  name = 'Guest',
  reservationId = '',
  roomName = 'Patar Beach Suite',
  checkIn = '',
  checkOut = '',
  amount = 0,
  reason = 'Guest requested refund',
  dateRequested = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
}) {
  const mail = getTransporter();
  const shortId = (reservationId || '').slice(0, 8).toUpperCase() || 'RESORT-REF';

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Refund Request In Process</title>
</head>
<body style="margin: 0; padding: 0; background-color: #0F172A; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #F8FAFC;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #0F172A; padding: 36px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width: 560px; background-color: #1E293B; border: 1px solid #334155; border-radius: 18px; overflow: hidden; box-shadow: 0 10px 25px rgba(0, 0, 0, 0.45);">
          <!-- Header Banner -->
          <tr>
            <td style="background: linear-gradient(135deg, #D97706, #F59E0B, #FBBF24); padding: 26px 30px; text-align: left;">
              <span style="font-size: 11px; letter-spacing: 0.15em; color: rgba(15,23,42,0.85); text-transform: uppercase; font-weight: 800;">Rock View Beach Resort · Guest Billing Operations</span>
              <h1 style="margin: 6px 0 0; color: #0F172A; font-size: 22px; font-weight: 800; letter-spacing: -0.02em;">Refund Request In Process</h1>
            </td>
          </tr>

          <!-- Main Content -->
          <tr>
            <td style="padding: 30px;">
              <p style="margin: 0 0 16px; font-size: 15px; color: #E2E8F0; line-height: 1.5;">
                Mabuhay, <strong>${name}</strong>,
              </p>
              <p style="margin: 0 0 20px; font-size: 14px; color: #94A3B8; line-height: 1.6;">
                We have received your refund request today (<strong>${dateRequested}</strong>) for Booking Reference <strong style="color: #38BDF8;">#${shortId}</strong>. Our finance and resort administration team has placed this request into active processing.
              </p>

              <!-- Reservation & Refund Details Table -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-bottom: 24px; background-color: #0F172A; border: 1px solid #334155; border-radius: 12px; overflow: hidden;">
                <tr>
                  <td style="padding: 14px 18px; border-bottom: 1px solid #1E293B; font-size: 13px; color: #94A3B8;">Booking Reference:</td>
                  <td style="padding: 14px 18px; border-bottom: 1px solid #1E293B; font-size: 13px; color: #F8FAFC; font-weight: 700; text-align: right;">#${shortId}</td>
                </tr>
                <tr>
                  <td style="padding: 14px 18px; border-bottom: 1px solid #1E293B; font-size: 13px; color: #94A3B8;">Room Reserved:</td>
                  <td style="padding: 14px 18px; border-bottom: 1px solid #1E293B; font-size: 13px; color: #F8FAFC; text-align: right;">${roomName}</td>
                </tr>
                ${checkIn && checkOut ? `
                <tr>
                  <td style="padding: 14px 18px; border-bottom: 1px solid #1E293B; font-size: 13px; color: #94A3B8;">Stay Schedule:</td>
                  <td style="padding: 14px 18px; border-bottom: 1px solid #1E293B; font-size: 13px; color: #F8FAFC; text-align: right;">${checkIn} → ${checkOut}</td>
                </tr>
                ` : ''}
                <tr>
                  <td style="padding: 14px 18px; border-bottom: 1px solid #1E293B; font-size: 13px; color: #94A3B8;">Refund Amount:</td>
                  <td style="padding: 14px 18px; border-bottom: 1px solid #1E293B; font-size: 16px; color: #F59E0B; font-weight: 800; text-align: right;">₱${Number(amount).toLocaleString()}</td>
                </tr>
                <tr>
                  <td style="padding: 14px 18px; font-size: 13px; color: #94A3B8;">Stated Reason:</td>
                  <td style="padding: 14px 18px; font-size: 13px; color: #CBD5E1; text-align: right;">${reason}</td>
                </tr>
              </table>

              <!-- Notice Badge -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-bottom: 24px;">
                <tr>
                  <td style="background-color: rgba(245, 158, 11, 0.1); border: 1px solid rgba(245, 158, 11, 0.35); border-radius: 12px; padding: 16px 18px;">
                    <span style="display: block; font-size: 12px; color: #FBBF24; font-weight: 700; margin-bottom: 4px;">⏳ Processing Window</span>
                    <span style="display: block; font-size: 13px; color: #CBD5E1; line-height: 1.5;">
                      Standard payment reconciliations are reviewed and disbursed within 1 to 3 banking business days. You will receive an immediate confirmation email as soon as the funds are approved and dispatched.
                    </span>
                  </td>
                </tr>
              </table>

              <p style="margin: 0; font-size: 12px; color: #64748B; line-height: 1.5;">
                Need assistance with this claim? Contact our Accounting & Concierge desk directly at concierge@rockviewresort.ph or call +63 900 555 0123.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #0F172A; border-top: 1px solid #334155; padding: 18px 30px; text-align: center;">
              <p style="margin: 0; font-size: 11px; color: #64748B; line-height: 1.5;">
                Rock View Beach Resort Management System<br>
                Brgy. Patar, Bolinao, Pangasinan, Philippines 2406<br>
                Direct Concierge Desk: +63 900 555 0123
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;

  const text = `
Rock View Beach Resort · Refund Request In Process

Mabuhay, ${name},

We received your refund request today (${dateRequested}) for Booking Reference #${shortId}.
Our finance and resort administration team has placed this request into active processing.

Details:
- Booking Reference: #${shortId}
- Room: ${roomName}
${checkIn && checkOut ? `- Stay Dates: ${checkIn} → ${checkOut}\n` : ''}- Refund Amount: ₱${Number(amount).toLocaleString()}
- Stated Reason: ${reason}
- Processing Timeline: 1 to 3 banking business days

You will receive an automated confirmation email once the refund is finalized.
For inquiries, contact: concierge@rockviewresort.ph | +63 900 555 0123

Rock View Beach Resort
Brgy. Patar, Bolinao, Pangasinan, Philippines
`;

  return await mail.sendMail({
    from: env.SMTP_FROM,
    to,
    subject: `Refund Request In Process · Booking #${shortId} · Rock View Beach Resort`,
    text,
    html,
  });
}

/**
 * Sends "Refund Confirmed & Processed" email when accounting approves the refund.
 */
export async function sendRefundConfirmedEmail({
  to,
  name = 'Guest',
  reservationId = '',
  roomName = 'Patar Beach Suite',
  amount = 0,
  refundMethod = 'GCash / Original Payment Method',
  referenceNumber = `REF-${Date.now().toString().slice(-6)}`,
  dateProcessed = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
}) {
  const mail = getTransporter();
  const shortId = (reservationId || '').slice(0, 8).toUpperCase() || 'RESORT-REF';

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Refund Confirmed and Processed</title>
</head>
<body style="margin: 0; padding: 0; background-color: #0F172A; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #F8FAFC;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #0F172A; padding: 36px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width: 560px; background-color: #1E293B; border: 1px solid #334155; border-radius: 18px; overflow: hidden; box-shadow: 0 10px 25px rgba(0, 0, 0, 0.45);">
          <!-- Header Banner -->
          <tr>
            <td style="background: linear-gradient(135deg, #059669, #10B981, #34D399); padding: 26px 30px; text-align: left;">
              <span style="font-size: 11px; letter-spacing: 0.15em; color: rgba(15,23,42,0.85); text-transform: uppercase; font-weight: 800;">Rock View Beach Resort · Guest Billing Operations</span>
              <h1 style="margin: 6px 0 0; color: #0F172A; font-size: 22px; font-weight: 800; letter-spacing: -0.02em;">Refund Confirmed & Processed</h1>
            </td>
          </tr>

          <!-- Main Content -->
          <tr>
            <td style="padding: 30px;">
              <p style="margin: 0 0 16px; font-size: 15px; color: #E2E8F0; line-height: 1.5;">
                Mabuhay, <strong>${name}</strong>,
              </p>
              <p style="margin: 0 0 20px; font-size: 14px; color: #94A3B8; line-height: 1.6;">
                Great news! Your refund for Booking Reference <strong style="color: #38BDF8;">#${shortId}</strong> has been <strong>approved and confirmed</strong> by our accounting office on <strong>${dateProcessed}</strong>.
              </p>

              <!-- Confirmation Details Table -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-bottom: 24px; background-color: #0F172A; border: 1px solid #334155; border-radius: 12px; overflow: hidden;">
                <tr>
                  <td style="padding: 14px 18px; border-bottom: 1px solid #1E293B; font-size: 13px; color: #94A3B8;">Booking Reference:</td>
                  <td style="padding: 14px 18px; border-bottom: 1px solid #1E293B; font-size: 13px; color: #F8FAFC; font-weight: 700; text-align: right;">#${shortId}</td>
                </tr>
                <tr>
                  <td style="padding: 14px 18px; border-bottom: 1px solid #1E293B; font-size: 13px; color: #94A3B8;">Room:</td>
                  <td style="padding: 14px 18px; border-bottom: 1px solid #1E293B; font-size: 13px; color: #F8FAFC; text-align: right;">${roomName}</td>
                </tr>
                <tr>
                  <td style="padding: 14px 18px; border-bottom: 1px solid #1E293B; font-size: 13px; color: #94A3B8;">Refunded Amount:</td>
                  <td style="padding: 14px 18px; border-bottom: 1px solid #1E293B; font-size: 18px; color: #10B981; font-weight: 800; text-align: right;">₱${Number(amount).toLocaleString()}</td>
                </tr>
                <tr>
                  <td style="padding: 14px 18px; border-bottom: 1px solid #1E293B; font-size: 13px; color: #94A3B8;">Payment Channel:</td>
                  <td style="padding: 14px 18px; border-bottom: 1px solid #1E293B; font-size: 13px; color: #F8FAFC; text-align: right;">${refundMethod}</td>
                </tr>
                <tr>
                  <td style="padding: 14px 18px; font-size: 13px; color: #94A3B8;">Reference No.:</td>
                  <td style="padding: 14px 18px; font-size: 13px; color: #38BDF8; font-family: monospace; font-weight: 700; text-align: right;">${referenceNumber}</td>
                </tr>
              </table>

              <!-- Success Alert Box -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-bottom: 24px;">
                <tr>
                  <td style="background-color: rgba(16, 185, 129, 0.1); border: 1px solid rgba(16, 185, 129, 0.35); border-radius: 12px; padding: 16px 18px;">
                    <span style="display: block; font-size: 12px; color: #34D399; font-weight: 700; margin-bottom: 4px;">✅ Funds Dispatched</span>
                    <span style="display: block; font-size: 13px; color: #CBD5E1; line-height: 1.5;">
                      Depending on your financial institution or e-wallet provider (GCash / Maya / Bank), the reflected balance may take between a few minutes to 48 hours to appear on your transaction statement.
                    </span>
                  </td>
                </tr>
              </table>

              <p style="margin: 0; font-size: 12px; color: #64748B; line-height: 1.5;">
                We hope to welcome you to Rock View Beach Resort in the future! For further inquiries, contact us at concierge@rockviewresort.ph.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #0F172A; border-top: 1px solid #334155; padding: 18px 30px; text-align: center;">
              <p style="margin: 0; font-size: 11px; color: #64748B; line-height: 1.5;">
                Rock View Beach Resort Management System<br>
                Brgy. Patar, Bolinao, Pangasinan, Philippines 2406<br>
                Direct Concierge Desk: +63 900 555 0123
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;

  const text = `
Rock View Beach Resort · Refund Confirmed & Processed

Mabuhay, ${name},

Your refund for Booking Reference #${shortId} has been confirmed and processed on ${dateProcessed}.

Details:
- Booking Reference: #${shortId}
- Room: ${roomName}
- Total Refunded: ₱${Number(amount).toLocaleString()}
- Refund Channel: ${refundMethod}
- Reference Number: ${referenceNumber}

The funds have been returned to your original payment method.
Salamat for your patience, and we hope to welcome you to Bolinao soon!

Rock View Beach Resort
Brgy. Patar, Bolinao, Pangasinan, Philippines
`;

  return await mail.sendMail({
    from: env.SMTP_FROM,
    to,
    subject: `Refund Confirmed & Processed · Booking #${shortId} · Rock View Beach Resort`,
    text,
    html,
  });
}



