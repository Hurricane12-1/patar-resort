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
        const previewId = `mock-email-${Date.now()}`;
        console.log('\n============================================================');
        console.log(' 📧 [J & D Beach House Mailer - Development / Offline Preview]');
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
              <span style="font-size: 11px; letter-spacing: 0.15em; color: rgba(255,255,255,0.9); text-transform: uppercase; font-weight: 700;">J & D Beach House · Patar Beach</span>
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
                We received a request to recover or reset the security credentials for your J & D Beach House account. Please use the verification code below to authorize this request:
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
                ⚠️ <strong>Security Notice:</strong> Never share this code with anyone. J & D Beach House staff will never ask you for your verification code or password.
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
                J & D Beach House Resort Management System<br>
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
J & D Beach House · Account Recovery Verification Code

Mabuhay, ${name}!

Your one-time verification code is: ${code}

This code is valid for 15 minutes. Never share this code with anyone.
If you did not request this, please ignore this email.

J & D Beach House Resort
Brgy. Patar, Bolinao, Pangasinan, Philippines
`;

  return await mail.sendMail({
    from: env.SMTP_FROM,
    to,
    subject: `Your Verification Code: ${code} · J & D Beach House`,
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
                Mabuhay, <strong>${name}</strong>. Your J & D Beach House account password has been updated. You can now sign in with your new credentials.
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
    subject: 'Security Alert: Password Updated · J & D Beach House',
    text: `Your password has been successfully reset. J & D Beach House.`,
    html,
  });
}

/**
 * Sends a 6-digit Two-Factor Authentication (2FA) verification code
 * via Nodemailer (Google Mail / SMTP) to confirm client account creation before finalization.
 */
export async function sendSignup2FAOTP({ to, code, name = 'Guest', provider = 'email' }) {
  const mail = getTransporter();

  const providerLabel = provider === 'facebook'
    ? 'Facebook Integrated Sign-Up'
    : provider === 'google' || provider === 'gmail'
    ? 'Google / Gmail Sign-Up'
    : 'Client Guest Registration';

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>2FA Sign-Up Confirmation</title>
</head>
<body style="margin: 0; padding: 0; background-color: #0F172A; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #F8FAFC;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #0F172A; padding: 36px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width: 540px; background-color: #1E293B; border: 1px solid #334155; border-radius: 18px; overflow: hidden; box-shadow: 0 10px 25px rgba(0, 0, 0, 0.45);">
          <!-- Header Banner -->
          <tr>
            <td style="background: linear-gradient(135deg, #0284C7, #0EA5E9, #38BDF8); padding: 26px 30px; text-align: left;">
              <span style="font-size: 11px; letter-spacing: 0.15em; color: rgba(255,255,255,0.9); text-transform: uppercase; font-weight: 700;">J & D Beach House · Patar Beach</span>
              <h1 style="margin: 6px 0 0; color: #FFFFFF; font-size: 22px; font-weight: 800; letter-spacing: -0.02em;">Finalize Account Sign-Up · 2FA Security</h1>
            </td>
          </tr>

          <!-- Main Content -->
          <tr>
            <td style="padding: 30px;">
              <p style="margin: 0 0 12px; font-size: 15px; color: #E2E8F0; line-height: 1.5;">
                Mabuhay, <strong>${name}</strong>!
              </p>
              <p style="margin: 0 0 8px; font-size: 14px; color: #38BDF8; font-weight: 600;">
                Method: ${providerLabel}
              </p>
              <p style="margin: 0 0 24px; font-size: 14px; color: #94A3B8; line-height: 1.6;">
                Thank you for choosing J & D Beach House. To finalize your client account creation and activate your reservation portal, please enter the two-factor authentication (2FA) verification code below:
              </p>

              <!-- OTP Code Display Card -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-bottom: 24px;">
                <tr>
                  <td align="center" style="background-color: #0F172A; border: 1px solid #0284C7; border-radius: 12px; padding: 22px 16px;">
                    <span style="display: block; font-size: 11px; letter-spacing: 0.15em; color: #38BDF8; text-transform: uppercase; font-weight: 700; margin-bottom: 8px;">2FA Finalization Code</span>
                    <span style="display: block; font-family: Consolas, 'Liberation Mono', Menlo, Courier, monospace; font-size: 38px; font-weight: 800; letter-spacing: 0.35em; color: #38BDF8;">
                      ${code}
                    </span>
                    <span style="display: block; font-size: 12px; color: #64748B; margin-top: 8px;">
                      ⏱️ Valid for 15 minutes · Confirms Client Identity & Guest Manifest
                    </span>
                  </td>
                </tr>
              </table>

              <p style="margin: 0 0 16px; font-size: 13px; color: #F59E0B; line-height: 1.5; font-weight: 500;">
                🔒 <strong>Account Security:</strong> Your resort profile requires 2FA confirmation before the account is finalized. Never share this code.
              </p>

              <p style="margin: 0; font-size: 12px; color: #64748B; line-height: 1.5;">
                If you did not request this account creation, please ignore this email.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #0F172A; border-top: 1px solid #334155; padding: 18px 30px; text-align: center;">
              <p style="margin: 0; font-size: 11px; color: #64748B; line-height: 1.5;">
                J & D Beach House Resort Management System<br>
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
J & D Beach House · 2FA Account Sign-Up Confirmation

Mabuhay, ${name}!

Your 2FA verification code to finalize account sign-up is: ${code}

This code is valid for 15 minutes. Never share this code with anyone.

J & D Beach House Resort
Brgy. Patar, Bolinao, Pangasinan, Philippines
`;

  return await mail.sendMail({
    from: env.SMTP_FROM,
    to,
    subject: `Your 2FA Sign-Up Code: ${code} · J & D Beach House`,
    text,
    html,
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
  <title>Welcome to J & D Beach House</title>
</head>
<body style="margin: 0; padding: 0; background-color: #0F172A; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #F8FAFC;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="padding: 30px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width: 520px; background-color: #1E293B; border: 1px solid #334155; border-radius: 16px; padding: 26px;">
          <tr>
            <td>
              <h2 style="color: #38BDF8; margin: 0 0 12px;">🏖️ Welcome to J & D Beach House!</h2>
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
    subject: 'Welcome to J & D Beach House · Your Account is Finalized ✦',
    text: `Welcome to J & D Beach House, ${name}! Your account has been verified and finalized.`,
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
  <title>Account Not Confirmed · J & D Beach House</title>
</head>
<body style="margin: 0; padding: 0; background-color: #0F172A; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #F8FAFC;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #0F172A; padding: 36px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width: 540px; background-color: #1E293B; border: 1px solid #334155; border-radius: 18px; overflow: hidden; box-shadow: 0 10px 25px rgba(0, 0, 0, 0.45);">
          <!-- Header Banner -->
          <tr>
            <td style="background: linear-gradient(135deg, #EF4444, #DC2626, #B91C1C); padding: 26px 30px; text-align: left;">
              <span style="font-size: 11px; letter-spacing: 0.15em; color: rgba(255,255,255,0.9); text-transform: uppercase; font-weight: 700;">J & D Beach House · Patar Beach</span>
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
                J & D Beach House Resort Management System<br>
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
J & D Beach House · Account Not Confirmed

Mabuhay, ${name},

Your account registration was not confirmed within the 1-minute time limit.
The unconfirmed account has been automatically removed from our system.

Try Again, please make sure you confirm.

J & D Beach House Resort
Brgy. Patar, Bolinao, Pangasinan, Philippines
`;

  return await mail.sendMail({
    from: env.SMTP_FROM,
    to,
    subject: 'Account Not Confirmed · Try Again · J & D Beach House',
    text,
    html,
  });
}


