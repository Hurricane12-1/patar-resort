import { useEffect, useState } from 'react';
import { api } from './api';

// Admin-managed public page media, hero titles, and dashboard layout customization.
export interface PageMedia {
  heroImageUrl?: string;
  heroHeadline?: string;
  heroSubtitle?: string;
  heroKicker?: string;
  dashboardGreeting?: string;
  dashboardSubtitle?: string;
  dashboardAnnouncement?: string;
  dashboardBadge?: string;
  dashboardShowQuickBooking?: boolean;
  dashboardThemeAccent?: string;
}

const STORAGE_KEY = 'rockview_page_settings';

function getLocalStoredSettings(): PageMedia {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') return parsed;
    }
  } catch {}
  return {};
}

function persistToLocalStorage(data: PageMedia) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {}
}

let cache: PageMedia = getLocalStoredSettings();
let inflight: Promise<PageMedia> | null = null;
const listeners = new Set<(m: PageMedia) => void>();

function notify() {
  const snap = { ...cache };
  listeners.forEach((l) => l(snap));
}

/** Fetch page media & layout settings once (cached). Pass force=true to refetch. */
export async function loadPageSettings(force = false): Promise<PageMedia> {
  if (cache && Object.keys(cache).length > 0 && !force) return cache;
  if (inflight && !force) return inflight;
  inflight = api
    .getPageSettings()
    .then((res) => {
      const remote = res && res.settings ? (res.settings as PageMedia) : {};
      cache = { ...cache, ...remote };
      persistToLocalStorage(cache);
      notify();
      return cache;
    })
    .catch(() => {
      return cache;
    })
    .finally(() => {
      inflight = null;
    });
  return inflight;
}

/** Replace the cache (e.g. right after an admin save) so every consumer updates live. */
export function setPageSettingsCache(next: PageMedia) {
  cache = { ...cache, ...(next || {}) };
  persistToLocalStorage(cache);
  notify();
}

/** Save page media & layout settings to server and synchronize locally. */
export async function savePageSettings(settings: Partial<PageMedia>): Promise<PageMedia> {
  const current = { ...cache, ...settings };
  setPageSettingsCache(current);
  try {
    const res: any = await api.savePageSettings(settings as Record<string, any>);
    const finalSettings = res?.settings || current;
    setPageSettingsCache(finalSettings);
    return finalSettings;
  } catch (err) {
    // Keep local cache even if server had an error, so admin changes remain live
    throw err;
  }
}

/** React hook: current page media and layout settings, kept in sync across the app. */
export function usePageSettings(): PageMedia {
  const [media, setMedia] = useState<PageMedia>({ ...cache });
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
