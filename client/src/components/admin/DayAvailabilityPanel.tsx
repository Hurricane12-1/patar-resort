export interface PanelPlace {
  id: string;
  name: string;
  /** The rate for an open place, or the guest for a booked one. */
  detail?: string;
}

interface DayAvailabilityPanelProps {
  heading: string;
  summary: string;
  open: PanelPlace[];
  booked: PanelPlace[];
  onBook?: (placeId: string) => void;
  onClose: () => void;
  isLightMode: boolean;
}

export function DayAvailabilityPanel({ heading, summary, open, booked, onBook, onClose, isLightMode }: DayAvailabilityPanelProps) {
  const text = isLightMode ? '#0F172A' : '#F8FAFC';
  const muted = isLightMode ? '#64748B' : '#94A3B8';
  const border = isLightMode ? '#E2E8F0' : 'rgba(255,255,255,0.12)';
  const sectionLabel = { margin: '12px 0 6px', fontSize: '.72rem', fontWeight: 800, letterSpacing: '.06em', textTransform: 'uppercase', color: muted } as const;

  return (
    <section
      aria-label="Rooms open and booked on the chosen date"
      aria-live="polite"
      style={{ margin: '12px 18px', padding: '14px 16px', borderRadius: 8, border: `1px solid ${border}`, background: isLightMode ? '#F8FAFC' : 'rgba(15,23,42,0.6)', color: text }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start' }}>
        <div>
          <p style={{ margin: 0, fontSize: '.95rem', fontWeight: 800 }}>{heading}</p>
          <p style={{ margin: '2px 0 0', fontSize: '.8rem', color: muted }}>{summary}</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          style={{ width: 32, height: 32, border: `1px solid ${border}`, background: 'transparent', color: muted, cursor: 'pointer', fontSize: '1rem', lineHeight: 1 }}
        >
          ×
        </button>
      </div>

      {open.length + booked.length === 0 ? (
        <p style={{ margin: '12px 0 0', fontSize: '.82rem', color: muted }}>No rooms are set up yet.</p>
      ) : (
        <>
          <p style={sectionLabel}>Open ({open.length})</p>
          {open.length === 0 ? (
            <p style={{ margin: 0, fontSize: '.82rem', color: muted }}>Nothing is open on this date.</p>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))', gap: 8 }}>
              {open.map((place) => (
                <div key={place.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '8px 10px', border: `1px solid ${border}`, borderRadius: 8, background: isLightMode ? '#FFFFFF' : 'rgba(255,255,255,0.04)' }}>
                  <span style={{ minWidth: 0 }}>
                    <b style={{ display: 'block', fontSize: '.84rem' }}>{place.name}</b>
                    {place.detail && <span style={{ fontSize: '.72rem', color: muted }}>{place.detail}</span>}
                  </span>
                  {onBook && (
                    <button
                      type="button"
                      onClick={() => onBook(place.id)}
                      style={{ padding: '5px 12px', background: '#006699', color: '#FFFFFF', border: '1px solid #006699', fontSize: '.76rem', fontWeight: 600, cursor: 'pointer' }}
                    >
                      Book
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}

          {booked.length > 0 && (
            <>
              <p style={sectionLabel}>Booked ({booked.length})</p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))', gap: 8 }}>
                {booked.map((place) => (
                  <div key={place.id} style={{ padding: '8px 10px', border: `1px solid ${border}`, borderRadius: 8, opacity: 0.85 }}>
                    <b style={{ display: 'block', fontSize: '.84rem' }}>{place.name}</b>
                    {place.detail && <span style={{ fontSize: '.72rem', color: muted }}>{place.detail}</span>}
                  </div>
                ))}
              </div>
            </>
          )}
        </>
      )}
    </section>
  );
}
