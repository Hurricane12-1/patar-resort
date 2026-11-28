import { useCallback, useEffect, useState } from 'react';
import { api } from '../lib/api';
import { toast } from './Toasts';
import { chevronSelectStyle } from '../lib/selectChevron';

interface StaffTicketsListProps {
  isLightMode: boolean;
  themeBg: string;
  themeText: string;
  themeMuted: string;
  themeBorder: string;
}

type TicketAction = 'take' | 'progress' | 'resolve' | 'close';

const STATUS_FILTERS: { value: string; label: string }[] = [
  { value: '', label: 'All tickets' },
  { value: 'open', label: 'Open' },
  { value: 'in_progress', label: 'In progress' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'closed', label: 'Closed' },
];

const STATUS_LABEL: Record<string, string> = {
  open: 'Open',
  in_progress: 'In progress',
  resolved: 'Resolved',
  closed: 'Closed',
};

const STATUS_TONE: Record<string, { bg: string; color: string }> = {
  open: { bg: 'rgba(16,185,129,0.15)', color: '#059669' },
  in_progress: { bg: 'rgba(14,165,233,0.15)', color: '#0284C7' },
  resolved: { bg: 'rgba(99,102,241,0.15)', color: '#4F46E5' },
  closed: { bg: 'rgba(148,163,184,0.2)', color: '#64748B' },
};

