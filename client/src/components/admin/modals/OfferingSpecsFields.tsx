import React from 'react';
import {
  OfferingType,
  OfferingSpecs,
  ROOM_CATEGORIES,
  VILLA_CATEGORIES,
  SUITE_CATEGORIES,
  COTTAGE_CATEGORIES,
  CABANA_CATEGORIES,
  OFFER_CATEGORIES,
  EVENT_CATEGORIES,
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
  { key: 'room', label: 'Room (Overnight)', icon: 'fas fa-bed', badgeBg: '#E0F2FE', badgeFg: '#00517A', border: '#006699' },
  { key: 'cottage', label: 'Cottage (Beachfront Day-Use)', icon: 'fas fa-umbrella-beach', badgeBg: '#D1FAE5', badgeFg: '#065F46', border: '#047857' },
];

export const getCategoryOptionsForType = (type: OfferingType): readonly string[] => {
  let list: readonly string[];
  switch (type) {
    case 'villa': list = VILLA_CATEGORIES; break;
    case 'suite': list = SUITE_CATEGORIES; break;
    case 'cottage': list = COTTAGE_CATEGORIES; break;
    case 'cabana': list = CABANA_CATEGORIES; break;
    case 'offer': list = OFFER_CATEGORIES; break;
    case 'event': list = EVENT_CATEGORIES; break;
    case 'room':
    default: list = ROOM_CATEGORIES; break;
  }
  return list.filter((item) => item !== 'Rooms' && item !== 'Villas' && item !== 'Suites' && item !== 'Cottages' && item !== 'Cabanas');
};

const BATHROOM_PRESETS = [
  'Private En-Suite',
  'Private Bath (Hot/Cold Shower)',
  'Private Ocean En-Suite + Tub',
  'Luxury Marble Bath & Rain Shower',
  'Shared Bathroom',
] as const;

const CLIMATE_PRESETS = [
  'Split Air-Conditioned',
  'Dual Split Inverter AC',
  'Silent Inverter Air-Conditioned',
  'Window Air-Conditioned',
  'Fan / Coastal Breeze',
] as const;

const COTTAGE_STYLE_PRESETS = [
  'Open-Air Nipa Cottage',
  'Beachfront Kubo Pavilion',
  'Elevated Cliff Cabana',
  'Enclosed Family Cottage',
  'Shaded Poolside / Garden Cabana',
  'Luxury Daybed Cabana',
  'Beachfront Covered Function Pavilion',
] as const;

const USAGE_MODE_PRESETS = [
  'Day Use & Overnight',
  'Day Use Only (07:00 AM - 06:00 PM)',
  'Overnight Cottage',
  'Day Use & Evening Rental',
  'Banquet & Group Gathering (Up to 50 pax)',
] as const;

const SHORELINE_PRESETS = [
  'Direct Sand / Beachfront',
  'Steps from Shoreline',
  'Coconut Grove / Shaded Lawn',
  'Boardwalk & Poolside Area',
  'Cliffside Oceanfront Deck',
] as const;

const TOUR_SUBTYPE_PRESETS = [
  'Guided Island Hopping Tour',
  'Private Motorized Bangka Charter',
  'Coral Reef Snorkeling Tour',
  'Sunset Coastal Cruise',
  'Fishing & Caving Excursion',
] as const;

interface CustomizableDropdownProps {
  id: string;
  label: string;
  value: string;
  onChange: (val: string) => void;
  options: readonly string[];
  isLightMode: boolean;
  themeBorder: string;
  themeText: string;
  themeMuted: string;
}

