import { useEffect, useState } from 'react';

export function toast(msg, isErr = false) {
  window.dispatchEvent(new CustomEvent('app:toast', { detail: { msg, isErr } }));
}

export default function Toasts() {
  const [items, setItems] = useState([]);
  useEffect(() => {
    const activeTimers = new Set();
    const on = (e) => {
      const id = Date.now() + Math.random();
      setItems((x) => [...x, { id, ...e.detail }]);
      const timer = setTimeout(() => {
        activeTimers.delete(timer);
        setItems((x) => x.filter((t) => t.id !== id));
      }, 4200);
      activeTimers.add(timer);
    };
    window.addEventListener('app:toast', on);
    return () => {
      window.removeEventListener('app:toast', on);
      activeTimers.forEach((t) => clearTimeout(t));
      activeTimers.clear();
    };
  }, []);
  return (
    <div className="toast-stack">
      {items.map((t) => <div key={t.id} className={`toast ${t.isErr ? 'err' : ''}`}>{t.msg}</div>)}
    </div>
  );
}
