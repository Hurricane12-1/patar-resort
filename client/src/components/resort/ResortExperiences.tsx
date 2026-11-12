import React from 'react';
import { inferOfferingType, getRateUnitSuffix, formatSpecHighlights } from '../../lib/offeringSpecs';

interface ResortExperiencesProps {
  eyebrow?: string;
  title?: string;
  tagline?: string;
  items: Array<{ title: string; body: string }>;
  offerRooms: any[];
  onSelectRoom: (name: string) => void;
  onOpenReservation: (name: string, startWithCalendar?: boolean) => void;
}

export default function ResortExperiences({
  eyebrow = 'Curated Moments',
  title = 'Bolinao Unhurried',
  tagline = 'Fifty steps from the sand on Patar Beach.',
  items = [],
  offerRooms = [],
  onSelectRoom,
  onOpenReservation,
}: ResortExperiencesProps) {
  const peso = (n: number) => `₱${Number(n || 0).toLocaleString()}`;
  const tourOffers = offerRooms.filter((r) => inferOfferingType(r) === 'offer');

  return (
    <section id="experiences-section" className="mx-auto w-full max-w-6xl px-5 sm:px-8 lg:px-10 pt-16 md:pt-24 scroll-mt-16">
      <div className="rounded-3xl bg-[#ECE7DE] p-7 text-[#0A1628] sm:p-10 lg:grid lg:grid-cols-[1fr_1.6fr] lg:gap-16 lg:p-14">
        <div>
          <span className="text-xs uppercase tracking-[0.2em] text-[#006699] font-bold block mb-1">
            {eyebrow}
          </span>
          <h2 className="font-serif text-3xl sm:text-4xl text-[#0A1628] font-medium tracking-tight">
            {title}
          </h2>
          <p className="mt-4 hidden max-w-xs text-sm font-light leading-relaxed text-[#0A1628]/70 lg:block">
            {tagline}
          </p>
        </div>

        <div className="mt-8 grid gap-x-10 sm:grid-cols-2 lg:mt-0">
          {items.map((exp, i) => (
            <div key={exp.title} className="border-t border-[#0A1628]/10 py-5">
              <div className="flex items-baseline gap-3">
                <span className="font-serif text-lg italic text-sky-700/60">0{i + 1}</span>
                <h3 className="font-serif text-xl font-medium">{exp.title}</h3>
              </div>
              <p className="mt-2 text-sm font-light leading-relaxed text-[#0A1628]/70">{exp.body}</p>
            </div>
          ))}

          {tourOffers.length > 0 && (
            <div className="sm:col-span-2 mt-4 rounded-2xl border border-[#006699]/25 bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-widest text-[#006699]">
                    Reservable Island Tours &amp; Offers
                  </span>
                  <h4 className="font-serif text-lg font-semibold text-[#0A1628]">
                    Book Your Island Tour Schedule Ahead
                  </h4>
                </div>
                <span className="text-xs text-slate-600">
                  Online booking with mandatory 2-hour buffer window
                </span>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                {tourOffers.map((offerItem) => (
                  <div
                    key={offerItem.id || offerItem.name}
                    className="rounded-xl border border-slate-200 bg-slate-50 p-4 flex flex-col justify-between gap-3"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="rounded-full bg-[#fef3c7] px-2.5 py-0.5 text-[11px] font-bold text-[#78350f]">
                          {offerItem.category || 'Island Tour'}
                        </span>
                        <span className="text-sm font-bold text-[#006699]">
                          {peso(offerItem.rate_php)} {getRateUnitSuffix('offer', offerItem.specs)}
                        </span>
                      </div>
                      <h5 className="mt-2 font-serif text-base font-semibold text-[#0A1628]">
                        {offerItem.name}
                      </h5>
                      <p className="mt-1 text-xs text-slate-600 line-clamp-2">{offerItem.description}</p>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {formatSpecHighlights(offerItem).slice(0, 3).map((sp) => (
                          <span
                            key={sp.label}
                            className="rounded bg-white px-2 py-0.5 text-[10px] font-medium text-slate-700 border border-slate-200"
                          >
                            {sp.label}: {sp.value}
                          </span>
                        ))}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        onSelectRoom(offerItem.name);
                        onOpenReservation(offerItem.name, true);
                      }}
                      className="min-h-[40px] w-full rounded-xl bg-[#006699] px-4 py-2 text-xs font-bold text-white hover:bg-[#00517a] transition cursor-pointer"
                    >
                      Reserve Island Tour / Offer
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
