import React, { useState, useEffect } from 'react';
import { money } from '../../lib/format';
import { api } from '../../lib/api';
import RoomImageCarousel from '../../components/RoomImageCarousel';
import {
  inferOfferingType,
  getOfferingLabel,
  getRateUnitSuffix,
  formatSpecHighlights,
  OfferingType,
} from '../../lib/offeringSpecs';
import { ResortSpinner, SkeletonTable } from '../../components/LoadingAnimations';

export interface RoomInventoryViewProps {
  roomsList: any[];
  allBookings: any[];
  loadingRoomsAndInv: boolean;
  refreshRoomsAndInventory: () => void;
  refreshReservations?: () => void;
  setShowCreateRoomModal: (show: boolean) => void;
  openCreateOfferingModal?: (type: OfferingType) => void;
  setEditingRoom: (room: any) => void;
  setRoomToRemove: (room: any) => void;
  handleToggleRoomActive: (room: any) => void;
  isLightMode: boolean;
  themeCardBg: string;
  themeBorder: string;
  themeShadow: string;
  themeText: string;
  themeMuted: string;
  toast: (msg: string, isError?: boolean) => void;
}

export const RoomInventoryView: React.FC<RoomInventoryViewProps> = ({
  roomsList,
  allBookings,
  loadingRoomsAndInv,
  refreshRoomsAndInventory,
  refreshReservations,
  setShowCreateRoomModal,
  openCreateOfferingModal,
  setEditingRoom,
  setRoomToRemove,
  handleToggleRoomActive,
  isLightMode,
  themeCardBg,
  themeBorder,
  themeShadow,
  themeText,
  themeMuted,
  toast,
}) => {
  // Local real-time overrides for instant UI response
  const [bookingStatusOverrides, setBookingStatusOverrides] = useState<Record<string, string>>({});
  const [roomMaintenanceOverrides, setRoomMaintenanceOverrides] = useState<Record<string, boolean>>({});

  const handleProceedBooking = async (booking: any, room: any) => {
    try {
      setBookingStatusOverrides((prev) => ({ ...prev, [booking.id]: 'confirmed' }));
      if (room && !room.is_active && !roomMaintenanceOverrides[room.id]) {
        await api.updateRoom(room.id, { is_active: true });
        setRoomMaintenanceOverrides((prev) => ({ ...prev, [room.id]: true }));
        handleToggleRoomActive({ ...room, is_active: false });
      }
      await api.updateReservation(booking.id, { status: 'confirmed' });
      toast(`✅ Booking for ${booking.guest_name || 'Guest'} confirmed to proceed.`);
      if (refreshReservations) refreshReservations();
      if (refreshRoomsAndInventory) refreshRoomsAndInventory();
    } catch (err: any) {
      toast(`Error proceeding booking: ${err.message}`, true);
    }
  };

  const handleHoldBooking = async (booking: any) => {
    try {
      setBookingStatusOverrides((prev) => ({ ...prev, [booking.id]: 'on_hold' }));
      await api.updateReservation(booking.id, { status: 'on_hold' });
      toast(`⏸ Booking for ${booking.guest_name || 'Guest'} placed ON HOLD for review.`);
      if (refreshReservations) refreshReservations();
    } catch (err: any) {
      toast(`Error placing booking on hold: ${err.message}`, true);
    }
  };

  const handleMarkMaintenanceWithBooking = async (room: any, booking?: any) => {
    try {
      setRoomMaintenanceOverrides((prev) => ({ ...prev, [room.id]: false }));
      await api.updateRoom(room.id, { is_active: false });
      handleToggleRoomActive({ ...room, is_active: true });

      if (booking && booking.id) {
        setBookingStatusOverrides((prev) => ({ ...prev, [booking.id]: 'on_hold' }));
        await api.updateReservation(booking.id, { status: 'on_hold' });
        toast(`⚠️ ${room.name} marked on MAINTENANCE. Booking for ${booking.guest_name || 'Guest'} placed ON HOLD.`);
      } else {
        toast(`⏸️ ${room.name} placed in MAINTENANCE.`);
      }
      if (refreshReservations) refreshReservations();
      if (refreshRoomsAndInventory) refreshRoomsAndInventory();
    } catch (err: any) {
      toast(`Error updating maintenance: ${err.message}`, true);
    }
  };

  const formatDates = (cin?: string, cout?: string) => {
    if (!cin) return 'Upcoming';
    try {
      const dIn = new Date(cin);
      const inStr = dIn.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      if (!cout) return inStr;
      const dOut = new Date(cout);
      const outStr = dOut.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      return `${inStr} → ${outStr}`;
    } catch {
      return `${String(cin).slice(0, 10)} → ${String(cout || '').slice(0, 10)}`;
    }
  };
  const [inventorySearch, setInventorySearch] = useState(() => {
    try {
      if (typeof localStorage !== 'undefined') localStorage.removeItem('jd_admin_inv_search');
      return (typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('jd_admin_inv_search') : '') || '';
    } catch {
      return '';
    }
  });
  useEffect(() => {
    try {
      if (typeof localStorage !== 'undefined') localStorage.removeItem('jd_admin_inv_search');
      if (typeof sessionStorage !== 'undefined') sessionStorage.setItem('jd_admin_inv_search', inventorySearch);
    } catch {}
  }, [inventorySearch]);

  const [offeringFilter, setOfferingFilter] = useState<'room' | 'cottage'>('room');

  return (
    <div className="panel" style={{ background: themeCardBg, border: `1px solid ${themeBorder}`, borderRadius: 16, padding: 24, boxShadow: themeShadow }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 14 }}>
        <div>
          <span className="label light">Resort Infrastructure & Assets</span>
          <h3 className="serif" style={{ fontSize: '1.6rem', margin: '4px 0 0', color: themeText }}>Room Management Hub</h3>
          <p className="muted small" style={{ margin: '4px 0 0' }}>Live control of room and cottage rates, unit inventory and availability.</p>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <input
            className="search"
            placeholder="Search rooms and cottages…"
            value={inventorySearch}
            onChange={(e) => setInventorySearch(e.target.value)}
            style={{ maxWidth: 220, background: isLightMode ? '#FFF' : undefined, color: themeText }}
          />
          {(
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <button type="button" className="btn btn-sm" style={{ background: '#006699', color: '#FFFFFF', border: 'none', borderRadius: 8, padding: '7px 12px', fontSize: '.78rem', fontWeight: 700, cursor: 'pointer' }} onClick={() => (openCreateOfferingModal ? openCreateOfferingModal('room') : setShowCreateRoomModal(true))}>
                + Room
              </button>
              <button type="button" className="btn btn-sm" style={{ background: '#047857', color: '#FFFFFF', border: 'none', borderRadius: 8, padding: '7px 12px', fontSize: '.78rem', fontWeight: 700, cursor: 'pointer' }} onClick={() => (openCreateOfferingModal ? openCreateOfferingModal('cottage') : setShowCreateRoomModal(true))}>
                + Cottage
              </button>
            </div>
          )}
        </div>
      </div>

      {/* STAT SUMMARY BAND (CLICKABLE INTERACTIVE TELEMETRY CARDS) */}
      <div className="admin-grid-4-col" style={{ gap: 12, marginBottom: 20, gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
        <div
          className="kpi-card-clickable"
          onClick={() => setOfferingFilter('room')}
          style={{
            background: isLightMode ? '#F8FAFC' : 'rgba(255,255,255,0.03)',
            border: `1px solid ${offeringFilter === 'room' ? '#0EA5E9' : themeBorder}`,
            borderRadius: 16,
            padding: 14,
            cursor: 'pointer',
            transition: 'all 0.2s ease',
          }}
          title="Click to view all rooms"
        >
          <span style={{ fontSize: '.72rem', color: themeMuted, textTransform: 'uppercase', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span>Rooms</span>
            <i className="fas fa-arrow-up-right-from-square" style={{ fontSize: '.68rem', color: '#0EA5E9' }} />
          </span>
          <div style={{ fontSize: '1.4rem', fontWeight: 800, color: themeText, marginTop: 4 }}>{roomsList.length} Categories</div>
        </div>

        <div
          className="kpi-card-clickable"
          onClick={() => {
            toast(`Total Resort Capacity: ${roomsList.reduce((acc, r) => acc + (r.units || 0), 0)} Units across Patar coastline`);
          }}
          style={{
            background: isLightMode ? '#F8FAFC' : 'rgba(255,255,255,0.03)',
            border: `1px solid ${themeBorder}`,
            borderRadius: 16,
            padding: 14,
            cursor: 'pointer',
            transition: 'all 0.2s ease',
          }}
          title="Click to inspect total unit inventory"
        >
          <span style={{ fontSize: '.72rem', color: themeMuted, textTransform: 'uppercase', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span>Total Units</span>
            <i className="fas fa-bed" style={{ fontSize: '.68rem', color: '#38BDF8' }} />
          </span>
          <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#38BDF8', marginTop: 4 }}>
            {roomsList.reduce((acc, r) => acc + (r.units || 0), 0)} Total Units
          </div>
        </div>

      </div>

      <div style={{ marginBottom: 20 }}>
        <select
          aria-label="Show rooms or cottages"
          value={offeringFilter}
          onChange={(e) => setOfferingFilter(e.target.value as 'room' | 'cottage')}
          style={{
            padding: '9px 18px',
            border: `1px solid ${themeBorder}`,
            background: isLightMode ? '#FFFFFF' : '#0F172A',
            color: themeText,
            fontSize: '.84rem',
            fontWeight: 700,
            cursor: 'pointer',
            minWidth: 220,
          }}
        >
          <option value="room">Rooms ({roomsList.filter((r) => inferOfferingType(r) === 'room').length})</option>
          <option value="cottage">Cottages ({roomsList.filter((r) => inferOfferingType(r) === 'cottage').length})</option>
        </select>
      </div>

      {loadingRoomsAndInv && roomsList.length === 0 ? (
        <div style={{ padding: '24px 0', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
          <ResortSpinner size="md" message="Synchronizing accommodations catalog…" submessage="Updating live status and amenity configurations." />
          <div style={{ width: '100%' }}>
            <SkeletonTable rows={4} />
          </div>
        </div>
      ) : (() => {
        const filteredRooms = roomsList
          .filter((r) => inferOfferingType(r) === offeringFilter)
          .filter((r) => !inventorySearch || r.name?.toLowerCase().includes(inventorySearch.toLowerCase()) || r.description?.toLowerCase().includes(inventorySearch.toLowerCase()));

        return filteredRooms.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '48px 20px', background: isLightMode ? '#F8FAFC' : 'rgba(255,255,255,0.02)', borderRadius: 16, border: `1px dashed ${themeBorder}`, margin: '12px 0' }}>
            <div style={{ fontSize: '2.8rem', marginBottom: 12, color: '#38BDF8' }}><i className="fas fa-umbrella-beach" /></div>
            <h4 style={{ margin: '0 0 6px', color: themeText, fontSize: '1.15rem', fontWeight: 800 }}>No Accommodations Added Yet</h4>
            <p style={{ margin: '0 auto 18px', maxWidth: 460, color: themeMuted, fontSize: '.86rem', lineHeight: 1.5 }}>
              Click below to provision and publish your first custom Room or Cottage with photos and rates.
            </p>
            <button className="btn btn-sm" onClick={() => (openCreateOfferingModal ? openCreateOfferingModal(offeringFilter) : setShowCreateRoomModal(true))} style={{ padding: '9px 18px', fontWeight: 700, background: '#006699', color: '#FFFFFF', border: 'none', borderRadius: 10, cursor: 'pointer' }}>
              + Add {offeringFilter === 'cottage' ? 'Cottage' : 'Room'}
            </button>
          </div>
        ) : (
          <div className="admin-grid-3-col" style={{ gap: 16 }}>
            {filteredRooms.map((room: any) => {
              const roomImages = Array.isArray(room.images) && room.images.length > 0
                ? room.images
                : (room.image_url ? [room.image_url] : []);

              const isRoomActive = roomMaintenanceOverrides[room.id] !== undefined
                ? roomMaintenanceOverrides[room.id]
                : Boolean(room.is_active);

              const matchingBookings = (Array.isArray(allBookings) ? allBookings : []).filter((b: any) => {
                if (!b) return false;
                const currStatus = bookingStatusOverrides[b.id] || b.status;
                if (currStatus === 'cancelled') return false;
                const matchId = b.room_id && room.id && String(b.room_id) === String(room.id);
                const matchName = b.room_name && room.name && String(b.room_name).toLowerCase().trim() === String(room.name).toLowerCase().trim();
                return matchId || matchName;
              });

              const primaryBooking = matchingBookings[0] || null;
              const primaryBookingStatus = primaryBooking
                ? (bookingStatusOverrides[primaryBooking.id] || primaryBooking.status || 'pending')
                : null;

              return (
                <div
                  key={room.id}
                  style={{
                    background: isLightMode ? '#FFFFFF' : 'rgba(15,23,42,0.85)',
                    border: `1px solid ${themeBorder}`,
                    borderRadius: 14,
                    overflow: 'hidden',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    boxShadow: themeShadow,
                  }}
                >
                  {/* AUTO-SCROLLING ROOM IMAGE SHOWCASE */}
                  <RoomImageCarousel
                    images={roomImages}
                    roomName={room.name}
                    category={room.category}
                    slug={room.slug}
                    height={185}
                    autoScroll={true}
                    interval={3500}
                    badge={
                      <span className="pill" style={{ background: 'rgba(14,165,233,0.85)', color: '#FFFFFF', fontWeight: 800, fontSize: '.72rem', backdropFilter: 'blur(4px)' }}>
                        {getOfferingLabel(inferOfferingType(room))}
                      </span>
                    }
                  />

                  <div style={{ padding: 18, flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                        <h4 style={{ margin: 0, fontSize: '1.15rem', color: themeText }}>{room.name}</h4>
                        <button
                          onClick={() => {
                            if (isRoomActive) {
                              handleMarkMaintenanceWithBooking(room, primaryBooking);
                            } else {
                              handleProceedBooking(primaryBooking || {}, room);
                            }
                          }}
                          style={{
                            border: 'none',
                            borderRadius: 12,
                            padding: '4px 11px',
                            fontSize: '.72rem',
                            fontWeight: 700,
                            cursor: 'pointer',
                            background: isRoomActive ? 'rgba(16,185,129,0.15)' : 'rgba(244,63,94,0.15)',
                            color: isRoomActive ? '#10B981' : '#F43F5E',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4,
                          }}
                          title="Click to toggle Active vs Maintenance"
                        >
                          {isRoomActive ? '● Active' : '⏸ Maintenance'}
                        </button>
                      </div>

                      <p style={{ margin: '0 0 12px', fontSize: '.82rem', color: themeMuted, lineHeight: 1.4, minHeight: 36 }}>
                        {room.description || 'Patar beachfront room with scenic sea vistas and resort amenities.'}
                      </p>

                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
                        {formatSpecHighlights(room).map((sp) => (
                          <span key={sp.label} style={{ fontSize: '.7rem', padding: '3px 8px', borderRadius: 8, background: isLightMode ? '#E0F2FE' : 'rgba(14,165,233,0.14)', color: isLightMode ? '#00517A' : '#E0F2FE', fontWeight: 600 }}>
                            {sp.label}: {sp.value}
                          </span>
                        ))}
                      </div>

                      {/* REFINED CAPACITY, RATE & STATUS BAR (PHYSICAL UNITS & RATING REMOVED) */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, fontSize: '.84rem', color: themeText, background: isLightMode ? '#F8FAFC' : 'rgba(255,255,255,0.03)', padding: '10px 14px', borderRadius: 12, border: `1px solid ${themeBorder}` }}>
                        <div>
                          <span style={{ color: themeMuted, fontSize: '.7rem', display: 'block', textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.03em' }}>Capacity</span>
                          <b style={{ fontSize: '.88rem' }}>{inferOfferingType(room) === 'offer' ? `Up to ${room.capacity || 10} pax` : `Sleeps ${room.capacity || 2}`}</b>
                        </div>
                        <div>
                          <span style={{ color: themeMuted, fontSize: '.7rem', display: 'block', textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.03em' }}>Rate</span>
                          <b style={{ fontSize: '.88rem', color: '#10B981' }}>₱{Number(room.rate_php || 0).toLocaleString()} <span style={{ fontSize: '.7rem', color: themeMuted, fontWeight: 500 }}>{getRateUnitSuffix(inferOfferingType(room), room.specs)}</span></b>
                        </div>
                        <div>
                          <span style={{ color: themeMuted, fontSize: '.7rem', display: 'block', textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.03em' }}>Status</span>
                          {!isRoomActive ? (
                            <span style={{ fontSize: '.74rem', fontWeight: 800, padding: '2px 8px', borderRadius: 6, background: 'rgba(244,63,94,0.12)', color: '#F43F5E', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                              ⏸ Maintenance
                            </span>
                          ) : primaryBooking ? (
                            primaryBookingStatus === 'on_hold' ? (
                              <span style={{ fontSize: '.74rem', fontWeight: 800, padding: '2px 8px', borderRadius: 6, background: 'rgba(245,158,11,0.12)', color: '#D97706', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                🟡 On Hold
                              </span>
                            ) : primaryBookingStatus === 'pending' ? (
                              <span style={{ fontSize: '.74rem', fontWeight: 800, padding: '2px 8px', borderRadius: 6, background: 'rgba(249,115,22,0.12)', color: '#EA580C', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                🟠 Pending
                              </span>
                            ) : primaryBookingStatus === 'checked_in' ? (
                              <span style={{ fontSize: '.74rem', fontWeight: 800, padding: '2px 8px', borderRadius: 6, background: 'rgba(14,165,233,0.12)', color: '#0EA5E9', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                🔴 In-House
                              </span>
                            ) : (
                              <span style={{ fontSize: '.74rem', fontWeight: 800, padding: '2px 8px', borderRadius: 6, background: 'rgba(79,70,229,0.12)', color: '#4F46E5', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                🔵 Booked
                              </span>
                            )
                          ) : (
                            <span style={{ fontSize: '.74rem', fontWeight: 800, padding: '2px 8px', borderRadius: 6, background: 'rgba(16,185,129,0.12)', color: '#10B981', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                              ● Available
                            </span>
                          )}
                        </div>
                      </div>

                      {/* OPERATIONAL GUARDRAIL: NOTIFY ADMIN/STAFF WHEN BOOKED OR CONFLICTED */}
                      {primaryBooking ? (
                        <div
                          style={{
                            marginBottom: 12,
                            padding: '12px 14px',
                            borderRadius: 12,
                            background: !isRoomActive
                              ? (isLightMode ? '#FFF1F2' : 'rgba(244, 63, 94, 0.12)')
                              : (primaryBookingStatus === 'on_hold'
                                  ? (isLightMode ? '#FFFBEB' : 'rgba(245, 158, 11, 0.12)')
                                  : (isLightMode ? '#F0FDF4' : 'rgba(16, 185, 129, 0.1)')),
                            border: `1px solid ${
                              !isRoomActive
                                ? '#F43F5E'
                                : (primaryBookingStatus === 'on_hold' ? '#F59E0B' : '#10B981')
                            }`,
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, marginBottom: 6 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <i
                                className={
                                  !isRoomActive
                                    ? "fas fa-triangle-exclamation"
                                    : (primaryBookingStatus === 'on_hold' ? "fas fa-hand" : "fas fa-shield-halved")
                                }
                                style={{
                                  color: !isRoomActive
                                    ? '#F43F5E'
                                    : (primaryBookingStatus === 'on_hold' ? '#D97706' : '#059669'),
                                  fontSize: '.9rem',
                                }}
                              />
                              <span
                                style={{
                                  fontSize: '.76rem',
                                  fontWeight: 800,
                                  textTransform: 'uppercase',
                                  letterSpacing: '0.04em',
                                  color: !isRoomActive
                                    ? '#F43F5E'
                                    : (primaryBookingStatus === 'on_hold' ? '#D97706' : '#059669'),
                                }}
                              >
                                {!isRoomActive
                                  ? '⚠️ Maintenance Conflict Guardrail'
                                  : (primaryBookingStatus === 'on_hold'
                                      ? 'Booking On Hold · Staff Review'
                                      : 'Booking Guardrail Alert')}
                              </span>
                            </div>

                            <span
                              style={{
                                fontSize: '.66rem',
                                fontWeight: 800,
                                padding: '2px 7px',
                                borderRadius: 6,
                                background: !isRoomActive ? '#F43F5E' : (primaryBookingStatus === 'on_hold' ? '#D97706' : '#059669'),
                                color: '#FFFFFF',
                                textTransform: 'uppercase',
                              }}
                            >
                              {!isRoomActive ? 'Conflict' : (primaryBookingStatus === 'on_hold' ? 'On Hold' : 'Booked')}
                            </span>
                          </div>

                          <div style={{ fontSize: '.78rem', color: themeText, lineHeight: 1.45, marginBottom: 8 }}>
                            <b>Booked</b> · {formatDates(primaryBooking.check_in, primaryBooking.check_out)}
                            <div
                              style={{
                                color: isLightMode ? '#92400E' : '#FCD34D',
                                fontSize: '.72rem',
                                marginTop: 4,
                                display: 'flex',
                                alignItems: 'flex-start',
                                gap: 5,
                              }}
                            >
                              <i className="fas fa-triangle-exclamation" style={{ marginTop: 2 }} />
                              <span>
                                {!isRoomActive
                                  ? 'Caution: this unit is offline but still has a booking. Reactivate it or move the guest.'
                                  : primaryBookingStatus === 'on_hold'
                                    ? 'Caution: this booking is on hold. Staff review is needed before the dates are used.'
                                    : 'Caution: this unit is booked. Check the booking before you hold it or mark it for maintenance.'}
                              </span>
                            </div>
                          </div>

                          {/* Interactive Decision Guardrail Buttons */}
                          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', paddingTop: 6, borderTop: `1px dashed ${!isRoomActive ? 'rgba(244,63,94,0.3)' : 'rgba(0,0,0,0.08)'}` }}>
                            <button
                              type="button"
                              onClick={() => handleProceedBooking(primaryBooking, room)}
                              style={{
                                border: 'none',
                                borderRadius: 8,
                                padding: '5px 10px',
                                fontSize: '.72rem',
                                fontWeight: 700,
                                background: '#059669',
                                color: '#FFFFFF',
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 4,
                              }}
                              title="Approve booking to proceed and clear maintenance hold"
                            >
                              <i className="fas fa-check" /> Proceed Booking
                            </button>

                            <button
                              type="button"
                              onClick={() => handleHoldBooking(primaryBooking)}
                              style={{
                                border: '1px solid rgba(217, 119, 6, 0.4)',
                                borderRadius: 8,
                                padding: '5px 10px',
                                fontSize: '.72rem',
                                fontWeight: 700,
                                background: primaryBookingStatus === 'on_hold' ? '#D97706' : (isLightMode ? '#FFFBEB' : 'rgba(217,119,6,0.15)'),
                                color: primaryBookingStatus === 'on_hold' ? '#FFFFFF' : '#D97706',
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 4,
                              }}
                              title="Put booking on hold pending staff review"
                            >
                              <i className="fas fa-pause" /> {primaryBookingStatus === 'on_hold' ? 'Booking On Hold' : 'Put on Hold'}
                            </button>

                            <button
                              type="button"
                              onClick={() => handleMarkMaintenanceWithBooking(room, primaryBooking)}
                              style={{
                                border: '1px solid rgba(244, 63, 94, 0.4)',
                                borderRadius: 8,
                                padding: '5px 10px',
                                fontSize: '.72rem',
                                fontWeight: 700,
                                background: !isRoomActive ? '#F43F5E' : (isLightMode ? '#FFF1F2' : 'rgba(244,63,94,0.15)'),
                                color: !isRoomActive ? '#FFFFFF' : '#F43F5E',
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 4,
                              }}
                              title="Mark room on maintenance and hold booking"
                            >
                              <i className="fas fa-screwdriver-wrench" /> {!isRoomActive ? 'Under Maintenance' : 'Mark Maintenance'}
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div
                          style={{
                            marginBottom: 12,
                            padding: '8px 12px',
                            borderRadius: 10,
                            background: !isRoomActive
                              ? (isLightMode ? '#FFF1F2' : 'rgba(244, 63, 94, 0.08)')
                              : (isLightMode ? '#F8FAFC' : 'rgba(255,255,255,0.02)'),
                            border: `1px solid ${!isRoomActive ? 'rgba(244,63,94,0.3)' : themeBorder}`,
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                          }}
                        >
                          <div style={{ fontSize: '.74rem', color: !isRoomActive ? '#F43F5E' : themeMuted, display: 'flex', alignItems: 'center', gap: 6 }}>
                            <i className={!isRoomActive ? "fas fa-screwdriver-wrench" : "fas fa-circle-check"} style={{ color: !isRoomActive ? '#F43F5E' : '#10B981' }} />
                            <span>{!isRoomActive ? 'Room is Offline for Maintenance' : 'No active bookings · Ready for guests'}</span>
                          </div>

                          <button
                            type="button"
                            onClick={() => {
                              if (!isRoomActive) {
                                handleProceedBooking({}, room);
                              } else {
                                handleMarkMaintenanceWithBooking(room);
                              }
                            }}
                            style={{
                              border: 'none',
                              borderRadius: 6,
                              padding: '4px 10px',
                              fontSize: '.7rem',
                              fontWeight: 700,
                              background: !isRoomActive ? '#10B981' : (isLightMode ? '#F1F5F9' : 'rgba(255,255,255,0.06)'),
                              color: !isRoomActive ? '#FFFFFF' : themeMuted,
                              cursor: 'pointer',
                            }}
                            title={!isRoomActive ? 'Reactivate room' : 'Take offline for maintenance'}
                          >
                            <i className={!isRoomActive ? "fas fa-play" : "fas fa-screwdriver-wrench"} style={{ marginRight: 4 }} />
                            {!isRoomActive ? 'Reactivate' : 'Mark Maintenance'}
                          </button>
                        </div>
                      )}

                      {Array.isArray(room.amenities) && room.amenities.length > 0 && (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 14 }}>
                          {room.amenities.slice(0, 4).map((a: string, i: number) => (
                            <span key={i} style={{ fontSize: '.68rem', padding: '2px 8px', borderRadius: 8, background: isLightMode ? '#F1F5F9' : 'rgba(255,255,255,0.05)', color: themeMuted }}>
                              {a}
                            </span>
                          ))}
                          {room.amenities.length > 4 && (
                            <span style={{ fontSize: '.68rem', padding: '2px 6px', borderRadius: 8, color: themeMuted }}>+{room.amenities.length - 4} more</span>
                          )}
                        </div>
                      )}
                    </div>

                    <div style={{ borderTop: `1px solid ${themeBorder}`, paddingTop: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <span style={{ fontSize: '.72rem', color: themeMuted, display: 'block' }}>Rate per night</span>
                        <b style={{ fontSize: '1.15rem', color: '#10B981' }}>{money(room.rate_php)}</b>
                      </div>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button
                          className="btn btn-sky btn-sm"
                          onClick={() => {
                            const currentImgs = Array.isArray(room.images) && room.images.length > 0
                              ? [...room.images]
                              : (room.image_url ? [room.image_url] : []);
                            setEditingRoom({
                              ...room,
                              image_url: room.image_url || currentImgs[0] || '',
                              images: currentImgs,
                              amenities: Array.isArray(room.amenities) ? room.amenities.join(', ') : (room.amenities || ''),
                            });
                          }}
                          style={{ display: 'flex', alignItems: 'center', gap: 6 }}
                        >
                          <i className="fas fa-pen-to-square" /> Edit
                        </button>
                        <button
                          className="btn btn-sm"
                          onClick={() => setRoomToRemove(room)}
                          style={{
                            background: 'rgba(239, 68, 68, 0.1)',
                            color: '#EF4444',
                            border: '1px solid rgba(239, 68, 68, 0.3)',
                            fontSize: '.8rem',
                            fontWeight: 700,
                            padding: '6px 14px',
                            borderRadius: 9999,
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                          }}
                          title="Remove room"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        );
      })()}
    </div>
  );
};
