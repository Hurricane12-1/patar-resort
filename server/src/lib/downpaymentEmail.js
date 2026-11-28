import { env } from '../config/env.js';
import { getTransporter } from './mailer.js';

const QR_CID = 'downpayment-qr';

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatPeso(amount) {
  return `₱${Number(amount || 0).toLocaleString('en-US')}`;
}

function formatDeadline(iso) {
  return new Date(iso).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'Asia/Manila',
  });
}

export async function sendDownpaymentQrEmail({
  to,
  name = 'Guest',
  reference,
  amount,
  rooms = [],
  checkIn = '',
  checkOut = '',
  expiresAt,
  qrPng,
}) {
  const mail = getTransporter();
  const deadline = formatDeadline(expiresAt);
  const amountLabel = formatPeso(amount);
  const roomsLabel = rooms.length ? rooms.join(' + ') : 'Your stay';
  const stayLabel = checkIn && checkOut ? `${checkIn} → ${checkOut}` : '';

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Downpayment QR Code · Rock View Beach Resort</title>
</head>
<body style="margin: 0; padding: 0; background-color: #0F172A; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #F8FAFC;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #0F172A; padding: 32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width: 540px; background-color: #1E293B; border: 1px solid #334155; border-radius: 12px; overflow: hidden;">
          <tr>
            <td style="background-color: #006699; padding: 24px 28px;">
              <span style="font-size: 11px; letter-spacing: 0.15em; color: #FFFFFF; text-transform: uppercase; font-weight: 700;">Rock View Beach Resort · Patar Beach</span>
              <h1 style="margin: 6px 0 0; color: #FFFFFF; font-size: 21px; font-weight: 800;">Downpayment QR Code</h1>
            </td>
          </tr>
          <tr>
            <td style="padding: 28px;">
              <p style="margin: 0 0 14px; font-size: 15px; color: #E2E8F0; line-height: 1.5;">
                Hi <strong>${escapeHtml(name)}</strong>,
              </p>
              <p style="margin: 0 0 20px; font-size: 14px; color: #CBD5E1; line-height: 1.6;">
                Your stay at <strong>${escapeHtml(roomsLabel)}</strong>${stayLabel ? ` (${escapeHtml(stayLabel)})` : ''} is held for you. Pay the downpayment of <strong>${escapeHtml(amountLabel)}</strong> by <strong>${escapeHtml(deadline)}</strong> to keep these dates.
              </p>

              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-bottom: 20px; background-color: #0F172A; border: 1px solid #334155; border-radius: 10px;">
                <tr>
                  <td align="center" style="padding: 22px 16px;">
                    <img src="cid:${QR_CID}" width="240" height="240" alt="Downpayment QR code for reference ${escapeHtml(reference)}" style="display: block; margin: 0 auto 12px; width: 240px; height: 240px; background-color: #FFFFFF; border-radius: 8px;">
                    <span style="display: block; font-size: 12px; color: #94A3B8;">Reference</span>
                    <span style="display: block; font-family: Consolas, 'Liberation Mono', Menlo, Courier, monospace; font-size: 18px; font-weight: 700; color: #38BDF8; letter-spacing: 0.08em;">${escapeHtml(reference)}</span>
                  </td>
                </tr>
              </table>

              <p style="margin: 0 0 8px; font-size: 14px; color: #E2E8F0; line-height: 1.6;">
                1. Scan the QR code above and pay <strong>${escapeHtml(amountLabel)}</strong>.
              </p>
              <p style="margin: 0 0 20px; font-size: 14px; color: #E2E8F0; line-height: 1.6;">
                2. Go back to the booking page and press <strong>I have paid</strong>.
              </p>

              <p style="margin: 0 0 8px; font-size: 13px; color: #FBBF24; line-height: 1.5;">
                The rooms are released if the downpayment is not confirmed by <strong>${escapeHtml(deadline)}</strong> (15 minutes after booking).
              </p>
            </td>
          </tr>
          <tr>
            <td style="background-color: #0F172A; border-top: 1px solid #334155; padding: 18px 28px; text-align: center;">
              <p style="margin: 0; font-size: 11px; color: #64748B; line-height: 1.5;">
                Rock View Beach Resort<br>
                Brgy. Patar, Bolinao, Pangasinan, Philippines 2406<br>
                Front Desk &amp; Concierge: +63 900 555 0123
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

  const text = [
    'Rock View Beach Resort · Downpayment QR Code',
    '',
    `Hi ${name},`,
    '',
    `Your stay at ${roomsLabel}${stayLabel ? ` (${stayLabel})` : ''} is held for you.`,
    `Pay the downpayment of ${amountLabel} by ${deadline} to keep these dates.`,
    '',
    `Reference: ${reference}`,
    '',
    '1. Scan the QR code attached to this email and pay the downpayment.',
    '2. Go back to the booking page and press "I have paid".',
    '',
    `The rooms are released if the downpayment is not confirmed by ${deadline} (15 minutes after booking).`,
    '',
    'Rock View Beach Resort',
    'Brgy. Patar, Bolinao, Pangasinan, Philippines',
  ].join('\n');

  return mail.sendMail({
    from: env.SMTP_FROM,
    to,
    subject: `Pay ${amountLabel} downpayment by ${deadline} · Rock View Beach Resort`,
    text,
    html,
    attachments: [
      {
        filename: `downpayment-${reference}.png`,
        content: qrPng,
        contentType: 'image/png',
        cid: QR_CID,
      },
    ],
  });
}
