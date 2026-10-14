import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import '../styles/rooms.css';
import { api } from '../lib/api.ts';
import { money } from '../lib/format.ts';
import { roomImg, roomGallery } from '../lib/images.ts';
import Stars from '../components/Stars.tsx';
import { useReveal } from '../hooks/useReveal.ts';

const CATS = ['All', 'Cottage', 'Garden', 'Suite', 'Villa', 'Dorm'];

const DEFAULT_ROOMS = [
  { id: 'tev', name: 'Unit TEV Grand Villa', slug: 'unit-tev', category: 'Villa', description: 'Grand beachfront group villa for large gatherings, family reunions, and corporate retreats. Sleeps up to 60 guests.', capacity: 60, units: 1, rate_php: 18000, rating_avg: 5.0, rating_count: 42, amenities: ['AC', 'Sea view', 'Kitchen', 'Grill', 'Karaoke', 'Porch'] },
  { id: 'gel', name: 'Unit GEL Premier Suite', slug: 'unit-gel', category: 'Suite', description: 'Spacious group suite overlooking the Patar white beach coastline. Sleeps up to 25 guests.', capacity: 25, units: 1, rate_php: 12000, rating_avg: 4.9, rating_count: 36, amenities: ['AC', 'Balcony', 'Hot shower', 'WiFi', 'Kitchenette'] },
  { id: 'cat', name: 'Unit CAT Cottage (Unit Papang)', slug: 'unit-cat', category: 'Cottage', description: 'Native beachfront cottage with direct sand access. Also known in logbooks as Unit Papang. Sleeps up to 10 guests.', capacity: 10, units: 1, rate_php: 6000, rating_avg: 4.8, rating_count: 29, amenities: ['Fan', 'AC', 'WiFi', 'Porch', 'Hot shower'] },
  { id: '1', name: 'Habagat Sea-View Suite', slug: 'habagat-suite', category: 'Suite', description: 'Front suite with private balcony hanging over the turquoise ocean.', capacity: 3, units: 4, rate_php: 2950, rating_avg: 4.9, rating_count: 38, amenities: ['AC', 'Sea view', 'Balcony', 'Breakfast'] },
  { id: '2', name: 'Nipa Cove Cottage', slug: 'nipa-cove', category: 'Cottage', description: 'Native nipa cottage steps from the sand with fan cooling and hammock porch.', capacity: 2, units: 6, rate_php: 1450, rating_avg: 4.8, rating_count: 52, amenities: ['Fan', 'Hot shower', 'WiFi', 'Porch'] },
  { id: '3', name: 'Duyan Family Villa', slug: 'duyan-villa', category: 'Villa', description: 'Two-bedroom family villa with private outdoor hammock deck & barbecue grill.', capacity: 6, units: 3, rate_php: 4800, rating_avg: 5.0, rating_count: 24, amenities: ['AC', 'Kitchenette', 'Grill deck', 'WiFi'] },
  { id: '4', name: 'Garden Breeze Room', slug: 'garden-breeze', category: 'Garden', description: 'Air-conditioned room looking out onto lush mango gardens.', capacity: 2, units: 8, rate_php: 1850, rating_avg: 4.9, rating_count: 41, amenities: ['AC', 'WiFi', 'Hot shower', 'Breakfast'] },
  { id: '5', name: 'Backpacker Bunk Suite', slug: 'backpacker-bunk', category: 'Dorm', description: 'Cozy air-conditioned shared bunk suite steps away from Patar beach front.', capacity: 1, units: 12, rate_php: 750, rating_avg: 4.7, rating_count: 65, amenities: ['AC', 'Lockers', 'Shared Bath', 'WiFi'] },
];

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
  const [cat, setCat] = useState('All');
  const [q, setQ] = useState('');

  useEffect(() => {
    api.rooms().then((data) => {
      if (Array.isArray(data) && data.length > 0) setAll(data);
    }).catch(() => {});
  }, []);

  useReveal(true);

  const displayRooms = all.length > 0 ? all : DEFAULT_ROOMS;

  const list = useMemo(() => displayRooms.filter((s) =>
    (cat === 'All' || s.category === cat) &&
    (q === '' || s.name.toLowerCase().includes(q.toLowerCase()))), [displayRooms, cat, q]);

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
        {list.length === 0 && <p className="empty">No rooms match — try another filter.</p>}
      </div>
    </section>
  );
}
