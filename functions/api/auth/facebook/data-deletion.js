// Cloudflare Pages Function: Meta / Facebook Data Deletion Request Callback
// Specification: https://developers.facebook.com/documentation/development/create-an-app/app-dashboard/data-deletion-callback

function base64UrlToUint8Array(base64Url) {
  const normalized = String(base64Url || '').replace(/-/g, '+').replace(/_/g, '/');
  const pad = normalized.length % 4;
  const padded = pad ? normalized + '='.repeat(4 - pad) : normalized;
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

async function parseSignedRequest(signedRequest, appSecret) {
  if (!signedRequest || typeof signedRequest !== 'string' || !signedRequest.includes('.')) {
    return null;
  }
  const [encodedSig, payload] = signedRequest.split('.', 2);
  const sigBytes = base64UrlToUint8Array(encodedSig);
  const payloadBytes = base64UrlToUint8Array(payload);
  const dataJson = new TextDecoder().decode(payloadBytes);
  const data = JSON.parse(dataJson);

  if (appSecret) {
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(appSecret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify']
    );
    const valid = await crypto.subtle.verify('HMAC', key, sigBytes, encoder.encode(payload));
    if (!valid) {
      throw new Error('Bad Signed JSON signature!');
    }
  }

  return data;
}

function generateConfirmationCode() {
  const bytes = new Uint8Array(4);
  crypto.getRandomValues(bytes);
  const hex = Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase();
  return `DEL-${hex}`;
}

export async function onRequestPost(context) {
  const { request, env, waitUntil } = context;
  let signedRequest = null;
  let email = null;

  const contentType = (request.headers.get('content-type') || '').toLowerCase();
  try {
    if (contentType.includes('application/json')) {
      const body = await request.json();
      signedRequest = body?.signed_request || null;
      email = body?.email || null;
    } else if (
      contentType.includes('application/x-www-form-urlencoded') ||
      contentType.includes('multipart/form-data')
    ) {
      const formData = await request.formData();
      signedRequest = formData.get('signed_request');
      email = formData.get('email');
    } else {
      const text = await request.text();
      const params = new URLSearchParams(text);
      signedRequest = params.get('signed_request');
      email = params.get('email');
    }
  } catch {}

  const appSecret = env?.FACEBOOK_APP_SECRET || env?.FB_APP_SECRET || '';
  if (signedRequest) {
    try {
      const parsed = await parseSignedRequest(String(signedRequest), appSecret);
      if (!parsed || !parsed.user_id) {
        return new Response(
          JSON.stringify({ error: 'Invalid signed_request: missing user_id.' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }
    } catch (err) {
      return new Response(
        JSON.stringify({ error: err.message || 'Bad Signed JSON signature!' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }
  }

  const confirmationCode = generateConfirmationCode();
  const statusUrl = `https://patar-resort.pages.dev/data-deletion?id=${confirmationCode}`;

  // Forward asynchronously to Render backend to purge database records
  if (typeof waitUntil === 'function') {
    waitUntil(
      fetch('https://patar-resort.onrender.com/api/auth/facebook/data-deletion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ signed_request: signedRequest, email }),
      }).catch(() => {})
    );
  }

  return new Response(
    JSON.stringify({
      url: statusUrl,
      confirmation_code: confirmationCode,
    }),
    {
      status: 200,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store',
      },
    }
  );
}

export async function onRequestGet(context) {
  const url = new URL(context.request.url);
  const id = url.searchParams.get('id') || url.searchParams.get('code');
  const target = id
    ? `https://patar-resort.pages.dev/data-deletion?id=${encodeURIComponent(id)}`
    : 'https://patar-resort.pages.dev/data-deletion';
  return Response.redirect(target, 302);
}
