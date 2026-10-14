import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import '../styles/rooms.css';
import { api } from '../lib/api.ts';
import { money } from '../lib/format.ts';
import { roomImg, roomGallery } from '../lib/images.ts';
import Stars from '../components/Stars.tsx';
import { useReveal } from '../hooks/useReveal.ts';

const CATS = ['All', 'Cottage', 'Garden', 'Suite', 'Villa', 'Dorm'];

function RoomCardItem({ s, index }) {
  const gallery = useMemo(() => roomGallery(s.slug), [s.slug]);
  const [activeImg, setActiveImg] = useState(gallery[0]);

  return (
    <div className="room-card reveal" style={{ transitionDelay: `${(index % 2) * 110}ms` }}>
      {/* MAIN INTERCHANGEABLE DISPLAY IMAGE */}
      <div className="im" style={{ position: 'relative' }}>
        <img src={activeImg} alt={s.name} loading="lazy" style={{ transition: 'opacity 0.3s ease' }} />
        
        {/* INTERCHANGEABLE THUMBNAIL OVERLAY SWITCHER */}
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
  const [all, setAll] = useState([]);
  const [loading, setLoading] = useState(true);
  const [cat, setCat] = useState('All');
  const [q, setQ] = useState('');

  useEffect(() => {
    api.rooms().then((data) => {
      if (Array.isArray(data)) setAll(data);
    }).catch(() => {})
    .finally(() => setLoading(false));
  }, []);

  useReveal(true);

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
        {!loading && list.length === 0 && (
          <p className="empty">No accommodations found in this category. Adjust your filter or search query.</p>
        )}
      </div>
    </section>
  );
}
