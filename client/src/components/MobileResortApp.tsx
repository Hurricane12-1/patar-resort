import React, { useState, useEffect, useRef } from 'react';
import site from '../content/site.json';

// --- INLINE TYPOGRAPHY & DESIGN TOKENS ---
export function Eyebrow({ children, light = false }: { children: React.ReactNode; light?: boolean }) {
  return (
    <span className={`block text-[11px] font-medium uppercase tracking-[0.28em] ${light ? 'text-sky-700' : 'text-cyan'}`}>
      {children}
    </span>
  );
}

export function SectionTitle({
  title,
  accent,
  light = false,
}: {
  title: string;
  accent?: string;
  light?: boolean;
}) {
  return (
    <h2 className={`font-serif text-3xl sm:text-4xl leading-tight mt-2 ${light ? 'text-[#060b18]' : 'text-white'}`}>
      {title}
      {accent && (
        <>
          <br />
          <em className={`italic font-serif ${light ? 'text-sky-700' : 'text-cyan'}`}>
            {accent}
          </em>
        </>
      )}
    </h2>
  );
}

export function Logo({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const markDimensions =
    size === 'lg' ? 'w-20 h-20 rounded-3xl' : size === 'sm' ? 'w-8 h-8 rounded-lg' : 'w-10 h-10 rounded-xl';
  const sunRadius = size === 'lg' ? 5 : size === 'sm' ? 2.5 : 3;

  return (
    <div className="flex items-center gap-3">
      <div
        className={`${markDimensions} border border-cyan/30 bg-gradient-to-br from-cyan/25 to-transparent flex items-center justify-center shrink-0 shadow-[0_4px_16px_-4px_rgba(34,195,238,.3)]`}
      >
        <svg viewBox="0 0 24 24" className="w-3/5 h-3/5" fill="none" xmlns="http://www.w3.org/2000/svg">
          {/* Gold sun circle */}
          <circle cx="12" cy="8" r={sunRadius} fill="#f6b74a" />
          {/* Two cyan wave strokes */}
          <path d="M4 14C7 12 9 16 12 14C15 12 17 16 20 14" stroke="#22c3ee" strokeWidth="2" strokeLinecap="round" />
          <path d="M4 18C7 16 9 20 12 18C15 16 17 20 20 18" stroke="#22c3ee" strokeWidth="2" strokeLinecap="round" strokeOpacity="0.7" />
        </svg>
      </div>

      <div className="whitespace-nowrap">
        <span className="font-serif text-xl sm:text-2xl text-white font-medium tracking-wide block leading-tight">
          {site.brand.name}
        </span>
        <span className="text-[9px] uppercase tracking-[0.25em] text-cyan/80 block font-sans">
          {site.brand.sub}
        </span>
      </div>
    </div>
  );
}

// --- MAIN MOBILE RESORT APP STATE MACHINE ---
export default function MobileResortApp() {
  const [stage, setStage] = useState<'loading' | 'intro' | 'auth' | 'app'>('loading');
  const [authMode, setAuthMode] = useState<'signup' | 'login'>('signup');
  const [activeScene, setActiveScene] = useState(0);
  const [ambientPlaying, setAmbientPlaying] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [newsletterEmail, setNewsletterEmail] = useState('');
  const [newsletterDone, setNewsletterDone] = useState(false);
  const [activeTab, setActiveTab] = useState('Home');

  // Booking Card State
  const today = new Date().toISOString().slice(0, 10);
  const addDays = (d: string, days: number) => {
    const res = new Date(d);
    res.setDate(res.getDate() + days);
    return res.toISOString().slice(0, 10);
  };

  const [checkIn, setCheckIn] = useState(addDays(today, 1));
  const [checkOut, setCheckOut] = useState(addDays(today, 3));
  const [guests, setGuests] = useState('2 Guests');
  const [selectedRoom, setSelectedRoom] = useState(site.rooms.items[0]?.name || 'Oceanfront Sunset Villa');

  // Audio wave synthesizer for Ambient Waves
  const audioCtxRef = useRef<AudioContext | null>(null);
  const noiseNodeRef = useRef<AudioNode | null>(null);

  const toggleAmbientAudio = () => {
    if (ambientPlaying) {
      if (audioCtxRef.current) {
        audioCtxRef.current.close().catch(() => {});
        audioCtxRef.current = null;
      }
      setAmbientPlaying(false);
    } else {
      try {
        const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        const ctx = new AudioContextClass();
        const bufferSize = ctx.sampleRate * 2;
        const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        let lastOut = 0.0;
        for (let i = 0; i < bufferSize; i++) {
          const white = Math.random() * 2 - 1;
          data[i] = (lastOut + 0.02 * white) / 1.02; // pink/brown noise
          lastOut = data[i];
          data[i] *= 0.15;
        }
        const noise = ctx.createBufferSource();
        noise.buffer = buffer;
        noise.loop = true;

        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(380, ctx.currentTime);

        const gainNode = ctx.createGain();
        gainNode.gain.setValueAtTime(0.08, ctx.currentTime);

        noise.connect(filter);
        filter.connect(gainNode);
        gainNode.connect(ctx.destination);

        noise.start();
        audioCtxRef.current = ctx;
        noiseNodeRef.current = noise;
        setAmbientPlaying(true);
      } catch {
        setAmbientPlaying(!ambientPlaying);
      }
    }
  };

  // 1. Loading stage transition (2400ms)
  useEffect(() => {
    if (stage === 'loading') {
      const timer = setTimeout(() => {
        setStage('intro');
      }, 2400);
      return () => clearTimeout(timer);
    }
  }, [stage]);

  // Clean up audio on unmount
  useEffect(() => {
    return () => {
      if (audioCtxRef.current) {
        audioCtxRef.current.close().catch(() => {});
      }
    };
  }, []);

  // Copy code helper
  const handleCopyCode = (code: string) => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(code).catch(() => {});
    }
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2500);
  };

  // Scroll to section helper
  const scrollTo = (id: string) => {
    setMenuOpen(false);
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  // ==========================================
  // STAGE 1: LOADING SCREEN
  // ==========================================
  if (stage === 'loading') {
    return (
      <main
        className="h-[100dvh] w-full bg-[#060b18] text-[#e8eef7] flex flex-col items-center justify-center p-6 select-none animate-fade-in"
        aria-label="Loading J & D Beach House"
      >
        <div className="flex flex-col items-center text-center">
          <Logo size="lg" />
          <p className="font-serif text-3xl sm:text-4xl text-white font-medium mt-6 tracking-wide">
            {site.brand.name}
          </p>
          <span className="text-xs uppercase tracking-[0.35em] text-cyan/80 mt-1 font-sans">
            {site.brand.sub}
          </span>

          {/* 2px progress bar w-40 with loadbar */}
          <div className="h-[2px] w-40 bg-white/10 rounded-full overflow-hidden mt-8">
            <div className="h-full bg-cyan rounded-full animate-loadbar" />
          </div>

          <p className="text-xs text-white/50 tracking-wider mt-4 font-light">
            {site.intro.loading}
          </p>
        </div>
      </main>
    );
  }

  // ==========================================
  // STAGE 2: INTRO SCREEN (8 SECTIONS)
  // ==========================================
  if (stage === 'intro') {
    return (
      <main
        id="intro-scroll"
        className="h-[100dvh] w-full overflow-y-auto bg-[#060b18] text-[#e8eef7] animate-fade-in"
      >
        <div className="mx-auto max-w-md min-h-screen flex flex-col relative">

          {/* 1. HERO SECTION */}
          <section className="h-[100dvh] relative flex flex-col justify-end p-6 pb-12 select-none overflow-hidden">
            {/* Photo absolute inset-0 with kenburns */}
            <img
              src={site.intro.image}
              alt={site.brand.name}
              className="absolute inset-0 w-full h-full object-cover animate-kenburns pointer-events-none"
            />
            {/* Gradient from-navy/30 via-transparent to-navy */}
            <div className="absolute inset-0 bg-gradient-to-t from-[#060b18] via-[#060b18]/40 to-[#060b18]/30 pointer-events-none" />

            <div className="relative z-10">
              <Eyebrow>{`${site.brand.name} · ${site.brand.sub}`}</Eyebrow>

              <h1 className="text-5xl sm:text-6xl font-serif leading-[0.95] text-white mt-3 font-medium">
                {site.intro.title}
                <br />
                <em className="italic text-cyan font-serif">{site.intro.accent}</em>
              </h1>

              <p className="text-[15px] font-light leading-relaxed text-white/80 mt-4 max-w-sm">
                {site.intro.body}
              </p>

              <button
                type="button"
                onClick={() => {
                  setAuthMode('signup');
                  setStage('auth');
                }}
                className="w-full py-4 mt-6 rounded-full bg-cyan text-navy font-semibold text-xs uppercase tracking-[0.18em] shadow-[0_10px_30px_-8px_rgba(34,195,238,.7)] hover:brightness-110 active:scale-[.98] transition cursor-pointer"
              >
                {site.intro.button}
              </button>

              <div className="text-center mt-3">
                <button
                  type="button"
                  onClick={() => {
                    setAuthMode('login');
                    setStage('auth');
                  }}
                  className="text-xs text-white/70 hover:text-white transition tracking-wide py-2"
                >
                  {site.intro.haveAccount} <span className="text-cyan font-medium underline underline-offset-4">{site.intro.login}</span>
                </button>
              </div>

              {/* Bouncing scroll cue */}
              <div className="flex flex-col items-center mt-6 text-white/50 text-[11px] tracking-widest uppercase">
                <span className="animate-bounce text-cyan text-base">↓</span>
                <span className="mt-1">{site.intro.scrollHint}</span>
              </div>
            </div>
          </section>

          {/* 2. HIGHLIGHTS (3 CARDS) */}
          <section className="px-6 pt-16">
            <Eyebrow>Sanctuary Highlights</Eyebrow>
            <SectionTitle title="Moments Built for" accent="Stillness" />

            <div className="mt-8 space-y-6">
              {site.intro.highlights.map((h, i) => (
                <article key={h.title} className="rounded-3xl border border-white/10 bg-[#0b1426] overflow-hidden">
                  <img src={h.image} alt={h.title} className="w-full h-48 object-cover" loading="lazy" />
                  <div className="p-6">
                    <div className="flex items-baseline gap-2">
                      <span className="font-serif italic text-cyan/70 text-lg">0{i + 1}</span>
                      <h3 className="font-serif text-2xl text-white font-medium">{h.title}</h3>
                    </div>
                    <p className="text-sm text-white/60 leading-relaxed mt-2 font-light">
                      {h.body}
                    </p>
                  </div>
                </article>
              ))}
            </div>
          </section>

          {/* 3. STATS (STATROW INSIDE INK CARD) */}
          <section className="px-6 pt-10">
            <div className="rounded-3xl border border-white/10 bg-[#0b1426] p-6 grid grid-cols-3 divide-x divide-white/10 text-center">
              {site.stats.map((st) => (
                <div key={st.label} className="px-2">
                  <span className="font-serif text-3xl text-cyan block font-medium">{st.value}</span>
                  <span className="text-[10px] uppercase tracking-[0.2em] text-white/50 block mt-1 leading-tight">
                    {st.label}
                  </span>
                </div>
              ))}
            </div>
          </section>

          {/* 4. ROOMS TEASER (CAROUSEL) */}
          <section className="pt-16">
            <div className="px-6">
              <Eyebrow>{site.rooms.eyebrow}</Eyebrow>
              <SectionTitle title={site.rooms.title} />
            </div>

            <div className="flex gap-4 overflow-x-auto snap-x snap-mandatory pt-6 pb-2 px-6">
              {site.rooms.items.map((room) => (
                <div
                  key={room.name}
                  className="snap-start shrink-0 w-[78%] rounded-3xl border border-white/10 bg-[#0b1426] overflow-hidden group"
                >
                  <div className="relative h-64 overflow-hidden">
                    <img
                      src={room.image}
                      alt={room.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition duration-700"
                      loading="lazy"
                    />
                    <span className="absolute bottom-3 left-3 bg-[#060b18]/85 backdrop-blur-md px-3.5 py-1 rounded-full text-xs text-cyan border border-white/10 font-serif">
                      ₱{room.price.toLocaleString()} <span className="text-[10px] text-white/60 font-sans">/night</span>
                    </span>
                  </div>
                  <div className="p-5">
                    <h3 className="font-serif text-xl text-white font-medium">{room.name}</h3>
                    <p className="text-xs text-white/50 mt-1 font-light">{room.meta}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* 5. AMENITIES (3×2 TILE GRID) */}
          <section className="px-6 pt-16">
            <Eyebrow>{site.amenities.eyebrow}</Eyebrow>
            <SectionTitle title={site.amenities.title} />

            <div className="grid grid-cols-2 gap-3 mt-6">
              {site.amenities.items.map((a) => (
                <div
                  key={a.label}
                  className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 flex items-center gap-3"
                >
                  <div className="w-9 h-9 rounded-full bg-cyan/15 border border-cyan/30 flex items-center justify-center text-cyan shrink-0">
                    <span className="text-xs">✦</span>
                  </div>
                  <span className="text-xs text-white/80 font-medium">{a.label}</span>
                </div>
              ))}
            </div>
          </section>

          {/* 6. REVIEW (SAND CARD) */}
          <section className="px-6 pt-16">
            <div className="rounded-3xl bg-[#f4e9d8] text-[#060b18] p-7 border border-[#e8d8be] shadow-lg">
              <span className="text-sm tracking-widest text-[#d9962b] block">★★★★★</span>
              <p className="font-serif italic text-2xl leading-snug mt-4 text-[#060b18]">
                "{site.reviews.items[0].quote}"
              </p>
              <div className="mt-5 pt-4 border-t border-[#060b18]/10 flex items-center justify-between">
                <div>
                  <span className="text-xs font-semibold text-[#060b18] block">{site.reviews.items[0].name}</span>
                  <span className="text-[11px] text-[#060b18]/60 block">{site.reviews.items[0].from}</span>
                </div>
                <span className="text-[10px] uppercase tracking-widest text-[#060b18]/50 font-medium">Verified Guest</span>
              </div>
            </div>
          </section>

          {/* 7. OFFER (CYAN -> SKY-600 GRADIENT CARD) */}
          <section className="px-6 pt-16">
            <div className="rounded-3xl bg-gradient-to-br from-cyan to-sky-600 text-navy p-7 shadow-[0_15px_35px_-10px_rgba(34,195,238,.4)]">
              <span className="text-[10px] uppercase tracking-[0.25em] font-semibold text-navy/70 block">
                {site.offers.items[0].tag} · Members Exclusive
              </span>
              <h3 className="font-serif text-3xl font-medium mt-1 text-navy leading-tight">
                {site.offers.items[0].title}
              </h3>
              <p className="text-sm text-navy/85 mt-2 leading-relaxed">
                {site.offers.items[0].body}
              </p>
              <button
                type="button"
                onClick={() => {
                  setAuthMode('signup');
                  setStage('auth');
                }}
                className="mt-6 w-full py-3.5 rounded-full bg-navy text-white text-xs font-semibold uppercase tracking-[0.18em] shadow-md hover:brightness-110 active:scale-[.98] transition cursor-pointer"
              >
                Sign Up for Privileges
              </button>
            </div>
          </section>

          {/* 8. MINI FOOTER */}
          <footer className="pt-20 pb-12 px-6 text-center border-t border-white/10 mt-16">
            <div className="flex justify-center">
              <Logo size="sm" />
            </div>
            <p className="font-serif italic text-white/60 text-sm mt-3">"{site.brand.tagline}"</p>

            <div className="flex justify-center gap-6 mt-5 text-xs text-white/50">
              {site.footer.socials.map((s) => (
                <span key={s} className="hover:text-cyan transition cursor-pointer">
                  {s}
                </span>
              ))}
            </div>

            <button
              type="button"
              onClick={() => {
                setAuthMode('login');
                setStage('auth');
              }}
              className="text-xs text-cyan tracking-wider uppercase font-semibold mt-6 block mx-auto underline underline-offset-4"
            >
              Sign in to Portal
            </button>

            <div className="mt-8 pt-6 border-t border-white/5 text-[10px] text-white/35">
              <p>{site.footer.copyright}</p>
            </div>
          </footer>
        </div>
      </main>
    );
  }

  // ==========================================
  // STAGE 3: AUTH SCREEN (SIGNUP / LOGIN)
  // ==========================================
  if (stage === 'auth') {
    const isSignup = authMode === 'signup';
    const copy = isSignup ? site.auth.signup : site.auth.login;

    return (
      <main
        className="h-[100dvh] w-full overflow-y-auto bg-[#060b18] text-[#e8eef7] animate-fade-in flex flex-col"
        key={authMode}
      >
        <div className="mx-auto max-w-md w-full min-h-screen flex flex-col p-6 pt-10 pb-8">
          {/* Safe-area back button circle 40×40 */}
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => setStage('intro')}
              className="w-10 h-10 rounded-full border border-white/20 bg-white/5 flex items-center justify-center text-white/80 hover:bg-white/10 transition active:scale-95"
              aria-label="Back to intro"
            >
              <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M19 12H5M12 19l-7-7 7-7" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>

            <Logo size="sm" />
          </div>

          <div className="mt-8">
            <Eyebrow>{isSignup ? 'New Guest' : 'Returning Guest'}</Eyebrow>
            <h1 className="font-serif text-3xl sm:text-4xl text-white font-medium mt-2">
              {copy.title}
            </h1>
            <p className="text-sm text-white/60 mt-2 font-light leading-relaxed">
              {copy.sub}
            </p>
          </div>

          {/* FORM */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              setStage('app');
            }}
            className="mt-8 space-y-4"
          >
            {isSignup && (
              <div>
                <label className="text-[10px] uppercase tracking-[0.2em] text-white/50 block mb-1.5 font-medium">
                  Full Name *
                </label>
                <input
                  required
                  type="text"
                  placeholder="e.g. Maria Santos"
                  className="w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3.5 text-sm text-white placeholder-white/35 focus:outline-none focus:border-cyan/60 transition"
                />
              </div>
            )}

            <div>
              <label className="text-[10px] uppercase tracking-[0.2em] text-white/50 block mb-1.5 font-medium">
                Email Address *
              </label>
              <input
                required
                type="email"
                placeholder="name@domain.com"
                className="w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3.5 text-sm text-white placeholder-white/35 focus:outline-none focus:border-cyan/60 transition"
              />
            </div>

            {isSignup && (
              <div>
                <label className="text-[10px] uppercase tracking-[0.2em] text-white/50 block mb-1.5 font-medium">
                  Mobile Number (SMS alerts)
                </label>
                <input
                  type="tel"
                  placeholder="09171234567"
                  className="w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3.5 text-sm text-white placeholder-white/35 focus:outline-none focus:border-cyan/60 transition"
                />
              </div>
            )}

            <div>
              <div className="flex justify-between items-center mb-1.5">
                <label className="text-[10px] uppercase tracking-[0.2em] text-white/50 font-medium">
                  Password *
                </label>
                {!isSignup && (
                  <button type="button" className="text-xs text-cyan hover:underline">
                    {site.auth.forgot}
                  </button>
                )}
              </div>
              <input
                required
                type="password"
                placeholder="••••••••"
                minLength={6}
                className="w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3.5 text-sm text-white placeholder-white/35 focus:outline-none focus:border-cyan/60 transition"
              />
            </div>

            <button
              type="submit"
              className="w-full py-4 mt-6 rounded-full bg-cyan text-navy font-semibold text-xs uppercase tracking-[0.18em] shadow-[0_10px_30px_-8px_rgba(34,195,238,.7)] hover:brightness-110 active:scale-[.98] transition cursor-pointer"
            >
              {copy.cta}
            </button>
          </form>

          {/* DIVIDER */}
          <div className="relative my-7 text-center">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-white/10" />
            </div>
            <span className="relative bg-[#060b18] px-3 text-[10px] uppercase tracking-widest text-white/35">
              {site.auth.or}
            </span>
          </div>

          {/* GOOGLE / FACEBOOK 2-COL */}
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setStage('app')}
              className="rounded-2xl border border-white/10 bg-white/[0.04] py-3 px-4 text-xs font-medium text-white flex items-center justify-center gap-2 hover:bg-white/10 active:scale-[.98] transition"
            >
              <span className="text-sm">G</span> Google
            </button>
            <button
              type="button"
              onClick={() => setStage('app')}
              className="rounded-2xl border border-white/10 bg-white/[0.04] py-3 px-4 text-xs font-medium text-white flex items-center justify-center gap-2 hover:bg-white/10 active:scale-[.98] transition"
            >
              <span className="text-sm font-bold">f</span> Facebook
            </button>
          </div>

          {/* CONTINUE AS GUEST */}
          <button
            type="button"
            onClick={() => setStage('app')}
            className="w-full mt-3 py-3 rounded-2xl border border-white/10 text-xs text-white/70 hover:bg-white/5 active:scale-[.98] transition tracking-wider uppercase font-medium"
          >
            {site.auth.guest}
          </button>

          {/* BOTTOM MODE SWITCH PINNED */}
          <div className="mt-auto pt-8 text-center text-xs text-white/60">
            {copy.switch}{' '}
            <button
              type="button"
              onClick={() => setAuthMode(isSignup ? 'login' : 'signup')}
              className="text-cyan font-semibold ml-1 underline underline-offset-4 cursor-pointer"
            >
              {copy.switchCta}
            </button>
          </div>
        </div>
      </main>
    );
  }

  // ==========================================
  // STAGE 4: MAIN RESORT APP (16 SECTIONS IN ORDER)
  // ==========================================
  const currentScene = site.hero.scenes[activeScene] || site.hero.scenes[0];

  return (
    <main
      id="main-scroll"
      className="h-[100dvh] w-full overflow-y-auto bg-[#060b18] text-[#e8eef7] animate-fade-in relative selection:bg-cyan selection:text-navy"
    >
      <div className="mx-auto max-w-md min-h-screen flex flex-col relative pb-28">

        {/* 1. TICKER STRIP */}
        <aside
          aria-label="Resort Announcements"
          className="bg-gradient-to-r from-cyan to-sky-500 text-navy py-1.5 text-[10px] font-semibold tracking-wider uppercase overflow-hidden whitespace-nowrap pt-[calc(0.4rem+env(safe-area-inset-top))]"
        >
          <div className="inline-block animate-ticker">
            {[...site.ticker, ...site.ticker, ...site.ticker, ...site.ticker].map((t, idx) => (
              <span key={idx} className="mx-3 inline-flex items-center gap-2">
                <span>✦</span>
                <span>{t}</span>
              </span>
            ))}
          </div>
        </aside>

        {/* 2. STICKY HEADER */}
        <header className="sticky top-0 z-40 bg-[#060b18]/85 backdrop-blur-xl border-b border-white/10 px-5 py-3.5 flex items-center justify-between whitespace-nowrap shrink-0">
          <Logo size="sm" />

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => {
                setAuthMode('login');
                setStage('auth');
              }}
              className="text-xs text-white/70 hover:text-white uppercase tracking-wider font-medium px-2 py-1"
            >
              {site.nav.signIn}
            </button>

            <button
              type="button"
              onClick={() => scrollTo('booking-section')}
              className="rounded-full bg-cyan px-4 py-2 text-navy text-[11px] font-semibold uppercase tracking-wider shadow-[0_4px_16px_-4px_rgba(34,195,238,.7)] hover:brightness-110 active:scale-95 transition"
            >
              {site.nav.book}
            </button>

            {/* 36px hamburger animating to X */}
            <button
              type="button"
              onClick={() => setMenuOpen(!menuOpen)}
              className="w-9 h-9 rounded-full border border-white/15 bg-white/5 flex items-center justify-center text-white shrink-0 hover:bg-white/10 transition active:scale-95 ml-1"
              aria-label="Toggle navigation menu"
            >
              {menuOpen ? (
                <span className="text-lg leading-none font-light">✕</span>
              ) : (
                <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M4 6h16M4 12h16M4 18h16" strokeLinecap="round" />
                </svg>
              )}
            </button>
          </div>
        </header>

        {/* DROPDOWN NAVIGATION MENU */}
        {menuOpen && (
          <nav
            aria-label="Mobile Navigation Menu"
            className="fixed inset-x-0 top-[57px] bottom-0 z-30 bg-[#060b18]/95 backdrop-blur-2xl p-6 flex flex-col justify-between border-b border-white/10 animate-fade-in max-w-md mx-auto"
          >
            <div className="space-y-4 pt-4">
              <span className="text-[10px] uppercase tracking-[0.3em] text-cyan block mb-2">Explore the Resort</span>
              {site.nav.links.map((link, i) => (
                <button
                  key={link}
                  type="button"
                  onClick={() => {
                    const targetMap: Record<string, string> = {
                      'Rooms & Suites': 'rooms-section',
                      Experiences: 'experiences-section',
                      Amenities: 'amenities-section',
                      Dining: 'dining-section',
                      Location: 'location-section',
                      FAQ: 'faq-section',
                    };
                    scrollTo(targetMap[link] || 'rooms-section');
                  }}
                  className="block w-full text-left font-serif text-3xl text-white hover:text-cyan transition py-2 border-b border-white/10"
                >
                  <span className="text-sm font-sans text-cyan/60 mr-3">0{i + 1}</span>
                  {link}
                </button>
              ))}
            </div>

            <div className="pt-6 border-t border-white/10">
              <p className="text-xs text-white/50 mb-3">{site.brand.tagline}</p>
              <div className="flex gap-4 text-xs text-cyan">
                {site.footer.socials.map((s) => (
                  <span key={s} className="hover:underline">{s}</span>
                ))}
              </div>
            </div>
          </nav>
        )}

        {/* 3. HERO SECTION */}
        <section className="min-h-[660px] relative flex flex-col justify-end p-6 pb-28 overflow-hidden select-none">
          {/* Crossfading scenes */}
          {site.hero.scenes.map((sc, idx) => (
            <img
              key={sc.label}
              src={sc.image}
              alt={sc.label}
              className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-1000 ${
                activeScene === idx ? 'opacity-100' : 'opacity-0 pointer-events-none'
              }`}
            />
          ))}

          {/* Navy gradient overlays */}
          <div className="absolute inset-0 bg-gradient-to-t from-[#060b18] via-[#060b18]/45 to-[#060b18]/25 pointer-events-none" />

          {/* Top-Right Ambient Waves Pill */}
          <div className="absolute top-5 right-5 z-10">
            <button
              type="button"
              onClick={toggleAmbientAudio}
              className="rounded-full bg-[#060b18]/80 backdrop-blur-md border border-white/20 px-3.5 py-1.5 text-xs text-white flex items-center gap-2 shadow-lg active:scale-95 transition"
            >
              <span className={`w-2 h-2 rounded-full ${ambientPlaying ? 'bg-emerald-400 animate-pulse' : 'bg-white/40'}`} />
              <span className="text-[11px] font-medium tracking-wide">{site.hero.ambient}</span>
            </button>
          </div>

          <div className="relative z-10">
            <Eyebrow>{site.hero.eyebrow}</Eyebrow>

            <h1 className="text-[48px] sm:text-[52px] font-serif leading-[0.95] text-white mt-2 font-medium">
              {site.hero.title}
              <br />
              <em className="italic text-cyan font-serif">{site.hero.accent}</em>
            </h1>

            <p className="text-[14px] font-light leading-relaxed text-white/80 mt-3 max-w-sm">
              {site.hero.body}
            </p>

            <div className="flex gap-3 mt-5">
              <button
                type="button"
                onClick={() => scrollTo('booking-section')}
                className="rounded-full bg-cyan px-6 py-3.5 text-navy text-xs font-semibold uppercase tracking-[0.18em] shadow-[0_10px_30px_-8px_rgba(34,195,238,.7)] hover:brightness-110 active:scale-95 transition cursor-pointer"
              >
                {site.hero.primary}
              </button>
              <button
                type="button"
                onClick={() => scrollTo('rooms-section')}
                className="rounded-full border border-white/25 text-white backdrop-blur hover:bg-white/10 px-5 py-3.5 text-xs font-semibold uppercase tracking-[0.18em] active:scale-95 transition cursor-pointer"
              >
                {site.hero.secondary}
              </button>
            </div>

            {/* Scene chips */}
            <div className="flex gap-2 mt-6 overflow-x-auto pb-1">
              {site.hero.scenes.map((sc, idx) => (
                <button
                  key={sc.label}
                  type="button"
                  onClick={() => setActiveScene(idx)}
                  className={`rounded-full border px-3 py-1.5 text-[11px] whitespace-nowrap transition cursor-pointer ${
                    activeScene === idx
                      ? 'border-cyan bg-cyan/20 text-cyan font-medium'
                      : 'border-white/15 bg-black/30 text-white/70 hover:border-white/30'
                  }`}
                >
                  {sc.label}
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* 4. BOOKING CARD OVERLAP (-MT-24) */}
        <section id="booking-section" className="-mt-20 relative z-20 px-4">
          <div className="rounded-3xl border border-white/15 bg-[#0b1426]/90 backdrop-blur-2xl p-6 shadow-2xl shadow-black/80">
            <div className="flex justify-between items-center mb-5">
              <h2 className="font-serif text-2xl text-white font-medium">
                {site.booking.title}
              </h2>
              <span className="flex items-center gap-1.5 text-[11px] text-emerald-400 font-semibold tracking-wider uppercase">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                Live rates
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3">
                <label className="text-[10px] uppercase tracking-widest text-white/50 block font-medium">
                  {site.booking.checkIn}
                </label>
                <input
                  type="date"
                  value={checkIn}
                  onChange={(e) => setCheckIn(e.target.value)}
                  className="w-full bg-transparent text-sm text-white focus:outline-none mt-1 font-medium"
                />
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3">
                <label className="text-[10px] uppercase tracking-widest text-white/50 block font-medium">
                  {site.booking.checkOut}
                </label>
                <input
                  type="date"
                  value={checkOut}
                  onChange={(e) => setCheckOut(e.target.value)}
                  className="w-full bg-transparent text-sm text-white focus:outline-none mt-1 font-medium"
                />
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3">
                <label className="text-[10px] uppercase tracking-widest text-white/50 block font-medium">
                  {site.booking.guests}
                </label>
                <select
                  value={guests}
                  onChange={(e) => setGuests(e.target.value)}
                  className="w-full bg-transparent text-sm text-white focus:outline-none mt-1 font-medium"
                >
                  <option value="1 Guest" className="bg-[#0b1426]">1 Guest</option>
                  <option value="2 Guests" className="bg-[#0b1426]">2 Guests</option>
                  <option value="3 Guests" className="bg-[#0b1426]">3 Guests</option>
                  <option value="4 Guests" className="bg-[#0b1426]">4 Guests</option>
                  <option value="5+ Barkada" className="bg-[#0b1426]">5+ Barkada</option>
                </select>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3">
                <label className="text-[10px] uppercase tracking-widest text-white/50 block font-medium">
                  {site.booking.room}
                </label>
                <select
                  value={selectedRoom}
                  onChange={(e) => setSelectedRoom(e.target.value)}
                  className="w-full bg-transparent text-sm text-white focus:outline-none mt-1 font-medium truncate"
                >
                  {site.rooms.items.map((r) => (
                    <option key={r.name} value={r.name} className="bg-[#0b1426]">
                      {r.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                alert(`✦ Availability Verified for ${selectedRoom}: ${checkIn} → ${checkOut} (${guests}). Proceeding to instant SMS confirmation reservation.`);
              }}
              className="w-full py-4 rounded-full bg-cyan text-navy font-semibold text-xs uppercase tracking-[0.18em] shadow-[0_10px_30px_-8px_rgba(34,195,238,.7)] hover:brightness-110 active:scale-[.98] transition cursor-pointer"
            >
              {site.booking.cta}
            </button>

            <p className="text-[11px] text-white/50 text-center mt-3 font-light">
              {site.booking.note}
            </p>
          </div>
        </section>

        {/* 5. STATS */}
        <section className="px-4 pt-10">
          <div className="rounded-3xl border border-white/10 bg-[#0b1426] p-6 grid grid-cols-3 divide-x divide-white/10 text-center">
            {site.stats.map((st) => (
              <div key={st.label} className="px-2">
                <span className="font-serif text-3xl text-cyan block font-medium">{st.value}</span>
                <span className="text-[10px] uppercase tracking-[0.2em] text-white/50 block mt-1 leading-tight">
                  {st.label}
                </span>
              </div>
            ))}
          </div>
        </section>

        {/* 6. ROOMS CAROUSEL */}
        <section id="rooms-section" className="pt-16">
          <div className="px-6">
            <Eyebrow>{site.rooms.eyebrow}</Eyebrow>
            <SectionTitle title={site.rooms.title} />
          </div>

          <div className="flex gap-4 overflow-x-auto snap-x snap-mandatory pt-6 pb-2 px-6">
            {site.rooms.items.map((room) => (
              <article
                key={room.name}
                className="snap-start shrink-0 w-[78%] rounded-3xl border border-white/10 bg-[#0b1426] overflow-hidden group"
              >
                <div className="relative h-56 overflow-hidden">
                  <img
                    src={room.image}
                    alt={room.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition duration-700"
                    loading="lazy"
                  />
                  <span className="absolute bottom-3 left-3 bg-[#060b18]/85 backdrop-blur-md px-3.5 py-1 rounded-full text-xs text-cyan border border-white/10 font-serif">
                    ₱{room.price.toLocaleString()} <span className="text-[10px] text-white/60 font-sans">/night</span>
                  </span>
                </div>
                <div className="p-5 flex items-center justify-between">
                  <div>
                    <h3 className="font-serif text-xl text-white font-medium">{room.name}</h3>
                    <p className="text-xs text-white/50 mt-1 font-light">{room.meta}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedRoom(room.name);
                      scrollTo('booking-section');
                    }}
                    className="w-9 h-9 rounded-full bg-cyan/15 border border-cyan/40 text-cyan flex items-center justify-center shrink-0 hover:bg-cyan hover:text-navy transition cursor-pointer"
                    aria-label={`Select ${room.name}`}
                  >
                    →
                  </button>
                </div>
              </article>
            ))}
          </div>
        </section>

        {/* 7. EXPERIENCES (SAND PANEL) */}
        <section id="experiences-section" className="px-4 pt-16">
          <div className="rounded-3xl bg-[#f4e9d8] text-[#060b18] p-7 border border-[#e8d8be] shadow-xl">
            <Eyebrow light>{site.experiences.eyebrow}</Eyebrow>
            <h2 className="font-serif text-3xl font-medium text-[#060b18] mt-1">
              {site.experiences.title}
            </h2>

            <div className="mt-6 divide-y divide-[#060b18]/10">
              {site.experiences.items.map((exp, idx) => (
                <div key={exp.title} className="py-4 first:pt-2 last:pb-2">
                  <div className="flex items-baseline gap-2.5">
                    <span className="font-serif italic text-sky-700/70 text-lg">0{idx + 1}</span>
                    <h3 className="font-serif text-xl font-medium text-[#060b18]">{exp.title}</h3>
                  </div>
                  <p className="text-sm text-[#060b18]/75 leading-relaxed mt-1.5 font-light">
                    {exp.body}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* 8. AMENITIES */}
        <section id="amenities-section" className="px-6 pt-16">
          <Eyebrow>{site.amenities.eyebrow}</Eyebrow>
          <SectionTitle title={site.amenities.title} />

          <div className="grid grid-cols-2 gap-3 mt-6">
            {site.amenities.items.map((a) => (
              <div
                key={a.label}
                className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 flex items-center gap-3"
              >
                <div className="w-9 h-9 rounded-full bg-cyan/15 border border-cyan/30 flex items-center justify-center text-cyan shrink-0">
                  <span className="text-xs">✦</span>
                </div>
                <span className="text-xs text-white/80 font-medium">{a.label}</span>
              </div>
            ))}
          </div>
        </section>

        {/* 9. GALLERY (2-COL × 3-ROW GRID H-[420PX]) */}
        <section className="px-6 pt-16">
          <Eyebrow>{site.gallery.eyebrow}</Eyebrow>
          <SectionTitle title={site.gallery.title} />

          <div className="grid grid-cols-2 grid-rows-3 gap-2.5 h-[420px] mt-6">
            {site.gallery.images[0] && (
              <div className="row-span-2 rounded-2xl overflow-hidden">
                <img src={site.gallery.images[0]} alt="Gallery 1" className="w-full h-full object-cover" loading="lazy" />
              </div>
            )}
            {site.gallery.images.slice(1, 5).map((img, i) => (
              <div key={i} className="rounded-2xl overflow-hidden">
                <img src={img} alt={`Gallery ${i + 2}`} className="w-full h-full object-cover" loading="lazy" />
              </div>
            ))}
          </div>
        </section>

        {/* 10. REVIEWS (CAROUSEL) */}
        <section className="pt-16">
          <div className="px-6">
            <Eyebrow>{site.reviews.eyebrow}</Eyebrow>
            <SectionTitle title={site.reviews.title} />
          </div>

          <div className="flex gap-4 overflow-x-auto snap-x snap-mandatory pt-6 pb-2 px-6">
            {site.reviews.items.map((rev) => (
              <div
                key={rev.name}
                className="snap-start shrink-0 w-[82%] rounded-3xl border border-white/10 bg-[#0b1426] p-6 flex flex-col justify-between"
              >
                <div>
                  <span className="text-sm tracking-widest text-[#f6b74a] block">★★★★★</span>
                  <p className="font-serif italic text-lg leading-relaxed text-white/90 mt-3">
                    "{rev.quote}"
                  </p>
                </div>

                <div className="flex items-center gap-3 mt-6 pt-4 border-t border-white/10">
                  <div className="w-9 h-9 rounded-full bg-gradient-to-br from-cyan/30 to-sky-600/30 border border-cyan/40 text-cyan flex items-center justify-center font-bold text-xs font-serif">
                    {rev.name[0]}
                  </div>
                  <div>
                    <span className="text-xs font-medium text-white block">{rev.name}</span>
                    <span className="text-[11px] text-white/50 block">{rev.from}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* 11. LOCATION */}
        <section id="location-section" className="px-4 pt-16">
          <div className="rounded-3xl border border-white/10 bg-[#0b1426] p-6 relative overflow-hidden">
            {/* Cyan blur orb */}
            <div className="absolute top-0 right-0 w-48 h-48 bg-cyan/15 rounded-full blur-3xl pointer-events-none" />

            <div className="relative z-10">
              <Eyebrow>{site.location.eyebrow}</Eyebrow>
              <SectionTitle title={site.location.title} />
              <p className="text-sm text-white/70 leading-relaxed mt-2 font-light">
                {site.location.body}
              </p>

              <div className="grid grid-cols-3 gap-2.5 my-6">
                {site.location.facts.map(([val, desc]) => (
                  <div key={desc} className="rounded-2xl border border-white/10 bg-white/[0.04] p-3 text-center">
                    <span className="font-serif text-xl text-cyan block font-medium">{val}</span>
                    <span className="text-[10px] text-white/50 block mt-1 leading-tight">{desc}</span>
                  </div>
                ))}
              </div>

              <a
                href="https://maps.google.com/?q=Patar+Beach+Bolinao+Pangasinan"
                target="_blank"
                rel="noopener noreferrer"
                className="w-full py-3.5 rounded-full border border-white/25 text-white backdrop-blur text-xs font-semibold uppercase tracking-[0.18em] flex items-center justify-center gap-2 hover:bg-white/10 transition"
              >
                <span>📍</span> {site.location.button}
              </a>
            </div>
          </div>
        </section>

        {/* 12. FAQ (ACCORDION) */}
        <section id="faq-section" className="px-6 pt-16">
          <Eyebrow>{site.faq.eyebrow}</Eyebrow>
          <SectionTitle title={site.faq.title} />

          <div className="mt-6 space-y-3">
            {site.faq.items.map((item, idx) => {
              const isOpen = openFaq === idx;
              return (
                <div
                  key={item.q}
                  className="rounded-2xl border border-white/10 bg-[#0b1426] overflow-hidden transition"
                >
                  <button
                    type="button"
                    onClick={() => setOpenFaq(isOpen ? null : idx)}
                    className="w-full p-4 text-left flex items-center justify-between gap-3"
                  >
                    <span className="font-serif text-lg text-white font-medium">{item.q}</span>
                    <span className={`text-cyan text-lg shrink-0 transition-transform duration-300 ${isOpen ? 'rotate-45' : 'rotate-0'}`}>
                      +
                    </span>
                  </button>

                  {isOpen && (
                    <div className="px-4 pb-4 pt-1 text-sm text-white/60 leading-relaxed font-light border-t border-white/5 animate-fade-in">
                      {item.a}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        {/* 13. OFFERS (CAROUSEL WITH CODE COPY) */}
        <section className="pt-16">
          <div className="px-6">
            <Eyebrow>{site.offers.eyebrow}</Eyebrow>
            <SectionTitle title={site.offers.title} />
          </div>

          <div className="flex gap-4 overflow-x-auto snap-x snap-mandatory pt-6 pb-2 px-6">
            {site.offers.items.map((offer, idx) => (
              <div
                key={offer.code}
                className={`snap-start shrink-0 w-[80%] rounded-3xl p-6 flex flex-col justify-between ${
                  idx === 0
                    ? 'bg-gradient-to-br from-cyan to-sky-600 text-navy'
                    : 'border border-white/10 bg-[#0b1426] text-white'
                }`}
              >
                <div>
                  <span className={`text-[10px] uppercase tracking-[0.25em] font-semibold ${idx === 0 ? 'text-navy/70' : 'text-cyan'} block`}>
                    {offer.tag}
                  </span>
                  <h3 className={`font-serif text-2xl font-medium mt-1 leading-tight ${idx === 0 ? 'text-navy' : 'text-white'}`}>
                    {offer.title}
                  </h3>
                  <p className={`text-sm mt-2 leading-relaxed ${idx === 0 ? 'text-navy/85' : 'text-white/60'}`}>
                    {offer.body}
                  </p>
                </div>

                <div className="mt-6 pt-4 border-t border-current/15 flex items-center justify-between">
                  <span className="text-[11px] font-mono tracking-wider opacity-75">PROMO CODE</span>
                  <button
                    type="button"
                    onClick={() => handleCopyCode(offer.code)}
                    className={`border border-dashed px-3 py-1.5 rounded-xl font-mono text-xs font-bold tracking-widest transition cursor-pointer ${
                      copiedCode === offer.code
                        ? 'bg-white text-navy border-white'
                        : idx === 0
                        ? 'border-navy/40 text-navy hover:bg-navy/10'
                        : 'border-cyan/40 text-cyan hover:bg-cyan/10'
                    }`}
                  >
                    {copiedCode === offer.code ? 'Copied ✦' : offer.code}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* 14. DINING */}
        <section id="dining-section" className="px-4 pt-16">
          <div className="rounded-3xl border border-white/10 bg-[#0b1426] overflow-hidden">
            <div className="h-60 relative">
              <img src={site.dining.image} alt={site.dining.title} className="w-full h-full object-cover" loading="lazy" />
              <div className="absolute inset-0 bg-gradient-to-t from-[#0b1426] via-[#0b1426]/30 to-transparent" />
            </div>

            <div className="p-6 -mt-8 relative z-10">
              <Eyebrow>{site.dining.eyebrow}</Eyebrow>
              <SectionTitle title={site.dining.title} />
              <p className="text-sm text-white/70 leading-relaxed mt-2 font-light">
                {site.dining.body}
              </p>

              <div className="mt-6 pt-4 border-t border-white/10 divide-y divide-white/10">
                {site.dining.hours.map(([meal, time]) => (
                  <div key={meal} className="py-2.5 flex justify-between items-center text-xs">
                    <span className="text-white/80 font-medium">{meal}</span>
                    <span className="text-cyan font-mono">{time}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* 15. CTA FULL BLEED */}
        <section className="px-4 pt-16">
          <div className="relative rounded-3xl overflow-hidden p-8 text-center min-h-[380px] flex flex-col items-center justify-center">
            <img src={site.cta.image} alt="Resort Vista" className="absolute inset-0 w-full h-full object-cover" loading="lazy" />
            <div className="absolute inset-0 bg-gradient-to-t from-[#060b18] via-[#060b18]/70 to-[#060b18]" />

            <div className="relative z-10 max-w-xs">
              <Eyebrow>{site.cta.eyebrow}</Eyebrow>
              <h2 className="font-serif text-4xl text-white font-medium mt-2 leading-tight">
                {site.cta.title}
                <br />
                <em className="italic text-cyan font-serif">{site.cta.accent}</em>
              </h2>
              <p className="text-sm text-white/80 mt-3 font-light leading-relaxed">
                {site.cta.body}
              </p>
              <button
                type="button"
                onClick={() => scrollTo('booking-section')}
                className="mt-6 px-8 py-4 rounded-full bg-cyan text-navy font-semibold text-xs uppercase tracking-[0.18em] shadow-[0_10px_30px_-8px_rgba(34,195,238,.7)] hover:brightness-110 active:scale-95 transition cursor-pointer"
              >
                {site.cta.button}
              </button>
            </div>
          </div>
        </section>

        {/* 16. FOOTER */}
        <footer className="pt-20 px-6 border-t border-white/10 mt-16 relative overflow-hidden">
          {/* Giant faint italic 'Beach House' watermark */}
          <span className="absolute -bottom-6 left-0 right-0 text-center font-serif italic text-[72px] sm:text-[90px] text-white/[0.03] select-none pointer-events-none whitespace-nowrap">
            Beach House
          </span>

          <Logo size="md" />
          <p className="text-xs text-white/60 leading-relaxed mt-4 font-light max-w-sm">
            {site.footer.about}
          </p>

          {/* Newsletter */}
          <div className="mt-8 rounded-2xl border border-white/10 bg-white/[0.04] p-5">
            <span className="text-[10px] uppercase tracking-widest text-cyan font-semibold block">
              {site.footer.newsletter.title}
            </span>
            <p className="text-xs text-white/60 mt-1 font-light leading-relaxed">
              {site.footer.newsletter.body}
            </p>

            {newsletterDone ? (
              <p className="text-xs text-emerald-400 font-medium mt-3">
                ✦ You are now subscribed to our private coastal dispatch.
              </p>
            ) : (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (newsletterEmail) setNewsletterDone(true);
                }}
                className="mt-3 flex gap-2"
              >
                <input
                  required
                  type="email"
                  value={newsletterEmail}
                  onChange={(e) => setNewsletterEmail(e.target.value)}
                  placeholder={site.footer.newsletter.placeholder}
                  className="w-full rounded-full border border-white/10 bg-[#060b18] px-4 py-2.5 text-xs text-white placeholder-white/35 focus:outline-none focus:border-cyan/60"
                />
                <button
                  type="submit"
                  className="rounded-full bg-cyan text-navy px-4 py-2.5 text-xs font-semibold uppercase tracking-wider shrink-0 hover:brightness-110"
                >
                  {site.footer.newsletter.button}
                </button>
              </form>
            )}
          </div>

          {/* 2-Col Links */}
          <div className="grid grid-cols-2 gap-6 mt-8 pt-6 border-t border-white/10">
            {site.footer.columns.map((col) => (
              <div key={col.title}>
                <span className="text-[10px] uppercase tracking-widest text-white/40 font-semibold block mb-3">
                  {col.title}
                </span>
                <ul className="space-y-2 text-xs text-white/70">
                  {col.items.map((it) => (
                    <li key={it} className="hover:text-cyan transition cursor-pointer">{it}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          {/* Badges & Payments */}
          <div className="mt-8 pt-6 border-t border-white/10 flex flex-wrap gap-2">
            {site.footer.badges.map((b) => (
              <span key={b} className="text-[10px] text-[#f6b74a] border border-[#f6b74a]/30 bg-[#f6b74a]/10 px-2.5 py-1 rounded-full">
                ★ {b}
              </span>
            ))}
          </div>

          <div className="flex flex-wrap gap-2 mt-4 text-[10px] text-white/40 font-mono">
            {site.footer.payments.map((p) => (
              <span key={p} className="bg-white/5 px-2 py-0.5 rounded border border-white/10">{p}</span>
            ))}
          </div>

          {/* Back to top */}
          <div className="mt-8 text-center">
            <button
              type="button"
              onClick={() => {
                const el = document.getElementById('main-scroll');
                if (el) el.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              className="text-xs text-cyan tracking-wider uppercase font-semibold inline-flex items-center gap-1.5 hover:underline"
            >
              ↑ {site.footer.backToTop}
            </button>
          </div>

          {/* Legal & Copyright */}
          <div className="mt-8 pt-6 border-t border-white/5 text-[10px] text-white/40 flex flex-col gap-2 pb-6">
            <div className="flex justify-center gap-4">
              {site.footer.legal.map((l) => (
                <span key={l} className="hover:underline cursor-pointer">{l}</span>
              ))}
              <a href="/admin" className="hover:underline opacity-50 hover:opacity-100 transition">Portal</a>
            </div>
            <p className="text-center">{site.footer.copyright}</p>
          </div>
        </footer>

        {/* 17. TAB BAR (STICKY BOTTOM-0 FLOATING GLASS PILL) */}
        <nav
          aria-label="Bottom Navigation Bar"
          className="fixed bottom-4 left-4 right-4 max-w-md mx-auto z-40 bg-[#0b1426]/85 backdrop-blur-2xl border border-white/10 rounded-full p-1.5 flex items-center justify-around shadow-2xl shadow-black/80"
        >
          {site.tabs.map((tab) => {
            const isBook = tab === 'Book';
            const isActive = activeTab === tab;

            return (
              <button
                key={tab}
                type="button"
                onClick={() => {
                  setActiveTab(tab);
                  if (tab === 'Book') scrollTo('booking-section');
                  else if (tab === 'Rooms') scrollTo('rooms-section');
                  else if (tab === 'Dining') scrollTo('dining-section');
                  else if (tab === 'Home') {
                    const el = document.getElementById('main-scroll');
                    if (el) el.scrollTo({ top: 0, behavior: 'smooth' });
                  } else if (tab === 'Profile') {
                    setAuthMode('login');
                    setStage('auth');
                  }
                }}
                className={`py-2 px-3 sm:px-4 rounded-full text-xs transition cursor-pointer ${
                  isBook
                    ? 'bg-cyan text-navy font-bold shadow-[0_4px_16px_rgba(34,195,238,.6)]'
                    : isActive
                    ? 'bg-white/10 text-white font-medium'
                    : 'text-white/60 hover:text-white'
                }`}
              >
                {tab}
              </button>
            );
          })}
        </nav>
      </div>
    </main>
  );
}
