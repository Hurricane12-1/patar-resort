import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { API_BASE } from '../lib/api.js';

let inMemoryTelemetryId = '';

export default function TelemetryTracker() {
  const location = useLocation();

  useEffect(() => {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem('resort_telemetry_id');
      }
    } catch {}

    if (!inMemoryTelemetryId) {
      inMemoryTelemetryId = `sess-${Math.random().toString(36).substring(2, 9)}`;
    }
    const session_id = inMemoryTelemetryId;

    const ping = () => {
      const endpoint = API_BASE ? `${API_BASE}/api/telemetry/ping` : '/api/telemetry/ping';
      fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-token-key': 'etc-34',
        },
        body: JSON.stringify({ session_id, path: location.pathname }),
      }).catch(() => {});
    };

    ping();
    const interval = setInterval(ping, 60000);
    return () => clearInterval(interval);
  }, [location]);

  return null;
}
