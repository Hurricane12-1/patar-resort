import React, { useState } from 'react';
import AvailabilityCalendar from '../AvailabilityCalendar.tsx';
import GuestBookingBar from '../GuestBookingBar.tsx';
import { inferOfferingType, OfferingType, getManilaTodayISO } from '../../lib/offeringSpecs';
import { toast } from '../Toasts.tsx';

interface ResortHeroBookingProps {
  checkIn: string;
  checkOut: string;
  setCheckIn: (val: string) => void;
  setCheckOut: (val: string) => void;
  checkInTime: string;
  checkOutTime: string;
  setCheckInTime: (val: string) => void;
  setCheckOutTime: (val: string) => void;
  guests: string;
  setGuests: (val: string) => void;
  selectedRoom: string;
  setSelectedRoom: (val: string) => void;
  displayRooms: any[];
  bookedRanges: any[];
  isRoomOccupiedForDates: (room: any, inDate: string, outDate: string, inTime?: string, outTime?: string) => boolean;
  isRoomOccupiedToday: (room: any) => boolean;
  checkAvailability: () => void;
  checkingAvailability: boolean;
  quote: { ok: boolean; text: string } | null;
  setQuote: (q: any) => void;
  onOpenReservation: (roomName?: string) => void;
  onResetCalendarSelection: () => void;
  showHeroCalendar: boolean;
  setShowHeroCalendar: React.Dispatch<React.SetStateAction<boolean>>;
  siteBooking?: any;
}

