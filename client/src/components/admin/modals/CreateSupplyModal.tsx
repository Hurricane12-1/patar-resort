import React from 'react';

export interface CreateSupplyModalProps {
  isOpen: boolean;
  onClose: () => void;
  newSupply: any;
  setNewSupply: React.Dispatch<React.SetStateAction<any>>;
  handleCreateSupply: (e: React.FormEvent) => void;
  isLightMode: boolean;
  themeBorder: string;
  themeText: string;
  themeMuted: string;
}

export const CreateSupplyModal: React.FC<CreateSupplyModalProps> = ({
  isOpen,
  onClose,
  newSupply,
  setNewSupply,
  handleCreateSupply,
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
          maxWidth: 480,
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
            <span style={{ fontSize: '.74rem', color: '#10B981', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.08em' }}>DEPARTMENT STOCK REGISTRY</span>
            <h3 style={{ margin: '4px 0 0', fontSize: '1.35rem', color: themeText, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
              <i className="fas fa-box" style={{ marginRight: 6 }} />Register Supply Item
            </h3>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: themeMuted, fontSize: '1.2rem', cursor: 'pointer' }}>
            <i className="fas fa-xmark" />
          </button>
        </div>

        <form onSubmit={handleCreateSupply} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={{ fontSize: '.78rem', color: themeMuted, fontWeight: 700, display: 'block', marginBottom: 4 }}>Item Name *</label>
            <input
              required
              style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: `1px solid ${themeBorder}`, background: isLightMode ? '#F8FAFC' : 'rgba(255,255,255,0.05)', color: themeText }}
              value={newSupply.item_name}
              onChange={(e) => setNewSupply({ ...newSupply, item_name: e.target.value })}
              placeholder="e.g. Premium Bath Towels"
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={{ fontSize: '.78rem', color: themeMuted, fontWeight: 700, display: 'block', marginBottom: 4 }}>Department *</label>
              <select
                style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: `1px solid ${themeBorder}`, background: isLightMode ? '#F8FAFC' : '#1E293B', color: themeText }}
                value={newSupply.category}
                onChange={(e) => setNewSupply({ ...newSupply, category: e.target.value })}
              >
                <option value="housekeeping">Housekeeping</option>
                <option value="front_desk">Front Desk</option>
                <option value="kitchen">Kitchen & Dining</option>
                <option value="tours">Tours & Outrigger</option>
                <option value="maintenance">Maintenance</option>
              </select>
            </div>
            <div>
              <label style={{ fontSize: '.78rem', color: themeMuted, fontWeight: 700, display: 'block', marginBottom: 4 }}>Unit *</label>
              <input
                required
                style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: `1px solid ${themeBorder}`, background: isLightMode ? '#F8FAFC' : 'rgba(255,255,255,0.05)', color: themeText }}
                value={newSupply.unit}
                onChange={(e) => setNewSupply({ ...newSupply, unit: e.target.value })}
                placeholder="pcs / sets / bottles"
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={{ fontSize: '.78rem', color: themeMuted, fontWeight: 700, display: 'block', marginBottom: 4 }}>Initial Stock Quantity</label>
              <input
                required
                type="number"
                min={0}
                style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: `1px solid ${themeBorder}`, background: isLightMode ? '#F8FAFC' : 'rgba(255,255,255,0.05)', color: themeText }}
                value={newSupply.stock_qty}
                onChange={(e) => setNewSupply({ ...newSupply, stock_qty: Number(e.target.value) || 0 })}
              />
            </div>
            <div>
              <label style={{ fontSize: '.78rem', color: themeMuted, fontWeight: 700, display: 'block', marginBottom: 4 }}>Reorder Threshold</label>
              <input
                required
                type="number"
                min={1}
                style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: `1px solid ${themeBorder}`, background: isLightMode ? '#F8FAFC' : 'rgba(255,255,255,0.05)', color: themeText }}
                value={newSupply.reorder_at}
                onChange={(e) => setNewSupply({ ...newSupply, reorder_at: Number(e.target.value) || 1 })}
              />
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 8 }}>
            <button type="button" className="btn btn-sm" onClick={onClose} style={{ border: `1px solid ${themeBorder}`, color: themeText }}>
              Cancel
            </button>
            <button type="submit" className="btn btn-sky btn-sm">
              Register Item ✦
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
