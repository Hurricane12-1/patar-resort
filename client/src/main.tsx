import './lib/noLocalStorage';
import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import './index.css';
import './styles/global.css';
import './styles/cinematic.css';
import './styles/staff-portal.css';
import './styles/resort-app.css';

// Purge all legacy localStorage booking/state keys so Supabase is the sole single source of truth
if (typeof window !== 'undefined' && window.localStorage) {
  try {
    const prefixes = ['rv_', 'jd_', 'resort_', 'admin_'];
    for (let i = window.localStorage.length - 1; i >= 0; i--) {
      const key = window.localStorage.key(i);
      if (key && prefixes.some((p) => key.startsWith(p))) {
        window.localStorage.removeItem(key);
      }
    }
  } catch {}
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);
