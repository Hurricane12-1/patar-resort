import { useEffect, useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import '../styles/home.css';
import BookingFlow from '../components/BookingFlow.tsx';
import Stars from '../components/Stars.tsx';
import { api } from '../lib/api.ts';
import { money, initials } from '../lib/format.ts';
import { IMG, roomImg } from '../lib/images.ts';
import { useReveal } from '../hooks/useReveal.ts';
import { toggleOceanSound, isOceanPlaying, stopOceanSound } from '../lib/oceanSynth.ts';
import ResortMapGeolocation from '../components/ResortMapGeolocation.tsx';
import { dispatchWordPrompt } from '../lib/wordPrompt.ts';
import { CANONICAL_ROOMS } from '../lib/canonicalRooms.ts';

function Counter({ to, decimals = 0, suffix = '' }) {
  const [v, setV] = useState(0);
  const [started, setStarted] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting && !started) { setStarted(true); obs.disconnect(); } },
      { threshold: 0.3 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [started]);

  useEffect(() => {
    if (!started) return;
    let raf;
    const t0 = performance.now(), dur = 1800;
    const step = (t) => {
      const p = Math.min(1, (t - t0) / dur);
      const ease = 1 - Math.pow(1 - p, 4);
      setV(to * ease);
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [started, to]);

  return <span ref={ref}>{v.toLocaleString(undefined, { maximumFractionDigits: decimals, minimumFractionDigits: decimals })}{suffix}</span>;
}

const SCENES = [
  { id: 'sunset', label: '01 · Sunset Cape', img: IMG.hero },
  { id: 'suite', label: '02 · Sea Balcony', img: IMG.suite },
  { id: 'nipa', label: '03 · Nipa Cove', img: IMG.cottage },
  { id: 'island', label: '04 · Island Hopping', img: IMG.island },
];

const RIBBON = ['white sand', 'warm lanterns', 'island hopping', 'sunset at the cape', 'fresh bangus', 'slow mornings', 'salt air'];
const EXP = [
  ['01', 'Cape Bolinao Lighthouse', '10 min'],
  ['02', 'Bolinao Falls', '15 min'],
  ['03', 'Enchanted Cave', '20 min'],
  ['04', 'Patar island hopping', '25 min'],
];

export default function Home() {
  const [rooms, setRooms] = useState(CANONICAL_ROOMS);
  const [reviews, setReviews] = useState([]);
  const [pick, setPick] = useState(null);
  const [activeScene, setActiveScene] = useState(SCENES[0]);
  const [playingAudio, setPlayingAudio] = useState(false);
  const [previewRoom, setPreviewRoom] = useState(null);
  const [pstTime, setPstTime] = useState('');

  useEffect(() => {
    api.rooms().then((data) => {
      if (Array.isArray(data) && data.length > 0) setRooms(data);
    }).catch(() => {});
    api.recentReviews().then(setReviews).catch(() => {});

    const updateClock = () => {
      const now = new Date();
      setPstTime(now.toLocaleTimeString('en-US', { timeZone: 'Asia/Manila', hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    };
    updateClock();
    const interval = setInterval(updateClock, 1000);
    return () => {
      clearInterval(interval);
      stopOceanSound();
    };
  }, []);

  useReveal(rooms);

  const displayRooms = rooms;

  const reserve = (slug) => {
    setPick(slug);
    setPreviewRoom(null);
    document.getElementById('reserve')?.scrollIntoView({ behavior: 'smooth' });
  };

  const toggleSound = () => {
    const newState = toggleOceanSound((active) => setPlayingAudio(active));
    setPlayingAudio(newState);
  };

  return (
    <>
      {/* ——— ACT I · THE SEA ——— */}
      <section className="cine-hero grain">
        <div className="cine-bg" style={{ backgroundImage: `url(${activeScene.img})` }} />
        <div className="cine-scrim" />
        
        {/* ATMOSPHERIC COORDINATES & LIVE TIME */}
        <span className="side-note">
          EST. 2016 · 16°21′ N — 119°56′ E · BOLINAO {pstTime || 'PST'}
        </span>

        {/* FLOATING AMBIENT AUDIO BUTTON */}
        <button
          className={`ambient-toggle ${playingAudio ? 'playing' : ''}`}
          onClick={toggleSound}
          title="Toggle synthesized ocean waves ambience"
        >
          <span className="wave-icon">🌊</span>
          <span>{playingAudio ? 'Ocean Ambience: ON' : 'Ambient Waves'}</span>
        </button>

        <div className="container cine-inner">
          <span className="label light fade-in">J & D Beach House · Bolinao, Pangasinan, Philippines</span>
          <h1 className="cine-h1">
            <span className="mask"><span>Where days slow</span></span>
            <span className="mask d2"><span><em>to the tide.</em></span></span>
          </h1>
          <p className="cine-sub fade-in f1">
            Barefoot cottages, sea-view suites and villas on Pangasinan’s quietest sand —
            ten minutes from the Cape Bolinao lighthouse, a world away from everything else.
          </p>
          
          <div className="cine-ctas fade-in f2">
            <button className="btn btn-sky" onClick={() => reserve(null)}>Reserve your stay</button>
            <Link to="/rooms" className="btn btn-line">Explore the rooms</Link>
          </div>

          {/* SCENE SELECTOR SWITCHER */}
          <div className="scene-switcher fade-in f2">
            {SCENES.map((s) => (
              <button
                key={s.id}
                className={`scene-btn ${activeScene.id === s.id ? 'active' : ''}`}
                onClick={() => setActiveScene(s)}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>
        
        <div className="scroll-cue" />
      </section>

      {/* ——— RESERVATIONS ——— */}
      <BookingFlow initialSlug={pick} />

      {/* ——— ACT II · THE RESORT ——— */}
      <section className="section">
        <div className="container">
          <div className="reveal" style={{ maxWidth: 760 }}>
            <span className="label">The resort</span>
            <h2 style={{ fontSize: 'clamp(2.2rem,4.6vw,3.6rem)', margin: '12px 0 16px' }}>
              Barefoot luxury, <em style={{ fontStyle: 'italic' }}>the Bolinao way.</em>
            </h2>
            <p className="muted" style={{ fontSize: '1.05rem', maxWidth: '60ch' }}>
              No lobby chandeliers, no dress codes — just linen that dries fast, lanterns at dusk,
              a kitchen that smells of grilled bangus, and the sea exactly fifty steps away.
            </p>
          </div>
          <div className="steps" style={{ marginTop: 32 }}>
            {[['18', 'rooms & cottages'], ['50', 'steps to the sand'], ['2016', 'welcoming guests since']].map(([n, l], i) => (
              <div className="step-item reveal" key={l} style={{ transitionDelay: `${i * 120}ms` }}>
                <b className="serif" style={{ fontSize: '2.8rem', color: '#38BDF8' }}>{n}</b>
                <p style={{ textTransform: 'uppercase', letterSpacing: '.18em', fontSize: '.72rem', color: '#94A3B8' }}>{l}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="cine-divider"><span>✦</span></div>

      {/* ——— ACT III · THE ROOMS (editorial spreads) ——— */}
      <section className="section" style={{ paddingTop: 10, paddingBottom: 40 }}>
        <div className="container">
          <div className="sec-head reveal" style={{ marginBottom: 36 }}>
            <div>
              <span className="label">Accommodations</span>
              <h2 className="serif" style={{ fontSize: 'clamp(2rem,4vw,3.2rem)' }}>Featured Rooms & Spreads</h2>
            </div>
            <Link to="/rooms" className="btn btn-ghost btn-sm">All rooms →</Link>
          </div>

          {displayRooms.length === 0 ? (
            <div className="reveal" style={{ padding: '48px 24px', textAlign: 'center', background: 'rgba(255,255,255,0.02)', borderRadius: 16, border: '1px dashed rgba(255,255,255,0.15)', margin: '20px 0 40px' }}>
              <div style={{ fontSize: '2.5rem', marginBottom: 12 }}>🏖️</div>
              <h3 className="serif" style={{ fontSize: '1.5rem', margin: '0 0 8px' }}>Accommodations Awaiting Provisioning</h3>
              <p className="muted" style={{ maxWidth: 520, margin: '0 auto 20px', fontSize: '.9rem', lineHeight: 1.6 }}>
                Resort management is currently updating our active beachfront inventory. Villas, suites, and cottages will be published here upon provisioning.
              </p>
              <Link to="/contact" className="btn btn-ghost btn-sm">Contact Concierge</Link>
            </div>
          ) : (
            displayRooms.slice(0, 4).map((s, i) => (
              <div className={`spread reveal ${i % 2 ? 'flip' : ''}`} key={s.id || s.slug} style={{ marginBottom: 48 }}>
                <div className="sp-img" onClick={() => setPreviewRoom(s)} style={{ cursor: 'pointer' }}>
                  {s.image_url || roomImg(s.slug) ? (
                    <img src={s.image_url || roomImg(s.slug)} alt={s.name} loading="lazy" />
                  ) : (
                    <div style={{ width: '100%', height: 260, background: 'linear-gradient(135deg, rgba(2,132,199,0.18), rgba(14,165,233,0.06))', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 16 }}>
                      <span style={{ fontSize: '4rem', fontWeight: 800, color: '#0EA5E9' }}>
                        {(s.name || 'Room')[0].toUpperCase()}
                      </span>
                    </div>
                  )}
                  <span className="sp-tag">{money(s.rate_php)} / night</span>
                </div>
                <div className="sp-copy">
                  <span className="label">{s.category}</span>
                  <h3 className="serif">{s.name}</h3>
                  <p>{s.description}</p>
                  <div style={{ margin: '14px 0' }}>
                    {s.amenities?.map((a) => (
                      <span
                        key={a}
                        className="tag clickable-prompt-word"
                        onClick={() => dispatchWordPrompt(a, { template: 'Tell me about rooms featuring {word}' })}
                        title={`Click word to type AI prompt: "${a}"`}
                      >
                        {a}
                      </span>
                    ))}
                  </div>
                  <div className="sp-meta">
                    <span>Sleeps<b>{s.capacity}</b></span>
                    <span>Rating<b>★ {Number(s.rating_avg).toFixed(1)}</b></span>
                    <span>Units<b>{s.units}</b></span>
                  </div>
                  <div style={{ display: 'flex', gap: 10 }}>
                    <button className="btn btn-sky" onClick={() => reserve(s.slug)}>Reserve this room</button>
                    <button className="btn btn-ghost btn-sm" onClick={() => setPreviewRoom(s)}>Quick View</button>
                  </div>
                </div>
              </div>
            ))
          )}

          <div style={{ textAlign: 'center', marginTop: 32 }}>
            <Link to="/rooms" className="btn btn-ghost">View all rooms & rates</Link>
          </div>
        </div>
      </section>

      {/* ——— SERIF RIBBON ——— */}
      <div className="ribbon" aria-hidden="true">
        <div className="marquee-track">
          {[...RIBBON, ...RIBBON].map((w, i) => (
            <span
              key={i}
              className="clickable-prompt-word"
              onClick={() => dispatchWordPrompt(w, { template: 'What makes {word} special at J & D Beach House?' })}
              title={`Click word to type AI prompt: "${w}"`}
            >
              {w}<i>✦</i>
            </span>
          ))}
        </div>
      </div>

      {/* ——— ACT IV · BEYOND THE GATE ——— */}
      <section className="exp grain">
        <div className="container">
          <span className="label light reveal">Beyond the gate</span>
          <h2 className="reveal">Bolinao keeps its wonders close.</h2>
          {EXP.map(([n, name, d], i) => (
            <div
              className="exp-item reveal clickable-prompt-word"
              key={n}
              style={{ transitionDelay: `${i * 90}ms`, cursor: 'pointer' }}
              onClick={() => dispatchWordPrompt(name, { template: `How do I visit ${name} (${d} away) from the resort?` })}
              title={`Click to type prompt for ${name}`}
            >
              <span className="n">{n}</span>
              <h3>{name}</h3>
              <span className="d">{d} away</span>
            </div>
          ))}
          <button
            className="btn btn-line"
            style={{ marginTop: 32 }}
            onClick={() => dispatchWordPrompt('Plan my day in Bolinao', { template: 'Can you plan a 1-day itinerary around Bolinao with beach, caves, and dinner?' })}
          >
            Ask J & D Bot to plan your day 💬
          </button>
        </div>
      </section>

      <div className="cine-divider"><span>✦</span></div>

      {/* ——— ACT V · GUEST VOICES ——— */}
      <section className="section">
        <div className="container">
          {reviews[0] && (
            <div className="quote-big reveal">
              <Stars value={reviews[0].rating} size={18} />
              <p style={{ marginTop: 14 }}>{reviews[0].comment || 'Salamat — see you again soon.'}</p>
              <div className="quote-who">
                {reviews[0].profiles?.full_name || 'A guest'} · {reviews[0].rooms?.name}
              </div>
            </div>
          )}
          <div className="reviews-cols" style={{ marginTop: 40 }}>
            {reviews.slice(1, 7).map((r, i) => (
              <div className="review-card reveal" key={r.id} style={{ transitionDelay: `${(i % 3) * 90}ms` }}>
                <Stars value={r.rating} />
                <p>“{r.comment || 'Salamat! See you again soon.'}”</p>
                <div className="reviewer">
                  <span className="avatar">{initials(r.profiles?.full_name)}</span>
                  <span><b style={{ color: '#F8FAFC' }}>{r.profiles?.full_name || 'Guest'}</b><br />{r.rooms?.name}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ——— STATS ——— */}
      <section className="stats-band">
        <div className="container">
          {[
            [<Counter to={18240} />, 'guests hosted'],
            [<Counter to={4.8} decimals={1} />, 'average rating'],
            [<Counter to={41} suffix="%" />, 'returning guests'],
            [<Counter to={26900} />, 'SMS pings sent'],
          ].map(([n, l], i) => (
            <div className="stat reveal" key={l} style={{ transitionDelay: `${i * 100}ms` }}>
              <b>{n}</b><span>{l.toUpperCase()}</span>
            </div>
          ))}
        </div>
      </section>

      {/* ——— RESORT GEOLOCATION & MAP ROUTE PLANNER ——— */}
      <ResortMapGeolocation isLightMode={true} />

      {/* ——— FINALE ——— */}
      <section className="cine-cta grain">
        <div className="scrim" />
        <div className="container">
          <span className="label light">Reservations open</span>
          <h2>The tide is coming in.<br /><em>So are the weekends.</em></h2>
          <p>Lanterns lit at six. Bangus on the grill. Your name on a door.</p>
          <button className="btn btn-sky" onClick={() => reserve(null)}>Book your stay</button>
        </div>
      </section>

      {/* ——— CINEMATIC ROOM PREVIEW MODAL ——— */}
      {previewRoom && (
        <div className="modal-overlay" onClick={() => setPreviewRoom(null)}>
          <div className="modal" style={{ maxWidth: 540 }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-head" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <span className="label light">{previewRoom.category} Accommodations</span>
                <h3 className="serif" style={{ fontSize: '1.8rem', marginTop: 2 }}>{previewRoom.name}</h3>
              </div>
              <button style={{ color: '#fff', fontSize: '1.8rem', border: 'none', background: 'none', cursor: 'pointer' }}
                onClick={() => setPreviewRoom(null)}>×</button>
            </div>
            <div style={{ height: 220, overflow: 'hidden' }}>
              {previewRoom.image_url || roomImg(previewRoom.slug) ? (
                <img src={previewRoom.image_url || roomImg(previewRoom.slug)} alt={previewRoom.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                <div style={{ width: '100%', height: '100%', background: 'linear-gradient(135deg, rgba(2,132,199,0.25), rgba(14,165,233,0.1))', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span style={{ fontSize: '4.5rem', fontWeight: 800, color: '#0EA5E9' }}>
                    {(previewRoom.name || 'R')[0].toUpperCase()}
                  </span>
                </div>
              )}
            </div>
            <div className="modal-body">
              <p style={{ fontSize: '.95rem', color: '#E2E8F0', marginBottom: 16 }}>{previewRoom.description}</p>
              <div style={{ margin: '14px 0' }}>{previewRoom.amenities?.map((a) => <span key={a} className="tag">{a}</span>)}</div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(30,41,59,.6)', padding: 14, borderRadius: 10, marginBottom: 20 }}>
                <div>
                  <small style={{ color: 'var(--muted)', letterSpacing: '.1em', textTransform: 'uppercase' }}>NIGHTLY RATE</small>
                  <div className="serif" style={{ fontSize: '1.6rem', color: '#38BDF8' }}>{money(previewRoom.rate_php)}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <small style={{ color: 'var(--muted)', letterSpacing: '.1em', textTransform: 'uppercase' }}>CAPACITY</small>
                  <div style={{ fontWeight: 700, fontSize: '1.1rem', color: '#F8FAFC' }}>Up to {previewRoom.capacity} Guests</div>
                </div>
              </div>
              <button className="btn btn-sky" style={{ width: '100%', justifyContent: 'center' }} onClick={() => reserve(previewRoom.slug)}>
                Reserve {previewRoom.name} ✦
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
