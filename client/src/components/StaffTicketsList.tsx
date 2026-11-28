import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react';
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
type SortKey = 'newest' | 'oldest' | 'updated' | 'urgent';

const STATUS_OPTIONS = [
  { value: '', label: 'All statuses' },
  { value: 'open', label: 'Open' },
  { value: 'in_progress', label: 'In progress' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'closed', label: 'Closed' },
];

const CATEGORY_OPTIONS = [
  'Change my dates',
  'Change room or guests',
  'Cancellation or refund',
  'Payment question',
  'Problem during my stay',
  'Something else',
];

const PRIORITY_OPTIONS = [
  { value: '', label: 'All priorities' },
  { value: 'urgent', label: 'Urgent' },
  { value: 'normal', label: 'Normal' },
];

const HANDLER_OPTIONS = [
  { value: '', label: 'Anyone' },
  { value: 'unassigned', label: 'Not taken yet' },
  { value: 'assigned', label: 'Taken by staff' },
];

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: 'newest', label: 'Newest first' },
  { value: 'oldest', label: 'Oldest first' },
  { value: 'updated', label: 'Recently updated' },
  { value: 'urgent', label: 'Urgent first' },
];

const STATUS_LABEL: Record<string, string> = {
  open: 'Open',
  in_progress: 'In progress',
  resolved: 'Resolved',
  closed: 'Closed',
};

const STATUS_TONE: Record<string, { bg: string; color: string }> = {
  open: { bg: 'rgba(16,185,129,0.15)', color: '#047857' },
  in_progress: { bg: 'rgba(14,165,233,0.15)', color: '#0369A1' },
  resolved: { bg: 'rgba(99,102,241,0.15)', color: '#4338CA' },
  closed: { bg: 'rgba(148,163,184,0.2)', color: '#475569' },
};

const COLUMN_COUNT = 10;

