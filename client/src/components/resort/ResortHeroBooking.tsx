import React from 'react';
import AvailabilityCalendar from '../AvailabilityCalendar.tsx';
import { inferOfferingType, OfferingType } from '../../lib/offeringSpecs';
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

        {/* Search & Selection Grid */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-[1.1fr_1.1fr_0.9fr_1.4fr_auto]">
          {/* Check-in Date & Time Picker */}
          <div
            className={`flex flex-col text-left gap-1 rounded-2xl border px-3.5 py-2.5 transition ${
              showHeroCalendar ? 'border-cyan bg-cyan/10' : 'border-white/10 bg-white/[0.04] hover:border-cyan/50'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className={LABEL}>{siteBooking.checkIn}</span>
              <button
                type="button"
                onClick={() => setShowHeroCalendar((s) => !s)}
                className="text-[10px] text-cyan font-semibold hover:underline"
              >
                Calendar
              </button>
            </div>
            <button
              type="button"
              onClick={() => setShowHeroCalendar((s) => !s)}
              className="text-sm font-semibold text-white flex items-center justify-between cursor-pointer"
              title="Tap to select check-in date"
            >
              <span>{checkIn}</span>
              <i className="fas fa-calendar-alt text-xs text-cyan" />
            </button>
            <div className="mt-1 flex items-center gap-1.5 pt-1 border-t border-white/10">
              <span className="text-[9px] uppercase tracking-wider text-white/50">Time:</span>
              <select
                value={checkInTime}
                onChange={(e) => {
                  setCheckInTime(e.target.value);
                  setQuote(null);
                }}
                className="bg-transparent text-[11px] font-semibold text-cyan outline-none cursor-pointer"
              >
                {['12:00 PM', '1:00 PM', '2:00 PM', '3:00 PM', '4:00 PM', '5:00 PM'].map((t) => (
                  <option key={t} value={t} className="bg-navy text-white">
                    {t}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Check-out Date & Time Picker */}
          <div
            className={`flex flex-col text-left gap-1 rounded-2xl border px-3.5 py-2.5 transition ${
              showHeroCalendar ? 'border-cyan bg-cyan/10' : 'border-white/10 bg-white/[0.04] hover:border-cyan/50'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className={LABEL}>{siteBooking.checkOut}</span>
              <button
                type="button"
                onClick={() => setShowHeroCalendar((s) => !s)}
                className="text-[10px] text-cyan font-semibold hover:underline"
              >
                Calendar
              </button>
            </div>
            <button
              type="button"
              onClick={() => setShowHeroCalendar((s) => !s)}
              className="text-sm font-semibold text-white flex items-center justify-between cursor-pointer"
              title="Tap to select check-out date"
            >
              <span>{checkOut}</span>
              <i className="fas fa-calendar-alt text-xs text-cyan" />
            </button>
            <div className="mt-1 flex items-center gap-1.5 pt-1 border-t border-white/10">
              <span className="text-[9px] uppercase tracking-wider text-white/50">Time:</span>
              <select
                value={checkOutTime}
                onChange={(e) => {
                  setCheckOutTime(e.target.value);
                  setQuote(null);
                }}
                className="bg-transparent text-[11px] font-semibold text-cyan outline-none cursor-pointer"
              >
                {['10:00 AM', '11:00 AM', '12:00 PM', '1:00 PM', '2:00 PM'].map((t) => (
                  <option key={t} value={t} className="bg-navy text-white">
                    {t}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Guests Count Selector */}
          <label className="flex flex-col gap-1 rounded-2xl border border-white/10 bg-white/[0.04] px-3.5 py-2.5">
            <span className={LABEL}>{siteBooking.guests}</span>
            <select
              value={guests}
              onChange={(e) => {
                setGuests(e.target.value);
                setQuote(null);
              }}
              className="w-full text-sm font-medium text-white outline-none bg-transparent mt-1 cursor-pointer"
            >
              {['1 Guest', '2 Guests', '3 Guests', '4 Guests', '5+ Guests'].map((g) => (
                <option key={g} value={g} className="bg-navy text-white">
                  {g}
                </option>
              ))}
            </select>
          </label>

          {/* Accommodation / Offering Selector */}
          <label className="flex flex-col gap-1 rounded-2xl border border-white/10 bg-white/[0.04] px-3.5 py-2.5">
            <span className={LABEL}>{siteBooking.room}</span>
            <select
              value={selectedRoom}
              onChange={(e) => {
                setSelectedRoom(e.target.value);
                setQuote(null);
              }}
              className="w-full truncate text-sm font-medium text-white outline-none bg-transparent mt-1 cursor-pointer"
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
          </label>

          {/* Check Availability Button */}
          <button
            type="button"
            onClick={checkAvailability}
            disabled={checkingAvailability}
            className="col-span-2 py-3.5 px-6 rounded-2xl bg-cyan hover:bg-cyan-light text-navy font-bold text-xs uppercase tracking-[0.16em] transition lg:col-span-1 lg:h-full cursor-pointer flex items-center justify-center gap-2 shadow-lg shadow-cyan/20 active:scale-95 disabled:opacity-50"
          >
            {checkingAvailability ? (
              <>
                <span className="h-4 w-4 border-2 border-navy border-t-transparent rounded-full animate-spin" />
                <span>Checking…</span>
              </>
            ) : (
              siteBooking.cta
            )}
          </button>
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
