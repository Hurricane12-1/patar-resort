// Labeled full-page screenshots of the public pages, using headless Edge over the DevTools protocol.
// Usage: node capture.mjs <baseUrl> <outDir>
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const [, , baseUrl, outDir] = process.argv;
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const PORT = 9333;
const PROFILE = join(tmpdir(), 'rockview-ui-capture-profile');
mkdirSync(outDir, { recursive: true });

const DESKTOP = { width: 1440, height: 900, mobile: false };
const MOBILE = { width: 390, height: 844, mobile: true };
const MOBILE_UA = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Mobile Safari/537.36';

const SHOTS = [
  { name: '01-home', path: '/', view: DESKTOP },
  { name: '02-home-chat-open', path: '/', view: DESKTOP, actions: [{ click: '.chat-fab' }] },
  { name: '03-rooms', path: '/rooms', view: DESKTOP },
  { name: '04-policy', path: '/policy', view: DESKTOP },
  { name: '05-terms', path: '/terms', view: DESKTOP },
  { name: '06-rules', path: '/rules', view: DESKTOP },
  { name: '07-privacy', path: '/privacy', view: DESKTOP },
  { name: '08-data-deletion', path: '/data-deletion', view: DESKTOP },
  { name: '09-guest-login', path: '/client/login', view: DESKTOP },
  { name: '10-guest-create-account', path: '/client/login', view: DESKTOP, actions: [{ clickText: 'Create Account', exact: true }] },
  { name: '11-guest-forgot-password', path: '/client/login', view: DESKTOP, actions: [{ clickText: 'Forgot account or password?' }] },
  { name: '12-staff-login', path: '/staff/login', view: DESKTOP },
  { name: '13-staff-forgot-password', path: '/staff/login', view: DESKTOP, actions: [{ clickText: 'Forgot' }] },
  { name: '14-admin-login', path: '/admin', view: DESKTOP },
  { name: '15-recovery', path: '/recovery', view: DESKTOP },
  { name: '16-mobile-home', path: '/', view: MOBILE },
  { name: '17-mobile-home-chat-open', path: '/', view: MOBILE, actions: [{ click: '.chat-fab' }] },
  { name: '18-mobile-guest-login', path: '/client/login', view: MOBILE },
  { name: '19-mobile-guest-create-account', path: '/client/login', view: MOBILE, actions: [{ clickText: 'Create Account', exact: true }] },
  { name: '20-mobile-policy', path: '/policy', view: MOBILE },
];

