import React from 'react';
import {
  OfferingType,
  OfferingSpecs,
  ROOM_CATEGORIES,
  COTTAGE_CATEGORIES,
  OFFER_CATEGORIES,
  getDefaultSpecs,
} from '../../../lib/offeringSpecs';

interface OfferingSpecsFieldsProps {
  offeringType: OfferingType;
  onOfferingTypeChange: (nextType: OfferingType, nextCategory: string, nextSpecs: OfferingSpecs) => void;
  specs: OfferingSpecs;
  onSpecsChange: (nextSpecs: OfferingSpecs) => void;
  isLightMode: boolean;
  themeBorder: string;
  themeText: string;
  themeMuted: string;
  idPrefix?: string;
}

const TYPE_OPTIONS: { key: OfferingType; label: string; icon: string; badgeBg: string; badgeFg: string; border: string }[] = [
  { key: 'room', label: 'Room', icon: 'fas fa-bed', badgeBg: '#E0F2FE', badgeFg: '#00517A', border: '#006699' },
  { key: 'cottage', label: 'Cottage', icon: 'fas fa-umbrella-beach', badgeBg: '#D1FAE5', badgeFg: '#065F46', border: '#047857' },
  { key: 'offer', label: 'Island Tour / Offer', icon: 'fas fa-ship', badgeBg: '#FEF3C7', badgeFg: '#78350F', border: '#B45309' },
];

export const getCategoryOptionsForType = (type: OfferingType): string[] => {
  if (type === 'cottage') return COTTAGE_CATEGORIES;
  if (type === 'offer') return OFFER_CATEGORIES;
  return ROOM_CATEGORIES;
};

