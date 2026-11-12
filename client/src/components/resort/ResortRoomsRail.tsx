import React, { useRef, useState } from 'react';
import { getRoomImageUrl, handleImageError } from '../../lib/images.ts';
import {
  inferOfferingType,
  formatOfferingBadge,
  getRateUnitSuffix,
  formatSpecHighlights,
  OfferingType,
} from '../../lib/offeringSpecs';

interface ResortRoomsRailProps {
  rooms: any[];
  checkIn: string;
  checkOut: string;
  checkInTime: string;
  checkOutTime: string;
  isRoomOccupiedForDates: (room: any, inDate: string, outDate: string, inTime?: string, outTime?: string) => boolean;
  isRoomOccupiedToday: (room: any) => boolean;
  onOpenReservation: (roomName?: string, startWithCalendar?: boolean) => void;
  onSelectRoom: (roomName: string) => void;
  eyebrow?: string;
  title?: string;
}

export default function ResortRoomsRail({
  rooms,
  checkIn,
  checkOut,
  checkInTime,
  checkOutTime,
  isRoomOccupiedForDates,
  isRoomOccupiedToday,
  onOpenReservation,
  onSelectRoom,
  eyebrow = 'Rooms & Suites',
  title = 'Private Coastal Living',
}: ResortRoomsRailProps) {
  const [offeringFilter, setOfferingFilter] = useState<'all' | OfferingType>('all');
  const roomsRailRef = useRef<HTMLDivElement>(null);

  const scrollRoomsRail = (direction: 'left' | 'right') => {
    if (!roomsRailRef.current) return;
    const offset = direction === 'left' ? -380 : 380;
    roomsRailRef.current.scrollBy({ left: offset, behavior: 'smooth' });
  };

  const peso = (n: number) => `₱${Number(n || 0).toLocaleString()}`;
  const formatRoomTitle = (name: string) => {
    if (!name) return 'Coastal Villa';
    return name.charAt(0).toUpperCase() + name.slice(1);
  };

  const filteredRooms = rooms.filter(
    (room) => offeringFilter === 'all' || inferOfferingType(room) === offeringFilter
  );

  return (
    <section id="rooms-section" className="mx-auto w-full max-w-6xl px-5 sm:px-8 lg:px-10 pt-16 md:pt-24 scroll-mt-16">
      <div className="flex items-end justify-between gap-4">
        <div>
          <span className="text-xs uppercase tracking-[0.2em] text-cyan font-bold block mb-1">
            {eyebrow}
          </span>
          <h2 className="font-serif text-3xl sm:text-4xl text-white font-medium tracking-tight">
            {title}
          </h2>
        </div>
        {rooms.length > 0 && (
          <div className="flex items-center gap-2">
            <span className="hidden sm:inline-flex items-center gap-1.5 text-[11px] uppercase tracking-[0.2em] text-white/50 font-medium">
              ✦ Swipe to explore
            </span>
            <button
              type="button"
              onClick={() => scrollRoomsRail('left')}
              className="flex h-10 w-10 items-center justify-center rounded-full border border-white/20 bg-white/5 text-white/80 transition hover:border-cyan hover:bg-cyan/15 hover:text-cyan cursor-pointer active:scale-95 shadow-sm"
              aria-label="Scroll left"
              title="Scroll left"
            >
              ◀
            </button>
            <button
              type="button"
              onClick={() => scrollRoomsRail('right')}
              className="flex h-10 w-10 items-center justify-center rounded-full border border-white/20 bg-white/5 text-white/80 transition hover:border-cyan hover:bg-cyan/15 hover:text-cyan cursor-pointer active:scale-95 shadow-sm"
              aria-label="Scroll right"
              title="Scroll right"
            >
              ▶
            </button>
          </div>
        )}
      </div>

      {rooms.length === 0 ? (
        <div className="mt-8 rounded-3xl border border-white/10 bg-white/[0.02] p-8 text-center text-white/60">
          <p className="font-serif text-lg text-white">No Rooms Published</p>
          <p className="mt-1 text-sm font-light">Rooms are currently being updated. Please check back shortly.</p>
        </div>
      ) : (
        <>
          <div className="mt-6 flex flex-wrap items-center gap-2">
            {([
              { key: 'all', label: `All (${rooms.length})` },
              { key: 'room', label: `Rooms (${rooms.filter((r) => inferOfferingType(r) === 'room').length})` },
              { key: 'cottage', label: `Cottages (${rooms.filter((r) => inferOfferingType(r) === 'cottage').length})` },
              { key: 'offer', label: `Island Tours & Offers (${rooms.filter((r) => inferOfferingType(r) === 'offer').length})` },
            ] as const).map((tab) => {
              const isActive = offeringFilter === tab.key;
              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setOfferingFilter(tab.key)}
                  className={`min-h-[40px] rounded-full px-4 py-1.5 text-xs font-semibold tracking-wide transition cursor-pointer ${
                    isActive
                      ? 'bg-[#006699] text-white border border-cyan/50 shadow-md'
                      : 'bg-white/5 text-white/80 border border-white/15 hover:border-cyan/40 hover:text-white'
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>

          <div
            ref={roomsRailRef}
            className="mt-6 flex gap-5 overflow-x-auto snap-x snap-mandatory pb-4 pt-1 -mx-5 px-5 sm:-mx-8 sm:px-8 scrollbar-none no-scrollbar"
            style={{
              scrollbarWidth: 'none',
              msOverflowStyle: 'none',
              WebkitOverflowScrolling: 'touch',
            }}
          >
            {filteredRooms.map((room) => {
              const roomTitle = formatRoomTitle(room.name);
              const categoryLabel = room.category || 'Luxury Villa';
              const capacityGuests = room.capacity || 4;
              const priceNight = room.rate_php || room.price || 0;
              const downpayment = Math.round(priceNight * 0.3);
              const descriptionText =
                room.description ||
                room.meta ||
                'Private coastal sanctuary featuring tranquil seaside ambiance, plush bedding, and direct beach trail access.';
              const isOccupiedForSelectedStay = Boolean(
                checkIn && checkOut && isRoomOccupiedForDates(room, checkIn, checkOut, checkInTime, checkOutTime)
              );
              const isOccupiedRightNow = isRoomOccupiedToday(room);

              return (
                <article
                  key={room.id || room.name}
                  className="group flex w-[88vw] max-w-[360px] sm:w-[380px] md:w-[410px] shrink-0 snap-start flex-col rounded-3xl border border-white/10 bg-[#0B1528]/95 backdrop-blur-md overflow-hidden transition-all duration-300 hover:border-cyan/50 hover:shadow-2xl hover:shadow-cyan/10"
                >
                  {/* Image Showcase with Fallbacks */}
                  <div className="relative h-60 w-full overflow-hidden bg-navy-dark">
                    <img
                      src={getRoomImageUrl(room)}
                      alt={roomTitle}
                      loading="lazy"
                      onError={handleImageError}
                      className="h-full w-full object-cover transition duration-700 group-hover:scale-105"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-[#0B1528] via-black/20 to-black/40 pointer-events-none" />

                    {/* Top Status Badges */}
                    <div className="absolute top-3 inset-x-3 flex items-center justify-between gap-2 pointer-events-none">
                      <span className="rounded-full border border-white/15 bg-black/75 px-3 py-1 font-mono text-[10px] font-semibold tracking-wider uppercase text-cyan backdrop-blur-md shadow-sm">
                        {formatOfferingBadge(inferOfferingType(room), categoryLabel)}
                      </span>
                      {isOccupiedForSelectedStay ? (
                        <span className="rounded-full border border-rose-500/40 bg-rose-950/85 px-2.5 py-1 text-[10px] font-semibold text-rose-300 backdrop-blur-md flex items-center gap-1.5 shadow-sm">
                          <span className="h-1.5 w-1.5 rounded-full bg-rose-400" />
                          Reserved / 2h Buffer
                        </span>
                      ) : isOccupiedRightNow ? (
                        <span className="rounded-full border border-amber-500/40 bg-amber-950/85 px-2.5 py-1 text-[10px] font-semibold text-amber-300 backdrop-blur-md flex items-center gap-1.5 shadow-sm">
                          <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
                          Occupied Today
                        </span>
                      ) : (
                        <span className="rounded-full border border-emerald-500/30 bg-emerald-950/80 px-2.5 py-1 text-[10px] font-semibold text-emerald-300 backdrop-blur-md flex items-center gap-1.5 shadow-sm">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                          Available
                        </span>
                      )}
                    </div>

                    {/* Bottom Price Tag */}
                    <div className="absolute bottom-3 left-3 rounded-2xl border border-white/15 bg-navy/90 px-3.5 py-1.5 backdrop-blur-md shadow-lg flex items-baseline gap-1.5">
                      <span className="font-serif text-lg font-bold text-cyan">
                        {peso(priceNight)}
                      </span>
                      <span className="font-sans text-[10px] text-white/70">
                        {getRateUnitSuffix(inferOfferingType(room), room.specs)}
                      </span>
                      <span className="hidden sm:inline text-[9px] text-white/40 pl-1 border-l border-white/10">
                        DP: {peso(downpayment)}
                      </span>
                    </div>
                  </div>

                  {/* Card Content & Details */}
                  <div className="flex flex-1 flex-col justify-between p-5 sm:p-6 gap-4">
                    <div className="space-y-2.5">
                      {/* Title & Star Rating */}
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="font-serif text-xl sm:text-2xl font-medium tracking-wide text-white group-hover:text-cyan transition leading-tight">
                          {roomTitle}
                        </h3>
                        <span className="flex items-center gap-1 text-[11px] font-medium text-amber-300/90 shrink-0 pt-0.5">
                          <i className="fas fa-star text-gold" style={{ marginRight: 4 }} />4.9 <span className="text-white/40">(18)</span>
                        </span>
                      </div>

                      {/* Specs & Amenities Highlights */}
                      <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-white/60">
                        <span className="inline-flex items-center gap-1 rounded-lg bg-white/5 px-2.5 py-1 border border-white/5">
                          <i className="fas fa-users" style={{ marginRight: 4 }} />
                          {inferOfferingType(room) === 'offer' ? `Up to ${capacityGuests} pax` : `Sleeps ${capacityGuests}`}
                        </span>
                        {formatSpecHighlights(room).slice(0, 3).map((sp) => (
                          <span key={sp.label} className="inline-flex items-center gap-1 rounded-lg bg-white/5 px-2.5 py-1 border border-white/5">
                            {sp.label}: {sp.value}
                          </span>
                        ))}
                      </div>

                      <p className="text-xs font-light leading-relaxed text-white/60 line-clamp-2">
                        {descriptionText}
                      </p>
                    </div>

                    {/* Dual Action Footer with Reactive Buttons */}
                    <div className="pt-3 border-t border-white/10 flex items-center gap-2.5">
                      <button
                        type="button"
                        onClick={() => {
                          onSelectRoom(room.name);
                          onOpenReservation(room.name, true);
                        }}
                        title={`Check calendar & reserved dates for ${roomTitle}`}
                        className="flex-1 py-2.5 px-3.5 rounded-xl border border-white/20 bg-white/5 hover:border-cyan hover:bg-cyan/10 text-xs font-semibold text-white/90 tracking-wide transition flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap"
                      >
                        <i className="fas fa-calendar-check" style={{ marginRight: 4 }} />
                        <span>Check Dates</span>
                      </button>

                      {isOccupiedForSelectedStay ? (
                        <button
                          type="button"
                          onClick={() => {
                            onSelectRoom(room.name);
                            onOpenReservation(room.name, true);
                          }}
                          title={`This accommodation is already reserved from ${checkIn} (${checkInTime}) to ${checkOut} (${checkOutTime}) with mandatory 2-hour turnaround buffer. Click to view open slots.`}
                          className="flex-1 py-2.5 px-3.5 rounded-xl border border-rose-500/40 bg-rose-950/50 hover:bg-rose-950/80 text-rose-200 font-bold text-xs tracking-wide transition flex items-center justify-center gap-1.5 cursor-pointer shadow-sm whitespace-nowrap"
                        >
                          <i className="fas fa-clock text-[10px] text-rose-400" />
                          <span>Reserved · 2h Gap</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            onSelectRoom(room.name);
                            onOpenReservation(room.name, false);
                          }}
                          title={`Reserve ${roomTitle}`}
                          className="flex-1 py-2.5 px-3.5 rounded-xl bg-cyan hover:bg-cyan-light text-navy font-bold text-xs tracking-wide transition flex items-center justify-center gap-1.5 cursor-pointer shadow-md shadow-cyan/20 whitespace-nowrap"
                        >
                          <span>{inferOfferingType(room) === 'offer' ? 'Reserve Tour →' : inferOfferingType(room) === 'cottage' ? 'Reserve Cottage →' : 'Book Room →'}</span>
                        </button>
                      )}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </>
      )}
    </section>
  );
}