const LABEL_SCRIPT = `(() => {
  document.querySelectorAll('[data-ui-label-overlay]').forEach((n) => n.remove());
  const SEL = 'a[href],button,input:not([type=hidden]),select,textarea,[role="button"],[role="link"],[role="tab"],[role="checkbox"],[role="switch"],[role="menuitem"],[role="combobox"],summary,form,dialog,[role="dialog"],[aria-modal="true"]';
  const visible = (el) => {
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    return r.width > 2 && r.height > 2 && cs.visibility !== 'hidden' && cs.display !== 'none' && Number(cs.opacity) > 0.05;
  };
  const kindOf = (el) => {
    const tag = el.tagName.toLowerCase();
    const role = el.getAttribute('role');
    if (tag === 'dialog' || role === 'dialog' || el.getAttribute('aria-modal') === 'true') return 'modal';
    if (tag === 'form') return 'form';
    if (tag === 'select' || role === 'combobox') return 'dropdown';
    if (tag === 'input' || tag === 'textarea') {
      const t = (el.getAttribute('type') || 'text').toLowerCase();
      if (t === 'checkbox' || t === 'radio') return 'checkbox';
      if (t === 'submit' || t === 'button' || t === 'reset') return 'button';
      return 'field';
    }
    if (tag === 'a' || role === 'link') return 'link';
    if (role === 'tab') return 'tab';
    if (role === 'checkbox' || role === 'switch') return 'checkbox';
    return 'button';
  };
  const nameOf = (el) => {
    const ids = (el.getAttribute('aria-labelledby') || '').split(' ').filter(Boolean);
    const byId = ids.map((id) => (document.getElementById(id) || {}).innerText || '').join(' ');
    let label = '';
    if (el.id) {
      const l = document.querySelector('label[for="' + CSS.escape(el.id) + '"]');
      if (l) label = l.innerText;
    }
    if (!label && el.closest('label')) label = el.closest('label').innerText;
    const selected = el.tagName === 'SELECT' && el.options[el.selectedIndex] ? el.options[el.selectedIndex].text : '';
    const own = el.tagName === 'FORM' || el.tagName === 'DIALOG' || el.getAttribute('role') === 'dialog'
      ? ((el.querySelector('h1,h2,h3,h4,legend') || {}).innerText || '')
      : el.innerText;
    const text = el.getAttribute('aria-label') || byId || label || selected || own || el.getAttribute('placeholder') || el.getAttribute('title') || el.getAttribute('alt') || (el.querySelector('img') || {}).alt || el.getAttribute('name') || el.value || '';
    return String(text).replace(/\\s+/g, ' ').trim().slice(0, 90);
  };
  const colors = { button: '#2563EB', link: '#059669', field: '#D97706', dropdown: '#B45309', checkbox: '#7C3AED', tab: '#0891B2', form: '#6B7280', modal: '#DC2626' };
  const items = [];
  const seen = new Set();
  let n = 0;
  for (const el of document.querySelectorAll(SEL)) {
    if (seen.has(el) || !visible(el)) continue;
    seen.add(el);
    const r = el.getBoundingClientRect();
    const kind = kindOf(el);
    const fixed = (() => { for (let p = el; p; p = p.parentElement) { const pos = getComputedStyle(p).position; if (pos === 'fixed' || pos === 'sticky') return true; } return false; })();
    n += 1;
    const left = r.left + (fixed ? 0 : scrollX);
    const top = r.top + (fixed ? 0 : scrollY);
    const box = document.createElement('div');
    box.setAttribute('data-ui-label-overlay', '');
    box.style.cssText = 'position:' + (fixed ? 'fixed' : 'absolute') + ';left:' + left + 'px;top:' + top + 'px;width:' + r.width + 'px;height:' + r.height + 'px;outline:2px ' + (kind === 'form' || kind === 'modal' ? 'dashed' : 'solid') + ' ' + colors[kind] + ';outline-offset:1px;pointer-events:none;z-index:2147483646;';
    const tag = document.createElement('div');
    tag.setAttribute('data-ui-label-overlay', '');
    tag.textContent = String(n);
    tag.style.cssText = 'position:' + (fixed ? 'fixed' : 'absolute') + ';left:' + Math.max(0, left - 2) + 'px;top:' + Math.max(0, top - 14) + 'px;background:' + colors[kind] + ';color:#fff;font:700 10px/14px Arial,sans-serif;padding:0 4px;border-radius:3px;pointer-events:none;z-index:2147483647;';
    document.body.appendChild(box);
    document.body.appendChild(tag);
    items.push({
      n,
      kind,
      name: nameOf(el),
      href: el.tagName === 'A' ? el.getAttribute('href') || '' : undefined,
      disabled: Boolean(el.disabled || el.getAttribute('aria-disabled') === 'true'),
      size: Math.round(r.width) + 'x' + Math.round(r.height),
      fixed,
    });
  }
  return JSON.stringify(items);
})()`;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function waitForDevtools() {
  for (let i = 0; i < 60; i += 1) {
    try {
      const res = await fetch(`http://127.0.0.1:${PORT}/json/version`);
      if (res.ok) return;
    } catch {
      await sleep(500);
    }
  }
  throw new Error('Edge did not start its debugging port.');
}

function connect(wsUrl) {
  const ws = new WebSocket(wsUrl);
  let nextId = 1;
  const pending = new Map();
  const listeners = new Map();
  ws.onmessage = (event) => {
    const msg = JSON.parse(event.data);
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) reject(new Error(`${msg.error.message}`));
      else resolve(msg.result);
    } else if (msg.method && listeners.has(msg.method)) {
      for (const fn of listeners.get(msg.method)) fn(msg.params);
    }
  };
  const ready = new Promise((resolve, reject) => {
    ws.onopen = resolve;
    ws.onerror = () => reject(new Error('Could not connect to Edge.'));
  });
  return {
    ready,
    send(method, params = {}) {
      const id = nextId++;
      ws.send(JSON.stringify({ id, method, params }));
      return new Promise((resolve, reject) => pending.set(id, { resolve, reject }));
    },
    once(method, timeoutMs) {
      return new Promise((resolve) => {
        const timer = setTimeout(() => resolve(null), timeoutMs);
        const fn = (params) => {
          clearTimeout(timer);
          listeners.set(method, (listeners.get(method) || []).filter((f) => f !== fn));
          resolve(params);
        };
        listeners.set(method, [...(listeners.get(method) || []), fn]);
      });
    },
    close: () => ws.close(),
  };
}

const evaluate = async (cdp, expression) => {
  const result = await cdp.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  return result?.result?.value;
};

