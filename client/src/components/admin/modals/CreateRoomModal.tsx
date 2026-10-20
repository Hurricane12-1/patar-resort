import React from 'react';

export interface CreateRoomModalProps {
  isOpen: boolean;
  onClose: () => void;
  newRoom: any;
  setNewRoom: React.Dispatch<React.SetStateAction<any>>;
  handleCreateRoom: (e: React.FormEvent) => void;
  isLightMode: boolean;
  themeBorder: string;
  themeText: string;
  themeMuted: string;
}

export const CreateRoomModal: React.FC<CreateRoomModalProps> = ({
  isOpen,
  onClose,
  newRoom,
  setNewRoom,
  handleCreateRoom,
  isLightMode,
  themeBorder,
  themeText,
  themeMuted,
}) => {
  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(2, 6, 23, 0.75)',
        backdropFilter: 'blur(8px)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 540,
          background: isLightMode ? '#FFFFFF' : '#0F172A',
          borderRadius: 20,
          border: `1px solid ${themeBorder}`,
          padding: 24,
          boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)',
          maxHeight: '90vh',
          overflowY: 'auto',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, borderBottom: `1px solid ${themeBorder}`, paddingBottom: 12 }}>
          <div>
            <span style={{ fontSize: '.74rem', color: '#0EA5E9', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.08em' }}>ROOM CATALOG</span>
            <h3 style={{ margin: '4px 0 0', fontSize: '1.35rem', color: themeText, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
              <i className="fas fa-hotel" style={{ marginRight: 6 }} />Add New Room
            </h3>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: themeMuted, fontSize: '1.2rem', cursor: 'pointer' }}>
            <i className="fas fa-xmark" />
          </button>
        </div>

        <form onSubmit={handleCreateRoom} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={{ fontSize: '.78rem', color: themeMuted, fontWeight: 700, display: 'block', marginBottom: 4 }}>Room Name *</label>
            <input
              required
              style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: `1px solid ${themeBorder}`, background: isLightMode ? '#F8FAFC' : 'rgba(255,255,255,0.05)', color: themeText }}
              value={newRoom.name}
              onChange={(e) => setNewRoom({ ...newRoom, name: e.target.value })}
              placeholder="e.g. Sunset Luxury Cottage"
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={{ fontSize: '.78rem', color: themeMuted, fontWeight: 700, display: 'block', marginBottom: 4 }}>Category *</label>
              <select
                style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: `1px solid ${themeBorder}`, background: isLightMode ? '#F8FAFC' : '#1E293B', color: themeText }}
                value={newRoom.category}
                onChange={(e) => setNewRoom({ ...newRoom, category: e.target.value })}
              >
                <option value="Cottage">Cottage</option>
                <option value="Villa">Villa</option>
                <option value="Suite">Suite</option>
                <option value="Garden">Garden</option>
                <option value="Dorm">Dorm</option>
              </select>
            </div>
            <div>
              <label style={{ fontSize: '.78rem', color: themeMuted, fontWeight: 700, display: 'block', marginBottom: 4 }}>Nightly Rate (₱) *</label>
              <input
                required
                type="number"
                min={100}
                style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: `1px solid ${themeBorder}`, background: isLightMode ? '#F8FAFC' : 'rgba(255,255,255,0.05)', color: themeText }}
                value={newRoom.rate_php}
                onChange={(e) => setNewRoom({ ...newRoom, rate_php: Number(e.target.value) || 0 })}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={{ fontSize: '.78rem', color: themeMuted, fontWeight: 700, display: 'block', marginBottom: 4 }}>Sleeps Capacity (Guests)</label>
              <input
                required
                type="number"
                min={1}
                max={20}
                style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: `1px solid ${themeBorder}`, background: isLightMode ? '#F8FAFC' : 'rgba(255,255,255,0.05)', color: themeText }}
                value={newRoom.capacity}
                onChange={(e) => setNewRoom({ ...newRoom, capacity: Number(e.target.value) || 1 })}
              />
            </div>
            <div>
              <label style={{ fontSize: '.78rem', color: themeMuted, fontWeight: 700, display: 'block', marginBottom: 4 }}>Total Physical Units</label>
              <input
                required
                type="number"
                min={1}
                max={50}
                style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: `1px solid ${themeBorder}`, background: isLightMode ? '#F8FAFC' : 'rgba(255,255,255,0.05)', color: themeText }}
                value={newRoom.units}
                onChange={(e) => setNewRoom({ ...newRoom, units: Number(e.target.value) || 1 })}
              />
            </div>
          </div>

          <div>
            <label style={{ fontSize: '.78rem', color: themeMuted, fontWeight: 700, display: 'block', marginBottom: 4 }}>Description</label>
            <textarea
              rows={3}
              style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: `1px solid ${themeBorder}`, background: isLightMode ? '#F8FAFC' : 'rgba(255,255,255,0.05)', color: themeText }}
              value={newRoom.description}
              onChange={(e) => setNewRoom({ ...newRoom, description: e.target.value })}
              placeholder="Describe view, ambiance, and special features…"
            />
          </div>

          <div>
            <label style={{ fontSize: '.78rem', color: themeMuted, fontWeight: 700, display: 'block', marginBottom: 4 }}>Amenities (comma separated)</label>
            <input
              style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: `1px solid ${themeBorder}`, background: isLightMode ? '#F8FAFC' : 'rgba(255,255,255,0.05)', color: themeText }}
              value={newRoom.amenities}
              onChange={(e) => setNewRoom({ ...newRoom, amenities: e.target.value })}
              placeholder="Air Conditioning, Free Wi-Fi, Private Bath, Sea View"
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 14, borderTop: `1px solid ${themeBorder}`, paddingTop: 16 }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: '9px 18px',
                borderRadius: 10,
                fontSize: '.82rem',
                fontWeight: 600,
                color: themeMuted,
                background: isLightMode ? '#F1F5F9' : 'rgba(255,255,255,0.05)',
                border: `1px solid ${themeBorder}`,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '9px 24px',
                borderRadius: 10,
                fontSize: '.82rem',
                fontWeight: 800,
                color: '#FFFFFF',
                background: 'linear-gradient(135deg, #0EA5E9, #0284C7)',
                border: 'none',
                boxShadow: '0 4px 14px rgba(14, 165, 233, 0.35)',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              <i className="fas fa-floppy-disk" style={{ marginRight: 6 }} />Save
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
