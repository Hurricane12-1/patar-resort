# Typography: two fonts only

The whole project uses exactly two font families. No other family may appear in the code.

## 1. Playfair Display (headings and brand)

Used for:
- Guest-site headings: hero titles, section titles, and the resort name.
- Printed vouchers: the title line.

Weights: 500, 600, 700. Italic: 500 only.
Tokens: `var(--font-serif)` (also `font-serif` in Tailwind, and `var(--font-display)` in the older stylesheets).

## 2. Plus Jakarta Sans (everything else)

Used for:
- Body text, buttons, labels, form fields, navigation, and tables.
- All admin and staff screens. Their headings also stay in this font, as `admin.css` enforces.
- Numbers, times, booking codes, and tracking IDs. These use tabular numbers so they line up in columns.
- Emails. Mail apps may not load Google fonts, so the fallback is Arial.

Weights: 400, 500, 600, 700, 800.
Tokens: `var(--font-sans)`, and `font-sans` or `font-mono` in Tailwind (`font-mono` is the same font with tabular numbers).

## Rules

- Load both fonts only in `client/index.html`. Do not add `@import` lines for fonts in stylesheets.
- Do not name any other family in `font-family`, `fontFamily`, or `--font-*` values.
- Generic fallbacks (`Georgia`, `system-ui`, `Arial`, `sans-serif`, `serif`) are allowed. They only show if the two fonts fail to load.
- Run `node tools/check-fonts.mjs` before committing. It fails if a font outside this list appears.