const CustomizableDropdown: React.FC<CustomizableDropdownProps> = ({
  id,
  label,
  value,
  onChange,
  options,
  isLightMode,
  themeBorder,
  themeText,
  themeMuted,
}) => {
  const selectBg = isLightMode ? '#F8FAFC' : '#1E293B';
  const choices: readonly string[] = value && !options.includes(value) ? [value, ...options] : options;

  return (
    <div>
      <label htmlFor={id} style={{ display: 'block', fontSize: '.76rem', color: themeMuted, fontWeight: 700, marginBottom: 4 }}>
        {label}
      </label>
      <select
        id={id}
        style={{
          width: '100%',
          minWidth: 0,
          boxSizing: 'border-box',
          padding: '9px 12px',
          borderRadius: 10,
          border: `1px solid ${themeBorder}`,
          background: selectBg,
          color: themeText,
          fontWeight: 600,
          fontSize: '.84rem',
          cursor: 'pointer',
        }}
        value={choices.includes(value) ? value : choices[0]}
        onChange={(e) => onChange(e.target.value)}
      >
        {choices.map((opt) => (
          <option key={opt} value={opt}>
            {opt}
          </option>
        ))}
      </select>
    </div>
  );
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
  const cardBg = isLightMode ? '#F8FAFC' : 'rgba(15,23,42,0.55)';


  const fieldStyle: React.CSSProperties = {
    width: '100%',
    minWidth: 0,
    boxSizing: 'border-box',
    padding: '9px 12px',
    borderRadius: 10,
    border: `1px solid ${themeBorder}`,
    background: inputBg,
    color: themeText,
    fontSize: '.86rem',
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

  const isLodgingUnit = ['room', 'villa', 'suite'].includes(offeringType);
  const isCottageUnit = ['cottage', 'cabana'].includes(offeringType);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Offering Classification Tabs */}
      <div>
        <span style={labelStyle}>Accommodation Classification &amp; Category *</span>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8 }}>
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
          gap: 12,
        }}
      >
        <div style={{ fontSize: '.76rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.06em', color: themeText }}>
          {offeringType === 'room' && 'Room Specifications'}
          {offeringType === 'villa' && 'Villa Specifications (Oceanfront)'}
          {offeringType === 'suite' && 'Suite Specifications (Loft & Deck)'}
          {offeringType === 'cottage' && 'Cottage Specifications (Day-Use)'}
          {offeringType === 'cabana' && 'Cabana Specifications (Pool & Garden)'}
          {offeringType === 'offer' && 'Island Tour & Charter Specifications'}
          {offeringType === 'event' && 'Event Pavilion Specifications'}
        </div>

        {/* 1. ROOM / VILLA / SUITE SPECIFICATIONS */}
        {isLodgingUnit && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10 }}>
            <div>
              <label htmlFor={`${idPrefix}-bed-config`} style={labelStyle}>Bed Configuration</label>
              <input
                id={`${idPrefix}-bed-config`}
                style={fieldStyle}
                value={String(specs?.bed_config || '')}
                onChange={(e) => updateSpec('bed_config', e.target.value)}
                placeholder="e.g. 1 King Bed, 1 Extra Pull-out"
              />
            </div>

            <CustomizableDropdown
              id={`${idPrefix}-bath-type`}
              label="Bathroom Type"
              value={String(specs?.bathroom_type || 'Private En-Suite')}
              onChange={(val) => updateSpec('bathroom_type', val)}
              options={BATHROOM_PRESETS}
              isLightMode={isLightMode}
              themeBorder={themeBorder}
              themeText={themeText}
              themeMuted={themeMuted}
            />

            <CustomizableDropdown
              id={`${idPrefix}-climate`}
              label="Cooling & Climate"
              value={String(specs?.climate_control || 'Split Air-Conditioned')}
              onChange={(val) => updateSpec('climate_control', val)}
              options={CLIMATE_PRESETS}
              isLightMode={isLightMode}
              themeBorder={themeBorder}
              themeText={themeText}
              themeMuted={themeMuted}
            />

            <div>
              <label htmlFor={`${idPrefix}-wing`} style={labelStyle}>Floor / Wing</label>
              <input
                id={`${idPrefix}-wing`}
                style={fieldStyle}
                value={String(specs?.floor_wing || '')}
                onChange={(e) => updateSpec('floor_wing', e.target.value)}
                placeholder="e.g. Upper Terrace, Oceanfront Wing"
              />
            </div>

            <div style={{ gridColumn: 'span 2' }}>
              <label htmlFor={`${idPrefix}-view-type`} style={labelStyle}>View &amp; Deck Outlook</label>
              <input
                id={`${idPrefix}-view-type`}
                style={fieldStyle}
                value={String(specs?.view_type || '')}
                onChange={(e) => updateSpec('view_type', e.target.value)}
                placeholder="e.g. Direct Sunset Ocean View, Private Veranda"
              />
            </div>
          </div>
        )}

        {/* 2. COTTAGE / CABANA SPECIFICATIONS */}
        {isCottageUnit && (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10 }}>
              <CustomizableDropdown
                id={`${idPrefix}-cottage-style`}
                label="Cottage / Cabana Structure"
                value={String(specs?.cottage_style || 'Open-Air Nipa Cottage')}
                onChange={(val) => updateSpec('cottage_style', val)}
                options={COTTAGE_STYLE_PRESETS}
                isLightMode={isLightMode}
                themeBorder={themeBorder}
                themeText={themeText}
                themeMuted={themeMuted}
              />

              <CustomizableDropdown
                id={`${idPrefix}-cottage-usage`}
                label="Usage Mode"
                value={String(specs?.usage_mode || 'Day Use & Overnight')}
                onChange={(val) => updateSpec('usage_mode', val)}
                options={USAGE_MODE_PRESETS}
                isLightMode={isLightMode}
                themeBorder={themeBorder}
                themeText={themeText}
                themeMuted={themeMuted}
              />

              <CustomizableDropdown
                id={`${idPrefix}-shoreline`}
                label="Shoreline Proximity"
                value={String(specs?.beachfront_proximity || 'Steps from Shoreline')}
                onChange={(val) => updateSpec('beachfront_proximity', val)}
                options={SHORELINE_PRESETS}
                isLightMode={isLightMode}
                themeBorder={themeBorder}
                themeText={themeText}
                themeMuted={themeMuted}
              />

              <div>
                <label htmlFor={`${idPrefix}-seating`} style={labelStyle}>Tables &amp; Seating Setup</label>
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

        {/* 3. ISLAND TOUR / CHARTER SPECIFICATIONS */}
        {offeringType === 'offer' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10 }}>
            <CustomizableDropdown
              id={`${idPrefix}-tour-subtype`}
              label="Tour Activity Subtype"
              value={String(specs?.offer_subtype || 'Guided Island Hopping Tour')}
              onChange={(val) => updateSpec('offer_subtype', val)}
              options={TOUR_SUBTYPE_PRESETS}
              isLightMode={isLightMode}
              themeBorder={themeBorder}
              themeText={themeText}
              themeMuted={themeMuted}
            />

            <div>
              <label htmlFor={`${idPrefix}-duration`} style={labelStyle}>Tour Duration</label>
              <input
                id={`${idPrefix}-duration`}
                style={fieldStyle}
                value={String(specs?.duration || '4 Hours (Half Day)')}
                onChange={(e) => updateSpec('duration', e.target.value)}
                placeholder="e.g. 4 Hours (Half Day)"
              />
            </div>

            <div style={{ gridColumn: 'span 2' }}>
              <label htmlFor={`${idPrefix}-destinations`} style={labelStyle}>Destinations &amp; Key Stops</label>
              <input
                id={`${idPrefix}-destinations`}
                style={fieldStyle}
                value={String(specs?.destinations || '')}
                onChange={(e) => updateSpec('destinations', e.target.value)}
                placeholder="e.g. Patar Reef Sanctuary, Sandbar Cove, Sea Caves"
              />
            </div>

            <div style={{ gridColumn: 'span 2' }}>
              <label htmlFor={`${idPrefix}-inclusions`} style={labelStyle}>Inclusions</label>
              <input
                id={`${idPrefix}-inclusions`}
                style={fieldStyle}
                value={String(specs?.inclusions || '')}
                onChange={(e) => updateSpec('inclusions', e.target.value)}
                placeholder="e.g. Motorized Bangka, Licensed Guide, Life Vests, Snorkels"
              />
            </div>
          </div>
        )}

        {/* 4. EVENT PAVILION SPECIFICATIONS */}
        {offeringType === 'event' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10 }}>
            <CustomizableDropdown
              id={`${idPrefix}-event-style`}
              label="Pavilion Venue Structure"
              value={String(specs?.cottage_style || 'Beachfront Covered Function Pavilion')}
              onChange={(val) => updateSpec('cottage_style', val)}
              options={COTTAGE_STYLE_PRESETS}
              isLightMode={isLightMode}
              themeBorder={themeBorder}
              themeText={themeText}
              themeMuted={themeMuted}
            />

            <CustomizableDropdown
              id={`${idPrefix}-event-usage`}
              label="Event Setup & Capacity"
              value={String(specs?.usage_mode || 'Banquet & Group Gathering (Up to 50 pax)')}
              onChange={(val) => updateSpec('usage_mode', val)}
              options={USAGE_MODE_PRESETS}
              isLightMode={isLightMode}
              themeBorder={themeBorder}
              themeText={themeText}
              themeMuted={themeMuted}
            />

            <div style={{ gridColumn: 'span 2' }}>
              <label htmlFor={`${idPrefix}-event-seating`} style={labelStyle}>Seating &amp; AV Setup</label>
              <input
                id={`${idPrefix}-event-seating`}
                style={fieldStyle}
                value={String(specs?.seating_tables || 'Banquet Dining Tables & Chairs')}
                onChange={(e) => updateSpec('seating_tables', e.target.value)}
                placeholder="e.g. Round Tables, Stage, Sound System"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
