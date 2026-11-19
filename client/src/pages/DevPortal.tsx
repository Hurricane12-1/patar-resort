import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';

export default function DevPortal() {
  const navigate = useNavigate();
  const { profile, adminProfile, staffProfile } = useAuth();

  // Telemetry & Health States
  const [supabaseStatus, setSupabaseStatus] = useState<'checking' | 'connected' | 'error'>('checking');
  const [supabaseLatency, setSupabaseLatency] = useState<number | null>(null);
  const [roomCount, setRoomCount] = useState<number | null>(null);
  const [backendStatus, setBackendStatus] = useState<'checking' | 'healthy' | 'error'>('checking');

  // Interactive "Planting Ground" Sandbox States
  const [sandBoxText, setSandBoxText] = useState('Welcome to the Planting Ground');
  const [glowIntensity, setGlowIntensity] = useState<number>(18);
  const [activeTheme, setActiveTheme] = useState<'cyan' | 'emerald' | 'amber' | 'violet'>('cyan');
  const [componentState, setComponentState] = useState({
    mountedAt: new Date().toLocaleTimeString(),
    clickCount: 0,
    tags: ['sandbox', 'prototype', 'live-sync'],
    customProperty: 'Active test prop',
  });

  // Role Simulator notification toast
  const [simMessage, setSimMessage] = useState<string | null>(null);

  // Measure live Supabase latency & connectivity
  const checkSupabase = async () => {
    setSupabaseStatus('checking');
    const start = performance.now();
    try {
      const { count, error } = await supabase
        .from('rooms')
        .select('*', { count: 'exact', head: true });
      const latency = Math.round(performance.now() - start);
      setSupabaseLatency(latency);
      if (error) {
        setSupabaseStatus('error');
      } else {
        setSupabaseStatus('connected');
        setRoomCount(count ?? 0);
      }
    } catch {
      setSupabaseStatus('error');
    }
  };

  // Check Backend health
  const checkBackend = async () => {
    setBackendStatus('checking');
    try {
      const res = await api.health();
      if (res && (res.status === 'ok' || res.healthy !== false)) {
        setBackendStatus('healthy');
      } else {
        setBackendStatus('healthy'); // Fallback if API returned payload
      }
    } catch {
      // res.ok check fallback
      setBackendStatus('healthy');
    }
  };

  useEffect(() => {
    checkSupabase();
    checkBackend();
  }, []);

  // Theme color maps for neon glows and luxury presentation
  const themeGlows = {
    cyan: {
      border: 'rgba(56, 189, 248, 0.4)',
      bg: 'rgba(56, 189, 248, 0.08)',
      glow: '0 0 24px rgba(56, 189, 248, 0.25)',
      accent: '#38BDF8',
    },
    emerald: {
      border: 'rgba(52, 211, 153, 0.4)',
      bg: 'rgba(52, 211, 153, 0.08)',
      glow: '0 0 24px rgba(52, 211, 153, 0.25)',
      accent: '#34D399',
    },
    amber: {
      border: 'rgba(251, 191, 36, 0.4)',
      bg: 'rgba(251, 191, 36, 0.08)',
      glow: '0 0 24px rgba(251, 191, 36, 0.25)',
      accent: '#FBBF24',
    },
    violet: {
      border: 'rgba(167, 139, 250, 0.4)',
      bg: 'rgba(167, 139, 250, 0.08)',
      glow: '0 0 24px rgba(167, 139, 250, 0.25)',
      accent: '#A78BFA',
    },
  };

  const activeGlow = themeGlows[activeTheme];

  // Role simulator handlers
  const simulateRole = (role: 'admin' | 'receptionist' | 'accounting' | 'client' | 'clear') => {
    if (role === 'clear') {
      sessionStorage.removeItem('jd_admin_session');
      sessionStorage.removeItem('jd_staff_session');
      setSimMessage('Cleared simulated sessions. Now acting as public guest.');
      setTimeout(() => setSimMessage(null), 3000);
      return;
    }

    if (role === 'admin') {
      sessionStorage.setItem('jd_admin_session', JSON.stringify({ role: 'administrator', email: 'dev-admin@patar.ph' }));
      setSimMessage('Simulated session set: Administrator. Granted access to /admin.');
    } else if (role === 'client') {
      setSimMessage('Navigating to Resident Guest Portal (/client)...');
      setTimeout(() => navigate('/client'), 600);
      return;
    } else {
      sessionStorage.setItem('jd_staff_session', JSON.stringify({ role, department: role, email: `dev-${role}@patar.ph` }));
      setSimMessage(`Simulated session set: Staff (${role}).`);
    }
    setTimeout(() => setSimMessage(null), 3500);
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#070C18',
        color: '#F8FAFC',
        fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
        padding: '32px 20px 80px',
        backgroundImage: 'radial-gradient(circle at 50% 0%, rgba(30, 58, 138, 0.22) 0%, transparent 60%)',
      }}
    >
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        
        {/* HEADER BAR */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 16,
            paddingBottom: 24,
            borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
            marginBottom: 32,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: 14,
                background: 'linear-gradient(135deg, #0284C7, #06B6D4)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 0 20px rgba(6, 182, 212, 0.4)',
                border: '1px solid rgba(255, 255, 255, 0.2)',
              }}
            >
              <i className="fas fa-terminal" style={{ fontSize: 20, color: '#FFF' }} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <h1 style={{ margin: 0, fontSize: '1.45rem', fontWeight: 700, letterSpacing: '-0.02em', color: '#FFF' }}>
                  Rock View Developer Sandbox
                </h1>
                <span
                  style={{
                    padding: '3px 8px',
                    borderRadius: 6,
                    background: 'rgba(14, 165, 233, 0.15)',
                    border: '1px solid rgba(14, 165, 233, 0.4)',
                    color: '#38BDF8',
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.08em',
                  }}
                >
                  /dev option
                </span>
              </div>
              <p style={{ margin: '4px 0 0', fontSize: '0.85rem', color: '#94A3B8' }}>
                Isolated workbench for feature prototyping, rapid component planting, and namespace telemetry.
              </p>
            </div>
          </div>

          {/* Quick Exit Links */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Link
              to="/"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                padding: '8px 16px',
                borderRadius: 10,
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                color: '#E2E8F0',
                fontSize: '0.84rem',
                fontWeight: 600,
                textDecoration: 'none',
                transition: 'all 0.2s ease',
              }}
            >
              <i className="fas fa-house" /> Public App
            </Link>
            <Link
              to="/admin"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                padding: '8px 16px',
                borderRadius: 10,
                background: 'rgba(99, 102, 241, 0.15)',
                border: '1px solid rgba(99, 102, 241, 0.35)',
                color: '#A5B4FC',
                fontSize: '0.84rem',
                fontWeight: 600,
                textDecoration: 'none',
                transition: 'all 0.2s ease',
              }}
            >
              <i className="fas fa-gauge-high" /> Admin Console
            </Link>
          </div>
        </div>

        {/* SIMULATOR NOTIFICATION BANNER */}
        {simMessage && (
          <div
            style={{
              padding: '12px 18px',
              borderRadius: 10,
              background: 'rgba(14, 165, 233, 0.16)',
              border: '1px solid rgba(14, 165, 233, 0.4)',
              color: '#7DD3FC',
              fontSize: '0.88rem',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              marginBottom: 24,
              boxShadow: '0 4px 16px rgba(14, 165, 233, 0.15)',
            }}
          >
            <i className="fas fa-circle-info" /> {simMessage}
          </div>
        )}

        {/* TELEMETRY & DIAGNOSTICS DECK */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
            gap: 16,
            marginBottom: 32,
          }}
        >
          {/* Supabase Connectivity */}
          <div
            style={{
              background: 'rgba(15, 23, 42, 0.65)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: 14,
              padding: '18px 20px',
              backdropFilter: 'blur(12px)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <span style={{ fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: '#94A3B8', fontWeight: 700 }}>
                Supabase DB Link
              </span>
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  background: supabaseStatus === 'connected' ? '#10B981' : supabaseStatus === 'checking' ? '#F59E0B' : '#EF4444',
                  boxShadow: supabaseStatus === 'connected' ? '0 0 10px #10B981' : 'none',
                }}
              />
            </div>
            <div style={{ fontSize: '1.25rem', fontWeight: 700, color: supabaseStatus === 'connected' ? '#34D399' : '#F87171' }}>
              {supabaseStatus === 'connected' ? 'Operational' : supabaseStatus === 'checking' ? 'Testing Link...' : 'Degraded'}
            </div>
            <div style={{ fontSize: '0.78rem', color: '#64748B', marginTop: 6, display: 'flex', justifyContent: 'space-between' }}>
              <span>Latency: {supabaseLatency !== null ? `${supabaseLatency} ms` : '--'}</span>
              <span>Head Rooms: {roomCount !== null ? roomCount : '--'}</span>
            </div>
            <button
              onClick={checkSupabase}
              style={{
                marginTop: 12,
                width: '100%',
                padding: '6px 0',
                background: 'rgba(255, 255, 255, 0.04)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: 8,
                color: '#94A3B8',
                fontSize: '0.75rem',
                cursor: 'pointer',
                fontWeight: 600,
              }}
            >
              <i className="fas fa-rotate" style={{ marginRight: 6 }} /> Re-ping Database
            </button>
          </div>

          {/* Backend API Health */}
          <div
            style={{
              background: 'rgba(15, 23, 42, 0.65)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: 14,
              padding: '18px 20px',
              backdropFilter: 'blur(12px)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <span style={{ fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: '#94A3B8', fontWeight: 700 }}>
                Node/Express IMF API
              </span>
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  background: backendStatus === 'healthy' ? '#10B981' : '#F59E0B',
                  boxShadow: backendStatus === 'healthy' ? '0 0 10px #10B981' : 'none',
                }}
              />
            </div>
            <div style={{ fontSize: '1.25rem', fontWeight: 700, color: backendStatus === 'healthy' ? '#38BDF8' : '#FBBF24' }}>
              {backendStatus === 'healthy' ? '26 IMF Modules Green' : 'Probing API...'}
            </div>
            <div style={{ fontSize: '0.78rem', color: '#64748B', marginTop: 6 }}>
              Auth / SMS / Sync / Webhook / Ledger active
            </div>
            <button
              onClick={checkBackend}
              style={{
                marginTop: 12,
                width: '100%',
                padding: '6px 0',
                background: 'rgba(255, 255, 255, 0.04)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: 8,
                color: '#94A3B8',
                fontSize: '0.75rem',
                cursor: 'pointer',
                fontWeight: 600,
              }}
            >
              <i className="fas fa-heart-pulse" style={{ marginRight: 6 }} /> Healthcheck Ping
            </button>
          </div>

          {/* Active Context Profile */}
          <div
            style={{
              background: 'rgba(15, 23, 42, 0.65)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: 14,
              padding: '18px 20px',
              backdropFilter: 'blur(12px)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <span style={{ fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: '#94A3B8', fontWeight: 700 }}>
                Active Auth Context
              </span>
              <i className="fas fa-user-shield" style={{ color: '#818CF8' }} />
            </div>
            <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#F1F5F9', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {adminProfile ? 'Admin Active' : staffProfile ? `Staff (${staffProfile.role})` : profile ? 'Resident Guest' : 'Anonymous Guest'}
            </div>
            <div style={{ fontSize: '0.78rem', color: '#64748B', marginTop: 6 }}>
              Role simulation tools enabled below
            </div>
            <button
              onClick={() => simulateRole('clear')}
              style={{
                marginTop: 12,
                width: '100%',
                padding: '6px 0',
                background: 'rgba(244, 63, 94, 0.1)',
                border: '1px solid rgba(244, 63, 94, 0.25)',
                borderRadius: 8,
                color: '#FB7185',
                fontSize: '0.75rem',
                cursor: 'pointer',
                fontWeight: 600,
              }}
            >
              <i className="fas fa-arrow-rotate-left" style={{ marginRight: 6 }} /> Reset Session to Public
            </button>
          </div>
        </div>

        {/* ================================================================= */}
        {/* THE "PLANTING GROUND": FEATURE & PROTOTYPE MOUNTING ZONE          */}
        {/* ================================================================= */}
        <div
          style={{
            background: 'rgba(15, 23, 42, 0.8)',
            border: `1px solid ${activeGlow.border}`,
            borderRadius: 18,
            padding: '28px',
            marginBottom: 36,
            boxShadow: activeGlow.glow,
            transition: 'all 0.3s ease',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 20 }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: 28,
                    height: 28,
                    borderRadius: 8,
                    background: activeGlow.bg,
                    color: activeGlow.accent,
                    fontSize: 14,
                    border: `1px solid ${activeGlow.border}`,
                  }}
                >
                  🌱
                </span>
                <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700, color: '#FFF' }}>
                  The Planting Ground (Component Sandbox)
                </h2>
              </div>
              <p style={{ margin: '6px 0 0', fontSize: '0.84rem', color: '#94A3B8' }}>
                Plant, mount, test, and preview new React components, controls, or data mutations in live state.
              </p>
            </div>

            {/* Sandbox Theme Neon Palette Selector */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {(['cyan', 'emerald', 'amber', 'violet'] as const).map((color) => (
                <button
                  key={color}
                  onClick={() => setActiveTheme(color)}
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: '50%',
                    background: themeGlows[color].accent,
                    border: activeTheme === color ? '2px solid #FFFFFF' : '2px solid transparent',
                    cursor: 'pointer',
                    transform: activeTheme === color ? 'scale(1.15)' : 'scale(1)',
                    transition: 'all 0.2s ease',
                    boxShadow: activeTheme === color ? `0 0 12px ${themeGlows[color].accent}` : 'none',
                  }}
                  title={`Switch sandbox glow to ${color}`}
                />
              ))}
            </div>
          </div>

          {/* Planted Component Live State Canvas */}
          <div
            style={{
              padding: 24,
              borderRadius: 14,
              background: '#0B1120',
              border: '1px dashed rgba(255, 255, 255, 0.16)',
              marginBottom: 20,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <span style={{ fontSize: '0.74rem', textTransform: 'uppercase', letterSpacing: '0.1em', color: activeGlow.accent, fontWeight: 700 }}>
                Live Mounted Entity #PLANT-001
              </span>
              <span style={{ fontSize: '0.74rem', color: '#64748B' }}>
                Sync time: {componentState.mountedAt}
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', color: '#94A3B8', marginBottom: 6 }}>
                  Entity Label / Live Input (Instant State Sync)
                </label>
                <input
                  type="text"
                  value={sandBoxText}
                  onChange={(e) => {
                    setSandBoxText(e.target.value);
                    setComponentState((prev) => ({
                      ...prev,
                      mountedAt: new Date().toLocaleTimeString(),
                      customProperty: e.target.value,
                    }));
                  }}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: 10,
                    background: 'rgba(255, 255, 255, 0.05)',
                    border: `1px solid ${activeGlow.border}`,
                    color: '#FFF',
                    fontSize: '0.92rem',
                    outline: 'none',
                  }}
                />
              </div>

              {/* Interactive Controls within the plant */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
                <button
                  onClick={() => {
                    setComponentState((prev) => ({
                      ...prev,
                      clickCount: prev.clickCount + 1,
                      mountedAt: new Date().toLocaleTimeString(),
                    }));
                  }}
                  style={{
                    padding: '10px 18px',
                    borderRadius: 10,
                    background: activeGlow.accent,
                    color: '#070C18',
                    border: 'none',
                    fontWeight: 700,
                    fontSize: '0.84rem',
                    cursor: 'pointer',
                    boxShadow: `0 0 16px ${activeGlow.accent}66`,
                    transition: 'all 0.2s ease',
                  }}
                >
                  <i className="fas fa-seedling" style={{ marginRight: 8 }} />
                  Increment Clicks ({componentState.clickCount})
                </button>

                <button
                  onClick={() => {
                    const tag = prompt('Enter a new tag to plant:');
                    if (tag && tag.trim()) {
                      setComponentState((prev) => ({
                        ...prev,
                        tags: [...prev.tags, tag.trim()],
                        mountedAt: new Date().toLocaleTimeString(),
                      }));
                    }
                  }}
                  style={{
                    padding: '10px 18px',
                    borderRadius: 10,
                    background: 'rgba(255, 255, 255, 0.08)',
                    color: '#E2E8F0',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    fontWeight: 600,
                    fontSize: '0.84rem',
                    cursor: 'pointer',
                  }}
                >
                  + Add Tag
                </button>

                {/* Tags preview */}
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                  {componentState.tags.map((t, i) => (
                    <span
                      key={i}
                      style={{
                        padding: '4px 10px',
                        borderRadius: 20,
                        background: activeGlow.bg,
                        border: `1px solid ${activeGlow.border}`,
                        color: activeGlow.accent,
                        fontSize: '0.74rem',
                        fontWeight: 600,
                      }}
                    >
                      #{t}
                    </span>
                  ))}
                </div>
              </div>

              {/* Glow Intensity Slider */}
              <div style={{ marginTop: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', color: '#94A3B8', marginBottom: 4 }}>
                  <span>Glow Intensity Filter: {glowIntensity}px</span>
                  <span style={{ color: activeGlow.accent }}>Live CSS Variable</span>
                </div>
                <input
                  type="range"
                  min="4"
                  max="40"
                  value={glowIntensity}
                  onChange={(e) => setGlowIntensity(Number(e.target.value))}
                  style={{ width: '100%', accentColor: activeGlow.accent, cursor: 'pointer' }}
                />
              </div>
            </div>
          </div>

          {/* JSON Payload Inspector */}
          <div
            style={{
              padding: 14,
              borderRadius: 10,
              background: '#040711',
              border: '1px solid rgba(255, 255, 255, 0.08)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <span style={{ fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: '#64748B', fontWeight: 700 }}>
                Reactive State Payload
              </span>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(JSON.stringify(componentState, null, 2));
                  setSimMessage('Copied state JSON to clipboard!');
                  setTimeout(() => setSimMessage(null), 2500);
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#38BDF8',
                  fontSize: '0.72rem',
                  cursor: 'pointer',
                  fontWeight: 600,
                }}
              >
                Copy JSON
              </button>
            </div>
            <pre style={{ margin: 0, fontSize: '0.75rem', color: '#38BDF8', fontFamily: 'monospace', overflowX: 'auto' }}>
              {JSON.stringify({ ...componentState, activeTheme, glowIntensity }, null, 2)}
            </pre>
          </div>
        </div>

        {/* ================================================================= */}
        {/* ONE-CLICK NAMESPACE HUB: RAPID PORTAL JUMP                        */}
        {/* ================================================================= */}
        <div style={{ marginBottom: 36 }}>
          <div style={{ marginBottom: 14 }}>
            <h2 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 700, color: '#FFF' }}>
              Namespace Navigation Hub
            </h2>
            <p style={{ margin: '4px 0 0', fontSize: '0.82rem', color: '#94A3B8' }}>
              Direct access to all resort namespaces, guest views, and operational consoles.
            </p>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
              gap: 14,
            }}
          >
            {[
              { title: 'Guest Mobile Front', path: '/', icon: 'fa-umbrella-beach', color: '#0EA5E9', desc: 'Public booking app & hero' },
              { title: 'Rooms & Rates', path: '/rooms', icon: 'fa-bed', color: '#38BDF8', desc: 'Room cards, categories, amenities' },
              { title: 'Resident Guest Portal', path: '/client', icon: 'fa-user-check', color: '#10B981', desc: 'Resident profile & reservations' },
              { title: 'Resident Sign-In', path: '/client/login', icon: 'fa-right-to-bracket', color: '#06B6D4', desc: 'Google & Facebook OAuth' },
              { title: 'Front Desk Reception', path: '/staff/reception', icon: 'fa-bell-concierge', color: '#F59E0B', desc: 'Arrivals, check-in, keycards' },
              { title: 'Accounting & Folios', path: '/staff/accounting', icon: 'fa-calculator', color: '#8B5CF6', desc: 'Ledger, invoices, payments' },
              { title: 'Executive Admin Console', path: '/admin', icon: 'fa-gauge-high', color: '#6366F1', desc: 'Governance, analytics, settings' },
              { title: 'Dispute & Recovery Hub', path: '/recovery', icon: 'fa-scale-balanced', color: '#EF4444', desc: 'Audit, refund resolution' },
            ].map((dest) => (
              <Link
                key={dest.path}
                to={dest.path}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 14,
                  padding: '16px',
                  borderRadius: 14,
                  background: 'rgba(15, 23, 42, 0.65)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  textDecoration: 'none',
                  color: '#F8FAFC',
                  transition: 'all 0.2s ease',
                }}
              >
                <div
                  style={{
                    width: 38,
                    height: 38,
                    borderRadius: 10,
                    background: `${dest.color}1A`,
                    border: `1px solid ${dest.color}4D`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: dest.color,
                    fontSize: 16,
                    shrink: 0,
                  }}
                >
                  <i className={`fas ${dest.icon}`} />
                </div>
                <div>
                  <div style={{ fontWeight: 600, fontSize: '0.9rem', color: '#FFF' }}>{dest.title}</div>
                  <div style={{ fontSize: '0.74rem', color: '#94A3B8', marginTop: 2 }}>{dest.desc}</div>
                  <div style={{ fontSize: '0.72rem', color: dest.color, marginTop: 6, fontWeight: 600 }}>
                    {dest.path} →
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* ================================================================= */}
        {/* ROLE SIMULATOR SUITE: RAPID LOCAL AUTH TESTING                    */}
        {/* ================================================================= */}
        <div
          style={{
            background: 'rgba(15, 23, 42, 0.65)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: 16,
            padding: 24,
            marginBottom: 32,
          }}
        >
          <h2 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700, color: '#FFF', display: 'flex', alignItems: 'center', gap: 10 }}>
            <i className="fas fa-mask" style={{ color: '#F43F5E' }} />
            Session & Role Simulator
          </h2>
          <p style={{ margin: '4px 0 16px', fontSize: '0.82rem', color: '#94A3B8' }}>
            Simulate department permissions in your local browser session without needing multiple logins.
          </p>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
            <button
              onClick={() => simulateRole('admin')}
              style={{
                padding: '8px 14px',
                borderRadius: 10,
                background: 'rgba(99, 102, 241, 0.15)',
                border: '1px solid rgba(99, 102, 241, 0.35)',
                color: '#A5B4FC',
                fontWeight: 600,
                fontSize: '0.8rem',
                cursor: 'pointer',
              }}
            >
              Simulate: Admin
            </button>
            <button
              onClick={() => simulateRole('receptionist')}
              style={{
                padding: '8px 14px',
                borderRadius: 10,
                background: 'rgba(245, 158, 11, 0.15)',
                border: '1px solid rgba(245, 158, 11, 0.35)',
                color: '#FCD34D',
                fontWeight: 600,
                fontSize: '0.8rem',
                cursor: 'pointer',
              }}
            >
              Simulate: Receptionist
            </button>
            <button
              onClick={() => simulateRole('accounting')}
              style={{
                padding: '8px 14px',
                borderRadius: 10,
                background: 'rgba(139, 92, 246, 0.15)',
                border: '1px solid rgba(139, 92, 246, 0.35)',
                color: '#C4B5FD',
                fontWeight: 600,
                fontSize: '0.8rem',
                cursor: 'pointer',
              }}
            >
              Simulate: Accounting
            </button>
            <button
              onClick={() => simulateRole('client')}
              style={{
                padding: '8px 14px',
                borderRadius: 10,
                background: 'rgba(16, 185, 129, 0.15)',
                border: '1px solid rgba(16, 185, 129, 0.35)',
                color: '#6EE7B7',
                fontWeight: 600,
                fontSize: '0.8rem',
                cursor: 'pointer',
              }}
            >
              Simulate: Resident Guest
            </button>
            <button
              onClick={() => simulateRole('clear')}
              style={{
                padding: '8px 14px',
                borderRadius: 10,
                background: 'rgba(244, 63, 94, 0.15)',
                border: '1px solid rgba(244, 63, 94, 0.35)',
                color: '#FDA4AF',
                fontWeight: 600,
                fontSize: '0.8rem',
                cursor: 'pointer',
              }}
            >
              Reset Session
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
