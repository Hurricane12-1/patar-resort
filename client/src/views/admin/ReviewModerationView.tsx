import React, { useState } from 'react';
import { fmtDate, initials } from '../../lib/format';
import Stars from '../../components/Stars';

type FilterKey = 'all' | 'pending' | 'approved' | 'flagged' | 'rejected';
type ModStatus = 'pending' | 'approved' | 'rejected' | 'flagged';

export interface ReviewModerationViewProps {
  reviewsList: any[];
  reviewCounts: Record<string, number>;
  loadingReviews: boolean;
  refreshReviews: () => void;
  onModerate: (id: string, status: ModStatus, note?: string) => Promise<void> | void;
  onReply: (id: string, reply: string) => Promise<void> | void;
  isLightMode: boolean;
  themeCardBg: string;
  themeBorder: string;
  themeShadow: string;
  themeText: string;
  themeMuted: string;
  toast: (msg: string, isError?: boolean) => void;
}

export const ReviewModerationView: React.FC<ReviewModerationViewProps> = ({
  reviewsList,
  reviewCounts,
  loadingReviews,
  refreshReviews,
  onModerate,
  onReply,
  isLightMode,
  themeCardBg,
  themeBorder,
  themeShadow,
  themeText,
  themeMuted,
  toast,
}) => {
  const [statusFilter, setStatusFilter] = useState<FilterKey>('pending');
  const [searchQuery, setSearchQuery] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});

  const statusMeta = (status: string) => {
    switch (status) {
      case 'pending':
        return { label: 'AWAITING REVIEW', bg: isLightMode ? '#FEF3C7' : 'rgba(217, 119, 6, 0.2)', color: isLightMode ? '#92400E' : '#FCD34D' };
      case 'approved':
        return { label: 'PUBLISHED', bg: isLightMode ? '#D1FAE5' : 'rgba(5, 150, 105, 0.22)', color: isLightMode ? '#065F46' : '#6EE7B7' };
      case 'flagged':
        return { label: 'FLAGGED', bg: isLightMode ? '#FFEDD5' : 'rgba(234, 88, 12, 0.22)', color: isLightMode ? '#9A3412' : '#FDBA74' };
      case 'rejected':
        return { label: 'REJECTED', bg: isLightMode ? '#FEE2E2' : 'rgba(220, 38, 38, 0.22)', color: isLightMode ? '#991B1B' : '#FCA5A5' };
      default:
        return { label: String(status || '').toUpperCase(), bg: 'rgba(100,116,139,0.2)', color: themeMuted };
    }
  };

  const filtered = reviewsList.filter((rv) => {
    const status = rv.moderation_status || (rv.is_approved ? 'approved' : 'pending');
    const matchStatus = statusFilter === 'all' || status === statusFilter;
    if (!matchStatus) return false;
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      (rv.profiles?.full_name || '').toLowerCase().includes(q) ||
      (rv.profiles?.email || '').toLowerCase().includes(q) ||
      (rv.rooms?.name || '').toLowerCase().includes(q) ||
      (rv.comment || '').toLowerCase().includes(q)
    );
  });

  const runModerate = async (rv: any, status: ModStatus, note?: string) => {
    setBusyId(rv.id);
    try {
      await onModerate(rv.id, status, note);
    } finally {
      setBusyId(null);
    }
  };

  const saveReply = async (rv: any) => {
    const draft = replyDrafts[rv.id] ?? rv.admin_reply ?? '';
    setBusyId(rv.id);
    try {
      await onReply(rv.id, draft);
      setReplyDrafts((prev) => {
        const next = { ...prev };
        delete next[rv.id];
        return next;
      });
    } finally {
      setBusyId(null);
    }
  };

  const chipBtn = (active: boolean, accent: string): React.CSSProperties => ({
    padding: '7px 14px',
    borderRadius: 999,
    border: `1px solid ${active ? accent : themeBorder}`,
    background: active ? accent : (isLightMode ? '#FFFFFF' : 'rgba(255,255,255,0.04)'),
    color: active ? '#FFFFFF' : themeText,
    fontWeight: 700,
    fontSize: '.78rem',
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    gap: 7,
  });

  const kpis: { key: FilterKey; label: string; val: number; accent: string; icon: string }[] = [
    { key: 'pending', label: 'Awaiting Review', val: reviewCounts.pending || 0, accent: '#D97706', icon: 'fa-clock' },
    { key: 'approved', label: 'Published', val: reviewCounts.approved || 0, accent: '#059669', icon: 'fa-circle-check' },
    { key: 'flagged', label: 'Flagged', val: reviewCounts.flagged || 0, accent: '#EA580C', icon: 'fa-flag' },
    { key: 'rejected', label: 'Rejected', val: reviewCounts.rejected || 0, accent: '#DC2626', icon: 'fa-circle-xmark' },
  ];

  return (
    <div className="panel" style={{ background: themeCardBg, border: `1px solid ${themeBorder}`, borderRadius: 16, padding: 24, boxShadow: themeShadow }}>
      {/* Header */}
      <div className="admin-tab-header" style={{ marginBottom: 18 }}>
        <div>
          <span className="label light" style={{ color: '#006699', fontWeight: 800, letterSpacing: '.12em' }}>
            <i className="fas fa-star-half-stroke" style={{ marginRight: 6 }} />
            GUEST REVIEW MODERATION
          </span>
          <h3 className="serif" style={{ fontSize: '1.6rem', margin: '4px 0 0', color: themeText }}>
            Reputation & Guest Voices Console
          </h3>
          <p className="muted small" style={{ margin: '4px 0 0', maxWidth: 820 }}>
            New reviews stay off the public wall until you publish them. Reject or flag anything inappropriate, and post an official reply the guest and future visitors will see on the homepage.
          </p>
        </div>
        <button
          type="button"
          className="btn btn-sm"
          onClick={refreshReviews}
          disabled={loadingReviews}
          style={{ border: `1px solid ${themeBorder}`, color: themeText, background: isLightMode ? '#FFFFFF' : 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', gap: 6 }}
        >
          <i className={`fas fa-rotate ${loadingReviews ? 'fa-spin' : ''}`} />
          {loadingReviews ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>

      {/* KPI band (also acts as quick filters) */}
      <div className="admin-grid-4-col" style={{ gap: 12, marginBottom: 20 }}>
        {kpis.map((card) => (
          <div
            key={card.key}
            onClick={() => setStatusFilter(card.key)}
            style={{
              background: isLightMode ? '#F8FAFC' : 'rgba(255,255,255,0.03)',
              border: `1px solid ${statusFilter === card.key ? card.accent : themeBorder}`,
              borderRadius: 12,
              padding: '14px 16px',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '.72rem', color: themeMuted, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em' }}>{card.label}</span>
              <i className={`fas ${card.icon}`} style={{ color: card.accent, fontSize: '.85rem' }} />
            </div>
            <div style={{ fontSize: '1.7rem', fontWeight: 800, color: themeText, marginTop: 4 }}>{card.val}</div>
          </div>
        ))}
      </div>

      {/* Filters + search */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center', marginBottom: 18 }}>
        {([
          ['all', 'All', '#006699'],
          ['pending', 'Awaiting', '#D97706'],
          ['approved', 'Published', '#059669'],
          ['flagged', 'Flagged', '#EA580C'],
          ['rejected', 'Rejected', '#DC2626'],
        ] as [FilterKey, string, string][]).map(([key, label, accent]) => (
          <button key={key} type="button" style={chipBtn(statusFilter === key, accent)} onClick={() => setStatusFilter(key)}>
            {label}
          </button>
        ))}
        <div style={{ flex: 1, minWidth: 200, position: 'relative' }}>
          <i className="fas fa-magnifying-glass" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: themeMuted, fontSize: '.8rem' }} />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search guest, room, or comment…"
            style={{
              width: '100%', padding: '9px 12px 9px 32px', borderRadius: 10,
              border: `1px solid ${themeBorder}`, background: isLightMode ? '#FFFFFF' : 'rgba(255,255,255,0.04)',
              color: themeText, fontSize: '.85rem',
            }}
          />
        </div>
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '48px 20px', color: themeMuted }}>
          <i className="fas fa-comment-slash" style={{ fontSize: 30, opacity: 0.6, marginBottom: 10, display: 'block' }} />
          {loadingReviews ? 'Loading reviews…' : 'No reviews match this view yet.'}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {filtered.map((rv) => {
            const status = rv.moderation_status || (rv.is_approved ? 'approved' : 'pending');
            const meta = statusMeta(status);
            const busy = busyId === rv.id;
            const draft = replyDrafts[rv.id] ?? rv.admin_reply ?? '';
            const replyDirty = draft.trim() !== (rv.admin_reply || '').trim();
            return (
              <div
                key={rv.id}
                style={{
                  border: `1px solid ${themeBorder}`,
                  borderLeft: `4px solid ${meta.color}`,
                  borderRadius: 14,
                  padding: 18,
                  background: isLightMode ? '#FFFFFF' : 'rgba(255,255,255,0.02)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                    <span style={{
                      width: 42, height: 42, borderRadius: '50%', flexShrink: 0,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      background: isLightMode ? '#E0F2FE' : 'rgba(0,102,153,0.25)',
                      color: '#006699', fontWeight: 800, fontSize: '.9rem',
                    }}>
                      {initials(rv.profiles?.full_name || 'Guest')}
                    </span>
                    <div>
                      <div style={{ fontWeight: 700, color: themeText }}>
                        {rv.profiles?.full_name || 'Verified Guest'}
                      </div>
                      <div style={{ fontSize: '.78rem', color: themeMuted }}>
                        {rv.rooms?.name || 'Stay'} · {fmtDate(rv.created_at)}
                      </div>
                    </div>
                  </div>
                  <span style={{
                    alignSelf: 'flex-start', padding: '4px 11px', borderRadius: 999,
                    background: meta.bg, color: meta.color, fontWeight: 800, fontSize: '.68rem',
                    letterSpacing: '.06em',
                  }}>
                    {meta.label}
                  </span>
                </div>

                <div style={{ margin: '12px 0 6px' }}>
                  <Stars value={rv.rating} size={16} />
                </div>
                <p style={{ color: themeText, margin: '0 0 6px', lineHeight: 1.55 }}>
                  {rv.comment ? `“${rv.comment}”` : <span style={{ color: themeMuted, fontStyle: 'italic' }}>No written comment.</span>}
                </p>
                {rv.moderation_note && (
                  <div style={{ fontSize: '.78rem', color: themeMuted, marginBottom: 6 }}>
                    <i className="fas fa-note-sticky" style={{ marginRight: 5 }} />
                    Moderator note: {rv.moderation_note}
                  </div>
                )}

                {/* Moderation actions */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>
                  {status !== 'approved' && (
                    <button type="button" disabled={busy} onClick={() => runModerate(rv, 'approved')}
                      style={actionBtn('#059669', busy)}>
                      <i className="fas fa-circle-check" /> Publish
                    </button>
                  )}
                  {status !== 'rejected' && (
                    <button type="button" disabled={busy} onClick={() => runModerate(rv, 'rejected')}
                      style={actionBtn('#DC2626', busy)}>
                      <i className="fas fa-circle-xmark" /> Reject
                    </button>
                  )}
                  {status !== 'flagged' && (
                    <button type="button" disabled={busy} onClick={() => runModerate(rv, 'flagged')}
                      style={actionBtn('#EA580C', busy)}>
                      <i className="fas fa-flag" /> Flag
                    </button>
                  )}
                  {status !== 'pending' && (
                    <button type="button" disabled={busy} onClick={() => runModerate(rv, 'pending')}
                      style={ghostBtn(themeBorder, themeText, busy)}>
                      <i className="fas fa-rotate-left" /> Re-queue
                    </button>
                  )}
                </div>

                {/* Official reply */}
                <div style={{ marginTop: 14, borderTop: `1px dashed ${themeBorder}`, paddingTop: 12 }}>
                  <label style={{ fontSize: '.72rem', fontWeight: 800, color: themeMuted, textTransform: 'uppercase', letterSpacing: '.06em', display: 'block', marginBottom: 6 }}>
                    <i className="fas fa-reply" style={{ marginRight: 6, color: '#006699' }} />
                    Official reply {rv.admin_reply ? '(visible on homepage)' : '(optional)'}
                  </label>
                  <textarea
                    value={draft}
                    maxLength={600}
                    onChange={(e) => setReplyDrafts((prev) => ({ ...prev, [rv.id]: e.target.value }))}
                    placeholder="Thank the guest, answer a concern, or add resort context…"
                    rows={2}
                    style={{
                      width: '100%', padding: '9px 12px', borderRadius: 10, resize: 'vertical',
                      border: `1px solid ${themeBorder}`, background: isLightMode ? '#F8FAFC' : 'rgba(255,255,255,0.04)',
                      color: themeText, fontSize: '.86rem', fontFamily: 'inherit',
                    }}
                  />
                  <div style={{ display: 'flex', gap: 8, marginTop: 8, alignItems: 'center' }}>
                    <button type="button" disabled={busy || !replyDirty} onClick={() => saveReply(rv)}
                      style={actionBtn('#006699', busy || !replyDirty)}>
                      <i className="fas fa-paper-plane" /> {rv.admin_reply ? 'Update reply' : 'Post reply'}
                    </button>
                    {rv.admin_reply && (
                      <button type="button" disabled={busy} onClick={() => { setReplyDrafts((prev) => ({ ...prev, [rv.id]: '' })); onReply(rv.id, ''); }}
                        style={ghostBtn(themeBorder, themeText, busy)}>
                        <i className="fas fa-trash-can" /> Remove
                      </button>
                    )}
                    <span style={{ marginLeft: 'auto', fontSize: '.72rem', color: themeMuted }}>{draft.length}/600</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

function actionBtn(accent: string, disabled: boolean): React.CSSProperties {
  return {
    background: accent, color: '#FFFFFF', border: 'none', borderRadius: 9,
    padding: '8px 14px', fontWeight: 700, fontSize: '.82rem',
    cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.55 : 1,
    display: 'inline-flex', alignItems: 'center', gap: 7,
  };
}

function ghostBtn(border: string, text: string, disabled: boolean): React.CSSProperties {
  return {
    background: 'transparent', color: text, border: `1px solid ${border}`, borderRadius: 9,
    padding: '8px 14px', fontWeight: 700, fontSize: '.82rem',
    cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.55 : 1,
    display: 'inline-flex', alignItems: 'center', gap: 7,
  };
}
