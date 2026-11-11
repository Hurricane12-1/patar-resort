import React, { useEffect, useState, useCallback } from 'react';
import { api } from '../lib/api.ts';
import { money, fmtTime } from '../lib/format.ts';
import { toast } from './Toasts.tsx';

export default function PriceChangeRequestPanel() {
  const [rooms, setRooms] = useState<any[]>([]);
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRoom, setSelectedRoom] = useState<any | null>(null);
  const [requestedRate, setRequestedRate] = useState('');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [codeInputs, setCodeInputs] = useState<Record<string, string>>({});
  const [applyingId, setApplyingId] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [roomRows, reqRows] = await Promise.all([
        api.rooms(true).catch(() => []),
        api.priceRequests().catch(() => []),
      ]);
      setRooms(Array.isArray(roomRows) ? roomRows : []);
      setRequests(Array.isArray(reqRows) ? reqRows : []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleOpenRequestModal = (room: any) => {
    setSelectedRoom(room);
    setRequestedRate(String(room.rate_php || ''));
    setReason('');
  };

  const handleSubmitRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRoom) return;
    const rateNum = Number(requestedRate);
    if (!Number.isFinite(rateNum) || rateNum < 50) {
      toast('Enter a valid rate of at least ₱50.', true);
      return;
    }
    if (rateNum === Number(selectedRoom.rate_php)) {
      toast('Requested rate must be different from the current rate.', true);
      return;
    }
    if (reason.trim().length < 5) {
      toast('Please enter a short reason for administrator review.', true);
      return;
    }

    setSubmitting(true);
    try {
      await api.createPriceRequest({
        room_id: selectedRoom.id,
        requested_rate_php: Math.round(rateNum),
        reason: reason.trim(),
      });
      toast(`Price change request sent to Administrator for "${selectedRoom.name}".`);
      setSelectedRoom(null);
      setRequestedRate('');
      setReason('');
      await loadData();
    } catch (err: any) {
      toast(err.message || 'Could not submit price change request', true);
    } finally {
      setSubmitting(false);
    }
  };

  const handleApplyWithCode = async (reqId: string) => {
    const code = (codeInputs[reqId] || '').trim();
    if (!code) {
      toast('Enter the authorization code sent by Administrator.', true);
      return;
    }
    setApplyingId(reqId);
    try {
      await api.applyPriceRequestWithCode(reqId, code);
      toast('Approved price change applied using administrator code.');
      setCodeInputs((prev) => ({ ...prev, [reqId]: '' }));
      await loadData();
    } catch (err: any) {
      toast(err.message || 'Invalid or expired authorization code', true);
    } finally {
      setApplyingId(null);
    }
  };

  const statusPill = (status: string) => {
    if (status === 'pending') return { label: 'Awaiting Admin Review', cls: 'pending' };
    if (status === 'code_issued') return { label: 'Admin Code Sent — Enter Code', cls: 'sent' };
    if (status === 'approved_applied') return { label: 'Approved & Applied', cls: 'delivered' };
    return { label: 'Declined', cls: 'cancelled' };
  };

  return (
    <div style={{ marginTop: 28, display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Current Rates (Read-Only + Request Permission) */}
      <div className="panel">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 14 }}>
          <div>
            <span className="label" style={{ color: '#006699' }}>Administrator Permission Required</span>
            <h3 className="serif" style={{ fontSize: '1.35rem', margin: '4px 0 0' }}>
              Room &amp; Rate Change Requests
            </h3>
            <p className="muted small" style={{ margin: '4px 0 0' }}>
              Direct price editing is locked to Administrator. Submit a permission request below; Administrator can approve directly or send an authorization code.
            </p>
          </div>
          <button type="button" className="act-btn" onClick={loadData} disabled={loading}>
            <i className={`fas fa-rotate ${loading ? 'fa-spin' : ''}`} style={{ marginRight: 5 }} />
            Refresh
          </button>
        </div>

        {loading ? (
          <div className="skel" style={{ height: 140 }} />
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Accommodation / Offering</th>
                  <th>Category</th>
                  <th>Current Rate</th>
                  <th style={{ textAlign: 'right' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {rooms.map((room) => (
                  <tr key={room.id}>
                    <td><b>{room.name}</b></td>
                    <td><span className="tag" style={{ margin: 0 }}>{room.category}</span></td>
                    <td><b>{money(room.rate_php)}</b></td>
                    <td style={{ textAlign: 'right' }}>
                      <button
                        type="button"
                        className="act-btn"
                        onClick={() => handleOpenRequestModal(room)}
                      >
                        <i className="fas fa-pen-to-square" style={{ marginRight: 5 }} />
                        Request Price Change
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Submitted Requests & Authorization Code Redemption */}
      <div className="panel">
        <h3 className="serif" style={{ fontSize: '1.3rem', marginBottom: 12 }}>
          My Price-Change Requests ({requests.length})
        </h3>
        {requests.length === 0 ? (
          <p className="muted small" style={{ padding: '12px 0' }}>No price-change requests submitted yet.</p>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Offering</th>
                  <th>Rate Change</th>
                  <th>Reason</th>
                  <th>Status</th>
                  <th>Admin Code Verification</th>
                </tr>
              </thead>
              <tbody>
                {requests.map((r) => {
                  const pill = statusPill(r.status);
                  return (
                    <tr key={r.id}>
                      <td>
                        <b>{r.room_name}</b><br />
                        <small className="muted">{fmtTime(r.created_at)}</small>
                      </td>
                      <td>
                        <span className="muted">{money(r.current_rate_php)}</span> → <b style={{ color: '#059669' }}>{money(r.requested_rate_php)}</b>
                      </td>
                      <td style={{ maxWidth: 240 }}>
                        <div>{r.reason}</div>
                        {r.review_note && <small className="muted">Admin: {r.review_note}</small>}
                      </td>
                      <td>
                        <span className={`pill ${pill.cls}`}>{pill.label}</span>
                      </td>
                      <td>
                        {r.status === 'code_issued' ? (
                          <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                            <input
                              type="text"
                              placeholder="Enter Admin Code (e.g. RV-XXXXXX)"
                              value={codeInputs[r.id] || ''}
                              onChange={(e) => setCodeInputs((prev) => ({ ...prev, [r.id]: e.target.value.toUpperCase() }))}
                              style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid var(--line)', fontFamily: 'monospace', minWidth: 185 }}
                            />
                            <button
                              type="button"
                              className="act-btn"
                              disabled={applyingId === r.id}
                              onClick={() => handleApplyWithCode(r.id)}
                            >
                              {applyingId === r.id ? 'Applying…' : 'Apply Rate'}
                            </button>
                          </div>
                        ) : r.status === 'approved_applied' ? (
                          <span className="muted small">Applied ({r.approval_mode === 'direct' ? 'Direct Admin Approval' : 'Code Verified'})</span>
                        ) : r.status === 'pending' ? (
                          <span className="muted small">Waiting for Administrator decision</span>
                        ) : (
                          <span className="muted small">Closed</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Request Price Change Modal */}
      {selectedRoom && (
        <div className="modal-overlay" onClick={() => !submitting && setSelectedRoom(null)}>
          <div className="modal" style={{ maxWidth: 460 }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <h3>Request Price Change Permission</h3>
              <p style={{ fontSize: '.85rem', opacity: 0.85 }}>
                {selectedRoom.name} · Current rate: {money(selectedRoom.rate_php)}
              </p>
            </div>
            <form className="modal-body" onSubmit={handleSubmitRequest}>
              <div className="field">
                <label>REQUESTED NEW RATE (₱) *</label>
                <input
                  type="number"
                  required
                  min={50}
                  value={requestedRate}
                  onChange={(e) => setRequestedRate(e.target.value)}
                />
              </div>
              <div className="field">
                <label>REASON FOR PRICE ADJUSTMENT *</label>
                <textarea
                  required
                  rows={3}
                  placeholder="Explain the promo, seasonal adjustment, or correction for Administrator review..."
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 12 }}>
                <button
                  type="button"
                  className="btn btn-ghost"
                  disabled={submitting}
                  onClick={() => setSelectedRoom(null)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-sky" disabled={submitting}>
                  {submitting ? 'Sending Request…' : 'Send Request to Admin'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
