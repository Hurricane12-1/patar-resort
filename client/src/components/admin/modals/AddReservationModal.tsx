import React, { useState, useEffect } from 'react';
import { money, fmtDate } from '../../../lib/format.ts';
import AvailabilityCalendar from '../../AvailabilityCalendar.tsx';
import { POOL_ADDON_OPTIONS } from '../../../lib/ledgerUtils.ts';
import { getCategoryDefaultCloudinaryImage } from '../../../lib/cloudinary.ts';
import { addDaysYMD } from '../../../lib/api.ts';

export interface NewReservationFormState {
  guest_name: string;
  phone: string;
  guest_email?: string;
  room_id: string;
  check_in: string;
  check_out: string;
  guests: number;
  total_php: number;
  payment_method: string;
  payment_status: string;
  notes?: string;
}

interface AddReservationModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeRoomsList: any[];
  roomsList?: any[];
  reservationsList: any[];
  isLightMode: boolean;
  themeBorder: string;
  themeText?: string;
  themeMuted?: string;
  newReservation: NewReservationFormState;
  setNewReservation: React.Dispatch<React.SetStateAction<any>>;
  walkInPoolAddon: string;
  setWalkInPoolAddon: (val: string) => void;
  creatingReservation: boolean;
  onSubmit: (e: React.FormEvent) => Promise<void>;
  getRoomImageUrl?: (room: any) => string;
}

const defaultGetRoomImageUrl = (room: any): string =>
  room?.image_url ||
  (Array.isArray(room?.images) && room.images[0]) ||
  getCategoryDefaultCloudinaryImage(room?.category, room?.slug || room?.name);