function formatWhen(iso?: string | null): string {
  if (!iso) return '';
  return new Date(iso).toLocaleString('en-PH', {
    timeZone: 'Asia/Manila',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function handlersText(ticket: any): string {
  const handlers: { name: string; employee_id: string | null }[] = ticket.handlers || [];
  if (handlers.length) return handlers.map((h) => (h.employee_id ? `${h.name} · ${h.employee_id}` : h.name)).join(', ');
  if (ticket.assigned_name) return ticket.assigned_employee_id ? `${ticket.assigned_name} · ${ticket.assigned_employee_id}` : ticket.assigned_name;
  return 'Not yet';
}

function timeOf(iso?: string | null): number {
  const t = iso ? Date.parse(iso) : NaN;
  return Number.isFinite(t) ? t : 0;
}

export default function StaffTicketsList({ isLightMode, themeBg, themeText, themeMuted, themeBorder }: StaffTicketsListProps) {
  const [tickets, setTickets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const [statusFilter, setStatusFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [handlerFilter, setHandlerFilter] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('newest');
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      setTickets(await api.allTickets());
    } catch (err: any) {
      setLoadError(err?.message || 'Could not load the tickets.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const counts = useMemo(
    () =>
      tickets.reduce<Record<string, number>>((acc, t) => {
        acc[t.status] = (acc[t.status] || 0) + 1;
        return acc;
      }, {}),
    [tickets]
  );

  const visible = useMemo(() => {
    const needle = search.trim().toLowerCase();
    const rows = tickets.filter((t) => {
      if (statusFilter && t.status !== statusFilter) return false;
      if (categoryFilter && t.category !== categoryFilter) return false;
      if (priorityFilter && (t.priority || 'normal') !== priorityFilter) return false;
      const taken = Boolean(t.assigned_to || t.assigned_name || (t.handlers || []).length);
      if (handlerFilter === 'unassigned' && taken) return false;
      if (handlerFilter === 'assigned' && !taken) return false;
      if (!needle) return true;
      return [t.tracking_id, t.guest_name, t.guest_email, t.guest_phone, t.booking_code, t.room_name, t.subject, t.details]
        .some((v) => String(v || '').toLowerCase().includes(needle));
    });
    return rows.sort((a, b) => {
      if (sortKey === 'oldest') return timeOf(a.created_at) - timeOf(b.created_at);
      if (sortKey === 'updated') return timeOf(b.updated_at || b.created_at) - timeOf(a.updated_at || a.created_at);
      if (sortKey === 'urgent') {
        const rank = (t: any) => (t.priority === 'urgent' ? 0 : 1);
        return rank(a) - rank(b) || timeOf(b.created_at) - timeOf(a.created_at);
      }
      return timeOf(b.created_at) - timeOf(a.created_at);
    });
  }, [tickets, statusFilter, categoryFilter, priorityFilter, handlerFilter, sortKey, search]);

  const filtersActive = Boolean(statusFilter || categoryFilter || priorityFilter || handlerFilter || search.trim());

  const clearFilters = () => {
    setStatusFilter('');
    setCategoryFilter('');
    setPriorityFilter('');
    setHandlerFilter('');
    setSearch('');
  };

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

  const fieldBg = isLightMode ? '#FFFFFF' : '#1E293B';
  const selectStyle: CSSProperties = {
    padding: '7px 30px 7px 10px',
    borderRadius: 8,
    border: `1px solid ${themeBorder}`,
    backgroundColor: fieldBg,
    color: themeText,
    fontSize: '.8rem',
    fontWeight: 600,
    cursor: 'pointer',
    minWidth: 140,
    ...chevronSelectStyle(isLightMode ? '#006699' : '#38BDF8'),
  };
  const labelStyle: CSSProperties = { display: 'flex', flexDirection: 'column', gap: 4, fontSize: '.68rem', fontWeight: 700, color: themeMuted, textTransform: 'uppercase', letterSpacing: '.04em' };
  const cell: CSSProperties = { padding: '10px 12px', borderBottom: `1px solid ${themeBorder}`, verticalAlign: 'top', fontSize: '.8rem' };
  const head: CSSProperties = { padding: '10px 12px', textAlign: 'left', color: themeMuted, fontWeight: 700, fontSize: '.7rem', letterSpacing: '.04em', textTransform: 'uppercase', whiteSpace: 'nowrap', borderBottom: `1px solid ${themeBorder}`, background: isLightMode ? '#F1F5F9' : 'rgba(30,41,59,0.9)' };
  const sub: CSSProperties = { display: 'block', color: themeMuted, marginTop: 2 };

  return (
    <section aria-labelledby="staff-tickets-title" style={{ marginBottom: 20, border: `1px solid ${themeBorder}`, borderRadius: 14, padding: 16, background: themeBg }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10, marginBottom: 14 }}>
        <div>
          <h3 id="staff-tickets-title" style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: themeText }}>
            Guest tickets
          </h3>
          <p style={{ margin: '2px 0 0', fontSize: '.76rem', color: themeMuted }}>
            Open {counts.open || 0} · In progress {counts.in_progress || 0} · Resolved {counts.resolved || 0} · Closed {counts.closed || 0}
          </p>
        </div>
        <button
          type="button"
          onClick={load}
          disabled={loading}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 8, border: 'none', background: '#006699', color: '#FFFFFF', fontSize: '.8rem', fontWeight: 700, cursor: loading ? 'wait' : 'pointer', opacity: loading ? 0.7 : 1 }}
        >
          <i className="fas fa-rotate-right" aria-hidden="true" />
          {loading ? 'Loading…' : 'Refresh'}
        </button>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'flex-end', marginBottom: 12 }}>
        <label style={{ ...labelStyle, flex: '1 1 200px' }}>
          Search
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Tracking ID, guest, booking, subject"
            style={{ padding: '7px 10px', borderRadius: 8, border: `1px solid ${themeBorder}`, background: fieldBg, color: themeText, fontSize: '.8rem', textTransform: 'none', letterSpacing: 'normal', fontWeight: 500 }}
          />
        </label>
        <label style={labelStyle}>
          Status
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={selectStyle}>
            {STATUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
                {o.value ? ` (${counts[o.value] || 0})` : ` (${tickets.length})`}
              </option>
            ))}
          </select>
        </label>
        <label style={labelStyle}>
          Category
          <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} style={selectStyle}>
            <option value="">All categories</option>
            {CATEGORY_OPTIONS.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
        <label style={labelStyle}>
          Priority
          <select value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value)} style={selectStyle}>
            {PRIORITY_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
        <label style={labelStyle}>
          Handled by
          <select value={handlerFilter} onChange={(e) => setHandlerFilter(e.target.value)} style={selectStyle}>
            {HANDLER_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
        <label style={labelStyle}>
          Sort
          <select value={sortKey} onChange={(e) => setSortKey(e.target.value as SortKey)} style={selectStyle}>
            {SORT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
        {filtersActive && (
          <button
            type="button"
            onClick={clearFilters}
            style={{ padding: '7px 12px', borderRadius: 8, border: `1px solid ${themeBorder}`, background: 'transparent', color: themeText, fontSize: '.8rem', fontWeight: 700, cursor: 'pointer' }}
          >
            Clear filters
          </button>
        )}
      </div>

      <p style={{ margin: '0 0 8px', fontSize: '.74rem', color: themeMuted }}>
        Showing {visible.length} of {tickets.length} {tickets.length === 1 ? 'ticket' : 'tickets'}
      </p>

      <div style={{ overflowX: 'auto', border: `1px solid ${themeBorder}`, borderRadius: 10 }}>
        <table style={{ width: '100%', minWidth: 1180, borderCollapse: 'collapse', color: themeText }}>
          <thead>
            <tr>
              <th style={head}>Tracking ID</th>
              <th style={head}>Guest</th>
              <th style={head}>Booking</th>
              <th style={head}>Category</th>
              <th style={head}>Ticket</th>
              <th style={head}>Status</th>
              <th style={head}>Handled by</th>
              <th style={head}>Rating</th>
              <th style={head}>Opened / Updated</th>
              <th style={head}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={COLUMN_COUNT} style={{ ...cell, color: themeMuted }}>Loading tickets…</td>
              </tr>
            ) : loadError ? (
              <tr>
                <td colSpan={COLUMN_COUNT} style={{ ...cell, color: '#B91C1C' }}>
                  {loadError}{' '}
                  <button type="button" onClick={load} style={{ border: 'none', background: 'none', color: '#006699', fontWeight: 700, cursor: 'pointer', textDecoration: 'underline', padding: 0 }}>
                    Try again
                  </button>
                </td>
              </tr>
            ) : visible.length === 0 ? (
              <tr>
                <td colSpan={COLUMN_COUNT} style={{ ...cell, color: themeMuted }}>
                  {tickets.length === 0 ? 'No tickets have been filed yet.' : 'No tickets match these filters.'}
                </td>
              </tr>
            ) : (
              visible.map((t) => {
                const tone = STATUS_TONE[t.status] || STATUS_TONE.closed;
                return (
                  <tr key={t.id}>
                    <td style={{ ...cell, fontFamily: 'var(--font-sans)', fontVariantNumeric: 'tabular-nums', fontWeight: 700, color: isLightMode ? '#006699' : '#38BDF8', whiteSpace: 'nowrap' }}>
                      {t.tracking_id}
                      {t.priority === 'urgent' && (
                        <span style={{ display: 'block', marginTop: 4, fontSize: '.66rem', fontWeight: 800, color: '#E11D48', fontFamily: 'inherit' }}>URGENT</span>
                      )}
                    </td>
                    <td style={{ ...cell, minWidth: 160 }}>
                      <b>{t.guest_name || 'Guest'}</b>
                      {t.guest_email && <span style={{ ...sub, wordBreak: 'break-all' }}>{t.guest_email}</span>}
                      {t.guest_phone && <span style={sub}>{t.guest_phone}</span>}
                    </td>
                    <td style={{ ...cell, minWidth: 130 }}>
                      {t.room_name || t.booking_code ? (
                        <>
                          <b>{t.room_name || 'Booking'}</b>
                          {t.booking_code && <span style={{ ...sub, fontFamily: 'var(--font-sans)', fontVariantNumeric: 'tabular-nums' }}>{t.booking_code}</span>}
                        </>
                      ) : (
                        <span style={{ color: themeMuted }}>No booking</span>
                      )}
                    </td>
                    <td style={{ ...cell, minWidth: 130 }}>{t.category}</td>
                    <td style={{ ...cell, minWidth: 220, maxWidth: 320 }}>
                      <b>{t.subject}</b>
                      {t.details && (
                        <span title={t.details} style={{ ...sub, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                          {t.details}
                        </span>
                      )}
                      {t.resolution_note && (
                        <span style={{ ...sub, color: isLightMode ? '#047857' : '#34D399' }}>Reply: {t.resolution_note}</span>
                      )}
                    </td>
                    <td style={cell}>
                      <span style={{ display: 'inline-block', padding: '3px 10px', borderRadius: 8, fontSize: '.72rem', fontWeight: 800, background: tone.bg, color: tone.color, whiteSpace: 'nowrap' }}>
                        {STATUS_LABEL[t.status] || t.status}
                      </span>
                    </td>
                    <td style={{ ...cell, minWidth: 140, maxWidth: 220 }}>{handlersText(t)}</td>
                    <td style={{ ...cell, minWidth: 90 }}>
                      {t.rating ? `${t.rating}/5` : '—'}
                      {t.feedback && <span title={t.feedback} style={{ ...sub, maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.feedback}</span>}
                    </td>
                    <td style={{ ...cell, whiteSpace: 'nowrap', color: themeMuted }}>
                      {formatWhen(t.created_at)}
                      {t.updated_at && t.updated_at !== t.created_at && <span style={sub}>Updated {formatWhen(t.updated_at)}</span>}
                    </td>
                    <td style={cell}>
                      {t.status === 'closed' ? (
                        <span style={{ color: themeMuted }}>No actions</span>
                      ) : (
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
                          <option value="">{busyId === t.id ? 'Saving…' : 'Actions'}</option>
                          {t.status === 'open' && <option value="take">Take this ticket</option>}
                          {t.status !== 'in_progress' && <option value="progress">Mark in progress</option>}
                          {t.status !== 'resolved' && <option value="resolve">Resolve</option>}
                          <option value="close">Close</option>
                        </select>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
