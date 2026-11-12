import React, { useState } from 'react';
import { Link } from 'react-router-dom';

interface ResortFooterProps {
  about?: string;
  socials?: string[];
  columns?: Array<{ title: string; items: string[] }>;
  newsletter?: { title: string; body: string; placeholder: string; button: string };
  badges?: string[];
  payments?: string[];
  legal?: string[];
  copyright?: string;
  backToTop?: string;
  onScrollTo?: (id: string) => void;
  onScrollTop?: () => void;
}

export default function ResortFooter({
  about = 'Seaside sanctuary on Patar Beach in Bolinao, Pangasinan. Golden sand bluffs, tranquil waters, and open-air beachfront living since 2016.',
  socials = ['Facebook', 'Instagram', 'TikTok', 'Google Maps'],
  columns = [
    { title: 'Experience', items: ['Accommodations', 'Island Tours', 'Seaside Grill', 'Direct Booking FAQ'] },
    { title: 'Concierge', items: ['Concierge Desk', 'Check-In Guidelines', 'Turnaround Buffer Rules', 'Weather Policy'] },
  ],
  newsletter = {
    title: 'Postcards from Patar',
    body: 'Quiet seasonal notes, tide predictions, and unannounced cottage openings. Never noisy.',
    placeholder: 'your.email@domain.ph',
    button: 'Join List',
  },
  badges = ['Verified Direct Booking', 'DOT Accredited Resort', 'Patar Beachfront', '2-Hour Gap Inspected'],
  payments = ['GCash Verified', 'Maya Instant', 'Bank Transfer', 'Cash at Reception Desk'],
  legal = ['Terms of Stay', 'Privacy Notice', '2-Hour Turnover Guarantee'],
  copyright = '© 2026 Rock View Beach Resort. All rights reserved. Brgy. Patar, Bolinao, Pangasinan.',
  backToTop = 'Top',
  onScrollTo,
  onScrollTop,
}: ResortFooterProps) {
  const [newsletterEmail, setNewsletterEmail] = useState('');
  const [newsletterDone, setNewsletterDone] = useState(false);

  return (
    <footer className="relative mt-20 overflow-hidden border-t border-white/10 bg-[#060B18] md:mt-28">
      <span className="pointer-events-none absolute -bottom-4 left-1/2 -translate-x-1/2 select-none whitespace-nowrap font-serif text-[80px] italic leading-none text-white/[0.03] md:-bottom-8 md:text-[160px] lg:text-[220px]">
        Rock View
      </span>

      <div className="mx-auto w-full max-w-6xl px-5 sm:px-8 lg:px-10 relative pb-[calc(8rem+env(safe-area-inset-bottom))] pt-16 lg:pb-16">
        <div className="grid gap-10 lg:grid-cols-12">
          <div className="lg:col-span-4">
            <div className="flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-cyan/20 border border-cyan/40 text-cyan">
                <i className="fas fa-umbrella-beach text-sm" />
              </span>
              <span className="font-serif text-lg tracking-wider text-white font-medium">ROCK VIEW BEACH RESORT</span>
            </div>
            <p className="mt-5 max-w-sm text-sm font-light leading-relaxed text-white/60">{about}</p>
            <div className="mt-5 flex gap-5 text-xs text-white/50">
              {socials.map((s) => (
                <span key={s} className="cursor-pointer transition hover:text-cyan">
                  {s}
                </span>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-6 lg:col-span-4">
            {columns.map((col) => (
              <div key={col.title}>
                <span className="mb-4 block text-[10px] font-semibold uppercase tracking-[0.25em] text-white/40">
                  {col.title}
                </span>
                <ul className="flex flex-col gap-2.5 text-sm text-white/70">
                  {col.items.map((it) => (
                    <li
                      key={it}
                      onClick={() => {
                        if (it === 'Concierge Desk') {
                          window.dispatchEvent(new CustomEvent('app:open-chat'));
                        } else if (it === 'Direct Booking FAQ') {
                          onScrollTo?.('faq-section');
                        } else if (it.includes('Accommodation') || it.includes('Rooms')) {
                          onScrollTo?.('rooms-section');
                        } else if (it.includes('Grill') || it.includes('Dining')) {
                          onScrollTo?.('dining-section');
                        }
                      }}
                      className="cursor-pointer transition hover:text-cyan"
                    >
                      {it}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-6 lg:col-span-4">
            <span className="block text-[10px] font-semibold uppercase tracking-[0.25em] text-cyan">
              {newsletter.title}
            </span>
            <p className="mt-2 text-sm font-light leading-relaxed text-white/60">{newsletter.body}</p>
            {newsletterDone ? (
              <p className="mt-4 text-sm text-cyan">✦ You're on the list. Watch for the next high tide.</p>
            ) : (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (newsletterEmail) setNewsletterDone(true);
                }}
                className="mt-4 flex flex-col gap-2 sm:flex-row"
              >
                <input
                  required
                  type="email"
                  value={newsletterEmail}
                  onChange={(e) => setNewsletterEmail(e.target.value)}
                  placeholder={newsletter.placeholder}
                  className="min-w-0 flex-1 rounded-full border border-white/10 bg-[#060B18] px-4 py-3 text-sm text-white outline-none focus:border-cyan/60"
                />
                <button
                  type="submit"
                  className="shrink-0 rounded-full bg-cyan px-5 py-3 text-xs font-semibold uppercase tracking-[0.15em] text-navy transition hover:brightness-110 cursor-pointer font-bold"
                >
                  {newsletter.button}
                </button>
              </form>
            )}
          </div>
        </div>

        <div className="mt-12 flex flex-col gap-4 border-t border-white/10 pt-8 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-wrap gap-2">
            {badges.map((b) => (
              <span key={b} className="rounded-full border border-[#FBBF24]/30 bg-[#FBBF24]/10 px-3 py-1 text-[10px] text-[#FBBF24]">
                <i className="fas fa-star" style={{ marginRight: 4 }} />
                {b}
              </span>
            ))}
          </div>
          <div className="flex flex-wrap gap-2 text-[10px] text-white/45">
            {payments.map((p) => (
              <span key={p} className="rounded-md border border-white/10 bg-white/5 px-2 py-1">
                {p}
              </span>
            ))}
          </div>
        </div>

        <div className="mt-8 flex flex-col items-center gap-4 border-t border-white/5 pt-6 text-[11px] text-white/40 md:flex-row md:justify-between">
          <p className="text-center md:text-left">{copyright}</p>
          <div className="flex flex-wrap items-center justify-center gap-4">
            {legal.map((l) => (
              <span key={l} className="cursor-pointer hover:text-white/70">
                {l}
              </span>
            ))}
            {/* Separate Staff Terminal Entry */}
            <Link
              to="/staff/login"
              className="rounded px-2 py-0.5 border border-cyan/30 text-cyan/70 hover:text-cyan hover:border-cyan transition font-mono text-[10px]"
              title="Authorized Operations & Department Terminal"
            >
              <i className="fas fa-clipboard-user" style={{ marginRight: 4 }} />
              Staff Station
            </Link>
            <button
              type="button"
              onClick={onScrollTop}
              className="font-semibold uppercase tracking-[0.15em] text-cyan cursor-pointer"
            >
              ↑ {backToTop}
            </button>
          </div>
        </div>
      </div>
    </footer>
  );
}
