import { useState, useEffect } from 'react';

export function useAutoDraft(key, initialValue) {
  const storageKey = `resort_draft_${key}`;

  const [value, setValue] = useState(() => {
    try {
      if (typeof localStorage !== 'undefined') localStorage.removeItem(storageKey);
      const saved = typeof sessionStorage !== 'undefined' ? sessionStorage.getItem(storageKey) : null;
      if (saved !== null) {
        return JSON.parse(saved);
      }
    } catch {}
    return typeof initialValue === 'function' ? initialValue() : initialValue;
  });

  useEffect(() => {
    try {
      if (typeof localStorage !== 'undefined') localStorage.removeItem(storageKey);
      if (value !== undefined && value !== null && typeof sessionStorage !== 'undefined') {
        sessionStorage.setItem(storageKey, JSON.stringify(value));
      }
    } catch {}
  }, [storageKey, value]);

  const clearDraft = () => {
    try {
      if (typeof localStorage !== 'undefined') localStorage.removeItem(storageKey);
      if (typeof sessionStorage !== 'undefined') sessionStorage.removeItem(storageKey);
    } catch {}
  };

  return [value, setValue, clearDraft];
}
