// Builds docs/ui-inventory/README.md from screenshots/inventory.json.
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const dir = process.argv[2];
const inv = JSON.parse(readFileSync(join(dir, 'screenshots', 'inventory.json'), 'utf8'));
const KINDS = ['button', 'link', 'field', 'dropdown', 'checkbox', 'tab', 'form', 'modal'];
const COLOR = { button: 'blue', link: 'green', field: 'amber', dropdown: 'dark amber', checkbox: 'purple', tab: 'teal', form: 'grey dashed', modal: 'red dashed' };
const esc = (s) => String(s ?? '').replace(/\|/g, '\\|').replace(/\n/g, ' ');

const lines = [];
lines.push('# Public pages: labeled screenshots and UI inventory', '');
lines.push(`Captured from ${inv.baseUrl} on ${inv.when.slice(0, 10)} with headless Edge. Every button, link, field, dropdown, checkbox, form and open modal is outlined and numbered on its screenshot; the table under each page says what each number is.`, '');
lines.push('Colors: ' + KINDS.map((k) => `${k} = ${COLOR[k]}`).join(', ') + '.', '');
lines.push('Re-run after a deploy: `node capture.mjs <site> docs/ui-inventory/screenshots`, then `node make_report.mjs docs/ui-inventory` (both scripts are in docs/ui-inventory/tools).', '');

lines.push('## Summary', '');
lines.push('| # | Page | View | Address | Buttons | Links | Fields | Dropdowns | Checkboxes | Forms | Controls without a label |');
lines.push('|---|---|---|---|---|---|---|---|---|---|---|');
inv.results.forEach((r, i) => {
  const items = r.items || [];
  const count = (k) => items.filter((x) => x.kind === k).length;
  const unlabeled = items.filter((x) => !x.name && x.kind !== 'form' && x.kind !== 'modal').length;
  lines.push(`| ${i + 1} | [${esc(r.name)}](#${r.name}) | ${r.view} | \`${esc(r.finalUrl || r.path)}\` | ${count('button')} | ${count('link')} | ${count('field')} | ${count('dropdown')} | ${count('checkbox')} | ${count('form')} | ${unlabeled} |`);
});
lines.push('');

lines.push('## Findings', '');
lines.push('1. **No unlabeled controls on the public pages.** Every button, link and field has a readable name.');
lines.push('2. **Admin sign-in fields are named only by their placeholder.** The captions "Administrator username or email" and "Password" are not linked to the inputs, so screen readers read "e.g. jjd001.administrator@rockview.ph". That placeholder also shows the format of admin login IDs.');
lines.push('3. **The recovery console shows to signed-out visitors.** `/recovery` renders the console with "Database Notice: Missing token", mentions Supabase on screen, and says "Queue is Clear" even though nothing loaded. No data is exposed (the server refuses the request), but the page should show only a sign-in prompt.');
lines.push('4. **Staff sign-in has no "Forgot password" link.** The admin and guest sign-in pages both have one.');
lines.push('5. **The chat box input is named only by its placeholder** ("Ask about rooms, rates, amenities, check-in…").');
lines.push('6. **Signed-in pages are not in this capture.** The guest dashboard (`/client`, bookings, book, help, profile, requests), the staff portal (`/staff/operations`, `/staff/reception`, `/staff/accounting`), the admin console and the signed-in recovery console need an account. Signed out, `/client/book` and `/client/help` show the sign-in page.', '');

for (const r of inv.results) {
  lines.push(`## ${r.name}`, '');
  if (r.error) {
    lines.push(`Not captured: ${esc(r.error)}`, '');
    continue;
  }
  const failed = (r.actionResults || []).filter((a) => !a.ok);
  lines.push(`**Address:** \`${esc(r.finalUrl)}\` · **View:** ${r.view} · **Page height:** ${r.height}px${failed.length ? ' · Note: the scripted click did not find its target, so this shows the page without it' : ''}`, '');
  lines.push(`![${esc(r.name)}](screenshots/${r.file})`, '');
  lines.push('| # | Type | Label | Goes to / state |');
  lines.push('|---|---|---|---|');
  for (const item of r.items || []) {
    const notes = [item.href ? `\`${esc(item.href)}\`` : '', item.disabled ? 'disabled' : '', item.fixed ? 'stays on screen when scrolling' : ''].filter(Boolean).join(', ');
    lines.push(`| ${item.n} | ${item.kind} | ${esc(item.name) || '_(none)_'} | ${notes} |`);
  }
  lines.push('');
}

writeFileSync(join(dir, 'README.md'), lines.join('\n'));
console.log(`wrote ${join(dir, 'README.md')} (${lines.length} lines)`);
