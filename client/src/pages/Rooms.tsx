import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import '../styles/rooms.css';
import { api } from '../lib/api.ts';
import { money } from '../lib/format.ts';
import { roomImg, roomGallery } from '../lib/images.ts';
import Stars from '../components/Stars.tsx';
import { useReveal } from '../hooks/useReveal.ts';
import { CANONICAL_ROOMS } from '../lib/canonicalRooms.ts';

const CATS = ['All', 'Cottage', 'Garden', 'Suite', 'Villa', 'Dorm'];

function RoomCardItem({ s, index }) {
  const gallery = useMemo(() => {
    const list = [s.image_url, ...roomGallery(s.slug)].filter(Boolean);
    return Array.from(new Set(list));
  }, [s.slug, s.image_url]);
  const [activeImg, setActiveImg] = useState(gallery[0]);

  useEffect(() => {
    setActiveImg(gallery[0]);
  }, [gallery]);

  return (
    <div className="room-card reveal" style={{ transitionDelay: `${(index % 2) * 110}ms` }}>
      {/* MAIN INTERCHANGEABLE DISPLAY IMAGE */}
      <div className="im" style={{ position: 'relative' }}>
        {activeImg ? (
          <img src={activeImg} alt={s.name} loading="lazy" style={{ transition: 'opacity 0.3s ease' }} />
        ) : (
          <div style={{ width: '100%', height: 210, background: 'linear-gradient(135deg, rgba(2,132,199,0.18), rgba(14,165,233,0.06))', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontSize: '3.5rem', fontWeight: 800, color: '#0EA5E9' }}>
              {(s.name || 'Room')[0].toUpperCase()}
            </span>
          </div>
        )}
        
        {/* INTERCHANGEABLE THUMBNAIL OVERLAY SWITCHER */}
        {gallery.length > 1 && (
          <div style={{ position: 'absolute', bottom: 10, right: 10, display: 'flex', gap: 6, background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(6px)', padding: 4, borderRadius: 8 }}>
            {gallery.map((gUrl, gIdx) => (
              <img
                key={gIdx}
                src={gUrl}
                alt={`View ${gIdx + 1}`}
                onClick={(e) => {
                  e.stopPropagation();
                  setActiveImg(gUrl);
                }}
                style={{
                  width: 28,
                  height: 24,
                  borderRadius: 4,
                  objectFit: 'cover',
                  cursor: 'pointer',
                  border: activeImg === gUrl ? '2px solid #0EA5E9' : '1px solid rgba(255,255,255,0.4)',
                  opacity: activeImg === gUrl ? 1 : 0.65,
                  transition: 'all 0.2s ease',
                }}
              />
            ))}
          </div>
        )}
      </div>

      <div className="bd">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span className="label">{s.category}</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Stars value={Number(s.rating_avg)} size={13} />
            <small className="muted">{Number(s.rating_avg).toFixed(1)} ({s.rating_count || 12})</small>
          </span>
        </div>
        <h3>{s.name}</h3>
        <p className="muted" style={{ fontSize: '.92rem' }}>{s.description}</p>
        <div style={{ margin: '14px 0' }}>{s.amenities?.map((a) => <span key={a} className="tag">{a}</span>)}</div>
        <div className="rate-line">
          <span className="serif">{money(s.rate_php)}<small className="muted" style={{ fontFamily: 'var(--font-sans)' }}> /night</small></span>
          <span className="muted small">sleeps {s.capacity} · {s.units} units</span>
        </div>
        <Link to="/" state={{ book: s.slug }} className="btn btn-sky" style={{ width: '100%', justifyContent: 'center' }}>
          Reserve Room
        </Link>
      </div>
    </div>
  );
}

export default function Rooms() {
  const [all, setAll] = useState(CANONICAL_ROOMS);
  const [loading, setLoading] = useState(false);
  const [cat, setCat] = useState('All');
  const [q, setQ] = useState('');

  useEffect(() => {
    api.rooms().then((data) => {
      if (Array.isArray(data) && data.length > 0) setAll(data);
    }).catch(() => {})
    .finally(() => setLoading(false));
  }, []);

  useReveal(all);

  const list = useMemo(() => all.filter((s) =>
    (cat === 'All' || s.category === cat) &&
    (q === '' || s.name.toLowerCase().includes(q.toLowerCase()))), [all, cat, q]);

  return (
    <section className="section">
      <div className="container">
        <div className="sec-head reveal">
          <div>
            <span className="label">Sleep by the sea</span>
            <h2 style={{ fontSize: 'clamp(2.2rem,4.4vw,3.6rem)' }}>Rooms & <em style={{ fontStyle: 'italic' }}>rates</em></h2>
          </div>
          <input className="search" placeholder="Search rooms…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <div className="chip-row">
          {CATS.map((c) => (
            <button key={c} className={`chip ${cat === c ? 'sel' : ''}`} onClick={() => setCat(c)}>{c}</button>
          ))}
        </div>
        <div className="rooms-grid">
          {list.map((s, i) => (
            <RoomCardItem key={s.id || s.slug} s={s} index={i} />
          ))}
        </div>
        {!loading && all.length === 0 && (
          <div className="reveal" style={{ padding: '60px 24px', textAlign: 'center', background: 'rgba(255,255,255,0.02)', borderRadius: 16, border: '1px dashed rgba(255,255,255,0.15)', margin: '30px 0 60px' }}>
            <div style={{ fontSize: '3rem', marginBottom: 12 }}>🏖️</div>
            <h3 className="serif" style={{ fontSize: '1.6rem', margin: '0 0 8px' }}>Accommodations Awaiting Provisioning</h3>
            <p className="muted" style={{ maxWidth: 540, margin: '0 auto 20px', fontSize: '.92rem', lineHeight: 1.6 }}>
              Resort management is currently updating our active beachfront inventory. Villas, suites, and cottages will be published here upon provisioning.
            </p>
            <Link to="/contact" className="btn btn-sky btn-sm">Contact Concierge</Link>
          </div>
        )}
        {!loading && all.length > 0 && list.length === 0 && (
          <p className="empty">No accommodations found matching "{cat !== 'All' ? cat : q}". Adjust your filter or search query.</p>
        )}
      </div>
    </section>
  );
}