export default function ResortHeroBooking({
  checkIn,
  checkOut,
  setCheckIn,
  setCheckOut,
  checkInTime,
  checkOutTime,
  setCheckInTime,
  setCheckOutTime,
  guests,
  setGuests,
  selectedRoom,
  setSelectedRoom,
  displayRooms,
  bookedRanges,
  isRoomOccupiedForDates,
  isRoomOccupiedToday,
  checkAvailability,
  checkingAvailability,
  quote,
  setQuote,
  onOpenReservation,
  onResetCalendarSelection,
  showHeroCalendar,
  setShowHeroCalendar,
  siteBooking = {
    title: 'Reserve Your Private Sanctuary',
    checkIn: 'Check-in',
    checkOut: 'Check-out',
    guests: 'Guests',
    room: 'Offering',
    cta: 'Check Availability',
    note: 'Standard check-in: 2:00 PM · Check-out: 12:00 PM · 2-Hour preparation buffer enforced between stays',
  },
}: ResortHeroBookingProps) {
  const LABEL = 'text-[10px] font-mono uppercase tracking-[0.22em] text-cyan font-bold';
  const today = getManilaTodayISO();

  const [adults, setAdults] = useState<number>(() => {
    const num = parseInt(String(guests || '').replace(/\D/g, ''), 10);
    return num > 0 ? num : 2;
  });
  const [childrenCount, setChildrenCount] = useState<number>(0);
  const [roomsCount, setRoomsCount] = useState<number>(1);
  const [promoCode, setPromoCode] = useState<string>('');

  return (
    <section id="booking-section" className="mx-auto w-full max-w-6xl px-5 sm:px-8 lg:px-10 relative z-20 -mt-20 scroll-mt-24 md:-mt-24">
      <div className="rounded-3xl border border-white/15 bg-[#080E1B]/95 p-5 shadow-2xl shadow-black/70 backdrop-blur-2xl sm:p-6 lg:p-7">
        <div className="mb-5 flex items-center justify-between gap-3">
          <h2 className="font-serif text-2xl md:text-3xl font-medium text-white">{siteBooking.title}</h2>
          <span className="flex shrink-0 items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-cyan">
            <span className="h-1.5 w-1.5 rounded-full bg-cyan animate-pulse" />
            2-Hour Buffer Engine Active
          </span>
        </div>

        {/* Modern Dual-Month Side-by-Side Guest Booking Bar */}
        <div style={{ margin: '8px 0 16px' }}>
          <GuestBookingBar
            checkIn={checkIn}
            checkOut={checkOut}
            onSelectDates={(cin, cout) => {
              setCheckIn(cin);
              setCheckOut(cout);
              setQuote(null);
            }}
            adults={adults}
            onAdultsChange={(a) => {
              setAdults(a);
              setGuests(`${a + childrenCount} Guests`);
              setQuote(null);
            }}
            childrenCount={childrenCount}
            onChildrenChange={(c) => {
              setChildrenCount(c);
              setGuests(`${adults + c} Guests`);
              setQuote(null);
            }}
            roomsCount={roomsCount}
            onRoomsChange={setRoomsCount}
            promoCode={promoCode}
            onPromoCodeChange={setPromoCode}
            onSearch={checkAvailability}
            searching={checkingAvailability}
            catalog={displayRooms}
            today={today}
          />
        </div>

        {/* Accommodation / Offering Selector & Times Bar */}
        <div className="flex items-center justify-between flex-wrap gap-3 pt-3 border-t border-white/10 text-xs">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={LABEL}>Unit Allocation:</span>
            <select
              value={selectedRoom}
              onChange={(e) => {
                setSelectedRoom(e.target.value);
                setQuote(null);
              }}
              className="bg-navy/90 border border-white/15 text-white rounded-xl px-3 py-1.5 text-xs outline-none cursor-pointer max-w-xs truncate"
            >
              {displayRooms.length === 0 ? (
                <option value="" className="bg-navy text-white">No rooms available</option>
              ) : (
                (['room', 'cottage', 'offer'] as OfferingType[]).map((groupType) => {
                  const groupItems = displayRooms.filter((r) => inferOfferingType(r) === groupType);
                  if (groupItems.length === 0) return null;
                  const groupLabel =
                    groupType === 'room'
                      ? 'Rooms & Accommodations'
                      : groupType === 'cottage'
                      ? 'Beachfront Cottages'
                      : 'Island Tours & Offers';
                  return (
                    <optgroup key={groupType} label={groupLabel} className="bg-navy text-white">
                      {groupItems.map((r) => {
                        const occupiedForStay =
                          checkIn && checkOut && isRoomOccupiedForDates(r, checkIn, checkOut, checkInTime, checkOutTime);
                        const occupiedToday = isRoomOccupiedToday(r);
                        const statusTag = occupiedForStay
                          ? ' · [Reserved · 2h Gap]'
                          : occupiedToday
                          ? ' · [Occupied today]'
                          : ' · [Available]';
                        return (
                          <option
                            key={r.id || r.name}
                            value={r.name}
                            className={occupiedForStay ? 'text-rose-400 font-semibold bg-navy' : 'bg-navy'}
                          >
                            {r.name} ({r.category}){statusTag}
                          </option>
                        );
                      })}
                    </optgroup>
                  );
                })
              )}
            </select>
          </div>

          <div className="flex items-center gap-4 text-white/60">
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] uppercase text-white/50">Check-In:</span>
              <select
                value={checkInTime}
                onChange={(e) => { setCheckInTime(e.target.value); setQuote(null); }}
                className="bg-transparent text-[11px] font-semibold text-cyan outline-none cursor-pointer"
              >
                {['12:00 PM', '1:00 PM', '2:00 PM', '3:00 PM', '4:00 PM', '5:00 PM'].map((t) => (
                  <option key={t} value={t} className="bg-navy text-white">{t}</option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-1.5">
              <span className="text-[10px] uppercase text-white/50">Check-Out:</span>
              <select
                value={checkOutTime}
                onChange={(e) => { setCheckOutTime(e.target.value); setQuote(null); }}
                className="bg-transparent text-[11px] font-semibold text-cyan outline-none cursor-pointer"
              >
                {['10:00 AM', '11:00 AM', '12:00 PM', '1:00 PM', '2:00 PM'].map((t) => (
                  <option key={t} value={t} className="bg-navy text-white">{t}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Availability Calendar Dropdown Drawer */}
        <div className="mt-3.5 flex items-center justify-between flex-wrap gap-2 pt-3 border-t border-white/10">
          <span className="text-xs text-white/60">
            Check real-time calendar reservations &amp; 2-hour preparation buffers:
          </span>
          <button
            type="button"
            onClick={() => setShowHeroCalendar((prev) => !prev)}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold uppercase tracking-wider text-cyan hover:text-white bg-cyan/10 hover:bg-cyan/20 border border-cyan/30 transition cursor-pointer"
          >
            <i className="fas fa-calendar-alt text-cyan" />
            <span>{showHeroCalendar ? 'Hide Availability Calendar' : 'View Calendar (Check Reserved vs Open Dates)'}</span>
          </button>
        </div>

        {showHeroCalendar && (
          <div className="mt-4 animate-fade-in">
            <AvailabilityCalendar
              rooms={displayRooms}
              bookings={bookedRanges}
              initialCheckIn={checkIn}
              initialCheckOut={checkOut}
              isLightMode={false}
              onReset={onResetCalendarSelection}
              onSelectDates={(newIn, newOut) => {
                setCheckIn(newIn);
                setCheckOut(newOut);
                setQuote(null);
                if (newIn && newOut) {
                  toast(`✦ Dates selected: ${newIn} → ${newOut}`);
                }
              }}
              onClose={() => setShowHeroCalendar(false)}
            />
          </div>
        )}

        {/* Live Availability Quote & 2-Hour Collision Feedback */}
        {quote && (
          <div
            role="status"
            className={`mt-4 flex flex-col gap-3 rounded-2xl border px-4 py-3 text-sm animate-fade-in sm:flex-row sm:items-center sm:justify-between ${
              quote.ok ? 'border-cyan/30 bg-cyan/10 text-white' : 'border-rose-500/40 bg-rose-950/60 text-rose-200'
            }`}
          >
            <span className="flex items-center gap-2">
              {quote.ok ? <span className="text-cyan text-base">✦</span> : <i className="fas fa-triangle-exclamation text-rose-400" />}
              {quote.text}
            </span>
            {quote.ok ? (
              <button
                type="button"
                onClick={() => onOpenReservation(selectedRoom)}
                className="shrink-0 text-xs font-bold uppercase tracking-[0.18em] text-cyan underline underline-offset-4 cursor-pointer hover:brightness-120"
              >
                Continue to reserve →
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setShowHeroCalendar(true)}
                className="shrink-0 text-xs font-semibold uppercase tracking-[0.16em] text-rose-300 underline underline-offset-4 cursor-pointer hover:text-white"
              >
                View open dates on calendar →
              </button>
            )}
          </div>
        )}

        <p className="mt-4 text-center text-[11px] font-light text-white/50">{siteBooking.note}</p>
      </div>
    </section>
  );
}
