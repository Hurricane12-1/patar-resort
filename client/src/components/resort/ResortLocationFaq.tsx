import React, { useState } from 'react';

interface FaqItem {
  q: string;
  a: string;
}

interface ResortLocationFaqProps {
  locationEyebrow?: string;
  locationTitle?: string;
  locationBody?: string;
  locationFacts?: Array<[string, string]>;
  locationButton?: string;
  faqEyebrow?: string;
  faqTitle?: string;
  faqItems?: FaqItem[];
}

export default function ResortLocationFaq({
  locationEyebrow = 'Find Your Way',
  locationTitle = 'The Tip of Pangasinan',
  locationBody = 'Perched on Patar Beach in Bolinao, Pangasinan. A scenic four-hour coastal drive north of Metro Manila, directly overlooking the open West Philippine Sea.',
  locationFacts = [
    ['4 hrs', 'North of Manila'],
    ['50', 'Steps to Sand'],
    ['1905', 'Historic Light'],
  ],
  locationButton = 'View in Google Maps',
  faqEyebrow = 'Clear Answers',
  faqTitle = 'Before You Arrive',
  faqItems = [],
}: ResortLocationFaqProps) {
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  return (
    <>
      {/* 1. LOCATION */}
      <section id="location-section" className="mx-auto w-full max-w-6xl px-5 sm:px-8 lg:px-10 pt-16 md:pt-24 scroll-mt-16">
        <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-[#060B18]/90 p-6 sm:p-10 lg:grid lg:grid-cols-2 lg:items-center lg:gap-14 lg:p-14 shadow-xl">
          <div className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-cyan/15 blur-3xl" />
          <div className="relative">
            <span className="text-xs uppercase tracking-[0.2em] text-cyan font-bold block mb-1">
              {locationEyebrow}
            </span>
            <h2 className="font-serif text-3xl sm:text-4xl text-white font-medium tracking-tight">
              {locationTitle}
            </h2>
            <p className="mt-4 text-sm md:text-[15px] font-light leading-relaxed text-white/70">
              {locationBody}
            </p>
          </div>
          <div className="relative mt-8 lg:mt-0">
            <div className="grid grid-cols-3 gap-2.5 sm:gap-4">
              {locationFacts.map(([val, desc]) => (
                <div key={desc} className="rounded-2xl border border-white/10 bg-white/[0.04] p-3 text-center sm:p-5">
                  <span className="block font-serif text-2xl md:text-3xl font-medium text-cyan">{val}</span>
                  <span className="mt-1 block text-[10px] md:text-xs leading-tight text-white/50">{desc}</span>
                </div>
              ))}
            </div>
            <a
              href="https://maps.google.com/?q=Patar+Beach+Bolinao+Pangasinan"
              target="_blank"
              rel="noopener noreferrer"
              className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-white/20 bg-white/5 py-3 text-xs font-semibold uppercase tracking-wider text-white hover:border-cyan hover:bg-cyan/15 hover:text-cyan transition"
            >
              <i className="fas fa-location-dot" />
              <span>{locationButton}</span>
            </a>
          </div>
        </div>
      </section>

      {/* 2. FAQ */}
      <section id="faq-section" className="mx-auto w-full max-w-6xl px-5 sm:px-8 lg:px-10 pt-16 md:pt-24 scroll-mt-16 lg:grid lg:grid-cols-[1fr_1.6fr] lg:gap-16">
        <div>
          <span className="text-xs uppercase tracking-[0.2em] text-cyan font-bold block mb-1">
            {faqEyebrow}
          </span>
          <h2 className="font-serif text-3xl sm:text-4xl text-white font-medium tracking-tight">
            {faqTitle}
          </h2>
        </div>
        <div className="mt-8 flex flex-col gap-3 lg:mt-0">
          {faqItems.map((item, i) => {
            const open = openFaq === i;
            return (
              <div key={item.q} className="overflow-hidden rounded-2xl border border-white/10 bg-[#060B18]/80">
                <button
                  type="button"
                  onClick={() => setOpenFaq(open ? null : i)}
                  aria-expanded={open}
                  className="flex w-full items-center justify-between gap-4 p-5 text-left cursor-pointer"
                >
                  <span className="font-serif text-lg md:text-xl font-medium text-white">{item.q}</span>
                  <span
                    className={`shrink-0 text-2xl font-light leading-none text-cyan transition-transform duration-300 ${
                      open ? 'rotate-45' : ''
                    }`}
                  >
                    +
                  </span>
                </button>
                <div className={`grid transition-all duration-300 ${open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}>
                  <div className="overflow-hidden">
                    <p className="px-5 pb-5 text-sm font-light leading-relaxed text-white/60">{item.a}</p>
                  </div>
                </div>
              </div>
            );
          })}

          {/* AI Concierge Direct Trigger */}
          <div className="mt-2 flex flex-col gap-4 rounded-2xl border border-cyan/25 bg-cyan/[0.06] p-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="flex items-center gap-2 text-sm font-medium text-white">
                <span className="h-2 w-2 rounded-full bg-cyan animate-pulse" />
                Have more questions about your stay?
              </p>
              <p className="mt-1 text-xs text-white/60">
                Our 24/7 AI Concierge can instantly answer room rates, amenities, beach guidelines, and 2-hour turnaround policies.
              </p>
            </div>
            <button
              type="button"
              onClick={() => window.dispatchEvent(new CustomEvent('app:open-chat'))}
              className="shrink-0 rounded-full bg-cyan px-5 py-2.5 text-[11px] font-semibold uppercase tracking-[0.15em] text-[#0A1628] shadow-[0_4px_16px_rgba(34,195,238,.4)] transition hover:brightness-110 active:scale-95 cursor-pointer font-bold"
            >
              Ask AI Concierge ✦
            </button>
          </div>
        </div>
      </section>
    </>
  );
}
