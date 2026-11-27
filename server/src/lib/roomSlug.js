/**
 * The rooms table needs a unique slug, and two places with the same name only confuse staff and guests.
 * `existing` is a list of { name, slug } rows already in the table.
 */
export function planNewRoomName(name, wantedSlug, existing) {
  const rows = Array.isArray(existing) ? existing : [];
  const cleanName = String(name || '').trim();

  if (rows.some((r) => String(r.name || '').trim().toLowerCase() === cleanName.toLowerCase())) {
    return { nameTaken: true, slug: null };
  }

  const baseSlug =
    wantedSlug ||
    cleanName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') ||
    `room-${Date.now()}`;
  const used = new Set(rows.map((r) => String(r.slug || '').toLowerCase()));
  let slug = baseSlug;
  for (let n = 2; used.has(slug.toLowerCase()); n += 1) slug = `${baseSlug}-${n}`;

  return { nameTaken: false, slug };
}
