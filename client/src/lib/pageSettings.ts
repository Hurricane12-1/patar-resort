import { useEffect, useState } from 'react';
import { api } from './api';

// Admin-managed public page media (Page Adjustment). Image URLs only.
export interface PageMedia {
  heroImageUrl?: string;
}

let cache: PageMedia | null = null;
let inflight: Promise<PageMedia> | null = null;
const listeners = new Set<(m: PageMedia) => void>();

function notify() {
  const snap = cache || {};
  listeners.forEach((l) => l(snap));
}

/** Fetch page media once (cached). Pass force=true to refetch. */
export async function loadPageSettings(force = false): Promise<PageMedia> {
  if (cache && !force) return cache;
  if (inflight && !force) return inflight;
  inflight = api
    .getPageSettings()
    .then((res) => {
      cache = res && res.settings ? (res.settings as PageMedia) : {};
      notify();
      return cache;
    })
    .catch(() => {
      cache = cache || {};
      return cache;
    })
    .finally(() => {
      inflight = null;
    });
  return inflight;
}

/** Replace the cache (e.g. right after an admin save) so every consumer updates live. */
export function setPageSettingsCache(next: PageMedia) {
  cache = next || {};
  notify();
}

/** React hook: current page media, kept in sync across the app. */
export function usePageSettings(): PageMedia {
  const [media, setMedia] = useState<PageMedia>(cache || {});
  useEffect(() => {
    let active = true;
    const listener = (m: PageMedia) => {
      if (active) setMedia(m);
    };
    listeners.add(listener);
    loadPageSettings().then((m) => {
      if (active) setMedia(m);
    });
    return () => {
      active = false;
      listeners.delete(listener);
    };
  }, []);
  return media;
}
