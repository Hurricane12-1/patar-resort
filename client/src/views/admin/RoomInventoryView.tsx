import React, { useState, useEffect } from 'react';
import { money } from '../../lib/format';
import RoomImageCarousel from '../../components/RoomImageCarousel';

export interface RoomInventoryViewProps {
  roomsList: any[];
  allBookings: any[];
  inventoryList: any[];
  loadingRoomsAndInv: boolean;
  refreshRoomsAndInventory: () => void;
  setShowCreateRoomModal: (show: boolean) => void;
  setShowCreateSupplyModal: (show: boolean) => void;
  setEditingRoom: (room: any) => void;
  setRoomToRemove: (room: any) => void;
  setSupplyToRemove: (item: any) => void;
  handleToggleRoomActive: (room: any) => void;
  handleAdjustSupplyStock: (item: any, delta: number) => void;
  isLightMode: boolean;
  themeCardBg: string;
  themeBorder: string;
  themeShadow: string;
  themeText: string;
  themeMuted: string;
  toast: (msg: string, isError?: boolean) => void;
}

export const RoomInventoryView: React.FC<RoomInventoryViewProps> = ({
  roomsList,
  allBookings,
  inventoryList,
  loadingRoomsAndInv,
  refreshRoomsAndInventory,
  setShowCreateRoomModal,
  setShowCreateSupplyModal,
  setEditingRoom,
  setRoomToRemove,
  setSupplyToRemove,
  handleToggleRoomActive,
  handleAdjustSupplyStock,
  isLightMode,
  themeCardBg,
  themeBorder,
  themeShadow,
  themeText,
  themeMuted,
  toast,
}) => {
  const [inventorySearch, setInventorySearch] = useState(() => {
    try {
      return localStorage.getItem('jd_admin_inv_search') || '';
    } catch {
      return '';
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem('jd_admin_inv_search', inventorySearch);
    } catch {}
  }, [inventorySearch]);

  const [inventorySubTab, setInventorySubTab] = useState<'accommodations' | 'supplies'>(() => {
    try {
      const saved = localStorage.getItem('jd_admin_inv_subtab');
      if (saved === 'supplies' || saved === 'accommodations') return saved;
    } catch {}
    return 'accommodations';
  });
  useEffect(() => {
    try {
      localStorage.setItem('jd_admin_inv_subtab', inventorySubTab);
    } catch {}
  }, [inventorySubTab]);

  const [inventoryRoomFilter, setInventoryRoomFilter] = useState(() => {
    try {
      return localStorage.getItem('jd_admin_inv_room_filter') || 'all';
    } catch {
      return 'all';
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem('jd_admin_inv_room_filter', inventoryRoomFilter);
    } catch {}
  }, [inventoryRoomFilter]);

  const [inventoryDeptFilter, setInventoryDeptFilter] = useState(() => {
    try {
      return localStorage.getItem('jd_admin_inv_dept_filter') || 'all';
    } catch {
      return 'all';
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem('jd_admin_inv_dept_filter', inventoryDeptFilter);
    } catch {}
  }, [inventoryDeptFilter]);

  return (
    <div className="panel" style={{ background: themeCardBg, border: `1px solid ${themeBorder}`, borderRadius: 16, padding: 24, boxShadow: themeShadow }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 14 }}>
        <div>
          <span className="label light">Resort Infrastructure & Assets</span>
          <h3 className="serif" style={{ fontSize: '1.6rem', margin: '4px 0 0', color: themeText }}>Room Management Hub</h3>
          <p className="muted small" style={{ margin: '4px 0 0' }}>Live control of room rates, unit inventory, availability, and resort department stock supplies.</p>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <input
            className="search"
            placeholder="Search rooms or supplies…"
            value={inventorySearch}
            onChange={(e) => setInventorySearch(e.target.value)}
            style={{ maxWidth: 220, background: isLightMode ? '#FFF' : undefined, color: themeText }}
          />
          <button className="btn btn-sm" onClick={refreshRoomsAndInventory} disabled={loadingRoomsAndInv} style={{ border: `1px solid ${themeBorder}`, color: themeText }}>
            {loadingRoomsAndInv ? 'Syncing…' : '↻ Sync Now'}
          </button>
          {inventorySubTab === 'accommodations' ? (
            <button className="btn btn-sky btn-sm" onClick={() => setShowCreateRoomModal(true)}>
              + Add Room
            </button>
          ) : (
            <button className="btn btn-sky btn-sm" onClick={() => setShowCreateSupplyModal(true)}>
              + Add Supply Item
            </button>
          )}
        </div>
      </div>

      {/* STAT SUMMARY BAND (CLICKABLE INTERACTIVE TELEMETRY CARDS) */}
      <div className="admin-grid-4-col" style={{ gap: 12, marginBottom: 20 }}>
        <div
          className="kpi-card-clickable"
          onClick={() => {
            setInventorySubTab('accommodations');
            setInventoryRoomFilter('all');
            toast('Displaying all resort rooms');
          }}
          style={{
            background: isLightMode ? '#F8FAFC' : 'rgba(255,255,255,0.03)',
            border: `1px solid ${inventorySubTab === 'accommodations' && inventoryRoomFilter === 'all' ? '#0EA5E9' : themeBorder}`,
            borderRadius: 16,
            padding: 14,
            cursor: 'pointer',
            transition: 'all 0.2s ease',
          }}
          title="Click to view all rooms"
        >
          <span style={{ fontSize: '.72rem', color: themeMuted, textTransform: 'uppercase', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span>Rooms</span>
            <i className="fas fa-arrow-up-right-from-square" style={{ fontSize: '.68rem', color: '#0EA5E9' }} />
          </span>
          <div style={{ fontSize: '1.4rem', fontWeight: 800, color: themeText, marginTop: 4 }}>{roomsList.length} Categories</div>
        </div>

        <div
          className="kpi-card-clickable"
          onClick={() => {
            setInventorySubTab('accommodations');
            toast(`Total Resort Capacity: ${roomsList.reduce((acc, r) => acc + (r.units || 0), 0)} Physical Rooms across Patar coastline`);
          }}
          style={{
            background: isLightMode ? '#F8FAFC' : 'rgba(255,255,255,0.03)',
            border: `1px solid ${themeBorder}`,
            borderRadius: 16,
            padding: 14,
            cursor: 'pointer',
            transition: 'all 0.2s ease',
          }}
          title="Click to inspect total unit inventory"
        >
          <span style={{ fontSize: '.72rem', color: themeMuted, textTransform: 'uppercase', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span>Total Units</span>
            <i className="fas fa-bed" style={{ fontSize: '.68rem', color: '#38BDF8' }} />
          </span>
          <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#38BDF8', marginTop: 4 }}>
            {roomsList.reduce((acc, r) => acc + (r.units || 0), 0)} Physical Rooms
          </div>
        </div>

        <div
          className="kpi-card-clickable"
          onClick={() => {
            setInventorySubTab('supplies');
            toast('Switched view to Resort Supplies Ledger');
          }}
          style={{
            background: isLightMode ? '#F8FAFC' : 'rgba(255,255,255,0.03)',
            border: `1px solid ${inventorySubTab === 'supplies' ? '#10B981' : themeBorder}`,
            borderRadius: 16,
            padding: 14,
            cursor: 'pointer',
            transition: 'all 0.2s ease',
          }}
          title="Click to view resort department supplies"
        >
          <span style={{ fontSize: '.72rem', color: themeMuted, textTransform: 'uppercase', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span>Resort Supplies</span>
            <i className="fas fa-boxes-stacked" style={{ fontSize: '.68rem', color: '#10B981' }} />
          </span>
          <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#10B981', marginTop: 4 }}>
            {inventoryList.length} Tracked Items
          </div>
        </div>

        <div
          className="kpi-card-clickable"
          onClick={() => {
            setInventorySubTab('supplies');
            toast('Filtered view to low stock and reorder supply items');
          }}
          style={{
            background: isLightMode ? '#F8FAFC' : 'rgba(255,255,255,0.03)',
            border: `1px solid ${inventoryList.filter(i => (i.stock_qty || 0) <= (i.reorder_at || 10)).length > 0 ? 'rgba(244, 63, 94, 0.4)' : themeBorder}`,
            borderRadius: 16,
            padding: 14,
            cursor: 'pointer',
            transition: 'all 0.2s ease',
          }}
          title="Click to inspect reorder alerts"
        >
          <span style={{ fontSize: '.72rem', color: themeMuted, textTransform: 'uppercase', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span>Reorder Alerts</span>
            <i className="fas fa-bell" style={{ fontSize: '.68rem', color: inventoryList.filter(i => (i.stock_qty || 0) <= (i.reorder_at || 10)).length > 0 ? '#F43F5E' : '#10B981' }} />
          </span>
          <div style={{ fontSize: '1.4rem', fontWeight: 800, color: inventoryList.filter(i => (i.stock_qty || 0) <= (i.reorder_at || 10)).length > 0 ? '#F43F5E' : '#10B981', marginTop: 4 }}>
            {inventoryList.filter(i => (i.stock_qty || 0) <= (i.reorder_at || 10)).length} Items Low
          </div>
        </div>
      </div>

      {/* SUBTAB SWITCHER */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 20, background: isLightMode ? '#F1F5F9' : 'rgba(255,255,255,0.04)', borderRadius: 12, padding: 4 }}>
        {[
          { key: 'accommodations' as const, label: 'Rooms & Rates', icon: 'fas fa-hotel', count: roomsList.filter((r) => r.is_active !== false).length },
          { key: 'supplies' as const, label: 'Room Supplies & Amenities', icon: 'fas fa-box', count: inventoryList.length },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setInventorySubTab(tab.key)}
            style={{
              flex: 1, padding: '10px 16px', border: 'none', borderRadius: 10, cursor: 'pointer',
              fontSize: '.84rem', fontWeight: 700, transition: 'all 0.25s ease',
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              background: inventorySubTab === tab.key
                ? (tab.key === 'accommodations' ? 'linear-gradient(135deg, #0284C7, #0EA5E9)' : 'linear-gradient(135deg, #4338CA, #6366F1)')
                : 'transparent',
              color: inventorySubTab === tab.key ? '#FFF' : themeMuted,
              boxShadow: inventorySubTab === tab.key ? '0 4px 12px rgba(14,165,233,0.25)' : 'none',
            }}
          >
            <i className={tab.icon} />
            {tab.label} <span style={{ opacity: 0.85, fontSize: '.74rem', marginLeft: 4 }}>({tab.count})</span>
          </button>
        ))}
      </div>

      {/* SUBTAB 1: ROOMS & RATES */}
      {inventorySubTab === 'accommodations' && (
        <>
          {/* SIMPLIFIED CATEGORY FILTER DROPDOWN & ACTIVE FILTER BADGE */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: '.78rem', color: themeMuted, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em', display: 'flex', alignItems: 'center', gap: 6 }}>
                <i className="fas fa-filter" style={{ color: '#0EA5E9' }} /> Filter Category:
              </span>
              <select
                value={inventoryRoomFilter}
                onChange={(e) => setInventoryRoomFilter(e.target.value)}
                style={{
                  padding: '8px 18px',
                  borderRadius: 9999,
                  border: `1px solid ${themeBorder}`,
                  background: isLightMode ? '#FFFFFF' : '#0F172A',
                  color: themeText,
                  fontSize: '.84rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  minWidth: 200,
                }}
              >
                <option value="all">All Categories ({roomsList.filter((r) => r.is_active !== false).length})</option>
                <option value="Cottage">Cottages ({roomsList.filter((r) => r.is_active !== false && r.category?.toLowerCase() === 'cottage').length})</option>
                <option value="Villa">Villas ({roomsList.filter((r) => r.is_active !== false && r.category?.toLowerCase() === 'villa').length})</option>
                <option value="Suite">Suites ({roomsList.filter((r) => r.is_active !== false && r.category?.toLowerCase() === 'suite').length})</option>
                <option value="Garden">Garden Rooms ({roomsList.filter((r) => r.is_active !== false && r.category?.toLowerCase() === 'garden').length})</option>
                <option value="Dorm">Dormitories ({roomsList.filter((r) => r.is_active !== false && r.category?.toLowerCase() === 'dorm').length})</option>
              </select>
            </div>

            {inventoryRoomFilter !== 'all' && (
              <button
                type="button"
                onClick={() => setInventoryRoomFilter('all')}
                className="btn btn-ghost btn-sm"
                style={{
                  borderRadius: 9999,
                  fontSize: '.75rem',
                  fontWeight: 700,
                  color: '#0EA5E9',
                  borderColor: 'rgba(14, 165, 233, 0.4)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <i className="fas fa-times" /> Reset Category Filter
              </button>
            )}
          </div>

          {loadingRoomsAndInv ? (
            <div className="skel" style={{ height: 260 }} />
          ) : (() => {
            const filteredRooms = roomsList
              .filter((r) => r.is_active !== false)
              .filter((r) => inventoryRoomFilter === 'all' || r.category?.toLowerCase() === inventoryRoomFilter.toLowerCase())
              .filter((r) => !inventorySearch || r.name?.toLowerCase().includes(inventorySearch.toLowerCase()) || r.description?.toLowerCase().includes(inventorySearch.toLowerCase()));

            return filteredRooms.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '48px 20px', background: isLightMode ? '#F8FAFC' : 'rgba(255,255,255,0.02)', borderRadius: 16, border: `1px dashed ${themeBorder}`, margin: '12px 0' }}>
                <div style={{ fontSize: '2.8rem', marginBottom: 12, color: '#38BDF8' }}><i className="fas fa-umbrella-beach" /></div>
                <h4 style={{ margin: '0 0 6px', color: themeText, fontSize: '1.15rem', fontWeight: 800 }}>No Rooms Added Yet</h4>
                <p style={{ margin: '0 auto 18px', maxWidth: 460, color: themeMuted, fontSize: '.86rem', lineHeight: 1.5 }}>
                  All mock room data has been cleared. Click below to provision and publish your first custom room with photos and rates.
                </p>
                <button className="btn btn-sky btn-sm" onClick={() => setShowCreateRoomModal(true)} style={{ padding: '9px 18px', fontWeight: 700 }}>
                  + Add Your First Room
                </button>
              </div>
            ) : (
              <div className="admin-grid-3-col" style={{ gap: 16 }}>
                {filteredRooms.map((room: any) => {
                  const roomImages = Array.isArray(room.images) && room.images.length > 0
                    ? room.images
                    : (room.image_url ? [room.image_url] : []);

                  return (
                    <div
                      key={room.id}
                      style={{
                        background: isLightMode ? '#FFFFFF' : 'rgba(15,23,42,0.85)',
                        border: `1px solid ${themeBorder}`,
                        borderRadius: 14,
                        overflow: 'hidden',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                        boxShadow: themeShadow,
                      }}
                    >
                      {/* AUTO-SCROLLING ROOM IMAGE SHOWCASE */}
                      <RoomImageCarousel
                        images={roomImages}
                        roomName={room.name}
                        category={room.category}
                        slug={room.slug}
                        height={185}
                        autoScroll={true}
                        interval={3500}
                        badge={
                          <span className="pill" style={{ background: 'rgba(14,165,233,0.85)', color: '#FFFFFF', fontWeight: 800, fontSize: '.72rem', backdropFilter: 'blur(4px)' }}>
                            {room.category || 'Standard'}
                          </span>
                        }
                      />

                      <div style={{ padding: 18, flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                        <div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                            <h4 style={{ margin: 0, fontSize: '1.15rem', color: themeText }}>{room.name}</h4>
                            <button
                              onClick={() => handleToggleRoomActive(room)}
                              style={{
                                border: 'none',
                                borderRadius: 12,
                                padding: '3px 10px',
                                fontSize: '.72rem',
                                fontWeight: 700,
                                cursor: 'pointer',
                                background: room.is_active ? 'rgba(16,185,129,0.15)' : 'rgba(244,63,94,0.15)',
                                color: room.is_active ? '#10B981' : '#F43F5E',
                              }}
                              title="Click to toggle Active vs Maintenance"
                            >
                              {room.is_active ? '● Active' : '⏸ Maintenance'}
                            </button>
                          </div>

                          <p style={{ margin: '0 0 12px', fontSize: '.82rem', color: themeMuted, lineHeight: 1.4, minHeight: 36 }}>
                            {room.description || 'Patar beachfront room with scenic sea vistas and resort amenities.'}
                          </p>

                          <div style={{ display: 'flex', gap: 14, marginBottom: 12, fontSize: '.84rem', color: themeText, background: isLightMode ? '#F8FAFC' : 'rgba(255,255,255,0.03)', padding: '8px 12px', borderRadius: 10 }}>
                            <div><span style={{ color: themeMuted, fontSize: '.72rem', display: 'block' }}>Capacity</span><b>Sleeps {room.capacity || 2}</b></div>
                            <div><span style={{ color: themeMuted, fontSize: '.72rem', display: 'block' }}>Physical Units</span><b style={{ color: '#0EA5E9' }}>{room.units || 1} units</b></div>
                            <div><span style={{ color: themeMuted, fontSize: '.72rem', display: 'block' }}>Rating</span><b><i className="fas fa-star" style={{ color: '#F59E0B', marginRight: 4 }} />{room.rating_avg || 5.0}</b></div>
                          </div>

                          {Array.isArray(room.amenities) && room.amenities.length > 0 && (
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 14 }}>
                              {room.amenities.slice(0, 4).map((a: string, i: number) => (
                                <span key={i} style={{ fontSize: '.68rem', padding: '2px 8px', borderRadius: 8, background: isLightMode ? '#F1F5F9' : 'rgba(255,255,255,0.05)', color: themeMuted }}>
                                  {a}
                                </span>
                              ))}
                              {room.amenities.length > 4 && (
                                <span style={{ fontSize: '.68rem', padding: '2px 6px', borderRadius: 8, color: themeMuted }}>+{room.amenities.length - 4} more</span>
                              )}
                            </div>
                          )}
                        </div>

                        <div style={{ borderTop: `1px solid ${themeBorder}`, paddingTop: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div>
                            <span style={{ fontSize: '.72rem', color: themeMuted, display: 'block' }}>Rate per night</span>
                            <b style={{ fontSize: '1.15rem', color: '#10B981' }}>{money(room.rate_php)}</b>
                          </div>
                          <div style={{ display: 'flex', gap: 8 }}>
                            <button
                              className="btn btn-sky btn-sm"
                              onClick={() => {
                                const currentImgs = Array.isArray(room.images) && room.images.length > 0
                                  ? [...room.images]
                                  : (room.image_url ? [room.image_url] : []);
                                setEditingRoom({
                                  ...room,
                                  image_url: room.image_url || currentImgs[0] || '',
                                  images: currentImgs,
                                  amenities: Array.isArray(room.amenities) ? room.amenities.join(', ') : (room.amenities || ''),
                                });
                              }}
                              style={{ display: 'flex', alignItems: 'center', gap: 6 }}
                            >
                              <i className="fas fa-pen-to-square" /> Edit
                            </button>
                            <button
                              className="btn btn-sm"
                              onClick={() => setRoomToRemove(room)}
                              style={{
                                background: 'rgba(239, 68, 68, 0.1)',
                                color: '#EF4444',
                                border: '1px solid rgba(239, 68, 68, 0.3)',
                                fontSize: '.8rem',
                                fontWeight: 700,
                                padding: '6px 14px',
                                borderRadius: 9999,
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                              }}
                              title="Remove room"
                            >
                              Remove
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })()}
        </>
      )}

      {/* SUBTAB 2: RESORT SUPPLIES & STOCK LEDGER */}
      {inventorySubTab === 'supplies' && (
        <>
          {/* Department Filter Chips */}
          <div className="chip-row" style={{ marginBottom: 16 }}>
            {[
              { id: 'all', label: 'ALL DEPARTMENTS' },
              { id: 'front_desk', label: 'FRONT DESK' },
              { id: 'housekeeping', label: 'HOUSEKEEPING' },
              { id: 'kitchen', label: 'KITCHEN & DINING' },
              { id: 'tours', label: 'TOURS & LEISURE' },
              { id: 'maintenance', label: 'MAINTENANCE' },
            ].map((dept) => (
              <button
                key={dept.id}
                className={`chip ${inventoryDeptFilter === dept.id ? 'sel' : ''}`}
                onClick={() => setInventoryDeptFilter(dept.id)}
              >
                {dept.label}
              </button>
            ))}
          </div>

          {loadingRoomsAndInv ? (
            <div className="skel" style={{ height: 260 }} />
          ) : (() => {
            const filteredSupplies = inventoryList
              .filter((i) => inventoryDeptFilter === 'all' || i.category === inventoryDeptFilter)
              .filter((i) => !inventorySearch || i.item_name?.toLowerCase().includes(inventorySearch.toLowerCase()));

            return filteredSupplies.length === 0 ? (
              <p className="muted" style={{ padding: '30px 0', textAlign: 'center' }}>No supplies found in this department.</p>
            ) : (
              <div className="table-wrap" style={{ background: isLightMode ? '#FFFFFF' : 'rgba(15,23,42,0.85)', border: `1px solid ${themeBorder}` }}>
                <table className="table" style={{ color: themeText }}>
                  <thead>
                    <tr style={{ background: isLightMode ? '#F1F5F9' : 'rgba(30,41,59,0.8)' }}>
                      <th style={{ color: isLightMode ? '#475569' : themeMuted }}>Supply Item</th>
                      <th style={{ color: isLightMode ? '#475569' : themeMuted }}>Department</th>
                      <th style={{ color: isLightMode ? '#475569' : themeMuted }}>In-Stock Ledger</th>
                      <th style={{ color: isLightMode ? '#475569' : themeMuted }}>Reorder Threshold</th>
                      <th style={{ color: isLightMode ? '#475569' : themeMuted }}>Inventory Health</th>
                      <th style={{ color: isLightMode ? '#475569' : themeMuted, textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredSupplies.map((item: any) => {
                      const isLow = (item.stock_qty || 0) <= (item.reorder_at || 10);
                      return (
                        <tr key={item.id} style={{ borderBottom: `1px solid ${themeBorder}` }}>
                          <td>
                            <b style={{ color: themeText }}>{item.item_name}</b>
                            <span style={{ fontSize: '.72rem', color: themeMuted, display: 'block' }}>Unit: {item.unit || 'pcs'}</span>
                          </td>
                          <td>
                            <span className="pill" style={{ background: 'rgba(99,102,241,0.12)', color: '#818CF8', fontSize: '.72rem', textTransform: 'uppercase' }}>
                              {(item.category || 'general').replace('_', ' ')}
                            </span>
                          </td>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <button
                                onClick={() => handleAdjustSupplyStock(item, -1)}
                                style={{ width: 26, height: 26, borderRadius: 6, border: `1px solid ${themeBorder}`, background: isLightMode ? '#F1F5F9' : 'rgba(255,255,255,0.06)', color: themeText, cursor: 'pointer', fontWeight: 800 }}
                                title="Decrease stock by 1"
                              >
                                -
                              </button>
                              <b style={{ minWidth: 36, textAlign: 'center', fontSize: '1rem', color: isLow ? '#F43F5E' : '#10B981' }}>
                                {item.stock_qty} {item.unit || 'pcs'}
                              </b>
                              <button
                                onClick={() => handleAdjustSupplyStock(item, 1)}
                                style={{ width: 26, height: 26, borderRadius: 6, border: `1px solid ${themeBorder}`, background: isLightMode ? '#F1F5F9' : 'rgba(255,255,255,0.06)', color: themeText, cursor: 'pointer', fontWeight: 800 }}
                                title="Increase stock by 1"
                              >
                                +
                              </button>
                            </div>
                          </td>
                          <td>
                            <span style={{ fontSize: '.84rem', color: themeMuted }}>Min {item.reorder_at || 10} {item.unit || 'pcs'}</span>
                          </td>
                          <td>
                            <span
                              className="pill"
                              style={{
                                background: isLow ? 'rgba(244,63,94,0.15)' : 'rgba(16,185,129,0.15)',
                                color: isLow ? '#F43F5E' : '#10B981',
                                fontSize: '.74rem',
                                fontWeight: 700,
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 5,
                              }}
                            >
                              {isLow ? <><i className="fas fa-triangle-exclamation" /> Reorder Needed</> : <><i className="fas fa-circle" style={{ fontSize: '.5rem' }} /> In Stock</>}
                            </span>
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            <button
                              onClick={() => setSupplyToRemove(item)}
                              style={{
                                background: 'rgba(239, 68, 68, 0.1)',
                                border: '1px solid rgba(239, 68, 68, 0.3)',
                                color: '#EF4444',
                                cursor: 'pointer',
                                fontSize: '.78rem',
                                fontWeight: 700,
                                padding: '5px 12px',
                                borderRadius: 8,
                                display: 'inline-flex',
                                alignItems: 'center',
                              }}
                              title="Remove supply item"
                            >
                              Remove
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            );
          })()}
        </>
      )}
    </div>
  );
};
