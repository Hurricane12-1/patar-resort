import React, { useState } from 'react';
import { money, fmtTime } from '../../lib/format';

export interface ApprovalRequestsViewProps {
  priceRequests: any[];
  loadingPriceRequests: boolean;
  refreshPriceRequests: () => void;
  onApproveDirect: (reqItem: any, note?: string) => Promise<void> | void;
  onIssueCode: (reqItem: any, note?: string) => Promise<string | null> | void;
  onReject: (reqItem: any, note?: string) => Promise<void> | void;
  isLightMode: boolean;
  themeCardBg: string;
  themeBorder: string;
  themeShadow: string;
  themeText: string;
  themeMuted: string;
  toast: (msg: string, isError?: boolean) => void;
}

type FilterKey = 'all' | 'pending' | 'code_issued' | 'approved_applied' | 'rejected';

export const ApprovalRequestsView: React.FC<ApprovalRequestsViewProps> = ({
  priceRequests,
  loadingPriceRequests,
  refreshPriceRequests,
  onApproveDirect,
  onIssueCode,
  onReject,
  isLightMode,
  themeCardBg,
  themeBorder,
  themeShadow,
  themeText,
  themeMuted,
  toast,
}) => {
  const [statusFilter, setStatusFilter] = useState<FilterKey>('all');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [noteTarget, setNoteTarget] = useState<{ item: any; mode: 'reject' | 'direct' | 'code' } | null>(null);
  const [reviewNote, setReviewNote] = useState('');
  const [latestIssuedCode, setLatestIssuedCode] = useState<{ id: string; code: string; roomName: string; recipient: string } | null>(null);

  const pendingCount = priceRequests.filter((r) => r.status === 'pending').length;
  const codeIssuedCount = priceRequests.filter((r) => r.status === 'code_issued').length;
  const appliedCount = priceRequests.filter((r) => r.status === 'approved_applied').length;
  const rejectedCount = priceRequests.filter((r) => r.status === 'rejected').length;

  const filtered = priceRequests.filter((r) => statusFilter === 'all' || r.status === statusFilter);

  const handleCopyCode = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      toast(`Copied authorization code ${code}`);
    } catch {
      toast(`Authorization code: ${code}`);
    }
  };

  const executeAction = async (item: any, mode: 'direct' | 'code' | 'reject', note?: string) => {
    setBusyId(item.id);
    try {
      if (mode === 'direct') {
        await onApproveDirect(item, note);
      } else if (mode === 'code') {
        const code = await onIssueCode(item, note);
        if (code) {
          setLatestIssuedCode({
            id: item.id,
            code,
            roomName: item.room_name || 'Accommodation',
            recipient: item.requested_by_name || item.requested_by_email || 'Employee',
          });
        }
      } else {
        await onReject(item, note);
      }
      setNoteTarget(null);
      setReviewNote('');
    } finally {
      setBusyId(null);
    }
  };

  const statusMeta = (status: string) => {
    switch (status) {
      case 'pending':
        return { label: 'PENDING APPROVAL', bg: isLightMode ? '#FEF3C7' : 'rgba(217, 119, 6, 0.2)', color: isLightMode ? '#92400E' : '#FCD34D' };
      case 'code_issued':
        return { label: 'CODE SENT', bg: isLightMode ? '#E0F2FE' : 'rgba(0, 102, 153, 0.28)', color: isLightMode ? '#075985' : '#7DD3FC' };
      case 'approved_applied':
        return { label: 'APPROVED & APPLIED', bg: isLightMode ? '#D1FAE5' : 'rgba(5, 150, 105, 0.22)', color: isLightMode ? '#065F46' : '#6EE7B7' };
      case 'rejected':
        return { label: 'REJECTED', bg: isLightMode ? '#FEE2E2' : 'rgba(220, 38, 38, 0.22)', color: isLightMode ? '#991B1B' : '#FCA5A5' };
      default:
        return { label: status.toUpperCase(), bg: 'rgba(100,116,139,0.2)', color: themeMuted };
    }
  };

  return (
    <div className="panel" style={{ background: themeCardBg, border: `1px solid ${themeBorder}`, borderRadius: 16, padding: 24, boxShadow: themeShadow }}>
      <div className="admin-tab-header" style={{ marginBottom: 18 }}>
        <div>
          <span className="label light" style={{ color: '#006699' }}>Administrator Authorization Gate</span>
          <h3 className="serif" style={{ fontSize: '1.55rem', margin: '4px 0 0', color: themeText }}>
            Price-Change Approval Dashboard
          </h3>
          <p className="muted small" style={{ margin: '4px 0 0' }}>
            Review employee rate-change requests. Approve directly to update the catalog right away, or issue a one-time authorization code for the employee to apply.
          </p>
        </div>
        <button
          type="button"
          className="btn btn-sm"
          onClick={refreshPriceRequests}
          disabled={loadingPriceRequests}
          style={{ border: `1px solid ${themeBorder}`, color: themeText, background: isLightMode ? '#FFFFFF' : 'rgba(255,255,255,0.05)' }}
        >
          <i className={`fas fa-rotate ${loadingPriceRequests ? 'fa-spin' : ''}`} style={{ marginRight: 6 }} />
          {loadingPriceRequests ? 'Refreshing…' : 'Refresh Queue'}
        </button>
      </div>

      {latestIssuedCode && (
        <div
          style={{
            marginBottom: 18,
            padding: '14px 18px',
            borderRadius: 12,
            background: isLightMode ? '#EFF6FF' : 'rgba(0, 102, 153, 0.2)',
            border: '1px solid #006699',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 12,
          }}
        >
          <div>
            <div style={{ fontSize: '.74rem', fontWeight: 800, color: isLightMode ? '#00517A' : '#7DD3FC', textTransform: 'uppercase', letterSpacing: '.08em' }}>
              Authorization Code Ready to Send
            </div>
            <div style={{ color: themeText, fontSize: '.92rem', marginTop: 4 }}>
              Send code <strong style={{ fontFamily: 'monospace', fontSize: '1.08rem', letterSpacing: '.08em' }}>{latestIssuedCode.code}</strong> to{' '}
              <b>{latestIssuedCode.recipient}</b> for <b>{latestIssuedCode.roomName}</b> (also dispatched via notification/email).
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              type="button"
              className="btn btn-sm"
              onClick={() => handleCopyCode(latestIssuedCode.code)}
              style={{ background: '#006699', color: '#FFFFFF', border: 'none', borderRadius: 8, padding: '7px 14px', fontWeight: 700, cursor: 'pointer' }}
            >
              <i className="fas fa-copy" style={{ marginRight: 6 }} /> Copy Code
            </button>
            <button
              type="button"
              className="btn btn-sm"
              onClick={() => setLatestIssuedCode(null)}
              style={{ border: `1px solid ${themeBorder}`, color: themeText, borderRadius: 8, padding: '7px 12px', cursor: 'pointer' }}
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* KPI Summary Band */}
      <div className="admin-grid-4-col" style={{ gap: 12, marginBottom: 18 }}>
        {[
          { key: 'pending' as FilterKey, label: 'Pending Review', val: pendingCount, accent: '#D97706' },
          { key: 'code_issued' as FilterKey, label: 'Admin Code Sent', val: codeIssuedCount, accent: '#006699' },
          { key: 'approved_applied' as FilterKey, label: 'Applied Changes', val: appliedCount, accent: '#059669' },
          { key: 'rejected' as FilterKey, label: 'Declined', val: rejectedCount, accent: '#DC2626' },
        ].map((card) => (
          <div
            key={card.key}
            onClick={() => setStatusFilter(card.key)}
            style={{
              background: isLightMode ? '#F8FAFC' : 'rgba(255,255,255,0.03)',
              border: `1px solid ${statusFilter === card.key ? card.accent : themeBorder}`,
              borderRadius: 12,
              padding: 14,
              cursor: 'pointer',
            }}
          >
            <span style={{ fontSize: '.72rem', color: themeMuted, fontWeight: 700, textTransform: 'uppercase' }}>{card.label}</span>
            <div style={{ fontSize: '1.45rem', fontWeight: 800, color: card.accent, marginTop: 4 }}>{card.val}</div>
          </div>
        ))}
      </div>

      {/* Filter Chips */}
      <div className="chip-row" style={{ marginBottom: 16 }}>
        {([
          ['all', 'All Requests'],
          ['pending', 'Pending'],
          ['code_issued', 'Code Sent'],
          ['approved_applied', 'Applied'],
          ['rejected', 'Rejected'],
        ] as Array<[FilterKey, string]>).map(([k, label]) => (
          <button key={k} className={`chip ${statusFilter === k ? 'sel' : ''}`} onClick={() => setStatusFilter(k)}>
            {label}
          </button>
        ))}
      </div>

      {loadingPriceRequests ? (
        <div className="skel" style={{ height: 220 }} />
      ) : filtered.length === 0 ? (
        <p className="muted" style={{ padding: '28px 0', textAlign: 'center' }}>
          No price-change approval requests match this filter.
        </p>
      ) : (
        <div className="table-wrap" style={{ background: isLightMode ? '#FFFFFF' : 'rgba(11,17,32,0.9)', border: `1px solid ${themeBorder}` }}>
          <table className="table" style={{ color: themeText }}>
            <thead>
              <tr style={{ background: isLightMode ? '#F1F5F9' : 'rgba(30,41,59,0.8)' }}>
                <th style={{ color: isLightMode ? '#475569' : themeMuted }}>Requester</th>
                <th style={{ color: isLightMode ? '#475569' : themeMuted }}>Accommodation / Offering</th>
                <th style={{ color: isLightMode ? '#475569' : themeMuted }}>Rate Adjustment</th>
                <th style={{ color: isLightMode ? '#475569' : themeMuted }}>Justification</th>
                <th style={{ color: isLightMode ? '#475569' : themeMuted }}>Status &amp; Code</th>
                <th style={{ color: isLightMode ? '#475569' : themeMuted, textAlign: 'right' }}>Admin Decision</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((item) => {
                const badge = statusMeta(item.status);
                const diff = Number(item.requested_rate_php || 0) - Number(item.current_rate_php || 0);
                const canDecide = item.status === 'pending' || item.status === 'code_issued';
                const isBusy = busyId === item.id;

                return (
                  <tr key={item.id} style={{ borderBottom: `1px solid ${themeBorder}` }}>
                    <td>
                      <b style={{ color: themeText }}>{item.requested_by_name || 'Staff Member'}</b>
                      <div style={{ fontSize: '.74rem', color: themeMuted }}>
                        {(item.requested_by_department || item.requested_by_role || 'staff').replace('_', ' ').toUpperCase()} · {fmtTime(item.created_at)}
                      </div>
                    </td>
                    <td>
                      <b>{item.room_name}</b>
                      <div style={{ fontSize: '.74rem', color: themeMuted }}>{item.category || 'Room'}</div>
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                        <span style={{ color: themeMuted, textDecoration: 'line-through' }}>{money(item.current_rate_php)}</span>
                        <span>→</span>
                        <b style={{ color: '#059669' }}>{money(item.requested_rate_php)}</b>
                        <span style={{ fontSize: '.72rem', fontWeight: 700, color: diff >= 0 ? '#059669' : '#D97706' }}>
                          ({diff >= 0 ? `+${money(diff)}` : `-${money(Math.abs(diff))}`})
                        </span>
                      </div>
                    </td>
                    <td style={{ maxWidth: 260, fontSize: '.84rem' }}>
                      <div>{item.reason}</div>
                      {item.review_note && (
                        <div style={{ fontSize: '.74rem', color: themeMuted, marginTop: 4 }}>Admin note: {item.review_note}</div>
                      )}
                    </td>
                    <td>
                      <span
                        className="pill"
                        style={{
                          background: badge.bg,
                          color: badge.color,
                          fontSize: '.7rem',
                          fontWeight: 800,
                        }}
                      >
                        {badge.label}
                      </span>
                      {item.status === 'code_issued' && item.authorization_code && (
                        <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                          <code
                            style={{
                              padding: '2px 8px',
                              borderRadius: 6,
                              background: isLightMode ? '#E2E8F0' : 'rgba(255,255,255,0.08)',
                              color: themeText,
                              fontWeight: 700,
                              fontSize: '.78rem',
                            }}
                          >
                            {item.authorization_code}
                          </code>
                          <button
                            type="button"
                            onClick={() => handleCopyCode(item.authorization_code)}
                            style={{ border: 'none', background: 'none', color: '#006699', cursor: 'pointer', fontSize: '.78rem' }}
                            title="Copy code"
                          >
                            <i className="fas fa-copy" />
                          </button>
                        </div>
                      )}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      {canDecide ? (
                        <div style={{ display: 'inline-flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => executeAction(item, 'direct')}
                            style={{
                              background: '#047857',
                              color: '#FFFFFF',
                              border: 'none',
                              borderRadius: 8,
                              padding: '6px 10px',
                              fontSize: '.74rem',
                              fontWeight: 700,
                              cursor: 'pointer',
                            }}
                            title="Approve and apply new price immediately"
                          >
                            <i className="fas fa-check" style={{ marginRight: 4 }} />
                            Approve Directly
                          </button>
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => executeAction(item, 'code')}
                            style={{
                              background: '#006699',
                              color: '#FFFFFF',
                              border: 'none',
                              borderRadius: 8,
                              padding: '6px 10px',
                              fontSize: '.74rem',
                              fontWeight: 700,
                              cursor: 'pointer',
                            }}
                            title="Generate and send single-use approval code to employee"
                          >
                            <i className="fas fa-key" style={{ marginRight: 4 }} />
                            {item.status === 'code_issued' ? 'Reissue Code' : 'Send Code'}
                          </button>
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => {
                              setNoteTarget({ item, mode: 'reject' });
                              setReviewNote('');
                            }}
                            style={{
                              background: isLightMode ? '#FEE2E2' : 'rgba(220, 38, 38, 0.18)',
                              color: isLightMode ? '#991B1B' : '#FCA5A5',
                              border: '1px solid rgba(220, 38, 38, 0.35)',
                              borderRadius: 8,
                              padding: '6px 10px',
                              fontSize: '.74rem',
                              fontWeight: 700,
                              cursor: 'pointer',
                            }}
                          >
                            Reject
                          </button>
                        </div>
                      ) : (
                        <span style={{ fontSize: '.74rem', color: themeMuted }}>
                          {item.reviewed_by_name ? `By ${item.reviewed_by_name}` : 'Closed'}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Optional Rejection Note Modal */}
      {noteTarget && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(2, 6, 23, 0.72)',
            zIndex: 1050,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
          }}
          onClick={() => setNoteTarget(null)}
        >
          <div
            style={{
              width: '100%',
              maxWidth: 420,
              background: isLightMode ? '#FFFFFF' : '#0B1120',
              borderRadius: 16,
              border: `1px solid ${themeBorder}`,
              padding: 20,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h4 style={{ margin: '0 0 8px', color: themeText }}>Decline Price-Change Request</h4>
            <p style={{ fontSize: '.84rem', color: themeMuted, margin: '0 0 12px' }}>
              Provide an optional reason for declining <b>{noteTarget.item.room_name}</b> ({money(noteTarget.item.requested_rate_php)}).
            </p>
            <textarea
              rows={3}
              value={reviewNote}
              onChange={(e) => setReviewNote(e.target.value)}
              placeholder="e.g. Keep current seasonal rate until next month."
              style={{
                width: '100%',
                padding: '8px 12px',
                borderRadius: 8,
                border: `1px solid ${themeBorder}`,
                background: isLightMode ? '#F8FAFC' : 'rgba(255,255,255,0.05)',
                color: themeText,
                marginBottom: 14,
              }}
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button
                type="button"
                className="btn btn-sm"
                onClick={() => setNoteTarget(null)}
                style={{ border: `1px solid ${themeBorder}`, color: themeText }}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-sm"
                disabled={busyId === noteTarget.item.id}
                onClick={() => executeAction(noteTarget.item, 'reject', reviewNote.trim() || undefined)}
                style={{ background: '#DC2626', color: '#FFFFFF', border: 'none', borderRadius: 8, padding: '7px 14px', fontWeight: 700, cursor: 'pointer' }}
              >
                Confirm Reject
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
