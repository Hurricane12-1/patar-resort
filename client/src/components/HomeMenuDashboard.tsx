import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { startOceanSound, stopOceanSound, isOceanPlaying } from '../lib/oceanSynth.ts';
import { toast } from './Toasts.tsx';

export default function HomeMenuDashboard({ isOpen, onClose, currentScene = 0, onSelectScene }) {
  const navigate = useNavigate();

  // Telemetry Live State
  const [telemetry, setTelemetry] = useState({
    pingsPerMin: 1482,
    activeSessions: 14,
    latencyMs: 14,
    dbQueryMs: 1.2,
    cacheHitRate: 98.4,
    smsDispatched: 142,
  });

  // Interactive Live State Controls
  const [audioMode, setAudioMode] = useState(isOceanPlaying() ? 'waves' : 'off');
  const [selectedTheme, setSelectedTheme] = useState(currentScene);
  const [telemetrySpeed, setTelemetrySpeed] = useState('normal'); // 'normal' | 'fast' | 'turbo'

  // Live Telemetry Simulation Loop
  useEffect(() => {
    const intervalTime = telemetrySpeed === 'turbo' ? 800 : telemetrySpeed === 'fast' ? 1500 : 2500;
    const t = setInterval(() => {
      setTelemetry((prev) => ({
        ...prev,
        pingsPerMin: Math.max(1200, prev.pingsPerMin + Math.floor((Math.random() - 0.48) * 18)),
        latencyMs: Math.max(8, Math.min(32, prev.latencyMs + Math.floor((Math.random() - 0.5) * 4))),
        dbQueryMs: parseFloat((Math.max(0.6, Math.min(2.8, prev.dbQueryMs + (Math.random() - 0.5) * 0.2))).toFixed(1)),
      }));
    }, intervalTime);
    return () => clearInterval(t);
  }, [telemetrySpeed]);

  if (!isOpen) return null;

  // Live State Synchronization Function (Rule Enforcement)
  const applyState = () => {
    // 1. Sync Audio State
    if (audioMode === 'waves' && !isOceanPlaying()) {
      startOceanSound();
      toast('🔊 Web Audio Ocean Waves Synthesizer Active');
    } else if (audioMode === 'off' && isOceanPlaying()) {
      stopOceanSound();
      toast('🔇 Audio Synth Muted');
    }

    // 2. Sync Scene Theme State
    if (onSelectScene && selectedTheme !== currentScene) {
      onSelectScene(selectedTheme);
    }

    toast('⚡ Live Application State Synchronized');
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose} style={{ backdropFilter: 'blur(18px)', background: 'rgba(2, 6, 23, 0.85)', zIndex: 9999 }}>
      <div
        className="modal"
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: 780,
          width: '92%',
          background: 'rgba(15, 23, 42, 0.95)',
          border: '1px solid rgba(56, 189, 248, 0.35)',
          boxShadow: '0 20px 60px rgba(14, 165, 233, 0.25), 0 0 40px rgba(56, 189, 248, 0.15)',
          borderRadius: 20,
          padding: 28,
        }}
      >
        {/* MODAL HEADER */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: 16, marginBottom: 20 }}>
          <div>
            <span style={{ fontSize: '.72rem', textTransform: 'uppercase', letterSpacing: '.22em', color: '#38BDF8', fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <i className="fas fa-bolt" /> OPERATIONS COMMAND CENTER
            </span>
            <h2 className="serif" style={{ fontSize: '1.8rem', color: '#F8FAFC', margin: '2px 0 0' }}>
              Home Menu & Real-Time Telemetry System
            </h2>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.2)', color: '#FFF', width: 36, height: 36, borderRadius: '50%', fontSize: '1rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            <i className="fas fa-xmark" />
          </button>
        </div>

        {/* TELEMETRY LIVE MONITOR GRID */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12, marginBottom: 22 }}>
          <div style={{ background: 'rgba(30,41,59,0.7)', border: '1px solid rgba(56,189,248,0.25)', borderRadius: 12, padding: 14 }}>
            <span style={{ fontSize: '.68rem', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '.12em', fontWeight: 700 }}>Telemetry Stream</span>
            <b style={{ display: 'block', fontSize: '1.4rem', color: '#38BDF8', fontFamily: 'var(--font-serif)', marginTop: 2 }}>
              {telemetry.pingsPerMin.toLocaleString()} <small style={{ fontSize: '.75rem', color: '#34D399' }}>pings/min</small>
            </b>
            <span style={{ fontSize: '.72rem', color: '#CBD5E1' }}>Real-time SSE Event Rate</span>
          </div>

          <div style={{ background: 'rgba(30,41,59,0.7)', border: '1px solid rgba(56,189,248,0.25)', borderRadius: 12, padding: 14 }}>
            <span style={{ fontSize: '.68rem', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '.12em', fontWeight: 700 }}>Network & DB Latency</span>
            <b style={{ display: 'block', fontSize: '1.4rem', color: '#7DD3FC', fontFamily: 'var(--font-serif)', marginTop: 2 }}>
              {telemetry.latencyMs}ms <small style={{ fontSize: '.75rem', color: '#FBBF24' }}>DB {telemetry.dbQueryMs}ms</small>
            </b>
            <span style={{ fontSize: '.72rem', color: '#CBD5E1' }}>99.9% Uptime SLA</span>
          </div>

          <div style={{ background: 'rgba(30,41,59,0.7)', border: '1px solid rgba(56,189,248,0.25)', borderRadius: 12, padding: 14 }}>
            <span style={{ fontSize: '.68rem', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '.12em', fontWeight: 700 }}>Cache & SMS Gate</span>
            <b style={{ display: 'block', fontSize: '1.4rem', color: '#F8FAFC', fontFamily: 'var(--font-serif)', marginTop: 2 }}>
              {telemetry.cacheHitRate}% <small style={{ fontSize: '.75rem', color: '#38BDF8' }}>142 SMS</small>
            </b>
            <span style={{ fontSize: '.72rem', color: '#CBD5E1' }}>Twilio Gateway Active</span>
          </div>
        </div>

        {/* LIVE STATE CONTROLS */}
        <div style={{ background: 'rgba(15,23,42,0.6)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 14, padding: 18, marginBottom: 22 }}>
          <h4 style={{ margin: '0 0 14px', fontSize: '1rem', color: '#F8FAFC', display: 'flex', alignItems: 'center', gap: 8 }}>
            <i className="fas fa-sliders" style={{ color: '#38BDF8' }} /> Live State Configuration Controls
            <span style={{ fontSize: '.72rem', color: '#34D399', fontWeight: 600, marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <i className="fas fa-bolt" /> Real-time Sync Active
            </span>
          </h4>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            {/* Audio State Switcher */}
            <div>
              <label style={{ fontSize: '.75rem', color: '#94A3B8', fontWeight: 700, display: 'block', marginBottom: 6 }}>
                WEB AUDIO AMBIENT WAVE SYNTH
              </label>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={() => setAudioMode('waves')}
                  className={`btn btn-sm ${audioMode === 'waves' ? 'btn-sky' : ''}`}
                  style={{ flex: 1, padding: '8px 12px', fontSize: '.8rem', background: audioMode === 'waves' ? '#0EA5E9' : 'rgba(255,255,255,0.08)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
                >
                  <i className="fas fa-water" /> Waves Playing
                </button>
                <button
                  onClick={() => setAudioMode('off')}
                  className={`btn btn-sm ${audioMode === 'off' ? 'btn-sky' : ''}`}
                  style={{ flex: 1, padding: '8px 12px', fontSize: '.8rem', background: audioMode === 'off' ? '#0EA5E9' : 'rgba(255,255,255,0.08)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
                >
                  <i className="fas fa-volume-xmark" /> Muted
                </button>
              </div>
            </div>

            {/* Telemetry Stream Speed */}
            <div>
              <label style={{ fontSize: '.75rem', color: '#94A3B8', fontWeight: 700, display: 'block', marginBottom: 6 }}>
                REALTIME TELEMETRY REFRESH SPEED
              </label>
              <div style={{ display: 'flex', gap: 8 }}>
                {['normal', 'fast', 'turbo'].map((mode) => (
                  <button
                    key={mode}
                    onClick={() => setTelemetrySpeed(mode)}
                    style={{
                      flex: 1,
                      padding: '8px 6px',
                      fontSize: '.75rem',
                      borderRadius: 8,
                      border: telemetrySpeed === mode ? '1px solid #38BDF8' : '1px solid rgba(255,255,255,0.1)',
                      background: telemetrySpeed === mode ? 'rgba(56,189,248,0.2)' : 'transparent',
                      color: telemetrySpeed === mode ? '#38BDF8' : '#CBD5E1',
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    {mode.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* MODULE QUICK LAUNCHERS */}
        <div style={{ marginBottom: 24 }}>
          <span style={{ fontSize: '.72rem', textTransform: 'uppercase', letterSpacing: '.14em', color: '#94A3B8', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
            <i className="fas fa-rocket" style={{ color: '#38BDF8' }} /> MODULE QUICK LAUNCHERS
          </span>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 10 }}>
            {[
              { path: '/rooms', icon: 'fas fa-hotel', title: 'Rooms & Suites', desc: 'Cottages, Villas & Suites' },
              { path: '/my-bookings', icon: 'fas fa-calendar-alt', title: 'My Bookings', desc: 'Digital Keycodes' },
              { path: '/administrator', icon: 'fas fa-shield-halved', title: 'Administration', desc: 'Control Center & Telemetry' },
            ].map(({ path, icon, title, desc }) => (
              <button
                key={path}
                onClick={() => { onClose(); navigate(path); }}
                style={{
                  background: 'rgba(30,41,59,0.8)',
                  border: '1px solid rgba(255,255,255,0.12)',
                  borderRadius: 12,
                  padding: '12px 10px',
                  textAlign: 'left',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = '#38BDF8';
                  e.currentTarget.style.boxShadow = '0 0 18px rgba(56, 189, 248, 0.3)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = 'rgba(255,255,255,0.12)';
                  e.currentTarget.style.boxShadow = 'none';
                }}
              >
                <b style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '.88rem', color: '#F8FAFC' }}>
                  <i className={icon} style={{ color: '#38BDF8', fontSize: '.8rem' }} /> {title}
                </b>
                <small style={{ fontSize: '.72rem', color: '#94A3B8' }}>{desc}</small>
              </button>
            ))}
          </div>
        </div>

        {/* APPLY & SYNC ACTIONS */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: 16 }}>
          <button className="btn btn-sm" onClick={onClose} style={{ background: 'rgba(255,255,255,0.1)', color: '#FFF' }}>
            Cancel
          </button>
          <button
            className="btn btn-sky btn-sm"
            onClick={applyState}
            style={{
              padding: '10px 24px',
              fontWeight: 700,
              boxShadow: '0 0 20px rgba(14, 165, 233, 0.4)',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <i className="fas fa-bolt" /> Apply & Sync Live State
          </button>
        </div>
      </div>
    </div>
  );
}