async function runAction(cdp, action) {
  if (action.click) {
    return evaluate(cdp, `(() => { const el = document.querySelector(${JSON.stringify(action.click)}); if (!el) return false; el.click(); return true; })()`);
  }
  if (action.scrollToText) {
    return evaluate(cdp, `(() => { const t = ${JSON.stringify(action.scrollToText.toLowerCase())}; const el = [...document.querySelectorAll('button,a,[role=button]')].find((e) => (e.innerText || '').trim().toLowerCase() === t); if (!el) return false; el.scrollIntoView({ block: 'center' }); return true; })()`);
  }
  if (action.clickText) {
    return evaluate(cdp, `(() => {
      const t = ${JSON.stringify(action.clickText.toLowerCase())};
      const exact = ${Boolean(action.exact)};
      const candidates = [...document.querySelectorAll('button,a,[role=button],[role=tab]')].filter((e) => {
        const r = e.getBoundingClientRect();
        if (r.width < 2 || r.height < 2) return false;
        const text = (e.innerText || e.getAttribute('aria-label') || '').trim().toLowerCase();
        return exact ? text === t : text.includes(t);
      });
      if (!candidates.length) return false;
      candidates[0].click();
      return true;
    })()`);
  }
  return false;
}

async function capture(cdp, shot) {
  const { view } = shot;
  await cdp.send('Emulation.setDeviceMetricsOverride', { width: view.width, height: view.height, deviceScaleFactor: 1, mobile: view.mobile });
  await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: view.mobile });
  await cdp.send('Network.setUserAgentOverride', { userAgent: view.mobile ? MOBILE_UA : '' });
  const loaded = cdp.once('Page.loadEventFired', 25000);
  await cdp.send('Page.navigate', { url: baseUrl.replace(/\/+$/, '') + shot.path });
  await loaded;
  await sleep(3500);
  await evaluate(cdp, `new Promise(async (resolve) => { for (let y = 0; y < document.body.scrollHeight; y += 700) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 120)); } window.scrollTo(0, 0); setTimeout(resolve, 600); })`);
  const actionResults = [];
  for (const action of shot.actions || []) {
    actionResults.push({ action, ok: await runAction(cdp, action) });
    await sleep(1500);
  }
  const finalUrl = await evaluate(cdp, 'location.pathname + location.search');
  const title = await evaluate(cdp, 'document.title');
  const items = JSON.parse((await evaluate(cdp, LABEL_SCRIPT)) || '[]');
  await sleep(300);
  const metrics = await cdp.send('Page.getLayoutMetrics');
  const size = metrics.cssContentSize || metrics.contentSize;
  const height = Math.min(Math.ceil(size.height), 14000);
  const shotData = await cdp.send('Page.captureScreenshot', {
    format: 'jpeg',
    quality: 72,
    captureBeyondViewport: true,
    clip: { x: 0, y: 0, width: view.width, height, scale: 1 },
  });
  const file = `${shot.name}.jpg`;
  writeFileSync(join(outDir, file), Buffer.from(shotData.data, 'base64'));
  return { ...shot, view: view.mobile ? 'mobile 390x844' : 'desktop 1440x900', file, finalUrl, title, height, actionResults, items };
}

const edge = spawn(EDGE, [
  '--headless=new',
  '--disable-gpu',
  `--remote-debugging-port=${PORT}`,
  `--user-data-dir=${PROFILE}`,
  '--no-first-run',
  '--no-default-browser-check',
  '--hide-scrollbars',
  'about:blank',
], { stdio: 'ignore' });

const results = [];
try {
  await waitForDevtools();
  const target = await (await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' })).json();
  const cdp = connect(target.webSocketDebuggerUrl);
  await cdp.ready;
  await cdp.send('Page.enable');
  await cdp.send('Runtime.enable');
  await cdp.send('Network.enable');
  for (const shot of SHOTS) {
    try {
      const r = await capture(cdp, shot);
      results.push(r);
      const unlabeled = r.items.filter((i) => !i.name && i.kind !== 'form' && i.kind !== 'modal').length;
      console.log(`${r.name.padEnd(32)} ${String(r.items.length).padStart(4)} elements, ${unlabeled} controls without a label, ${r.finalUrl}${r.actionResults.some((a) => !a.ok) ? '  (an action did not find its target)' : ''}`);
    } catch (err) {
      console.log(`${shot.name.padEnd(32)} FAILED: ${err.message}`);
      results.push({ ...shot, error: err.message });
    }
  }
  cdp.close();
} finally {
  writeFileSync(join(outDir, 'inventory.json'), JSON.stringify({ baseUrl, when: new Date().toISOString(), results }, null, 2));
  edge.kill();
}