export const OfferingSpecsFields: React.FC<OfferingSpecsFieldsProps> = ({
  offeringType,
  onOfferingTypeChange,
  specs,
  onSpecsChange,
  isLightMode,
  themeBorder,
  themeText,
  themeMuted,
  idPrefix = 'offer',
}) => {
  const inputBg = isLightMode ? '#F8FAFC' : 'rgba(255,255,255,0.06)';
  const selectBg = isLightMode ? '#F8FAFC' : '#1E293B';
  const cardBg = isLightMode ? '#F8FAFC' : 'rgba(15,23,42,0.55)';

  const fieldStyle: React.CSSProperties = {
    width: '100%',
    padding: '9px 12px',
    borderRadius: 10,
    border: `1px solid ${themeBorder}`,
    background: inputBg,
    color: themeText,
    fontSize: '.86rem',
  };

  const selectStyle: React.CSSProperties = {
    ...fieldStyle,
    background: selectBg,
    fontWeight: 600,
    cursor: 'pointer',
  };

  const labelStyle: React.CSSProperties = {
    fontSize: '.76rem',
    color: themeMuted,
    fontWeight: 700,
    display: 'block',
    marginBottom: 4,
  };

  const updateSpec = (key: keyof OfferingSpecs, value: unknown) => {
    onSpecsChange({ ...(specs || {}), [key]: value });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Offering Classification Tabs */}
      <div>
        <span style={labelStyle}>Listing Type *</span>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 8 }}>
          {TYPE_OPTIONS.map((opt) => {
            const active = offeringType === opt.key;
            return (
              <button
                key={opt.key}
                type="button"
                onClick={() => {
                  if (opt.key === offeringType) return;
                  const nextCat = getCategoryOptionsForType(opt.key)[0];
                  onOfferingTypeChange(opt.key, nextCat, getDefaultSpecs(opt.key));
                }}
                style={{
                  minHeight: 44,
                  padding: '8px 10px',
                  borderRadius: 10,
                  border: active ? `2px solid ${opt.border}` : `1px solid ${themeBorder}`,
                  background: active ? (isLightMode ? opt.badgeBg : 'rgba(15, 23, 42, 0.9)') : cardBg,
                  color: active ? (isLightMode ? opt.badgeFg : '#F8FAFC') : themeText,
                  fontWeight: 700,
                  fontSize: '.82rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                }}
              >
                <i className={opt.icon} />
                <span>{opt.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Type-Specific Specifications Panel */}
      <div
        style={{
          padding: 14,
          borderRadius: 12,
          border: `1px solid ${themeBorder}`,
          background: cardBg,
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
        }}
      >
        <div style={{ fontSize: '.76rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.06em', color: themeText }}>
          {offeringType === 'room' && 'Room Specifications'}
          {offeringType === 'cottage' && 'Cottage Specifications'}
          {offeringType === 'offer' && 'Island Tour & Offer Specifications'}
        </div>

        {offeringType === 'room' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <label htmlFor={`${idPrefix}-bed-config`} style={labelStyle}>Bed Configuration</label>
              <input
                id={`${idPrefix}-bed-config`}
                style={fieldStyle}
                value={String(specs?.bed_config || '')}
                onChange={(e) => updateSpec('bed_config', e.target.value)}
                placeholder="e.g. 1 Queen Bed, 1 Extra Pull-out"
              />
            </div>
            <div>
              <label htmlFor={`${idPrefix}-bath-type`} style={labelStyle}>Bathroom Type</label>
              <select
                id={`${idPrefix}-bath-type`}
                style={selectStyle}
                value={String(specs?.bathroom_type || 'Private En-Suite')}
                onChange={(e) => updateSpec('bathroom_type', e.target.value)}
              >
                <option value="Private En-Suite">Private En-Suite</option>
                <option value="Private Bath (Hot/Cold Shower)">Private Bath (Hot/Cold Shower)</option>
                <option value="Shared Bathroom">Shared Bathroom</option>
              </select>
            </div>
            <div>
              <label htmlFor={`${idPrefix}-climate`} style={labelStyle}>Cooling &amp; Climate</label>
              <select
                id={`${idPrefix}-climate`}
                style={selectStyle}
                value={String(specs?.climate_control || 'Split Air-Conditioned')}
                onChange={(e) => updateSpec('climate_control', e.target.value)}
              >
                <option value="Split Air-Conditioned">Split Air-Conditioned</option>
                <option value="Window Air-Conditioned">Window Air-Conditioned</option>
                <option value="Fan / Coastal Breeze">Fan / Coastal Breeze</option>
              </select>
            </div>
            <div>
              <label htmlFor={`${idPrefix}-wing`} style={labelStyle}>Floor / Wing</label>
              <input
                id={`${idPrefix}-wing`}
                style={fieldStyle}
                value={String(specs?.floor_wing || '')}
                onChange={(e) => updateSpec('floor_wing', e.target.value)}
                placeholder="e.g. Ground Floor, Sunset Wing"
              />
            </div>
          </div>
        )}

        {offeringType === 'cottage' && (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div>
                <label htmlFor={`${idPrefix}-cottage-style`} style={labelStyle}>Cottage Structure</label>
                <select
                  id={`${idPrefix}-cottage-style`}
                  style={selectStyle}
                  value={String(specs?.cottage_style || 'Open-Air Nipa Cottage')}
                  onChange={(e) => updateSpec('cottage_style', e.target.value)}
                >
                  <option value="Open-Air Nipa Cottage">Open-Air Nipa Cottage</option>
                  <option value="Beachfront Kubo Pavilion">Beachfront Kubo Pavilion</option>
                  <option value="Elevated Cliff Cabana">Elevated Cliff Cabana</option>
                  <option value="Enclosed Family Cottage">Enclosed Family Cottage</option>
                </select>
              </div>
              <div>
                <label htmlFor={`${idPrefix}-cottage-usage`} style={labelStyle}>Usage Mode</label>
                <select
                  id={`${idPrefix}-cottage-usage`}
                  style={selectStyle}
                  value={String(specs?.usage_mode || 'Day Use & Overnight')}
                  onChange={(e) => updateSpec('usage_mode', e.target.value)}
                >
                  <option value="Day Use & Overnight">Day Use &amp; Overnight</option>
                  <option value="Day Use Only (07:00 AM - 06:00 PM)">Day Use Only (07:00 AM - 06:00 PM)</option>
                  <option value="Overnight Cottage">Overnight Cottage</option>
                </select>
              </div>
              <div>
                <label htmlFor={`${idPrefix}-shoreline`} style={labelStyle}>Shoreline Proximity</label>
                <select
                  id={`${idPrefix}-shoreline`}
                  style={selectStyle}
                  value={String(specs?.beachfront_proximity || 'Steps from Shoreline')}
                  onChange={(e) => updateSpec('beachfront_proximity', e.target.value)}
                >
                  <option value="Direct Sand / Beachfront">Direct Sand / Beachfront</option>
                  <option value="Steps from Shoreline">Steps from Shoreline</option>
                  <option value="Coconut Grove / Shaded Lawn">Coconut Grove / Shaded Lawn</option>
                </select>
              </div>
              <div>
                <label htmlFor={`${idPrefix}-seating`} style={labelStyle}>Tables &amp; Seating</label>
                <input
                  id={`${idPrefix}-seating`}
                  style={fieldStyle}
                  value={String(specs?.seating_tables || '')}
                  onChange={(e) => updateSpec('seating_tables', e.target.value)}
                  placeholder="e.g. Hardwood Table & Benches"
                />
              </div>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, paddingTop: 4 }}>
              <label htmlFor={`${idPrefix}-grill`} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: '.84rem', color: themeText, minHeight: 36 }}>
                <input
                  id={`${idPrefix}-grill`}
                  type="checkbox"
                  checked={Boolean(specs?.grilling_area)}
                  onChange={(e) => updateSpec('grilling_area', e.target.checked)}
                />
                <span>Grilling Area Available</span>
              </label>
              <label htmlFor={`${idPrefix}-outlet`} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: '.84rem', color: themeText, minHeight: 36 }}>
                <input
                  id={`${idPrefix}-outlet`}
                  type="checkbox"
                  checked={Boolean(specs?.power_outlet)}
                  onChange={(e) => updateSpec('power_outlet', e.target.checked)}
                />
                <span>Power Outlet &amp; Lighting</span>
              </label>
            </div>
          </>
        )}

        {offeringType === 'offer' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <label htmlFor={`${idPrefix}-offer-subtype`} style={labelStyle}>Offer Type</label>
              <select
                id={`${idPrefix}-offer-subtype`}
                style={selectStyle}
                value={String(specs?.offer_subtype || 'Island Hopping Tour')}
                onChange={(e) => updateSpec('offer_subtype', e.target.value)}
              >
                <option value="Island Hopping Tour">Island Hopping Tour</option>
                <option value="Snorkeling & Reef Tour">Snorkeling &amp; Reef Tour</option>
                <option value="Sunset Boat Cruise">Sunset Boat Cruise</option>
                <option value="Watersports Offer">Watersports Offer</option>
                <option value="Resort Activity Package">Resort Activity Package</option>
              </select>
            </div>
            <div>
              <label htmlFor={`${idPrefix}-pricing-mode`} style={labelStyle}>Pricing Basis</label>
              <select
                id={`${idPrefix}-pricing-mode`}
                style={selectStyle}
                value={String(specs?.pricing_mode || 'per_group')}
                onChange={(e) => updateSpec('pricing_mode', e.target.value === 'per_pax' ? 'per_pax' : 'per_group')}
              >
                <option value="per_group">Flat Rate per Boat / Group Trip</option>
                <option value="per_pax">Per Guest Rate (multiplied by guests)</option>
              </select>
            </div>
            <div>
              <label htmlFor={`${idPrefix}-duration`} style={labelStyle}>Duration</label>
              <input
                id={`${idPrefix}-duration`}
                style={fieldStyle}
                value={String(specs?.duration || '')}
                onChange={(e) => updateSpec('duration', e.target.value)}
                placeholder="e.g. 4 Hours (Half Day)"
              />
            </div>
            <div>
              <label htmlFor={`${idPrefix}-departure`} style={labelStyle}>Departure Schedule</label>
              <input
                id={`${idPrefix}-departure`}
                style={fieldStyle}
                value={String(specs?.departure_schedule || '')}
                onChange={(e) => updateSpec('departure_schedule', e.target.value)}
                placeholder="e.g. 08:00 AM Daily"
              />
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <label htmlFor={`${idPrefix}-destinations`} style={labelStyle}>Destinations / Stops</label>
              <input
                id={`${idPrefix}-destinations`}
                style={fieldStyle}
                value={String(specs?.destinations || '')}
                onChange={(e) => updateSpec('destinations', e.target.value)}
                placeholder="e.g. Patar Coral Garden, Sandbar, Limestone Caves"
              />
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <label htmlFor={`${idPrefix}-inclusions`} style={labelStyle}>Boat &amp; Tour Inclusions</label>
              <input
                id={`${idPrefix}-inclusions`}
                style={fieldStyle}
                value={String(specs?.inclusions || '')}
                onChange={(e) => updateSpec('inclusions', e.target.value)}
                placeholder="e.g. Motorized Bangka Boat, Boatman/Guide, Life Vests, Snorkel Mask"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
