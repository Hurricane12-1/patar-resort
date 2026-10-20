import React, { useState } from 'react';
import { money, fmtDate, fmtTime } from '../../lib/format';
import { IconSearch } from '../../components/AdminIcons';
import StatusPill from '../../components/StatusPill';
import AvailabilityCalendar from '../../components/AvailabilityCalendar';
import { api } from '../../lib/api';

export interface LedgerViewProps {
  ledgerSubView: 'stay_folios' | 'availability' | 'debit_credit';
  setLedgerSubView: (subView: 'stay_folios' | 'availability' | 'debit_credit') => void;
  allBookings: any[];
  activeRoomsList: any[];
  roomsList: any[];
  setRoomsList: React.Dispatch<React.SetStateAction<any[]>>;
  ledgerEntriesList: any[];
  trialBalance: any;
  chartOfAccounts: any[];
  loadingLedger: boolean;
  loadingReservations: boolean;
  reconcilingLedger: boolean;
  handleReconcileLedger: () => void;
  refreshReservations: () => void;
  refreshLedgerEntries: () => void;
  updateStatus: (id: string, status: string) => void;
  setTimelineBooking: (booking: any) => void;
  setReceiptModalBooking: (booking: any) => void;
  setReservationToRemove: (booking: any) => void;
  setRefundTarget: (booking: any) => void;
  setRefundMode: (mode: 'request' | 'confirm') => void;
  setRefundAmount: (amount: any) => void;
  setRefundMethod: (method: string) => void;
  setShowAddReservationModal: (show: boolean) => void;
  setShowAddJournalModal: (show: boolean) => void;
  setShowBackupModal: (show: boolean) => void;
  setBackupTab: (tab: 'export' | 'import' | 'notation' | 'auto') => void;
  newReservation: any;
  setNewReservation: React.Dispatch<React.SetStateAction<any>>;
  isLightMode: boolean;
  themeCardBg: string;
  themeBorder: string;
  themeShadow: string;
  themeText: string;
  themeMuted: string;
  toast: (msg: string, isError?: boolean) => void;
}

