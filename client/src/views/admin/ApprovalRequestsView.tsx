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
  const [searchQuery, setSearchQuery] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [noteTarget, setNoteTarget] = useState<{ item: any; mode: 'reject' | 'direct' | 'code' } | null>(null);
  const [reviewNote, setReviewNote] = useState('');
  const [latestIssuedCode, setLatestIssuedCode] = useState<{ id: string; code: string; roomName: string; recipient: string } | null>(null);

  const pendingCount = priceRequests.filter((r) => r.status === 'pending').length;
  const codeIssuedCount = priceRequests.filter((r) => r.status === 'code_issued').length;
  const appliedCount = priceRequests.filter((r) => r.status === 'approved_applied').length;
  const rejectedCount = priceRequests.filter((r) => r.status === 'rejected').length;

  const filtered = priceRequests.filter((r) => {
    const matchStatus = statusFilter === 'all' || r.status === statusFilter;
    if (!matchStatus) return false;
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      (r.requested_by_name || '').toLowerCase().includes(q) ||
      (r.requested_by_email || '').toLowerCase().includes(q) ||
      (r.requested_by_department || '').toLowerCase().includes(q) ||
      (r.requested_by_role || '').toLowerCase().includes(q) ||
      (r.requested_by_id || '').toLowerCase().includes(q) ||
      (r.room_name || '').toLowerCase().includes(q) ||
      (r.category || '').toLowerCase().includes(q) ||
      (r.reason || '').toLowerCase().includes(q)
    );
  });

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
        return { label: 'CODE ISSUED', bg: isLightMode ? '#E0F2FE' : 'rgba(0, 102, 153, 0.28)', color: isLightMode ? '#075985' : '#7DD3FC' };
      case 'approved_applied':
        return { label: 'APPROVED & APPLIED', bg: isLightMode ? '#D1FAE5' : 'rgba(5, 150, 105, 0.22)', color: isLightMode ? '#065F46' : '#6EE7B7' };
      case 'rejected':
        return { label: 'REJECTED', bg: isLightMode ? '#FEE2E2' : 'rgba(220, 38, 38, 0.22)', color: isLightMode ? '#991B1B' : '#FCA5A5' };
      default:
        return { label: status.toUpperCase(), bg: 'rgba(100,116,139,0.2)', color: themeMuted };
    }
  };

  const getInitials = (name?: string) => {
    if (!name) return 'ST';
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  return (
    <div className="panel" style={{ background: themeCardBg, border: `1px solid ${themeBorder}`, borderRadius: 16, padding: 24, boxShadow: themeShadow }}>
      {/* Header with Title & Refresh */}
      <div className="admin-tab-header" style={{ marginBottom: 18 }}>
        <div>
          <span className="label light" style={{ color: '#006699', fontWeight: 800, letterSpacing: '.12em' }}>
            <i className="fas fa-shield-halved" style={{ marginRight: 6 }} />
            ADMINISTRATOR GOVERNANCE & APPROVAL PORTAL
          </span>
          <h3 className="serif" style={{ fontSize: '1.6rem', margin: '4px 0 0', color: themeText }}>
            Subject of Changes & Requester Accounts Manifest
          </h3>
          <p className="muted small" style={{ margin: '4px 0 0', maxWidth: 820 }}>
            Audit and authorize rate modifications across all resort offerings. Displays the full verified employee account table for all requests regarding who requested changes to accommodations and offerings.
          </p>
        </div>
        <button
          type="button"
          className="btn btn-sm"
          onClick={refreshPriceRequests}
          disabled={loadingPriceRequests}
          style={{ border: `1px solid ${themeBorder}`, color: themeText, background: isLightMode ? '#FFFFFF' : 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', gap: 6 }}
        >
          <i className={`fas fa-rotate ${loadingPriceRequests ? 'fa-spin' : ''}`} />
          {loadingPriceRequests ? 'Refreshing…' : 'Refresh Requests'}
        </button>
      </div>

      {/* Authorization Code Banner */}
      {latestIssuedCode && (
        <div
          style={{
            marginBottom: 20,
            padding: '16px 20px',
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
              <i className="fas fa-key" style={{ marginRight: 6 }} />
              Authorization Code Ready to Send
            </div>
            <div style={{ color: themeText, fontSize: '.92rem', marginTop: 4 }}>
              Send authorization code <strong style={{ fontFamily: 'monospace', fontSize: '1.1rem', letterSpacing: '.08em', color: '#006699' }}>{latestIssuedCode.code}</strong> to{' '}
              <b>{latestIssuedCode.recipient}</b> for <b>{latestIssuedCode.roomName}</b> (dispatched automatically to employee inbox/logs).
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
      <div className="admin-grid-4-col" style={{ gap: 12, marginBottom: 20 }}>
        {[
          { key: 'pending' as FilterKey, label: 'Pending Review', val: pendingCount, accent: '#D97706', icon: 'fa-clock' },
          { key: 'code_issued' as FilterKey, label: 'Admin Code Sent', val: codeIssuedCount, accent: '#006699', icon: 'fa-paper-plane' },
          { key: 'approved_applied' as FilterKey, label: 'Applied Changes', val: appliedCount, accent: '#059669', icon: 'fa-circle-check' },
          { key: 'rejected' as FilterKey, label: 'Declined', val: rejectedCount, accent: '#DC2626', icon: 'fa-circle-xmark' },
        ].map((card) => (
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
            <div style={{ fontSize: '1.5rem', fontWeight: 800, color: card.accent, marginTop: 4 }}>{card.val}</div>
          </div>
        ))}
      </div>

      {/* Controls Bar: Filter Chips & Requester Search */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 18 }}>
        <div className="chip-row" style={{ margin: 0 }}>
          {([
            ['all', `All Requests (${priceRequests.length})`],
            ['pending', `Pending (${pendingCount})`],
            ['code_issued', `Code Sent (${codeIssuedCount})`],
            ['approved_applied', `Applied (${appliedCount})`],
            ['rejected', `Rejected (${rejectedCount})`],
          ] as Array<[FilterKey, string]>).map(([k, label]) => (
            <button key={k} className={`chip ${statusFilter === k ? 'sel' : ''}`} onClick={() => setStatusFilter(k)}>
              {label}
            </button>
          ))}
        </div>

        <div style={{ position: 'relative', width: '100%', maxWidth: 320 }}>
          <i
            className="fas fa-search"
            style={{
              position: 'absolute',
              left: 12,
              top: '50%',
              transform: 'translateY(-50%)',
              color: themeMuted,
              fontSize: '.82rem',
            }}
          />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search requester account or offering…"
            style={{
              width: '100%',
              padding: '8px 12px 8px 32px',
              borderRadius: 8,
              border: `1px solid ${themeBorder}`,
              background: isLightMode ? '#FFFFFF' : 'rgba(255,255,255,0.05)',
              color: themeText,
              fontSize: '.84rem',
            }}
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              style={{
                position: 'absolute',
                right: 8,
                top: '50%',
                transform: 'translateY(-50%)',
                background: 'none',
                border: 'none',
                color: themeMuted,
                cursor: 'pointer',
                fontSize: '.75rem',
              }}
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Loading Skeleton */}
      {loadingPriceRequests ? (
        <div className="skel" style={{ height: 260, borderRadius: 12 }} />
      ) : filtered.length === 0 ? (
        <div
          style={{
            padding: '48px 24px',
            textAlign: 'center',
            borderRadius: 12,
            background: isLightMode ? '#F8FAFC' : 'rgba(255,255,255,0.02)',
            border: `1px dashed ${themeBorder}`,
          }}
        >
          <i className="fas fa-inbox" style={{ fontSize: '2.4rem', color: themeMuted, marginBottom: 12, display: 'block' }} />
          <h4 style={{ margin: '0 0 6px', color: themeText }}>No Subject-of-Changes Requests Found</h4>
          <p className="muted small" style={{ margin: 0 }}>
            {searchQuery
              ? `No requests match search query "${searchQuery}". Clear search or adjust filter.`
              : 'There are currently no price change requests submitted by staff members.'}
          </p>
        </div>
      ) : (
        /* The Account Table for All Subject-of-Changes Requests */
        <div className="table-wrap" style={{ background: isLightMode ? '#FFFFFF' : 'rgba(11,17,32,0.9)', border: `1px solid ${themeBorder}`, borderRadius: 12 }}>
          <table className="table" style={{ color: themeText, width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: isLightMode ? '#F1F5F9' : 'rgba(30,41,59,0.8)', borderBottom: `1px solid ${themeBorder}` }}>
                <th style={{ color: isLightMode ? '#475569' : themeMuted, padding: '12px 14px' }}>Requester Account</th>
                <th style={{ color: isLightMode ? '#475569' : themeMuted, padding: '12px 14px' }}>Subject of Changes (Offering)</th>
                <th style={{ color: isLightMode ? '#475569' : themeMuted, padding: '12px 14px' }}>Proposed Rate Adjustment</th>
                <th style={{ color: isLightMode ? '#475569' : themeMuted, padding: '12px 14px' }}>Reason &amp; Justification</th>
                <th style={{ color: isLightMode ? '#475569' : themeMuted, padding: '12px 14px' }}>Status &amp; Authorization</th>
                <th style={{ color: isLightMode ? '#475569' : themeMuted, padding: '12px 14px', textAlign: 'right' }}>Executive Action</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((item) => {
                const badge = statusMeta(item.status);
                const currentRate = Number(item.current_rate_php || 0);
                const requestedRate = Number(item.requested_rate_php || 0);
                const diff = requestedRate - currentRate;
                const pct = currentRate > 0 ? Math.round((diff / currentRate) * 100) : 0;
                const canDecide = item.status === 'pending' || item.status === 'code_issued';
                const isBusy = busyId === item.id;
                const initials = getInitials(item.requested_by_name);

                return (
                  <tr key={item.id} style={{ borderBottom: `1px solid ${themeBorder}`, verticalAlign: 'top' }}>
                    {/* Requester Account Details */}
                    <td style={{ padding: '12px 14px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span
                          style={{
                            width: 34,
                            height: 34,
                            borderRadius: '50%',
                            background: 'linear-gradient(135deg, #0284C7, #0369A1)',
                            color: '#FFFFFF',
                            fontWeight: 800,
                            fontSize: '.78rem',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0,
                          }}
                        >
                          {initials}
                        </span>
                        <div>
                          <div style={{ fontWeight: 700, color: themeText, fontSize: '.9rem' }}>
                            {item.requested_by_name || 'Staff Member'}
                          </div>
                          {item.requested_by_email && (
                            <div style={{ fontSize: '.74rem', color: themeMuted }}>
                              <i className="fas fa-envelope" style={{ marginRight: 4, fontSize: '.68rem' }} />
                              {item.requested_by_email}
                            </div>
                          )}
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4, flexWrap: 'wrap' }}>
                            <span
                              style={{
                                fontSize: '.66rem',
                                fontWeight: 800,
                                padding: '2px 6px',
                                borderRadius: 4,
                                background: 'rgba(56, 189, 248, 0.15)',
                                color: '#38BDF8',
                                border: '1px solid rgba(56, 189, 248, 0.3)',
                                textTransform: 'uppercase',
                              }}
                            >
                              {(item.requested_by_department || item.requested_by_role || 'staff').replace('_', ' ')}
                            </span>
                            <span style={{ fontSize: '.7rem', color: themeMuted }}>
                              <i className="fas fa-clock" style={{ marginRight: 3, fontSize: '.65rem' }} />
                              {fmtTime(item.created_at)}
                            </span>
                          </div>
                          {item.requested_by_id && (
                            <div style={{ fontSize: '.66rem', color: themeMuted, marginTop: 2, fontFamily: 'monospace' }}>
                              ID: {String(item.requested_by_id).slice(0, 14)}…
                            </div>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Subject of Changes */}
                    <td style={{ padding: '12px 14px' }}>
                      <div style={{ fontWeight: 700, color: themeText, fontSize: '.92rem' }}>
                        {item.room_name}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 3 }}>
                        <span
                          style={{
                            fontSize: '.68rem',
                            fontWeight: 700,
                            padding: '1px 6px',
                            borderRadius: 4,
                            background: isLightMode ? '#F1F5F9' : 'rgba(255,255,255,0.06)',
                            color: themeMuted,
                            border: `1px solid ${themeBorder}`,
                          }}
                        >
                          {item.category || 'Offering'}
                        </span>
                      </div>
                      {item.room_id && (
                        <div style={{ fontSize: '.68rem', color: themeMuted, marginTop: 4, fontFamily: 'monospace' }}>
                          Ref: {String(item.room_id).slice(0, 12)}…
                        </div>
                      )}
                    </td>

                    {/* Proposed Rate Adjustment */}
                    <td style={{ padding: '12px 14px', whiteSpace: 'nowrap' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <span style={{ color: themeMuted, textDecoration: 'line-through', fontSize: '.88rem' }}>
                          {money(currentRate)}
                        </span>
                        <span style={{ color: themeMuted }}>→</span>
                        <strong style={{ color: '#059669', fontSize: '1.02rem' }}>
                          {money(requestedRate)}
                        </strong>
                      </div>
                      <div style={{ marginTop: 4 }}>
                        <span
                          style={{
                            fontSize: '.72rem',
                            fontWeight: 800,
                            padding: '2px 6px',
                            borderRadius: 4,
                            background: diff >= 0 ? 'rgba(5, 150, 105, 0.15)' : 'rgba(217, 119, 6, 0.15)',
                            color: diff >= 0 ? '#10B981' : '#F59E0B',
                            border: `1px solid ${diff >= 0 ? 'rgba(5, 150, 105, 0.3)' : 'rgba(217, 119, 6, 0.3)'}`,
                          }}
                        >
                          {diff >= 0 ? `+${money(diff)} (+${pct}%)` : `-${money(Math.abs(diff))} (${pct}%)`}
                        </span>
                      </div>
                    </td>

                    {/* Reason & Justification */}
                    <td style={{ padding: '12px 14px', maxWidth: 280 }}>
                      <div style={{ fontSize: '.84rem', color: themeText, lineHeight: 1.4 }}>
                        {item.reason}
                      </div>
                      {item.review_note && (
                        <div
                          style={{
                            fontSize: '.74rem',
                            color: isLightMode ? '#00517A' : '#7DD3FC',
                            marginTop: 6,
                            padding: '4px 8px',
                            borderRadius: 6,
                            background: isLightMode ? '#EFF6FF' : 'rgba(0, 102, 153, 0.15)',
                            border: '1px solid rgba(0, 102, 153, 0.25)',
                          }}
                        >
                          <strong>Admin Note:</strong> {item.review_note}
                        </div>
                      )}
                    </td>

                    {/* Status & Code */}
                    <td style={{ padding: '12px 14px', whiteSpace: 'nowrap' }}>
                      <span
                        className="pill"
                        style={{
                          background: badge.bg,
                          color: badge.color,
                          fontSize: '.7rem',
                          fontWeight: 800,
                          padding: '3px 8px',
                          borderRadius: 6,
                          display: 'inline-block',
                        }}
                      >
                        {badge.label}
                      </span>

                      {item.status === 'code_issued' && item.authorization_code && (
                        <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                          <code
                            style={{
                              padding: '3px 8px',
                              borderRadius: 6,
                              background: isLightMode ? '#E2E8F0' : 'rgba(255,255,255,0.08)',
                              color: themeText,
                              fontWeight: 700,
                              fontSize: '.82rem',
                              letterSpacing: '.06em',
                            }}
                          >
                            {item.authorization_code}
                          </code>
                          <button
                            type="button"
                            onClick={() => handleCopyCode(item.authorization_code)}
                            style={{
                              border: 'none',
                              background: 'none',
                              color: '#006699',
                              cursor: 'pointer',
                              fontSize: '.85rem',
                              padding: 2,
                            }}
                            title="Copy code"
                          >
                            <i className="fas fa-copy" />
                          </button>
                        </div>
                      )}
                    </td>

                    {/* Executive Governance Action Controls */}
                    <td style={{ padding: '12px 14px', textAlign: 'right' }}>
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
                              display: 'flex',
                              alignItems: 'center',
                              gap: 4,
                            }}
                            title="Approve and apply new price immediately to live catalog"
                          >
                            <i className="fas fa-check" />
                            Approve Live
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
                              display: 'flex',
                              alignItems: 'center',
                              gap: 4,
                            }}
                            title="Generate single-use authorization code for employee to apply"
                          >
                            <i className="fas fa-key" />
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
                        <div style={{ fontSize: '.76rem', color: themeMuted }}>
                          {item.reviewed_by_name ? `Reviewed by ${item.reviewed_by_name}` : 'Request Concluded'}
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Decline Reason Modal */}
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
