import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import '../styles/rooms.css';
import { api } from '../lib/api.ts';
import { money } from '../lib/format.ts';
import { roomImg, roomGallery } from '../lib/images.ts';
import Stars from '../components/Stars.tsx';
import RoomImageCarousel from '../components/RoomImageCarousel.tsx';
import { useReveal } from '../hooks/useReveal.ts';
import { CANONICAL_ROOMS } from '../lib/canonicalRooms.ts';

const CATS = ['All', 'Cottage', 'Garden', 'Suite', 'Villa', 'Dorm'];

function RoomCardItem({ s, index }) {
  const images = useMemo(() => {
    const list = [
      s.image_url,
      ...(Array.isArray(s.images) ? s.images : []),
      ...roomGallery(s.slug),
    ].filter(Boolean);
    return Array.from(new Set(list));
  }, [s.slug, s.image_url, s.images]);

  return (
    <div className="room-card reveal" style={{ transitionDelay: `${(index % 2) * 110}ms` }}>
      {/* AUTO-SCROLLING INTERACTIVE ROOM IMAGE CAROUSEL */}
      <RoomImageCarousel
        images={images}
        roomName={s.name}
        category={s.category}
        slug={s.slug}
        height={220}
        autoScroll={true}
        interval={3500}
      />

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