export default function AddReservationModal({
  isOpen,
  onClose,
  activeRoomsList,
  reservationsList,
  isLightMode,
  themeBorder,
  themeText: propThemeText,
  themeMuted: propThemeMuted,
  newReservation,
  setNewReservation,
  walkInPoolAddon,
  setWalkInPoolAddon,
  creatingReservation,
  onSubmit,
  getRoomImageUrl = defaultGetRoomImageUrl,
}: AddReservationModalProps) {
  const [showWalkInCalendar, setShowWalkInCalendar] = useState(false);

  const activeWalkInRoom = activeRoomsList.find((r) => r.id === newReservation.room_id) || activeRoomsList[0];

  useEffect(() => {
    if (!isOpen) return;
    const targetRoomId = newReservation.room_id || activeWalkInRoom?.id || '';
    const cin = newReservation.check_in || '2026-10-20';
    let cout = newReservation.check_out || addDaysYMD(cin, 1);
    if (cout <= cin) {
      cout = addDaysYMD(cin, 1);
    }
    if (targetRoomId !== newReservation.room_id || cout !== newReservation.check_out) {
      const nights = Math.max(1, Math.round((new Date(cout).getTime() - new Date(cin).getTime()) / 86400000));
      const rate = activeWalkInRoom?.rate_php || 3500;
      setNewReservation((prev: any) => ({
        ...prev,
        room_id: targetRoomId,
        check_in: cin,
        check_out: cout,
        total_php: prev.total_php || rate * nights,
      }));
    }
  }, [isOpen, activeWalkInRoom?.id, newReservation.room_id, newReservation.check_in, newReservation.check_out, setNewReservation, activeWalkInRoom?.rate_php]);

  if (!isOpen) return null;

  const themeText = propThemeText || (isLightMode ? '#0F172A' : '#F8FAFC');
  const themeMuted = propThemeMuted || (isLightMode ? '#64748B' : '#94A3B8');

  const activeRoomImage = getRoomImageUrl(activeWalkInRoom);
  const computedNights = Math.max(
    1,
    Math.round((new Date(newReservation.check_out).getTime() - new Date(newReservation.check_in).getTime()) / 86400000)
  );

  // Check overbooking / room locked
  const overlappingStaysCount = reservationsList.filter(
    (b: any) =>
      b.room_id === (newReservation.room_id || activeWalkInRoom?.id) &&
      ['pending', 'confirmed', 'checked_in'].includes(b.status) &&
      b.check_in < newReservation.check_out &&
      b.check_out > newReservation.check_in
  ).length;

  const totalRoomUnits = Math.max(1, Number(activeWalkInRoom?.units) || 1);
  const isModalRoomLocked = overlappingStaysCount >= totalRoomUnits;

  // Check specific unit taken if user selected [Unit X]
  const noteUnitMatch = (newReservation.notes || '').match(/\[Unit\s*(\d+)\]/i);
  const selectedUnitNum = noteUnitMatch ? parseInt(noteUnitMatch[1], 10) : null;
  const isSelectedUnitTaken = Boolean(
    selectedUnitNum &&
      reservationsList.some(
        (b: any) =>
          b.room_id === (newReservation.room_id || activeWalkInRoom?.id) &&
          ['pending', 'confirmed', 'checked_in'].includes(b.status) &&
          b.check_in < newReservation.check_out &&
          b.check_out > newReservation.check_in &&
          (b.notes || '').includes(`[Unit ${selectedUnitNum}]`)
      )
  );

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(10, 15, 29, 0.72)',
        backdropFilter: 'blur(8px)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px 12px',
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 620,
          background: isLightMode ? '#FFFFFF' : '#0F172A',
          borderRadius: 22,
          border: `1px solid ${themeBorder}`,
          boxShadow: '0 25px 60px -12px rgba(0,0,0,0.6)',
          maxHeight: '92vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* DYNAMIC ROOM IMAGE HERO AT TOP */}
        <div
          style={{
            position: 'relative',
            width: '100%',
            height: 175,
            background: '#0B1120',
            overflow: 'hidden',
            flexShrink: 0,
          }}
        >
          <img
            key={activeWalkInRoom?.id || 'room-hero'}
            src={activeRoomImage}
            alt={activeWalkInRoom?.name || 'Selected Room'}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              filter: 'brightness(0.82)',
              transition: 'opacity 0.35s ease, transform 0.4s ease',
            }}
          />
          {/* Gradient Protection Layer */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: 'linear-gradient(180deg, rgba(15,23,42,0.45) 0%, rgba(15,23,42,0.88) 100%)',
              pointerEvents: 'none',
            }}
          />

          {/* Top Bar inside Banner: Folio pill & Close button */}
          <div
            style={{
              position: 'absolute',
              top: 14,
              left: 16,
              right: 16,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              zIndex: 3,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span
                style={{
                  padding: '4px 10px',
                  borderRadius: 20,
                  background: 'rgba(14, 165, 233, 0.95)',
                  color: '#FFFFFF',
                  fontSize: '.68rem',
                  fontWeight: 800,
                  letterSpacing: '.06em',
                  textTransform: 'uppercase',
                  backdropFilter: 'blur(6px)',
                  boxShadow: '0 2px 8px rgba(14, 165, 233, 0.4)',
                }}
              >
                ✦ FRONT DESK FOLIO
              </span>
              <span
                style={{
                  padding: '4px 10px',
                  borderRadius: 20,
                  background: 'rgba(15, 23, 42, 0.75)',
                  color: '#F8FAFC',
                  fontSize: '.68rem',
                  fontWeight: 700,
                  backdropFilter: 'blur(6px)',
                  border: '1px solid rgba(255,255,255,0.22)',
                }}
              >
                {activeWalkInRoom?.category || 'Accommodation'}
              </span>
            </div>

            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              style={{
                width: 32,
                height: 32,
                borderRadius: '50%',
                background: 'rgba(15, 23, 42, 0.75)',
                border: '1px solid rgba(255, 255, 255, 0.3)',
                color: '#FFFFFF',
                fontSize: '1rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.2s ease',
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLButtonElement).style.background = 'rgba(239, 68, 68, 0.9)';
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.background = 'rgba(15, 23, 42, 0.75)';
              }}
            >
              <i className="fas fa-xmark" />
            </button>
          </div>

          {/* Bottom Room Info inside Dynamic Banner */}
          <div
            style={{
              position: 'absolute',
              bottom: 12,
              left: 18,
              right: 18,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-end',
              zIndex: 3,
            }}
          >
            <div>
              <div
                style={{
                  fontSize: '.7rem',
                  color: '#94A3B8',
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  letterSpacing: '.05em',
                }}
              >
                Selected Accommodation
              </div>
              <h3
                style={{
                  margin: '2px 0 0',
                  fontSize: '1.3rem',
                  fontWeight: 800,
                  color: '#FFFFFF',
                  fontFamily: "'Plus Jakarta Sans', sans-serif",
                  textShadow: '0 2px 6px rgba(0,0,0,0.6)',
                }}
              >
                {activeWalkInRoom?.name || 'Walk-In Reservation'}
              </h3>
              <div
                style={{
                  fontSize: '.74rem',
                  color: '#CBD5E1',
                  marginTop: 2,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <span>
                  <i className="fas fa-users" style={{ marginRight: 4 }} />
                  Up to {activeWalkInRoom?.capacity || 4} Guests
                </span>
                <span>•</span>
                <span>
                  <i className="fas fa-tag" style={{ marginRight: 4 }} />
                  {activeWalkInRoom?.units || 1} Total Unit
                  {Number(activeWalkInRoom?.units || 1) > 1 ? 's' : ''}
                </span>
              </div>
            </div>

            <div style={{ textAlign: 'right' }}>
              <div
                style={{
                  padding: '5px 12px',
                  borderRadius: 12,
                  background: 'rgba(16, 185, 129, 0.9)',
                  color: '#FFFFFF',
                  fontWeight: 800,
                  fontSize: '.88rem',
                  backdropFilter: 'blur(6px)',
                  boxShadow: '0 4px 12px rgba(16, 185, 129, 0.35)',
                  border: '1px solid rgba(255,255,255,0.25)',
                  display: 'inline-block',
                }}
              >
                {money(activeWalkInRoom?.rate_php || 3500)}{' '}
                <span style={{ fontSize: '.68rem', fontWeight: 600 }}>/ night</span>
              </div>
            </div>
          </div>
        </div>

        {/* MODAL BODY (SCROLLBAR HIDDEN, SMOOTH VERTICAL SCROLL) */}
        <div
          className="scrollbar-none no-scrollbar"
          style={{
            padding: '20px 24px',
            overflowY: 'auto',
            scrollbarWidth: 'none',
            msOverflowStyle: 'none',
            flex: 1,
          }}
        >
          <form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {/* WARNING: IF NO ROOMS PRESENT IN SYSTEM */}
            {activeRoomsList.length === 0 && (
              <div
                style={{
                  padding: '14px 18px',
                  borderRadius: 14,
                  background: 'rgba(239, 68, 68, 0.12)',
                  border: '1.5px solid rgba(239, 68, 68, 0.4)',
                  color: '#FECDD3',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                }}
              >
                <i
                  className="fas fa-triangle-exclamation"
                  style={{ color: '#F43F5E', fontSize: '1.3rem', flexShrink: 0 }}
                />
                <div>
                  <strong style={{ color: '#F43F5E', fontSize: '.88rem', display: 'block', marginBottom: 2 }}>
                    There's No Present Room Around
                  </strong>
                  <span style={{ fontSize: '.78rem', color: '#CBD5E1', lineHeight: 1.45 }}>
                    No accommodations are currently active or present in the resort system. Please create and
                    activate a room under <strong>Room Management</strong> before booking a walk-in or guest
                    stay.
                  </span>
                </div>
              </div>
            )}

            <div>
              <label
                style={{
                  fontSize: '.78rem',
                  color: themeMuted,
                  fontWeight: 700,
                  display: 'block',
                  marginBottom: 4,
                }}
              >
                Guest Full Name (defaults to Walk-In Guest if blank)
              </label>
              <input
                placeholder="e.g. Maria Santos (or leave blank for Walk-In Guest)"
                value={newReservation.guest_name}
                onChange={(e) => setNewReservation({ ...newReservation, guest_name: e.target.value })}
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  borderRadius: 10,
                  border: `1px solid ${themeBorder}`,
                  background: isLightMode ? '#FFF' : '#1E293B',
                  color: themeText,
                }}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
              <div>
                <label
                  style={{
                    fontSize: '.78rem',
                    color: themeMuted,
                    fontWeight: 700,
                    display: 'block',
                    marginBottom: 4,
                  }}
                >
                  Phone (for SMS confirmation)
                </label>
                <input
                  placeholder="09171234567"
                  value={newReservation.phone}
                  onChange={(e) => setNewReservation({ ...newReservation, phone: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: 10,
                    border: `1px solid ${themeBorder}`,
                    background: isLightMode ? '#FFF' : '#1E293B',
                    color: themeText,
                  }}
                />
              </div>
              <div>
                <label
                  style={{
                    fontSize: '.78rem',
                    color: themeMuted,
                    fontWeight: 700,
                    display: 'block',
                    marginBottom: 4,
                  }}
                >
                  Email (Optional)
                </label>
                <input
                  type="email"
                  placeholder="guest@gmail.com"
                  value={newReservation.guest_email || ''}
                  onChange={(e) => setNewReservation({ ...newReservation, guest_email: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: 10,
                    border: `1px solid ${themeBorder}`,
                    background: isLightMode ? '#FFF' : '#1E293B',
                    color: themeText,
                  }}
                />
              </div>
            </div>

            {/* ROOM SELECTOR (CHANGES TOP IMAGE IN REAL TIME) */}
            <div>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: 4,
                }}
              >
                <label style={{ fontSize: '.78rem', color: themeMuted, fontWeight: 700, margin: 0 }}>Room *</label>
                <span style={{ fontSize: '.7rem', color: '#0EA5E9', fontWeight: 600 }}>
                  <i className="fas fa-image" style={{ marginRight: 4 }} />
                  Changing selection updates photo at top
                </span>
              </div>
              <select
                disabled={activeRoomsList.length === 0}
                value={newReservation.room_id || activeWalkInRoom?.id || ''}
                onChange={(e) => {
                  const rId = e.target.value;
                  const room = activeRoomsList.find((r) => r.id === rId);
                  const rate = room?.rate_php || 3500;
                  const nights = Math.max(
                    1,
                    Math.round(
                      (new Date(newReservation.check_out).getTime() - new Date(newReservation.check_in).getTime()) /
                        86400000
                    )
                  );
                  setNewReservation({
                    ...newReservation,
                    room_id: rId,
                    total_php: rate * nights,
                  });
                }}
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  borderRadius: 10,
                  border: `1px solid ${themeBorder}`,
                  background: isLightMode ? '#FFF' : '#1E293B',
                  color: themeText,
                  fontWeight: 600,
                }}
              >
                <option value="">
                  {activeRoomsList.length === 0
                    ? "-- There's no present room around (add in Room Management) --"
                    : '-- Select Room / Cottage / Villa --'}
                </option>
                {activeRoomsList.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name} ({r.category || 'Standard'}) — {money(r.rate_php)}/night
                  </option>
                ))}
              </select>
            </div>

            {/* SPECIFIC PHYSICAL UNIT SELECTOR FOR MULTI-UNIT ACCOMMODATIONS */}
            {Number(activeWalkInRoom?.units) > 1 && (
              <div style={{ marginTop: 2 }}>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: 4,
                  }}
                >
                  <label style={{ fontSize: '.78rem', color: themeMuted, fontWeight: 700, margin: 0 }}>
                    <i className="fas fa-layer-group" style={{ marginRight: 6 }} />
                    Physical Unit Selection ({activeWalkInRoom.units} units total)
                  </label>
                  <span style={{ fontSize: '.7rem', color: '#0EA5E9', fontWeight: 600 }}>
                    Real-time unit assignment
                  </span>
                </div>
                <select
                  value={(() => {
                    const m = (newReservation.notes || '').match(/\[Unit\s*(\d+)\]/i);
                    return m ? m[1] : 'auto';
                  })()}
                  onChange={(e) => {
                    const val = e.target.value;
                    const clean = (newReservation.notes || '').replace(/\[Unit\s*\d+\]\s*/g, '').trim();
                    const nextNotes = val === 'auto' ? clean : `[Unit ${val}] ${clean}`.trim();
                    setNewReservation({
                      ...newReservation,
                      notes: nextNotes,
                    });
                  }}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: 10,
                    border: `1px solid ${themeBorder}`,
                    background: isLightMode ? '#FFF' : '#1E293B',
                    color: themeText,
                    fontWeight: 600,
                  }}
                >
                  <option value="auto">⚡ Auto-assign first available unit</option>
                  {Array.from({ length: Number(activeWalkInRoom.units) }, (_, i) => i + 1).map((uNum) => {
                    const isUnitTaken = reservationsList.some(
                      (b: any) =>
                        b.room_id === (newReservation.room_id || activeWalkInRoom?.id) &&
                        ['pending', 'confirmed', 'checked_in'].includes(b.status) &&
                        b.check_in < newReservation.check_out &&
                        b.check_out > newReservation.check_in &&
                        (b.notes || '').includes(`[Unit ${uNum}]`)
                    );
                    return (
                      <option key={uNum} value={String(uNum)} disabled={isUnitTaken}>
                        Unit {uNum} {isUnitTaken ? '— (Occupied for these dates)' : '— Available'}
                      </option>
                    );
                  })}
                </select>
              </div>
            )}

            {/* STAY DATES & INTERACTIVE VISUAL CALENDAR */}
            <div
              style={{
                borderRadius: 12,
                border: `1px solid ${isModalRoomLocked || isSelectedUnitTaken ? '#F43F5E' : themeBorder}`,
                padding: 12,
                background: isLightMode ? '#F8FAFC' : 'rgba(255,255,255,0.02)',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: 8,
                  marginBottom: 10,
                }}
              >
                <div>
                  <div
                    style={{
                      fontSize: '.78rem',
                      fontWeight: 700,
                      color: themeText,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                    }}
                  >
                    <span>
                      <i className="fas fa-calendar-alt" style={{ marginRight: 6 }} />
                      Stay Dates & Calendar
                    </span>
                    <span
                      style={{
                        fontSize: '.68rem',
                        padding: '2px 8px',
                        borderRadius: 6,
                        background: isModalRoomLocked || isSelectedUnitTaken ? '#FFF1F2' : '#ECFDF5',
                        color: isModalRoomLocked || isSelectedUnitTaken ? '#E11D48' : '#059669',
                        fontWeight: 700,
                        border: `1px solid ${
                          isModalRoomLocked || isSelectedUnitTaken
                            ? 'rgba(244,63,94,0.3)'
                            : 'rgba(16,185,129,0.3)'
                        }`,
                      }}
                    >
                      {isModalRoomLocked ? (
                        <>
                          <i className="fas fa-circle" style={{ color: '#EF4444', marginRight: 4 }} />
                          All Units Booked
                        </>
                      ) : isSelectedUnitTaken ? (
                        <>
                          <i className="fas fa-circle" style={{ color: '#F59E0B', marginRight: 4 }} />
                          Unit Occupied
                        </>
                      ) : (
                        <>
                          <i className="fas fa-circle" style={{ color: '#10B981', marginRight: 4 }} />
                          Dates Available
                        </>
                      )}
                    </span>
                  </div>
                  <span style={{ fontSize: '.72rem', color: themeMuted }}>
                    {computedNights} night{computedNights > 1 ? 's' : ''}: {fmtDate(newReservation.check_in)} →{' '}
                    {fmtDate(newReservation.check_out)}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => setShowWalkInCalendar((prev) => !prev)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '5px 12px',
                    borderRadius: 8,
                    border: `1px solid ${showWalkInCalendar ? '#0EA5E9' : themeBorder}`,
                    background: showWalkInCalendar
                      ? isLightMode
                        ? '#E0F2FE'
                        : 'rgba(14,165,233,0.18)'
                      : isLightMode
                      ? '#FFFFFF'
                      : '#1E293B',
                    color: showWalkInCalendar ? '#0EA5E9' : themeText,
                    fontSize: '.75rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                  }}
                >
                  <i className="fas fa-calendar-days" />
                  <span>{showWalkInCalendar ? 'Hide Visual Calendar' : 'Show Availability Calendar'}</span>
                </button>
              </div>

              {/* EXPANDABLE VISUAL AVAILABILITY CALENDAR */}
              {showWalkInCalendar && (
                <div
                  style={{
                    marginBottom: 12,
                    borderRadius: 12,
                    overflow: 'hidden',
                    border: `1px solid ${isLightMode ? '#BAE6FD' : 'rgba(14,165,233,0.35)'}`,
                  }}
                >
                  <AvailabilityCalendar
                    selectedRoomId={newReservation.room_id || activeWalkInRoom?.id || 'all'}
                    rooms={activeRoomsList}
                    initialCheckIn={newReservation.check_in}
                    initialCheckOut={newReservation.check_out}
                    isLightMode={isLightMode}
                    numDays={14}
                    onSelectDates={(cin, cout, targetRoomId, unitInfo) => {
                      const room =
                        (targetRoomId ? activeRoomsList.find((r) => r.id === targetRoomId) : null) ||
                        activeRoomsList.find((r) => r.id === newReservation.room_id) ||
                        activeWalkInRoom;
                      const rate = room?.rate_php || 3500;
                      const nights = Math.max(
                        1,
                        Math.round((new Date(cout).getTime() - new Date(cin).getTime()) / 86400000)
                      );
                      const unitTag = unitInfo && unitInfo.unitNumber ? `[Unit ${unitInfo.unitNumber}]` : '';
                      const cleanNotes = (newReservation.notes || '').replace(/\[Unit\s*\d+\]\s*/g, '').trim();
                      const nextNotes = unitTag ? `${unitTag} ${cleanNotes}`.trim() : cleanNotes;

                      setNewReservation((prev: any) => ({
                        ...prev,
                        room_id: room?.id || prev.room_id,
                        check_in: cin,
                        check_out: cout,
                        total_php: rate * nights,
                        notes: nextNotes || prev.notes,
                      }));
                    }}
                    onRoomChange={(roomId) => {
                      const room = activeRoomsList.find((r) => r.id === roomId);
                      const rate = room?.rate_php || 3500;
                      const nights = Math.max(
                        1,
                        Math.round(
                          (new Date(newReservation.check_out).getTime() -
                            new Date(newReservation.check_in).getTime()) /
                            86400000
                        )
                      );
                      setNewReservation((prev: any) => ({
                        ...prev,
                        room_id: roomId,
                        total_php: rate * nights,
                      }));
                    }}
                    onClose={() => setShowWalkInCalendar(false)}
                  />
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label
                    style={{
                      fontSize: '.74rem',
                      color: themeMuted,
                      fontWeight: 700,
                      display: 'block',
                      marginBottom: 4,
                    }}
                  >
                    Check-In Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={newReservation.check_in}
                    onChange={(e) => {
                      const cin = e.target.value;
                      let cout = newReservation.check_out;
                      if (cin >= cout) {
                        cout = addDaysYMD(cin, 1);
                      }
                      const nights = Math.max(
                        1,
                        Math.round((new Date(cout).getTime() - new Date(cin).getTime()) / 86400000)
                      );
                      const room = activeRoomsList.find((r) => r.id === newReservation.room_id) || activeWalkInRoom;
                      const rate = room?.rate_php || 3500;
                      setNewReservation({
                        ...newReservation,
                        check_in: cin,
                        check_out: cout,
                        total_php: rate * nights,
                      });
                    }}
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      borderRadius: 10,
                      border: `1px solid ${themeBorder}`,
                      background: isLightMode ? '#FFF' : '#1E293B',
                      color: themeText,
                    }}
                  />
                </div>
                <div>
                  <label
                    style={{
                      fontSize: '.74rem',
                      color: themeMuted,
                      fontWeight: 700,
                      display: 'block',
                      marginBottom: 4,
                    }}
                  >
                    Check-Out Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={newReservation.check_out}
                    onChange={(e) => {
                      const cout = e.target.value;
                      const nights = Math.max(
                        1,
                        Math.round(
                          (new Date(cout).getTime() - new Date(newReservation.check_in).getTime()) / 86400000
                        )
                      );
                      const room = activeRoomsList.find((r) => r.id === newReservation.room_id) || activeWalkInRoom;
                      const rate = room?.rate_php || 3500;
                      setNewReservation({
                        ...newReservation,
                        check_out: cout,
                        total_php: rate * nights,
                      });
                    }}
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      borderRadius: 10,
                      border: `1px solid ${themeBorder}`,
                      background: isLightMode ? '#FFF' : '#1E293B',
                      color: themeText,
                    }}
                  />
                </div>
              </div>
            </div>

            {/* SWIMMING POOL ADD-ON DROPDOWN (FRONT DESK WALK-IN) */}
            <div style={{ marginTop: 6, marginBottom: 8 }}>
              <label
                style={{
                  fontSize: '.78rem',
                  color: themeMuted,
                  fontWeight: 700,
                  display: 'flex',
                  justifyContent: 'space-between',
                  marginBottom: 4,
                }}
              >
                <span>
                  <i className="fas fa-person-swimming" style={{ marginRight: 6 }} />
                  Swimming Pool Add-on Options
                </span>
                {walkInPoolAddon !== 'none' && (
                  <span style={{ color: '#10B981', fontWeight: 800 }}>
                    +₱
                    {(
                      (POOL_ADDON_OPTIONS.find((o) => o.id === walkInPoolAddon)?.pricePerGuest || 0) *
                      (Number(newReservation.guests) || 1)
                    ).toLocaleString()}{' '}
                    adjustment
                  </span>
                )}
              </label>
              <select
                value={walkInPoolAddon}
                onChange={(e) => {
                  const pId = e.target.value;
                  setWalkInPoolAddon(pId);
                  const opt = POOL_ADDON_OPTIONS.find((o) => o.id === pId);
                  const poolCost = (opt?.pricePerGuest || 0) * (Number(newReservation.guests) || 1);
                  const baseRoom = (activeWalkInRoom?.rate_php || 3500) * computedNights;
                  const cleanNotes = (newReservation.notes || '').replace(/\[Pool Add-on:[^\]]+\]\s*/g, '').trim();
                  setNewReservation({
                    ...newReservation,
                    total_php: baseRoom + poolCost,
                    notes:
                      opt && opt.pricePerGuest > 0
                        ? `[Pool Add-on: ${opt.shortName} (+₱${poolCost.toLocaleString()})] ${cleanNotes}`.trim()
                        : cleanNotes,
                  });
                }}
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  borderRadius: 10,
                  border: `1.5px solid ${walkInPoolAddon !== 'none' ? '#0EA5E9' : themeBorder}`,
                  background: isLightMode ? '#FFF' : '#1E293B',
                  color: themeText,
                }}
              >
                {POOL_ADDON_OPTIONS.map((opt) => (
                  <option key={opt.id} value={opt.id}>
                    {opt.label}
                  </option>
                ))}
              </select>
              <small style={{ color: themeMuted, fontSize: '.72rem', display: 'block', marginTop: 3 }}>
                Base Room: ₱{((activeWalkInRoom?.rate_php || 3500) * computedNights).toLocaleString()} (
                {computedNights} night{computedNights > 1 ? 's' : ''})
                {walkInPoolAddon !== 'none' && (
                  <span style={{ color: '#0EA5E9', fontWeight: 700 }}> • Pool Add-on adjustment active</span>
                )}
              </small>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 12 }}>
              <div>
                <label
                  style={{
                    fontSize: '.78rem',
                    color: themeMuted,
                    fontWeight: 700,
                    display: 'block',
                    marginBottom: 4,
                  }}
                >
                  Guests *
                </label>
                <input
                  type="number"
                  min="1"
                  max={activeWalkInRoom?.capacity || 20}
                  required
                  value={newReservation.guests}
                  onChange={(e) => {
                    const gCount = Number(e.target.value) || 1;
                    const opt = POOL_ADDON_OPTIONS.find((o) => o.id === walkInPoolAddon);
                    const poolCost = (opt?.pricePerGuest || 0) * gCount;
                    const baseRoom = (activeWalkInRoom?.rate_php || 3500) * computedNights;
                    const cleanNotes = (newReservation.notes || '').replace(/\[Pool Add-on:[^\]]+\]\s*/g, '').trim();
                    setNewReservation({
                      ...newReservation,
                      guests: gCount,
                      total_php: baseRoom + poolCost,
                      notes:
                        opt && opt.pricePerGuest > 0
                          ? `[Pool Add-on: ${opt.shortName} (+₱${poolCost.toLocaleString()})] ${cleanNotes}`.trim()
                          : cleanNotes,
                    });
                  }}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: 10,
                    border: `1px solid ${themeBorder}`,
                    background: isLightMode ? '#FFF' : '#1E293B',
                    color: themeText,
                  }}
                />
              </div>
              <div>
                <label
                  style={{
                    fontSize: '.78rem',
                    color: themeMuted,
                    fontWeight: 700,
                    display: 'block',
                    marginBottom: 4,
                  }}
                >
                  Total Amount (₱) *
                </label>
                <input
                  type="number"
                  min="0"
                  required
                  value={newReservation.total_php}
                  onChange={(e) => setNewReservation({ ...newReservation, total_php: Number(e.target.value) })}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: 10,
                    border: `1px solid ${themeBorder}`,
                    background: isLightMode ? '#FFF' : '#1E293B',
                    color: themeText,
                  }}
                />
              </div>
              <div>
                <label
                  style={{
                    fontSize: '.78rem',
                    color: themeMuted,
                    fontWeight: 700,
                    display: 'block',
                    marginBottom: 4,
                  }}
                >
                  Payment Method
                </label>
                <select
                  value={newReservation.payment_method}
                  onChange={(e) => setNewReservation({ ...newReservation, payment_method: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: 10,
                    border: `1px solid ${themeBorder}`,
                    background: isLightMode ? '#FFF' : '#1E293B',
                    color: themeText,
                  }}
                >
                  <option value="GCash">GCash</option>
                  <option value="Cash">Cash (Front Desk)</option>
                  <option value="Maya">Maya</option>
                  <option value="Bank Transfer">Bank Transfer</option>
                </select>
              </div>
            </div>

            <div>
              <label
                style={{
                  fontSize: '.78rem',
                  color: themeMuted,
                  fontWeight: 700,
                  display: 'block',
                  marginBottom: 4,
                }}
              >
                Notes
              </label>
              <input
                placeholder="e.g. Early check-in requested, walk-in guest"
                value={newReservation.notes || ''}
                onChange={(e) => setNewReservation({ ...newReservation, notes: e.target.value })}
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  borderRadius: 10,
                  border: `1px solid ${themeBorder}`,
                  background: isLightMode ? '#FFF' : '#1E293B',
                  color: themeText,
                }}
              />
            </div>

            {isModalRoomLocked && (
              <div
                style={{
                  padding: '12px 16px',
                  borderRadius: 12,
                  background: isLightMode ? '#FFF1F2' : 'rgba(244, 63, 94, 0.14)',
                  border: '1px solid rgba(244, 63, 94, 0.4)',
                  color: '#E11D48',
                  fontSize: '.82rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                }}
              >
                <i className="fas fa-lock" style={{ fontSize: '1.2rem' }} />
                <div>
                  <strong>Overbooking Guard:</strong> All units of this accommodation are fully booked for these dates.
                  Overlapping bookings are blocked. Please select another room or adjust the stay dates in the calendar
                  above.
                </div>
              </div>
            )}

            {!isModalRoomLocked && isSelectedUnitTaken && (
              <div
                style={{
                  padding: '12px 16px',
                  borderRadius: 12,
                  background: isLightMode ? '#FFFBEB' : 'rgba(245, 158, 11, 0.14)',
                  border: '1px solid rgba(245, 158, 11, 0.4)',
                  color: '#D97706',
                  fontSize: '.82rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                }}
              >
                <i className="fas fa-triangle-exclamation" style={{ fontSize: '1.2rem' }} />
                <div>
                  <strong>Unit Occupied:</strong> The selected physical unit is already booked for these dates. Please
                  select an available unit from the Physical Unit Selection dropdown or switch to Auto-assign.
                </div>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 10 }}>
              <button
                type="button"
                onClick={onClose}
                className="btn btn-ghost btn-sm"
                style={{ color: themeText, border: `1px solid ${themeBorder}` }}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={
                  creatingReservation || isModalRoomLocked || isSelectedUnitTaken || activeRoomsList.length === 0
                }
                className="btn btn-sky btn-sm"
                style={{
                  fontWeight: 700,
                  background:
                    isModalRoomLocked || isSelectedUnitTaken || activeRoomsList.length === 0 ? '#94A3B8' : undefined,
                  cursor:
                    isModalRoomLocked || isSelectedUnitTaken || activeRoomsList.length === 0
                      ? 'not-allowed'
                      : 'pointer',
                  borderColor:
                    isModalRoomLocked || isSelectedUnitTaken || activeRoomsList.length === 0 ? '#94A3B8' : undefined,
                }}
              >
                {creatingReservation ? (
                  'Saving to Ledger…'
                ) : activeRoomsList.length === 0 ? (
                  <>
                    <i className="fas fa-triangle-exclamation" style={{ marginRight: 6 }} />
                    No Rooms Around
                  </>
                ) : isModalRoomLocked ? (
                  <>
                    <i className="fas fa-lock" style={{ marginRight: 6 }} />
                    All Units Booked
                  </>
                ) : isSelectedUnitTaken ? (
                  <>
                    <i className="fas fa-ban" style={{ marginRight: 6 }} />
                    Unit Occupied
                  </>
                ) : (
                  'Save & Log to Ledger ✦'
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