export const LedgerView: React.FC<LedgerViewProps> = ({
  ledgerSubView,
  setLedgerSubView,
  allBookings,
  activeRoomsList,
  roomsList,
  setRoomsList,
  ledgerEntriesList,
  trialBalance,
  chartOfAccounts,
  loadingLedger,
  loadingReservations,
  reconcilingLedger,
  handleReconcileLedger,
  refreshReservations,
  refreshLedgerEntries,
  updateStatus,
  setTimelineBooking,
  setReceiptModalBooking,
  setReservationToRemove,
  setRefundTarget,
  setRefundMode,
  setRefundAmount,
  setRefundMethod,
  setShowAddReservationModal,
  setShowAddJournalModal,
  setShowBackupModal,
  setBackupTab,
  newReservation,
  setNewReservation,
  isLightMode,
  themeCardBg,
  themeBorder,
  themeShadow,
  themeText,
  themeMuted,
  toast,
}) => {
  const [reservationFilter, setReservationFilter] = useState<string>('all');
  const [reservationSearch, setReservationSearch] = useState<string>('');
  const [folioViewLimit, setFolioViewLimit] = useState<number | 'all'>(25);

  const [ledgerAccountFilter, setLedgerAccountFilter] = useState<string>('');
  const [ledgerCategoryFilter, setLedgerCategoryFilter] = useState<string>('');
  const [ledgerTypeFilter, setLedgerTypeFilter] = useState<'all' | 'debit' | 'credit'>('all');
  const [ledgerSearch, setLedgerSearch] = useState<string>('');

  const filteredBookings = allBookings.filter((b: any) => {
    if (reservationFilter !== 'all' && b.status !== reservationFilter) return false;
    if (reservationSearch.trim()) {
      const q = reservationSearch.toLowerCase();
      const guestName = (b.guest_name || b.profiles?.full_name || '').toLowerCase();
      const phone = (b.phone || b.profiles?.phone || '').toLowerCase();
      const room = (b.rooms?.name || '').toLowerCase();
      const id = (b.id || '').toLowerCase();
      if (!guestName.includes(q) && !phone.includes(q) && !room.includes(q) && !id.includes(q)) return false;
    }
    return true;
  });

  return (
    <div className="panel" style={{ background: themeCardBg, border: `1px solid ${themeBorder}`, borderRadius: 16, padding: 24, boxShadow: themeShadow }}>
      {/* Header & Dynamic Contextual Action Buttons */}
      <div className="admin-tab-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20, flexWrap: 'wrap', gap: 14 }}>
        <div>
          <span style={{ fontSize: '.76rem', color: '#0EA5E9', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.08em' }}>
            ROCK VIEW BEACH RESORT · RESERVATIONS OPERATIONS
          </span>
          <h3 className="serif" style={{ fontSize: '1.45rem', margin: '4px 0 0', color: themeText, display: 'flex', alignItems: 'center', gap: 8 }}>
            {ledgerSubView === 'stay_folios' && (
              <>
                <i className="fas fa-clipboard-list" style={{ marginRight: 6 }} />Guest Stay Folios
              </>
            )}
            {ledgerSubView === 'availability' && (
              <>
                <i className="fas fa-calendar-alt" style={{ marginRight: 6 }} />Visual Room Lock & Availability Calendar
              </>
            )}
            {ledgerSubView === 'debit_credit' && (
              <>
                <i className="fas fa-scale-balanced" style={{ marginRight: 6 }} />Reservation Financial Ledger (General Ledger (Debit & Credit System))
              </>
            )}
          </h3>
          <p className="muted small" style={{ margin: '4px 0 0' }}>
            {ledgerSubView === 'stay_folios' &&
              'Real-time guest reservation folios, room assignments, direct walk-ins, and front desk check-in / check-out operations.'}
            {ledgerSubView === 'availability' &&
              'Interactive multi-month room occupancy timeline, real-time checkout locks, and date range walk-in dispatch.'}
            {ledgerSubView === 'debit_credit' &&
              'Dual-entry bookkeeping with real-time Trial Balance, Chart of Accounts, and adaptive PostgreSQL backup migration.'}
          </p>
        </div>

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          {ledgerSubView === 'stay_folios' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              {/* Booking Actions Systematic Dropdown */}
              <select
                onChange={(e) => {
                  const val = e.target.value;
                  e.target.value = '';
                  if (val === 'book') {
                    if (activeRoomsList.length === 0) {
                      toast("There's no present room around. Please add a room in Room Management first.", true);
                      return;
                    }
                    if (!newReservation.room_id && activeRoomsList.length > 0) {
                      const firstRoom = activeRoomsList[0];
                      const nights = Math.max(1, Math.round((new Date(newReservation.check_out).getTime() - new Date(newReservation.check_in).getTime()) / 86400000));
                      setNewReservation((prev: any) => ({
                        ...prev,
                        room_id: firstRoom.id,
                        total_php: (firstRoom.rate_php || 3500) * nights,
                      }));
                    }
                    setShowAddReservationModal(true);
                  } else if (val === 'refund') {
                    const target = allBookings.find((b) => b.payment_status === 'refund_pending' || (b.status !== 'cancelled' && b.payment_status !== 'refunded'));
                    if (target) {
                      setRefundTarget(target);
                      setRefundMode(target.payment_status === 'refund_pending' ? 'confirm' : 'request');
                      setRefundAmount(target.downpayment_php || target.total_php || '');
                      setRefundMethod(target.payment_method || 'GCash');
                    } else {
                      toast('No refundable reservation found', true);
                    }
                  } else if (val === 'cancel') {
                    const target = allBookings.find((b) => ['pending', 'confirmed'].includes(b.status));
                    if (target) {
                      if (confirm(`Cancel reservation for ${target.guest_name}?`)) {
                        updateStatus(target.id, 'cancelled');
                      }
                    } else {
                      toast('No pending or confirmed reservation to cancel', true);
                    }
                  } else if (val === 'refresh') {
                    refreshReservations();
                  }
                }}
                className="btn btn-sky btn-sm"
                style={{
                  padding: '7px 14px',
                  fontWeight: 800,
                  borderRadius: 10,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <option value="">Booking Actions ▾</option>
                <option value="book">+ New Walk-In / Phone Booking</option>
                <option value="refund">Process Guest Refund</option>
                <option value="cancel">Cancel Reservation</option>
                <option value="refresh">Refresh Stays</option>
              </select>

              {/* Viewable Rows Count Dropdown */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: '.76rem', color: themeMuted, fontWeight: 700 }}>SHOW:</span>
                <select
                  value={String(folioViewLimit)}
                  onChange={(e) => setFolioViewLimit(e.target.value === 'all' ? 'all' : Number(e.target.value))}
                  style={{
                    padding: '6px 12px',
                    borderRadius: 10,
                    border: `1px solid ${themeBorder}`,
                    background: isLightMode ? '#FFF' : '#1E293B',
                    color: themeText,
                    fontSize: '.78rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  <option value="10">10 Rows</option>
                  <option value="25">25 Rows</option>
                  <option value="50">50 Rows</option>
                  <option value="100">100 Rows</option>
                  <option value="all">All ({allBookings.length})</option>
                </select>
              </div>
            </div>
          )}

          {ledgerSubView === 'availability' && (
            <>
              <button
                className="btn btn-sky btn-sm"
                onClick={() => {
                  if (activeRoomsList.length === 0) {
                    toast("There's no present room around. Please add a room in Room Management first.", true);
                    return;
                  }
                  setShowAddReservationModal(true);
                }}
                style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}
              >
                <i className="fas fa-plus" /> Walk-In Booking
              </button>
              <button
                className="btn btn-sm btn-ghost"
                onClick={() => setLedgerSubView('stay_folios')}
                style={{ color: themeText, border: `1px solid ${themeBorder}`, fontWeight: 600 }}
              >
                <i className="fas fa-clipboard-list" /> View Folios Table
              </button>
              <button
                className="btn btn-sm btn-ghost"
                onClick={() => {
                  refreshReservations();
                  if (roomsList.length === 0) api.rooms(false).then((r: any) => setRoomsList(Array.isArray(r) ? r : [])).catch(() => {});
                }}
                style={{ color: themeText, border: `1px solid ${themeBorder}`, fontWeight: 600 }}
              >
                <i className="fas fa-rotate" /> Refresh Calendar
              </button>
            </>
          )}

          {ledgerSubView === 'debit_credit' && (
            <>
              <button
                className="btn btn-sky btn-sm"
                onClick={() => setShowAddJournalModal(true)}
                style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}
              >
                <i className="fas fa-plus" /> New Journal Entry
              </button>
              <button
                className="btn btn-sm btn-ghost"
                onClick={handleReconcileLedger}
                disabled={reconcilingLedger}
                style={{
                  color: isLightMode ? '#0D9488' : '#2DD4BF',
                  border: `1px solid ${isLightMode ? '#99F6E4' : 'rgba(45, 212, 191, 0.3)'}`,
                  background: isLightMode ? '#F0FDFA' : 'rgba(45, 212, 191, 0.12)',
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}
                title="Automatically sync and post unrecorded reservations and orders as double-entry journal vouchers"
              >
                <i className="fas fa-bolt" /> {reconcilingLedger ? 'Reconciling…' : 'Sync & Reconcile Stays'}
              </button>
              <button
                className="btn btn-sm btn-ghost"
                onClick={() => {
                  setBackupTab('export');
                  setShowBackupModal(true);
                }}
                style={{
                  color: isLightMode ? '#4338CA' : '#818CF8',
                  border: `1px solid ${isLightMode ? '#C7D2FE' : 'rgba(129, 140, 248, 0.3)'}`,
                  background: isLightMode ? '#EEF2FF' : 'rgba(129, 140, 248, 0.12)',
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}
                title="Export or Import PostgreSQL SQL dump, JSON, CSV, or logbook notation"
              >
                <i className="fas fa-floppy-disk" /> PostgreSQL Backup & Migration
              </button>
              <button
                className="btn btn-sm btn-ghost"
                onClick={() => {
                  refreshLedgerEntries();
                  refreshReservations();
                }}
                disabled={loadingLedger || loadingReservations}
                style={{ color: themeText, border: `1px solid ${themeBorder}`, fontWeight: 600 }}
              >
                {loadingLedger ? 'Refreshing…' : <><i className="fas fa-rotate" /> Refresh Ledger</>}
              </button>
            </>
          )}
        </div>
      </div>

      {/* THREE INTERACTIVE BUTTONS THAT REACTIVELY CHANGE THE UI */}
      <div
        style={{
          display: 'flex',
          gap: 10,
          marginBottom: 24,
          padding: '6px',
          background: isLightMode ? '#F1F5F9' : 'rgba(15, 23, 42, 0.65)',
          borderRadius: 14,
          border: `1px solid ${themeBorder}`,
          flexWrap: 'wrap',
        }}
      >
        {/* Button 1: Guest Stay Folios & Bookings */}
        <button
          type="button"
          onClick={() => setLedgerSubView('stay_folios')}
          style={{
            flex: '1 1 auto',
            minWidth: 200,
            padding: '10px 18px',
            borderRadius: 10,
            border: ledgerSubView === 'stay_folios' ? '1px solid #0284C7' : '1px solid transparent',
            background:
              ledgerSubView === 'stay_folios'
                ? isLightMode
                  ? 'linear-gradient(135deg, #0284C7, #0EA5E9)'
                  : 'linear-gradient(135deg, #0369A1, #0284C7)'
                : 'transparent',
            color: ledgerSubView === 'stay_folios' ? '#FFFFFF' : themeMuted,
            fontWeight: ledgerSubView === 'stay_folios' ? 800 : 600,
            fontSize: '.88rem',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            boxShadow: ledgerSubView === 'stay_folios' ? '0 4px 12px rgba(14, 165, 233, 0.3)' : 'none',
            transition: 'all 0.2s ease',
          }}
        >
          <i className="fas fa-clipboard-list" style={{ fontSize: "1.05rem" }} />
          <span>Guest Stay Folios</span>
          <span
            style={{
              fontSize: '.72rem',
              fontWeight: 800,
              background: ledgerSubView === 'stay_folios' ? 'rgba(255,255,255,0.25)' : isLightMode ? '#E2E8F0' : 'rgba(148, 163, 184, 0.2)',
              color: ledgerSubView === 'stay_folios' ? '#FFFFFF' : themeText,
              padding: '2px 8px',
              borderRadius: 12,
            }}
          >
            {allBookings.length}
          </span>
        </button>

        {/* Button 2: Visual Availability & Lock Calendar */}
        <button
          type="button"
          onClick={() => setLedgerSubView('availability')}
          style={{
            flex: '1 1 auto',
            minWidth: 200,
            padding: '10px 18px',
            borderRadius: 10,
            border: ledgerSubView === 'availability' ? '1px solid #0284C7' : '1px solid transparent',
            background:
              ledgerSubView === 'availability'
                ? isLightMode
                  ? 'linear-gradient(135deg, #0284C7, #0EA5E9)'
                  : 'linear-gradient(135deg, #0369A1, #0284C7)'
                : 'transparent',
            color: ledgerSubView === 'availability' ? '#FFFFFF' : themeMuted,
            fontWeight: ledgerSubView === 'availability' ? 800 : 600,
            fontSize: '.88rem',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            boxShadow: ledgerSubView === 'availability' ? '0 4px 12px rgba(14, 165, 233, 0.3)' : 'none',
            transition: 'all 0.2s ease',
          }}
        >
          <i className="fas fa-calendar-alt" style={{ fontSize: "1.05rem" }} />
          <span>Visual Room Lock & Calendar</span>
        </button>

        {/* Button 3: Debit & Credit General Ledger */}
        <button
          type="button"
          onClick={() => setLedgerSubView('debit_credit')}
          style={{
            flex: '1 1 auto',
            minWidth: 200,
            padding: '10px 18px',
            borderRadius: 10,
            border: ledgerSubView === 'debit_credit' ? '1px solid #0284C7' : '1px solid transparent',
            background:
              ledgerSubView === 'debit_credit'
                ? isLightMode
                  ? 'linear-gradient(135deg, #0284C7, #0EA5E9)'
                  : 'linear-gradient(135deg, #0369A1, #0284C7)'
                : 'transparent',
            color: ledgerSubView === 'debit_credit' ? '#FFFFFF' : themeMuted,
            fontWeight: ledgerSubView === 'debit_credit' ? 800 : 600,
            fontSize: '.88rem',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            boxShadow: ledgerSubView === 'debit_credit' ? '0 4px 12px rgba(14, 165, 233, 0.3)' : 'none',
            transition: 'all 0.2s ease',
          }}
        >
          <i className="fas fa-scale-balanced" style={{ fontSize: "1.05rem" }} />
          <span>Reservation Financial Ledger</span>
          <span
            style={{
              fontSize: '.72rem',
              fontWeight: 800,
              background: ledgerSubView === 'debit_credit' ? 'rgba(255,255,255,0.25)' : isLightMode ? '#E2E8F0' : 'rgba(148, 163, 184, 0.2)',
              color: ledgerSubView === 'debit_credit' ? '#FFFFFF' : themeText,
              padding: '2px 8px',
              borderRadius: 12,
            }}
          >
            {ledgerEntriesList.length}
          </span>
        </button>
      </div>

      {/* VIEW 1: DEBIT & CREDIT GENERAL LEDGER */}
      {ledgerSubView === 'debit_credit' && (() => {
        const totalDebits = trialBalance?.total_debits_php ?? ledgerEntriesList.reduce((acc, e) => acc + (Number(e.debit_php) || 0), 0);
        const totalCredits = trialBalance?.total_credits_php ?? ledgerEntriesList.reduce((acc, e) => acc + (Number(e.credit_php) || 0), 0);
        const netDifference = Math.abs(totalDebits - totalCredits);
        const isBalanced = trialBalance ? trialBalance.is_balanced : netDifference === 0;

        const filteredLedgerEntries = ledgerEntriesList.filter((entry) => {
          if (ledgerAccountFilter && entry.account_code !== ledgerAccountFilter) return false;
          if (ledgerCategoryFilter && String(entry.category).toUpperCase() !== ledgerCategoryFilter.toUpperCase()) return false;
          if (ledgerTypeFilter === 'debit' && entry.entry_type !== 'DEBIT') return false;
          if (ledgerTypeFilter === 'credit' && entry.entry_type !== 'CREDIT') return false;
          if (ledgerSearch) {
            const q = ledgerSearch.toLowerCase();
            const p = (entry.particulars || '').toLowerCase();
            const num = (entry.entry_number || '').toLowerCase();
            const acc = (entry.account_name || '').toLowerCase();
            const code = (entry.account_code || '').toLowerCase();
            const ref = (entry.reference_id || '').toLowerCase();
            if (!p.includes(q) && !num.includes(q) && !acc.includes(q) && !code.includes(q) && !ref.includes(q)) return false;
          }
          return true;
        });

        return (
          <div>
            {/* 4 Financial KPI Summary Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 14, marginBottom: 20 }}>
              <div style={{ padding: '16px 18px', background: isLightMode ? '#ECFDF5' : 'rgba(16,185,129,0.1)', borderRadius: 14, border: `1px solid ${isLightMode ? '#A7F3D0' : 'rgba(16,185,129,0.2)'}` }}>
                <small style={{ color: isLightMode ? '#047857' : '#34D399', textTransform: 'uppercase', fontSize: '.7rem', fontWeight: 800, letterSpacing: '.06em' }}>Total Debits (DR)</small>
                <b style={{ display: 'block', fontSize: '1.6rem', color: isLightMode ? '#065F46' : '#10B981', marginTop: 4 }}>
                  {money(totalDebits)}
                </b>
                <span style={{ fontSize: '.74rem', color: '#10B981' }}>Assets increase & expense inflows</span>
              </div>
              <div style={{ padding: '16px 18px', background: isLightMode ? '#EFF6FF' : 'rgba(59,130,246,0.1)', borderRadius: 14, border: `1px solid ${isLightMode ? '#BFDBFE' : 'rgba(59,130,246,0.2)'}` }}>
                <small style={{ color: isLightMode ? '#1D4ED8' : '#60A5FA', textTransform: 'uppercase', fontSize: '.7rem', fontWeight: 800, letterSpacing: '.06em' }}>Total Credits (CR)</small>
                <b style={{ display: 'block', fontSize: '1.6rem', color: isLightMode ? '#1E40AF' : '#3B82F6', marginTop: 4 }}>
                  {money(totalCredits)}
                </b>
                <span style={{ fontSize: '.74rem', color: '#3B82F6' }}>Revenues & guest deposit liabilities</span>
              </div>
              <div style={{ padding: '16px 18px', background: isLightMode ? '#F8FAFC' : 'rgba(255,255,255,0.04)', borderRadius: 14, border: `1px solid ${themeBorder}` }}>
                <small style={{ color: themeMuted, textTransform: 'uppercase', fontSize: '.7rem', fontWeight: 800, letterSpacing: '.06em' }}>Net General Ledger Balance</small>
                <b style={{ display: 'block', fontSize: '1.6rem', color: themeText, marginTop: 4 }}>
                  {money(totalDebits - totalCredits)}
                </b>
                <span style={{ fontSize: '.74rem', color: '#0EA5E9' }}>Cumulative ledger balance</span>
              </div>
              <div style={{ padding: '16px 18px', background: isBalanced ? (isLightMode ? '#F0FDF4' : 'rgba(34,197,94,0.1)') : (isLightMode ? '#FFFBEB' : 'rgba(245,158,11,0.1)'), borderRadius: 14, border: `1px solid ${isBalanced ? (isLightMode ? '#BBF7D0' : 'rgba(34,197,94,0.25)') : (isLightMode ? '#FDE68A' : 'rgba(245,158,11,0.25)')}` }}>
                <small style={{ color: isBalanced ? (isLightMode ? '#15803D' : '#4ADE80') : (isLightMode ? '#B45309' : '#FBBF24'), textTransform: 'uppercase', fontSize: '.7rem', fontWeight: 800, letterSpacing: '.06em' }}>Trial Balance Status</small>
                <b style={{ display: 'block', fontSize: '1.35rem', color: isBalanced ? (isLightMode ? '#166534' : '#22C55E') : (isLightMode ? '#92400E' : '#F59E0B'), marginTop: 4 }}>
                  {isBalanced ? <><i className="fas fa-check" style={{ marginRight: 6 }} />Balanced (0.00)</> : <><i className="fas fa-triangle-exclamation" style={{ marginRight: 6 }} />Imbalance: {money(netDifference)}</>}
                </b>
                <span style={{ fontSize: '.74rem', color: isBalanced ? '#22C55E' : '#F59E0B' }}>
                  {isBalanced ? 'Debits equal Credits perfectly' : 'Review adjusting entries'}
                </span>
              </div>
            </div>

            {/* Filter & Search Toolbar */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                {/* Account Selector */}
                <select
                  value={ledgerAccountFilter}
                  onChange={(e) => setLedgerAccountFilter(e.target.value)}
                  style={{
                    padding: '6px 12px',
                    borderRadius: 12,
                    border: `1px solid ${themeBorder}`,
                    background: isLightMode ? '#FFF' : '#1E293B',
                    color: themeText,
                    fontSize: '.78rem',
                    fontWeight: 600,
                  }}
                >
                  <option value="">All Accounts ({chartOfAccounts.length || 11})</option>
                  {(chartOfAccounts.length > 0 ? chartOfAccounts : [
                    { code: '1010', name: 'Cash on Hand & Digital Wallets' },
                    { code: '1020', name: 'Accounts Receivable - Guest Folios' },
                    { code: '2010', name: 'Guest Reservation Deposits' },
                    { code: '2020', name: 'Guest Refunds Payable' },
                    { code: '4010', name: 'Room Accommodations Revenue' },
                    { code: '4020', name: 'Kitchen & Dining Revenue' },
                    { code: '4030', name: 'Island Tours Revenue' },
                    { code: '5010', name: 'Kitchen & Food Supplies' },
                    { code: '5020', name: 'Housekeeping Linens & Amenities' },
                    { code: '5030', name: 'Resort Utilities & Fuel' },
                    { code: '5040', name: 'Repairs & Property Maintenance' },
                  ]).map((acc: any) => (
                    <option key={acc.code} value={acc.code}>
                      {acc.code} - {acc.name}
                    </option>
                  ))}
                </select>

                {/* Category Selector */}
                <select
                  value={ledgerCategoryFilter}
                  onChange={(e) => setLedgerCategoryFilter(e.target.value)}
                  style={{
                    padding: '6px 12px',
                    borderRadius: 12,
                    border: `1px solid ${themeBorder}`,
                    background: isLightMode ? '#FFF' : '#1E293B',
                    color: themeText,
                    fontSize: '.78rem',
                    fontWeight: 600,
                  }}
                >
                  <option value="">All Categories</option>
                  <option value="REVENUE">Revenue</option>
                  <option value="PAYMENT">Payment</option>
                  <option value="EXPENSE">Expense</option>
                  <option value="REFUND">Refund</option>
                  <option value="ADJUSTMENT">Adjustment</option>
                </select>

                {/* Entry Type Filter Pills */}
                <div style={{ display: 'flex', gap: 4, background: isLightMode ? '#F1F5F9' : 'rgba(30,41,59,0.8)', padding: 3, borderRadius: 12 }}>
                  {[
                    { key: 'all', label: 'All' },
                    { key: 'debit', label: 'Debits Only (DR)' },
                    { key: 'credit', label: 'Credits Only (CR)' },
                  ].map((t) => (
                    <button
                      key={t.key}
                      onClick={() => setLedgerTypeFilter(t.key as any)}
                      style={{
                        padding: '4px 10px',
                        borderRadius: 8,
                        border: 'none',
                        background: ledgerTypeFilter === t.key ? (isLightMode ? '#FFFFFF' : '#0F172A') : 'transparent',
                        color: ledgerTypeFilter === t.key ? (isLightMode ? '#0284C7' : '#38BDF8') : themeMuted,
                        fontSize: '.74rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                        boxShadow: ledgerTypeFilter === t.key ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                      }}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Search Input */}
              <div style={{ position: 'relative', width: 280, maxWidth: '100%' }}>
                <input
                  className="search"
                  placeholder="Search particulars, entry #, ref, code…"
                  value={ledgerSearch}
                  onChange={(e) => setLedgerSearch(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 12px 8px 32px',
                    borderRadius: 14,
                    border: `1px solid ${themeBorder}`,
                    background: isLightMode ? '#FFFFFF' : 'rgba(15,23,42,0.6)',
                    color: themeText,
                    fontSize: '.82rem',
                  }}
                />
                <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', opacity: 0.5 }}>
                  <IconSearch size={14} />
                </span>
              </div>
            </div>

            {/* Debit & Credit Ledger Table */}
            {loadingLedger && ledgerEntriesList.length === 0 ? (
              <div style={{ padding: '40px 0', textAlign: 'center', color: themeMuted }}>
                <p>Loading Double-Entry General Ledger…</p>
              </div>
            ) : filteredLedgerEntries.length === 0 ? (
              <div style={{ padding: '40px 16px', textAlign: 'center', background: isLightMode ? '#F8FAFC' : 'rgba(255,255,255,0.02)', borderRadius: 14, border: `1px dashed ${themeBorder}` }}>
                <p className="muted" style={{ margin: '0 0 8px', fontSize: '1rem' }}>No ledger entries match your filter or search.</p>
                <small style={{ color: themeMuted }}>Click "New Journal Entry" or "Sync & Reconcile Stays" to record transactions.</small>
              </div>
            ) : (
              <div className="table-wrap" style={{ background: isLightMode ? '#FFFFFF' : 'rgba(15,23,42,0.85)', border: `1px solid ${themeBorder}`, borderRadius: 12, overflowX: 'auto' }}>
                <table className="table" style={{ color: themeText, width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: isLightMode ? '#F1F5F9' : 'rgba(30,41,59,0.8)', textAlign: 'left' }}>
                      <th style={{ color: isLightMode ? '#475569' : themeMuted, padding: '12px 14px' }}>Entry #</th>
                      <th style={{ color: isLightMode ? '#475569' : themeMuted, padding: '12px 14px' }}>Date / Time</th>
                      <th style={{ color: isLightMode ? '#475569' : themeMuted, padding: '12px 14px' }}>Account</th>
                      <th style={{ color: isLightMode ? '#475569' : themeMuted, padding: '12px 14px' }}>Particulars / Reference</th>
                      <th style={{ color: isLightMode ? '#475569' : themeMuted, padding: '12px 14px' }}>Category</th>
                      <th style={{ color: isLightMode ? '#047857' : '#34D399', padding: '12px 14px', textAlign: 'right' }}>Debit (₱)</th>
                      <th style={{ color: isLightMode ? '#1D4ED8' : '#60A5FA', padding: '12px 14px', textAlign: 'right' }}>Credit (₱)</th>
                      <th style={{ color: isLightMode ? '#475569' : themeMuted, padding: '12px 14px', textAlign: 'right' }}>Balance (₱)</th>
                      <th style={{ color: isLightMode ? '#475569' : themeMuted, padding: '12px 14px' }}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredLedgerEntries.map((e: any) => {
                      const debitAmt = Number(e.debit_php) || 0;
                      const creditAmt = Number(e.credit_php) || 0;
                      const runBal = Number(e.running_balance_php) || 0;

                      return (
                        <tr key={e.id} style={{ borderBottom: `1px solid ${themeBorder}` }}>
                          <td style={{ padding: '12px 14px', whiteSpace: 'nowrap' }}>
                            <span style={{ fontFamily: 'monospace', fontSize: '.8rem', fontWeight: 700, color: '#0EA5E9' }}>
                              {e.entry_number}
                            </span>
                          </td>
                          <td style={{ padding: '12px 14px', fontSize: '.78rem', whiteSpace: 'nowrap', color: themeMuted }}>
                            {fmtDate(e.posted_at)} <span style={{ opacity: 0.7 }}>{fmtTime(e.posted_at)}</span>
                          </td>
                          <td style={{ padding: '12px 14px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <span style={{ fontFamily: 'monospace', fontWeight: 700, background: isLightMode ? '#E2E8F0' : 'rgba(255,255,255,0.08)', padding: '2px 6px', borderRadius: 6, fontSize: '.72rem' }}>
                                {e.account_code}
                              </span>
                              <span style={{ fontWeight: 600, fontSize: '.84rem' }}>{e.account_name}</span>
                            </div>
                          </td>
                          <td style={{ padding: '12px 14px' }}>
                            <div style={{ fontSize: '.84rem' }}>{e.particulars}</div>
                            {e.reference_id && (
                              <small style={{ color: themeMuted, fontSize: '.7rem', fontFamily: 'monospace' }}>
                                Ref: {e.reference_id}
                              </small>
                            )}
                          </td>
                          <td style={{ padding: '12px 14px' }}>
                            <span
                              className="pill"
                              style={{
                                fontSize: '.68rem',
                                textTransform: 'uppercase',
                                fontWeight: 700,
                                background: e.category === 'REVENUE' ? (isLightMode ? '#EFF6FF' : 'rgba(59,130,246,0.15)') : e.category === 'EXPENSE' ? (isLightMode ? '#FFF1F2' : 'rgba(244,63,94,0.15)') : (isLightMode ? '#F0FDFA' : 'rgba(45,212,191,0.15)'),
                                color: e.category === 'REVENUE' ? '#3B82F6' : e.category === 'EXPENSE' ? '#F43F5E' : '#14B8A6',
                                border: '1px solid currentColor',
                              }}
                            >
                              {e.category}
                            </span>
                          </td>
                          <td style={{ padding: '12px 14px', textAlign: 'right', fontWeight: debitAmt > 0 ? 800 : 400, color: debitAmt > 0 ? (isLightMode ? '#059669' : '#10B981') : themeMuted }}>
                            {debitAmt > 0 ? money(debitAmt) : '—'}
                          </td>
                          <td style={{ padding: '12px 14px', textAlign: 'right', fontWeight: creditAmt > 0 ? 800 : 400, color: creditAmt > 0 ? (isLightMode ? '#2563EB' : '#38BDF8') : themeMuted }}>
                            {creditAmt > 0 ? money(creditAmt) : '—'}
                          </td>
                          <td style={{ padding: '12px 14px', textAlign: 'right', fontWeight: 700, fontFamily: 'monospace', fontSize: '.84rem' }}>
                            {money(runBal)}
                          </td>
                          <td style={{ padding: '12px 14px' }}>
                            <span
                              style={{
                                fontSize: '.68rem',
                                padding: '3px 8px',
                                borderRadius: 8,
                                fontWeight: 700,
                                background: e.status === 'RECONCILED' ? (isLightMode ? '#ECFDF5' : 'rgba(16,185,129,0.15)') : (isLightMode ? '#F1F5F9' : 'rgba(255,255,255,0.06)'),
                                color: e.status === 'RECONCILED' ? '#10B981' : themeMuted,
                              }}
                            >
                              {e.status}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        );
      })()}

      {/* VIEW 2: GUEST STAY FOLIOS & RESERVATIONS */}
      {ledgerSubView === 'stay_folios' && (
        <div>
          {/* 4 KPI Summary Cards for Stays (CLICKABLE & INTERACTIVE FILTER TRIGGERS) */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 14, marginBottom: 20 }}>
            {/* CARD 1: TOTAL RESERVATIONS */}
            <div
              className="kpi-card-clickable"
              onClick={() => setReservationFilter('all')}
              style={{
                padding: '18px 20px',
                background: reservationFilter === 'all'
                  ? (isLightMode ? '#EFF6FF' : 'rgba(14,165,233,0.14)')
                  : (isLightMode ? '#F8FAFC' : 'rgba(255,255,255,0.04)'),
                borderRadius: 20,
                border: `1.5px solid ${reservationFilter === 'all' ? '#0EA5E9' : themeBorder}`,
                boxShadow: reservationFilter === 'all' ? '0 0 0 3px rgba(14,165,233,0.2)' : 'none',
              }}
              title="Click to view all reservations"
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <small style={{ color: themeMuted, textTransform: 'uppercase', fontSize: '.7rem', fontWeight: 800, letterSpacing: '.06em' }}>Total Reservations</small>
                {reservationFilter === 'all' && (
                  <span style={{ fontSize: '.68rem', fontWeight: 800, color: '#0EA5E9', background: 'rgba(14,165,233,0.15)', padding: '2px 8px', borderRadius: 9999 }}>
                    Active
                  </span>
                )}
              </div>
              <b style={{ display: 'block', fontSize: '1.65rem', color: themeText, marginTop: 4 }}>{allBookings.length} stays</b>
              <span style={{ fontSize: '.74rem', color: '#0EA5E9', display: 'flex', alignItems: 'center', gap: 5, marginTop: 2 }}>
                <i className="fas fa-layer-group" style={{ fontSize: '.7rem' }} /> All active & past folios
              </span>
            </div>

            {/* CARD 2: IN-HOUSE / CHECKED IN */}
            <div
              className="kpi-card-clickable"
              onClick={() => setReservationFilter('checked_in')}
              style={{
                padding: '18px 20px',
                background: reservationFilter === 'checked_in'
                  ? (isLightMode ? '#D1FAE5' : 'rgba(16,185,129,0.2)')
                  : (isLightMode ? '#ECFDF5' : 'rgba(16,185,129,0.08)'),
                borderRadius: 20,
                border: `1.5px solid ${reservationFilter === 'checked_in' ? '#10B981' : (isLightMode ? '#A7F3D0' : 'rgba(16,185,129,0.25)')}`,
                boxShadow: reservationFilter === 'checked_in' ? '0 0 0 3px rgba(16,185,129,0.2)' : 'none',
              }}
              title="Click to filter In-House / Checked In guests"
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <small style={{ color: isLightMode ? '#047857' : '#34D399', textTransform: 'uppercase', fontSize: '.7rem', fontWeight: 800, letterSpacing: '.06em' }}>In-House / Checked In</small>
                {reservationFilter === 'checked_in' && (
                  <span style={{ fontSize: '.68rem', fontWeight: 800, color: '#10B981', background: 'rgba(16,185,129,0.2)', padding: '2px 8px', borderRadius: 9999 }}>
                    Active
                  </span>
                )}
              </div>
              <b style={{ display: 'block', fontSize: '1.65rem', color: isLightMode ? '#065F46' : '#10B981', marginTop: 4 }}>
                {allBookings.filter((b) => b.status === 'checked_in').length} guests
              </b>
              <span style={{ fontSize: '.74rem', color: '#10B981', display: 'flex', alignItems: 'center', gap: 5, marginTop: 2 }}>
                <i className="fas fa-hotel" style={{ fontSize: '.7rem' }} /> Currently staying in resort
              </span>
            </div>

            {/* CARD 3: UPCOMING CONFIRMED */}
            <div
              className="kpi-card-clickable"
              onClick={() => setReservationFilter('confirmed')}
              style={{
                padding: '18px 20px',
                background: reservationFilter === 'confirmed'
                  ? (isLightMode ? '#DBEAFE' : 'rgba(59,130,246,0.2)')
                  : (isLightMode ? '#EFF6FF' : 'rgba(59,130,246,0.08)'),
                borderRadius: 20,
                border: `1.5px solid ${reservationFilter === 'confirmed' ? '#3B82F6' : (isLightMode ? '#BFDBFE' : 'rgba(59,130,246,0.25)')}`,
                boxShadow: reservationFilter === 'confirmed' ? '0 0 0 3px rgba(59,130,246,0.2)' : 'none',
              }}
              title="Click to filter upcoming confirmed bookings"
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <small style={{ color: isLightMode ? '#1D4ED8' : '#60A5FA', textTransform: 'uppercase', fontSize: '.7rem', fontWeight: 800, letterSpacing: '.06em' }}>Upcoming Confirmed</small>
                {reservationFilter === 'confirmed' && (
                  <span style={{ fontSize: '.68rem', fontWeight: 800, color: '#3B82F6', background: 'rgba(59,130,246,0.2)', padding: '2px 8px', borderRadius: 9999 }}>
                    Active
                  </span>
                )}
              </div>
              <b style={{ display: 'block', fontSize: '1.65rem', color: isLightMode ? '#1E40AF' : '#3B82F6', marginTop: 4 }}>
                {allBookings.filter((b) => b.status === 'confirmed').length} bookings
              </b>
              <span style={{ fontSize: '.74rem', color: '#3B82F6', display: 'flex', alignItems: 'center', gap: 5, marginTop: 2 }}>
                <i className="fas fa-calendar-check" style={{ fontSize: '.7rem' }} /> Awaiting arrival date
              </span>
            </div>

            {/* CARD 4: GROSS STAY VALUE */}
            <div
              className="kpi-card-clickable"
              onClick={() => setReservationFilter(reservationFilter === 'pending' ? 'all' : 'pending')}
              style={{
                padding: '18px 20px',
                background: reservationFilter === 'pending'
                  ? (isLightMode ? '#FEF3C7' : 'rgba(245,158,11,0.2)')
                  : (isLightMode ? '#FFFBEB' : 'rgba(245,158,11,0.08)'),
                borderRadius: 20,
                border: `1.5px solid ${reservationFilter === 'pending' ? '#F59E0B' : (isLightMode ? '#FDE68A' : 'rgba(245,158,11,0.25)')}`,
                boxShadow: reservationFilter === 'pending' ? '0 0 0 3px rgba(245,158,11,0.2)' : 'none',
              }}
              title="Click to filter pending stays or inspect revenue"
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <small style={{ color: isLightMode ? '#B45309' : '#FBBF24', textTransform: 'uppercase', fontSize: '.7rem', fontWeight: 800, letterSpacing: '.06em' }}>Gross Stay Value</small>
                {reservationFilter === 'pending' && (
                  <span style={{ fontSize: '.68rem', fontWeight: 800, color: '#F59E0B', background: 'rgba(245,158,11,0.2)', padding: '2px 8px', borderRadius: 9999 }}>
                    Pending Filter
                  </span>
                )}
              </div>
              <b style={{ display: 'block', fontSize: '1.65rem', color: isLightMode ? '#92400E' : '#F59E0B', marginTop: 4 }}>
                {money(allBookings.filter((b) => b.status !== 'cancelled').reduce((acc, b) => acc + (b.total_php || 0), 0))}
              </b>
              <span style={{ fontSize: '.74rem', color: '#F59E0B', display: 'flex', alignItems: 'center', gap: 5, marginTop: 2 }}>
                <i className="fas fa-sack-dollar" style={{ fontSize: '.7rem' }} /> Total booking revenue
              </span>
            </div>
          </div>

          {/* Search Bar & Clean Filter Dropdown */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <label style={{ fontSize: '.8rem', fontWeight: 800, color: themeText, display: 'flex', alignItems: 'center', gap: 6 }}>
                <i className="fas fa-filter" style={{ color: '#0EA5E9' }} /> Filter Status:
              </label>
              <select
                value={reservationFilter}
                onChange={(e) => setReservationFilter(e.target.value)}
                style={{
                  padding: '8px 18px',
                  borderRadius: 9999,
                  border: `1.5px solid ${themeBorder}`,
                  background: isLightMode ? '#FFFFFF' : '#1E293B',
                  color: themeText,
                  fontSize: '.82rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  boxShadow: isLightMode ? '0 1px 3px rgba(0,0,0,0.06)' : 'none',
                  outline: 'none',
                }}
              >
                <option value="all">All Folios ({allBookings.length})</option>
                <option value="confirmed">Upcoming Confirmed ({allBookings.filter(b => b.status === 'confirmed').length})</option>
                <option value="checked_in">In-House / Checked In ({allBookings.filter(b => b.status === 'checked_in').length})</option>
                <option value="checked_out">Checked Out ({allBookings.filter(b => b.status === 'checked_out').length})</option>
                <option value="pending">Pending Approval ({allBookings.filter(b => b.status === 'pending').length})</option>
                <option value="cancelled">Cancelled ({allBookings.filter(b => b.status === 'cancelled').length})</option>
              </select>
            </div>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '.76rem', color: themeMuted, fontWeight: 700 }}>
                Showing {folioViewLimit === 'all' ? filteredBookings.length : Math.min(folioViewLimit, filteredBookings.length)} of {filteredBookings.length} bookings
              </span>

              <div style={{ position: 'relative', width: 240, maxWidth: '100%' }}>
                <input
                  className="search"
                  placeholder="Search guest, room, phone…"
                  value={reservationSearch}
                  onChange={(e) => setReservationSearch(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 12px 8px 32px',
                    borderRadius: 14,
                    border: `1px solid ${themeBorder}`,
                    background: isLightMode ? '#FFFFFF' : 'rgba(15,23,42,0.6)',
                    color: themeText,
                    fontSize: '.82rem',
                  }}
                />
                <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', opacity: 0.5 }}>
                  <IconSearch size={14} />
                </span>
              </div>
            </div>
          </div>

          {/* Reservations Ledger Table */}
          {loadingReservations && allBookings.length === 0 ? (
            <div style={{ padding: '40px 0', textAlign: 'center', color: themeMuted }}>
              <p>Loading Guest Reservations Folios…</p>
            </div>
          ) : filteredBookings.length === 0 ? (
            <div style={{ padding: '40px 16px', textAlign: 'center', background: isLightMode ? '#F8FAFC' : 'rgba(255,255,255,0.02)', borderRadius: 14, border: `1px dashed ${themeBorder}` }}>
              <p className="muted" style={{ margin: '0 0 8px', fontSize: '1rem' }}>No reservations match your search or filter.</p>
              <small style={{ color: themeMuted }}>Use the Booking Actions dropdown above to create a walk-in reservation.</small>
            </div>
          ) : (
            <div className="table-wrap" style={{ background: isLightMode ? '#FFFFFF' : 'rgba(15,23,42,0.85)', border: `1px solid ${themeBorder}`, borderRadius: 12 }}>
              <table className="table" style={{ color: themeText }}>
                <thead>
                  <tr style={{ background: isLightMode ? '#F1F5F9' : 'rgba(30,41,59,0.8)' }}>
                    <th style={{ color: isLightMode ? '#475569' : themeMuted }}>Guest Folio</th>
                    <th style={{ color: isLightMode ? '#475569' : themeMuted }}>Room</th>
                    <th style={{ color: isLightMode ? '#475569' : themeMuted }}>Stay Dates</th>
                    <th style={{ color: isLightMode ? '#475569' : themeMuted }}>Party</th>
                    <th style={{ color: isLightMode ? '#475569' : themeMuted }}>Total Amount</th>
                    <th style={{ color: isLightMode ? '#475569' : themeMuted }}>Status</th>
                    <th style={{ color: isLightMode ? '#475569' : themeMuted }}>Front Desk Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {(folioViewLimit === 'all' ? filteredBookings : filteredBookings.slice(0, folioViewLimit)).map((b: any) => (
                    <tr key={b.id} style={{ borderBottom: `1px solid ${themeBorder}` }}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <span style={{ width: 32, height: 32, borderRadius: '50%', background: isLightMode ? '#E2E8F0' : '#334155', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '.8rem', fontWeight: 800 }}>
                            {(b.guest_name || b.profiles?.full_name || 'G').charAt(0).toUpperCase()}
                          </span>
                          <div>
                            <b>{b.guest_name || b.profiles?.full_name || 'Guest User'}</b>
                            <small style={{ color: themeMuted, display: 'block' }}>{b.phone || b.profiles?.phone || 'No phone recorded'}</small>
                          </div>
                        </div>
                      </td>
                      <td>
                        <b>{b.rooms?.name || 'Assigned Room'}</b>
                        {b.notes && (b.notes.toLowerCase().includes('pool') || b.notes.toLowerCase().includes('swimming')) ? (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, marginTop: 4, fontSize: '.7rem', background: 'rgba(56,189,248,0.15)', color: '#0EA5E9', border: '1px solid rgba(56,189,248,0.35)', padding: '1px 6px', borderRadius: 8, fontWeight: 700 }}>
                            <i className="fas fa-person-swimming" style={{ marginRight: 4 }} />Pool Pass
                          </span>
                        ) : (
                          <span style={{ display: 'block', marginTop: 2, fontSize: '.68rem', color: themeMuted }}>
                            Room Only
                          </span>
                        )}
                      </td>
                      <td>
                        <div>
                          <span>{fmtDate(b.check_in)} → {fmtDate(b.check_out)}</span>
                          <span style={{ marginLeft: 6, fontSize: '.72rem', background: isLightMode ? '#F1F5F9' : 'rgba(255,255,255,0.08)', padding: '2px 6px', borderRadius: 6, color: themeMuted }}>
                            {b.nights || 1} {b.nights === 1 ? 'night' : 'nights'}
                          </span>
                        </div>
                      </td>
                      <td>
                        <span style={{ fontSize: '.82rem' }}>{b.guests || 2} Guests</span>
                      </td>
                      <td>
                        <b>{money(b.total_php)}</b>
                        <small style={{ display: 'block', color: themeMuted, fontSize: '.72rem' }}>{b.payment_method || 'GCash'}</small>
                      </td>
                      <td>
                        <StatusPill
                          status={b.status}
                          paymentStatus={b.payment_status}
                          onClick={() => setTimelineBooking(b)}
                        />
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                          {/* Official Receipt & Folio Generator */}
                          <button
                            className="act-btn"
                            onClick={() => setReceiptModalBooking(b)}
                            style={{ color: '#0EA5E9', borderColor: '#0EA5E9', background: 'rgba(14,165,233,0.08)' }}
                            title="Generate official guest receipt & PDF folio"
                          >
                            <i className="fas fa-file-invoice-dollar" /> Receipt
                          </button>
                          {['pending', 'confirmed'].includes(b.status) && (
                            <button className="act-btn" onClick={() => updateStatus(b.id, 'checked_in')} style={{ color: '#10B981', borderColor: '#10B981' }}>
                              <i className="fas fa-bell-concierge" /> Check-in
                            </button>
                          )}
                          {b.status === 'checked_in' && (
                            <button className="act-btn" onClick={() => updateStatus(b.id, 'checked_out')} style={{ color: '#6366F1', borderColor: '#6366F1' }}>
                              <i className="fas fa-sign-out-alt" /> Check-out
                            </button>
                          )}
                          {['pending', 'confirmed'].includes(b.status) && (
                            <button className="act-btn" onClick={() => updateStatus(b.id, 'cancelled')} style={{ color: '#EF4444', borderColor: '#EF4444' }}>
                              <i className="fas fa-times" /> Cancel
                            </button>
                          )}
                          <button
                            className="act-btn"
                            onClick={() => setReservationToRemove(b)}
                            style={{ color: '#EF4444', borderColor: 'rgba(239, 68, 68, 0.4)' }}
                            title="Remove booking folio permanently"
                          >
                            <i className="fas fa-trash-alt" /> Remove
                          </button>
                          {b.payment_status === 'refund_pending' ? (
                            <button
                              className="act-btn"
                              onClick={() => {
                                setRefundTarget(b);
                                setRefundMode('confirm');
                                setRefundAmount(b.downpayment_php || b.total_php || '');
                                setRefundMethod(b.payment_method || 'GCash');
                              }}
                              style={{ color: '#10B981', borderColor: '#10B981', background: 'rgba(16,185,129,0.1)' }}
                              title="Approve & confirm refund with automated email"
                            >
                              <i className="fas fa-check-double" /> Confirm Refund
                            </button>
                          ) : b.payment_status !== 'refunded' && (
                            <button
                              className="act-btn"
                              onClick={() => {
                                setRefundTarget(b);
                                setRefundMode('request');
                                setRefundAmount(b.downpayment_php || b.total_php || '');
                              }}
                              style={{ color: '#F59E0B', borderColor: '#F59E0B' }}
                              title="Request refund with automated email on the day requested"
                            >
                              <i className="fas fa-hand-holding-dollar" /> Refund
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* VIEW 3: VISUAL AVAILABILITY & LOCK CALENDAR */}
      {ledgerSubView === 'availability' && (
        <div>
          <AvailabilityCalendar
            rooms={activeRoomsList}
            bookings={allBookings}
            isLightMode={isLightMode}
            onClose={() => setLedgerSubView('stay_folios')}
            onViewList={() => setLedgerSubView('stay_folios')}
            onNewBooking={() => {
              if (activeRoomsList.length === 0) {
                toast("There's no present room around. Please add a room in Room Management first.", true);
                return;
              }
              const activeRoom = activeRoomsList[0];
              setNewReservation((prev: any) => ({
                ...prev,
                room_id: prev.room_id || activeRoom?.id || '',
                check_in: prev.check_in || '2026-10-20',
                check_out: prev.check_out || '2026-10-21',
                total_php: activeRoom?.rate_php || 3500,
              }));
              setShowAddReservationModal(true);
            }}
            onSelectBooking={(stay) => {
              const foundBooking = allBookings.find((b: any) => b.id === stay.id);
              if (foundBooking) {
                toast(`Selected reservation for ${stay.guestName} (${stay.unitName})`);
              }
            }}
            onSelectDates={(cin, cout, targetRoomId, unitInfo) => {
              if (activeRoomsList.length === 0) {
                toast("There's no present room around. Please add a room in Room Management first.", true);
                return;
              }
              const activeRoom = (targetRoomId ? activeRoomsList.find((r) => r.id === targetRoomId) : null) || activeRoomsList.find((r) => r.id === newReservation.room_id) || activeRoomsList[0];
              const nights = Math.max(1, Math.round((new Date(cout).getTime() - new Date(cin).getTime()) / 86400000));
              const unitTag = unitInfo && unitInfo.unitNumber ? `[Unit ${unitInfo.unitNumber}]` : '';
              const cleanNotes = (newReservation.notes || '').replace(/\[Unit\s*\d+\]\s*/g, '').trim();
              const nextNotes = unitTag ? `${unitTag} ${cleanNotes}`.trim() : cleanNotes;

              setNewReservation((prev: any) => ({
                ...prev,
                room_id: targetRoomId || prev.room_id || activeRoom?.id || '',
                check_in: cin,
                check_out: cout,
                total_php: (activeRoom?.rate_php || 3500) * nights,
                notes: nextNotes || prev.notes,
              }));
              setShowAddReservationModal(true);
              toast(`✦ ${unitInfo?.name || activeRoom?.name || 'Unit'} selected: Check-in (${fmtDate(cin)}) and Check-out (${fmtDate(cout)})`);
            }}
          />
        </div>
      )}
    </div>
  );
};