function formatWhen(iso: string): string {
  if (!iso) return '';
  return new Date(iso).toLocaleString('en-PH', {
    timeZone: 'Asia/Manila',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function handlersText(handlers: { name: string; employee_id: string | null }[] = []): string {
  if (!handlers.length) return 'Not yet';
  return handlers.map((h) => (h.employee_id ? `${h.name} · ${h.employee_id}` : h.name)).join(', ');
}

export default function StaffTicketsList({ isLightMode, themeBg, themeText, themeMuted, themeBorder }: StaffTicketsListProps) {
  const [tickets, setTickets] = useState<any[]>([]);
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setTickets(await api.allTickets(statusFilter || undefined));
    } catch {
      toast('Could not load the tickets. Please refresh.', true);
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    setLoading(true);
    load();
  }, [load]);

  const counts = tickets.reduce<Record<string, number>>((acc, t) => {
    acc[t.status] = (acc[t.status] || 0) + 1;
    return acc;
  }, {});

  const runAction = async (ticket: any, action: TicketAction) => {
    let note = '';
    if (action === 'resolve') {
      const answer = window.prompt(`Reply to the guest for ${ticket.tracking_id} (optional):`, '');
      if (answer === null) return;
      note = answer.trim();
    }
    setBusyId(ticket.id);
    try {
      await api.updateTicket(ticket.id, { action, note });
      toast(`${ticket.tracking_id} updated`);
      await load();
    } catch (err: any) {
      toast(err?.message || `Could not update ${ticket.tracking_id}`, true);
    } finally {
      setBusyId(null);
    }
  };

  const cell = { padding: '10px 12px', borderBottom: `1px solid ${themeBorder}`, verticalAlign: 'top' as const, fontSize: '.8rem' };
  const head = { padding: '10px 12px', textAlign: 'left' as const, color: themeMuted, fontWeight: 700, fontSize: '.7rem', letterSpacing: '.04em', textTransform: 'uppercase' as const };

  return (
    <section aria-labelledby="staff-tickets-title" style={{ marginBottom: 20, border: `1px solid ${themeBorder}`, borderRadius: 14, padding: 16, background: themeBg }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10, marginBottom: 12 }}>
        <div>
          <h3 id="staff-tickets-title" style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: themeText }}>
            Guest tickets
          </h3>
          <p style={{ margin: '2px 0 0', fontSize: '.76rem', color: themeMuted }}>
            Open {counts.open || 0} · In progress {counts.in_progress || 0} · Resolved {counts.resolved || 0} · Closed {counts.closed || 0}
          </p>
        </div>
        <select
          aria-label="Filter tickets by status"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          style={{ padding: '6px 12px', borderRadius: 8, border: `1px solid ${themeBorder}`, background: isLightMode ? '#FFF' : '#1E293B', color: themeText, fontSize: '.82rem', fontWeight: 700, cursor: 'pointer' }}
        >
          {STATUS_FILTERS.map((f) => (
            <option key={f.value} value={f.value}>
              {f.label}
            </option>
          ))}
        </select>
      </div>

      {loading ? (
        <p style={{ color: themeMuted, fontSize: '.84rem', margin: '12px 0' }}>Loading tickets…</p>
      ) : tickets.length === 0 ? (
        <p style={{ color: themeMuted, fontSize: '.84rem', margin: '12px 0' }}>No tickets for this filter yet.</p>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', color: themeText }}>
            <thead>
              <tr>
                <th style={head}>Tracking ID</th>
                <th style={head}>Guest</th>
                <th style={head}>Ticket</th>
                <th style={head}>Status</th>
                <th style={head}>Handled by</th>
                <th style={head}>Rating</th>
                <th style={head}>Opened</th>
                <th style={head}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {tickets.map((t) => {
                const tone = STATUS_TONE[t.status] || STATUS_TONE.closed;
                return (
                  <tr key={t.id}>
                    <td style={{ ...cell, fontFamily: 'monospace', fontWeight: 700, color: '#0284C7' }}>
                      {t.tracking_id}
                      {t.priority === 'urgent' && (
                        <span style={{ display: 'block', marginTop: 4, fontSize: '.66rem', fontWeight: 800, color: '#E11D48' }}>URGENT</span>
                      )}
                    </td>
                    <td style={cell}>
                      <b>{t.guest_name || 'Guest'}</b>
                      <span style={{ display: 'block', color: themeMuted }}>{t.room_name || ''}{t.booking_code ? ` · ${t.booking_code}` : ''}</span>
                    </td>
                    <td style={{ ...cell, maxWidth: 280 }}>
                      <b>{t.subject}</b>
                      <span style={{ display: 'block', color: themeMuted }}>{t.category}</span>
                    </td>
                    <td style={cell}>
                      <span style={{ display: 'inline-block', padding: '3px 10px', borderRadius: 8, fontSize: '.72rem', fontWeight: 800, background: tone.bg, color: tone.color }}>
                        {STATUS_LABEL[t.status] || t.status}
                      </span>
                    </td>
                    <td style={{ ...cell, maxWidth: 240 }}>{handlersText(t.handlers)}</td>
                    <td style={cell}>{t.rating ? `${t.rating}/5` : '—'}</td>
                    <td style={{ ...cell, whiteSpace: 'nowrap', color: themeMuted }}>{formatWhen(t.created_at)}</td>
                    <td style={cell}>
                      <select
                        aria-label={`Actions for ${t.tracking_id}`}
                        value=""
                        disabled={busyId === t.id}
                        onChange={(e) => {
                          const action = e.target.value as TicketAction | '';
                          e.target.value = '';
                          if (action) runAction(t, action);
                        }}
                        style={{ padding: '6px 28px 6px 10px', borderRadius: 8, border: '1px solid #006699', backgroundColor: '#006699', ...chevronSelectStyle('#FFFFFF'), color: '#FFFFFF', fontSize: '.78rem', fontWeight: 700, cursor: 'pointer' }}
                      >
                        <option value="">Actions</option>
                        {t.status !== 'in_progress' && t.status !== 'resolved' && t.status !== 'closed' && <option value="take">Take this ticket</option>}
                        {t.status !== 'in_progress' && t.status !== 'closed' && <option value="progress">Mark in progress</option>}
                        {t.status !== 'resolved' && t.status !== 'closed' && <option value="resolve">Resolve</option>}
                        {t.status !== 'closed' && <option value="close">Close</option>}
                      </select>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
