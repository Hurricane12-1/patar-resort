import { useState, useEffect } from 'react';

// Resort Exact Coordinates: Rock View Beach Resort, Patar Beach Road, Bolinao, Pangasinan
const RESORT_COORDS = {
  lat: 16.3044,
  lng: 119.7828,
  name: 'Rock View Beach Resort',
  address: 'Patar Beach Road, Barangay Patar, Bolinao, 2406 Pangasinan, Philippines',
  googleMapsQuery: 'Rock+View+Beach+Resort,+Patar+Beach+Road,+Bolinao,+Pangasinan',
};

// Key Bolinao Landmarks & Excursions
const NEARBY_LANDMARKS = [
  { name: 'Patar White Sand Beach', dist: '0 km', time: '1 min walk', desc: 'Golden-white sand beach fronting the West Philippine Sea' },
  { name: 'Cape Bolinao Lighthouse', dist: '2.8 km', time: '6 mins drive', desc: 'Historic 1905 Spanish-era beacon standing atop Punta Piedra Point' },
  { name: 'Patar Rock View Formations', dist: '3.5 km', time: '8 mins drive', desc: 'Dramatic rugged limestone cliffs, rock view coves, and coral sea arches' },
  { name: 'Enchanted Cave', dist: '6.2 km', time: '12 mins drive', desc: 'Underground natural limestone cavern with subterranean freshwater pool' },
  { name: 'Bolinao Falls 1 & 2', dist: '14.2 km', time: '25 mins drive', desc: 'Cascading spring waterfalls surrounded by emerald nature' },
];

/**
 * Great-circle distance using Haversine Formula (in km)
 */
function calculateHaversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth radius in km
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export default function ResortMapGeolocation({ isLightMode = true }) {
  const [userLocation, setUserLocation] = useState(null);
  const [locating, setLocating] = useState(false);
  const [locError, setLocError] = useState(null);
  const [distanceKm, setDistanceKm] = useState(null);
  const [mapType, setMapType] = useState('roadmap'); // 'roadmap' | 'satellite'

  // Read Google Maps API key from environment if configured
  const mapsApiKey = typeof import.meta !== 'undefined' && import.meta.env?.VITE_GOOGLE_MAPS_API_KEY;

  const detectLocation = () => {
    if (!navigator.geolocation) {
      setLocError('Geolocation is not supported by your browser.');
      return;
    }

    setLocating(true);
    setLocError(null);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const coords = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        };
        setUserLocation(coords);
        const dist = calculateHaversineKm(coords.lat, coords.lng, RESORT_COORDS.lat, RESORT_COORDS.lng);
        setDistanceKm(Math.round(dist));
        setLocating(false);
      },
      (err) => {
        setLocating(false);
        setLocError(err.message || 'Unable to retrieve your location. Please ensure location permissions are enabled.');
      },
      { timeout: 10000, enableHighAccuracy: true }
    );
  };

  // Google Maps Directions Deep-Link
  const directionsUrl = userLocation
    ? `https://www.google.com/maps/dir/?api=1&origin=${userLocation.lat},${userLocation.lng}&destination=${RESORT_COORDS.lat},${RESORT_COORDS.lng}&travelmode=driving`
    : `https://www.google.com/maps/dir/?api=1&destination=${RESORT_COORDS.lat},${RESORT_COORDS.lng}&travelmode=driving`;

  // Estimate driving time based on distance
  const getEstimatedTravelTime = (km) => {
    if (!km) return null;
    if (km < 10) return `${Math.max(5, Math.round(km * 2.5))} mins`;
    if (km < 50) return `${Math.round(km * 1.5)} mins`;
    const hours = (km / 55).toFixed(1);
    return `~${hours} hrs driving`;
  };

  const themeBg = isLightMode ? '#FFFFFF' : '#0F172A';
  const themeCard = isLightMode ? '#F8FAFC' : '#1E293B';
  const themeText = isLightMode ? '#0F172A' : '#F8FAFC';
  const themeMuted = isLightMode ? '#64748B' : '#94A3B8';
  const themeBorder = isLightMode ? '#E2E8F0' : 'rgba(255, 255, 255, 0.12)';

  return (
    <section
      id="resort-location"
      style={{
        background: themeBg,
        padding: '72px 20px',
        borderTop: `1px solid ${themeBorder}`,
        borderBottom: `1px solid ${themeBorder}`,
        color: themeText,
      }}
    >
      <div style={{ maxWidth: 1240, margin: '0 auto' }}>
        {/* SECTION HEADER */}
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <span
            style={{
              fontSize: '0.78rem',
              fontWeight: 800,
              textTransform: 'uppercase',
              letterSpacing: '0.14em',
              color: '#2563EB',
              background: 'rgba(37, 99, 235, 0.08)',
              padding: '6px 16px',
              borderRadius: 20,
              display: 'inline-block',
              marginBottom: 12,
            }}
          >
            Patar Beach Coastline · Bolinao, Pangasinan
          </span>
          <h2
            style={{
              fontSize: '2.4rem',
              fontWeight: 800,
              margin: '0 0 10px',
              fontFamily: "'Playfair Display', Georgia, serif",
              color: themeText,
            }}
          >
            Resort Geolocation & Route Planner
          </h2>
          <p style={{ fontSize: '1rem', color: themeMuted, maxWidth: 640, margin: '0 auto', lineHeight: 1.6 }}>
            Located directly on the beachfront of Patar Beach Road. Use your GPS location to calculate distance and driving time to your private sea villa.
          </p>
        </div>

        {/* 2-COLUMN LAYOUT: MAP ON LEFT / GEOLOCATION RADAR ON RIGHT */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))',
            gap: 28,
            alignItems: 'start',
          }}
        >
          {/* MAP DISPLAY CARD */}
          <div
            style={{
              background: '#FFFFFF',
              borderRadius: 20,
              border: `1px solid ${themeBorder}`,
              boxShadow: '0 10px 30px rgba(15, 23, 42, 0.06)',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            {/* MAP HEADER CONTROLS */}
            <div
              style={{
                padding: '16px 20px',
                borderBottom: `1px solid ${themeBorder}`,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                background: '#FFFFFF',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <i className="fas fa-location-dot" style={{ fontSize: '1.3rem', color: '#EF4444' }} />
                <div>
                  <b style={{ fontSize: '0.92rem', color: '#0F172A', display: 'block' }}>Rock View Beach Resort</b>
                  <span style={{ fontSize: '0.74rem', color: '#64748B' }}>16.3044° N, 119.7828° E · Seafront</span>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button
                  type="button"
                  onClick={() => setMapType('roadmap')}
                  style={{
                    padding: '5px 12px',
                    borderRadius: 8,
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    border: mapType === 'roadmap' ? '1px solid #2563EB' : `1px solid ${themeBorder}`,
                    background: mapType === 'roadmap' ? '#2563EB' : '#FFFFFF',
                    color: mapType === 'roadmap' ? '#FFFFFF' : '#64748B',
                    cursor: 'pointer',
                  }}
                >
                  Map
                </button>
                <button
                  type="button"
                  onClick={() => setMapType('satellite')}
                  style={{
                    padding: '5px 12px',
                    borderRadius: 8,
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    border: mapType === 'satellite' ? '1px solid #2563EB' : `1px solid ${themeBorder}`,
                    background: mapType === 'satellite' ? '#2563EB' : '#FFFFFF',
                    color: mapType === 'satellite' ? '#FFFFFF' : '#64748B',
                    cursor: 'pointer',
                  }}
                >
                  Satellite
                </button>
              </div>
            </div>

            {/* INTERACTIVE MAP FRAME */}
            <div style={{ width: '100%', height: 400, position: 'relative', background: '#E2E8F0' }}>
              <iframe
                title="Rock View Beach Resort Map"
                width="100%"
                height="100%"
                style={{ border: 0 }}
                loading="lazy"
                allowFullScreen
                referrerPolicy="no-referrer-when-downgrade"
                src={
                  mapsApiKey
                    ? `https://www.google.com/maps/embed/v1/place?key=${mapsApiKey}&q=${RESORT_COORDS.googleMapsQuery}&zoom=15&maptype=${mapType}`
                    : `https://maps.google.com/maps?q=${RESORT_COORDS.lat},${RESORT_COORDS.lng}&hl=en&z=15&t=${mapType === 'satellite' ? 'k' : 'm'}&output=embed`
                }
              />
            </div>

            {/* MAP FOOTER ADDRESS & DIRECTIONS */}
            <div style={{ padding: '16px 20px', background: '#F8FAFC', borderTop: `1px solid ${themeBorder}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
              <span style={{ fontSize: '0.82rem', color: '#475569', maxWidth: 360, lineHeight: 1.4 }}>
                <strong>Address:</strong> Patar Beach Road, Bolinao, 2406 Pangasinan
              </span>
              <a
                href={directionsUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '8px 16px',
                  borderRadius: 10,
                  background: '#2563EB',
                  color: '#FFFFFF',
                  textDecoration: 'none',
                  fontSize: '0.82rem',
                  fontWeight: 700,
                  boxShadow: '0 2px 8px rgba(37, 99, 235, 0.25)',
                }}
              >
                <><i className="fas fa-map-location-dot" style={{ marginRight: 6 }} />Open in Google Maps <i className="fas fa-arrow-up-right-from-square" style={{ marginLeft: 4 }} /></>
              </a>
            </div>
          </div>

          {/* GEOLOCATION RADAR & DISTANCE CALCULATOR */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {/* GPS DETECTOR CARD */}
            <div
              style={{
                background: '#FFFFFF',
                borderRadius: 20,
                border: `1px solid ${themeBorder}`,
                padding: 24,
                boxShadow: '0 10px 30px rgba(15, 23, 42, 0.06)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
                <div
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 12,
                    background: 'rgba(37, 99, 235, 0.1)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '1.3rem',
                  }}
                >
                  <i className="fas fa-compass" style={{ color: '#2563EB' }} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800, color: '#0F172A' }}>
                    Live Distance Calculator
                  </h3>
                  <span style={{ fontSize: '0.78rem', color: '#64748B' }}>Browser GPS Great-Circle Telemetry</span>
                </div>
              </div>

              <p style={{ margin: '0 0 16px', fontSize: '0.86rem', color: '#475569', lineHeight: 1.5 }}>
                Tap below to detect your current coordinates. We will calculate the direct distance and estimated travel time to Rock View Beach Resort.
              </p>

              <button
                type="button"
                onClick={detectLocation}
                disabled={locating}
                style={{
                  width: '100%',
                  padding: '12px 18px',
                  borderRadius: 12,
                  background: locating ? '#94A3B8' : '#2563EB',
                  color: '#FFFFFF',
                  border: 'none',
                  fontWeight: 700,
                  fontSize: '0.9rem',
                  cursor: locating ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  boxShadow: '0 4px 14px rgba(37, 99, 235, 0.25)',
                  transition: 'all 0.2s ease',
                }}
              >
                {locating ? <><i className="fas fa-satellite-dish" style={{ marginRight: 6 }} />Pinpointing Your Coordinates…</> : <><i className="fas fa-crosshairs" style={{ marginRight: 6 }} />Detect My Current Location</>}
              </button>

              {locError && (
                <div
                  style={{
                    marginTop: 12,
                    padding: '10px 14px',
                    borderRadius: 10,
                    background: '#FEF2F2',
                    border: '1px solid #FCA5A5',
                    color: '#B91C1C',
                    fontSize: '0.8rem',
                  }}
                >
                  <><i className="fas fa-triangle-exclamation" style={{ color: '#F59E0B', marginRight: 6 }} />{locError}</>
                </div>
              )}

              {userLocation && (
                <div
                  style={{
                    marginTop: 16,
                    padding: 16,
                    borderRadius: 12,
                    background: '#F8FAFC',
                    border: '1px solid #E2E8F0',
                  }}
                >
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                    <div>
                      <small style={{ fontSize: '0.7rem', color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700 }}>
                        DISTANCE TO RESORT
                      </small>
                      <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#2563EB' }}>
                        {distanceKm} km
                      </div>
                      <span style={{ fontSize: '0.74rem', color: '#64748B' }}>
                        (~{Math.round(distanceKm * 0.621371)} miles)
                      </span>
                    </div>

                    <div>
                      <small style={{ fontSize: '0.7rem', color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700 }}>
                        ESTIMATED TRAVEL
                      </small>
                      <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#0F172A' }}>
                        {getEstimatedTravelTime(distanceKm)}
                      </div>
                      <span style={{ fontSize: '0.74rem', color: '#10B981', fontWeight: 700 }}>
                        Via SCTEX / TPLEX
                      </span>
                    </div>
                  </div>

                  <div style={{ fontSize: '0.76rem', color: '#64748B', borderTop: '1px solid #E2E8F0', paddingTop: 8 }}>
                    Your GPS: <code>{userLocation.lat.toFixed(4)}° N, {userLocation.lng.toFixed(4)}° E</code> (Accuracy ±{Math.round(userLocation.accuracy)}m)
                  </div>
                </div>
              )}
            </div>

            {/* NEARBY EXCURSIONS & LANDMARKS */}
            <div
              style={{
                background: '#FFFFFF',
                borderRadius: 20,
                border: `1px solid ${themeBorder}`,
                padding: 24,
                boxShadow: '0 10px 30px rgba(15, 23, 42, 0.06)',
              }}
            >
              <h4 style={{ margin: '0 0 14px', fontSize: '1rem', fontWeight: 800, color: '#0F172A', display: 'flex', alignItems: 'center', gap: 8 }}>
                <><i className="fas fa-umbrella-beach" style={{ marginRight: 6 }} />Nearby Patar Beach Excursions & Landmarks</>
              </h4>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {NEARBY_LANDMARKS.map((lm, idx) => (
                  <div
                    key={idx}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '10px 14px',
                      borderRadius: 12,
                      background: '#F8FAFC',
                      border: '1px solid #E2E8F0',
                    }}
                  >
                    <div>
                      <b style={{ fontSize: '0.86rem', color: '#0F172A', display: 'block' }}>{lm.name}</b>
                      <span style={{ fontSize: '0.74rem', color: '#64748B' }}>{lm.desc}</span>
                    </div>
                    <div style={{ textAlign: 'right', minWidth: 70 }}>
                      <span style={{ fontSize: '0.82rem', fontWeight: 800, color: '#2563EB', display: 'block' }}>{lm.dist}</span>
                      <small style={{ fontSize: '0.7rem', color: '#10B981', fontWeight: 600 }}>{lm.time}</small>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
