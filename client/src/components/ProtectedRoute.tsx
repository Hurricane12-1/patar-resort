import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.tsx';
import { toast } from './Toasts.tsx';

/* ── tiny animated particle field ── */
function Particles({ count = 30, color = 'rgba(56,189,248,0.15)' }) {
  const canvasRef = useRef(null);
  useEffect(() => {
    const cvs = canvasRef.current;
    if (!cvs) return;
    const ctx = cvs.getContext('2d');
    let raf;
    const resize = () => { cvs.width = cvs.offsetWidth; cvs.height = cvs.offsetHeight; };
    resize();
    window.addEventListener('resize', resize);
    const dots = Array.from({ length: count }, () => ({
      x: Math.random() * cvs.width,
      y: Math.random() * cvs.height,
      r: Math.random() * 2 + 0.5,
      dx: (Math.random() - 0.5) * 0.4,
      dy: (Math.random() - 0.5) * 0.3,
      o: Math.random() * 0.5 + 0.2,
    }));
    const draw = () => {
      ctx.clearRect(0, 0, cvs.width, cvs.height);
      dots.forEach((d) => {
        d.x += d.dx; d.y += d.dy;
        if (d.x < 0 || d.x > cvs.width) d.dx *= -1;
        if (d.y < 0 || d.y > cvs.height) d.dy *= -1;
        ctx.beginPath();
        ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2);
        ctx.fillStyle = color.replace(/[\d.]+\)$/, `${d.o})`);
        ctx.fill();
      });
      raf = requestAnimationFrame(draw);
    };
    draw();
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', resize); };
  }, [count, color]);
  return <canvas ref={canvasRef} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 0 }} />;
}

export default function ProtectedRoute({ children, allowedRoles = [], portalTitle = 'Restricted Portal' }) {
  const { session, profile, signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPwd, setShowPwd] = useState(false);
  const [mounted, setMounted] = useState(true);

  useEffect(() => { setMounted(true); }, []);

  const isAuthenticated = Boolean(session && profile);
  const isAuthorized = isAuthenticated && (
    allowedRoles.length === 0 ||
    allowedRoles.includes(profile.role) ||
    ['administrator', 'admin'].includes(profile.role)
  );

  if (isAuthorized) return children;

  const isCustomer = allowedRoles.length > 0 && allowedRoles[0] === 'customer';
  const isAdmin = allowedRoles.includes('administrator');

  const handleGateLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (!email.trim() || !password) {
        toast('Please enter your email and password.', true);
        setLoading(false);
        return;
      }
      const targetEmail = email.trim();
      const res = await signIn(targetEmail, password);
      if (res?.error) throw res.error;
      toast(`Welcome to ${portalTitle} ✦`);
    } catch (err) {
      toast(err.message || 'Authentication failed', true);
    } finally {
      setLoading(false);
    }
  };

  const accent = isCustomer ? '#38BDF8' : isAdmin ? '#A78BFA' : '#34D399';
  const accentRgb = isCustomer ? '56,189,248' : isAdmin ? '167,139,250' : '52,211,153';
  const gradientFrom = isCustomer ? 'rgba(8,47,73,0.95)' : 'rgba(15,10,40,0.95)';
  const gradientTo = isCustomer ? 'rgba(2,6,23,1)' : 'rgba(2,6,23,1)';

  return (
    <div className="gate-page" style={{
      minHeight: '100vh', width: '100vw', position: 'fixed', top: 0, left: 0, zIndex: 99999,
      background: `radial-gradient(ellipse at 30% 20%, ${gradientFrom} 0%, ${gradientTo} 100%)`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '24px 16px', boxSizing: 'border-box', overflow: 'hidden',
    }}>
      <Particles count={isCustomer ? 40 : 25} color={`rgba(${accentRgb},0.2)`} />

      {/* Animated wave for customer portals */}
      {isCustomer && (
        <svg viewBox="0 0 1440 320" preserveAspectRatio="none" style={{
          position: 'absolute', bottom: 0, left: 0, width: '100%', height: 120, opacity: 0.08, zIndex: 0
        }}>
          <path fill={accent} d="M0,224L48,213.3C96,203,192,181,288,186.7C384,192,480,224,576,218.7C672,213,768,171,864,154.7C960,139,1056,149,1152,165.3C1248,181,1344,203,1392,213.3L1440,224L1440,320L1392,320C1344,320,1248,320,1152,320C1056,320,960,320,864,320C768,320,672,320,576,320C480,320,384,320,288,320C192,320,96,320,48,320L0,320Z">
            <animate attributeName="d" dur="8s" repeatCount="indefinite" values="
              M0,224L48,213.3C96,203,192,181,288,186.7C384,192,480,224,576,218.7C672,213,768,171,864,154.7C960,139,1056,149,1152,165.3C1248,181,1344,203,1392,213.3L1440,224L1440,320L0,320Z;
              M0,192L48,202.7C96,213,192,235,288,229.3C384,224,480,192,576,186.7C672,181,768,203,864,213.3C960,224,1056,224,1152,208C1248,192,1344,160,1392,144L1440,128L1440,320L0,320Z;
              M0,224L48,213.3C96,203,192,181,288,186.7C384,192,480,224,576,218.7C672,213,768,171,864,154.7C960,139,1056,149,1152,165.3C1248,181,1344,203,1392,213.3L1440,224L1440,320L0,320Z
            " />
          </path>
        </svg>
      )}

      <div style={{
        position: 'relative', zIndex: 1, width: '100%', maxWidth: 460,
        opacity: mounted ? 1 : 0,
        transform: mounted ? 'translateY(0)' : 'translateY(20px)',
        transition: 'opacity 0.6s cubic-bezier(0.16,1,0.3,1), transform 0.6s cubic-bezier(0.16,1,0.3,1)',
      }}>
        {/* Logo & Branding */}
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            width: 56, height: 56, borderRadius: 16,
            background: `linear-gradient(135deg, rgba(${accentRgb},0.25), rgba(${accentRgb},0.45))`,
            border: `1px solid rgba(${accentRgb},0.4)`,
            boxShadow: `0 0 40px rgba(${accentRgb},0.25)`,
            marginBottom: 14,
          }}>
            <svg width="30" height="30" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="7" r="3" fill="#F59E0B" />
              <path d="M2 17c3-3 6-3 9 0s6 3 9 0" stroke={accent} strokeWidth="2" strokeLinecap="round" opacity="0.9" />
              <path d="M2 12c3-2 6-2 9 0s6 2 9 0" stroke={accent} strokeWidth="1.5" strokeLinecap="round" opacity="0.6" />
            </svg>
          </div>
          <h1 className="serif" style={{ fontSize: 'clamp(1.6rem,3vw,2rem)', color: '#FFF', margin: 0, letterSpacing: '.06em' }}>
            ROCK VIEW BEACH RESORT
          </h1>
          <span style={{
            display: 'inline-block', fontSize: '.65rem', letterSpacing: '.28em', color: accent,
            fontWeight: 800, textTransform: 'uppercase', marginTop: 4,
          }}>
            {isCustomer ? 'GUEST & CUSTOMER PORTAL' : 'EXECUTIVE & MANAGEMENT PORTAL'}
          </span>
        </div>

        {/* Login Card */}
        <div style={{
          background: 'rgba(15, 23, 42, 0.85)',
          backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)',
          border: `1px solid rgba(${accentRgb}, 0.25)`,
          boxShadow: `0 24px 80px rgba(0,0,0,0.5), 0 0 60px rgba(${accentRgb},0.08), inset 0 1px 0 rgba(255,255,255,0.06)`,
          borderRadius: 20, padding: 'clamp(24px,4vw,36px)', position: 'relative', overflow: 'hidden',
        }}>
          {/* Accent glow line at top */}
          <div style={{
            position: 'absolute', top: 0, left: '15%', right: '15%', height: 2,
            background: `linear-gradient(90deg, transparent, ${accent}, transparent)`, opacity: 0.5,
          }} />

          <div style={{ textAlign: 'center', marginBottom: 24 }}>
            <span style={{
              fontSize: '.7rem', letterSpacing: '.2em', color: accent,
              fontWeight: 700, textTransform: 'uppercase',
            }}>
              SECURE SIGN IN
            </span>
            <h2 className="serif" style={{ fontSize: 'clamp(1.4rem,3vw,1.75rem)', color: '#FFF', margin: '6px 0 8px' }}>
              {portalTitle}
            </h2>
            <p style={{ color: '#94A3B8', fontSize: '.88rem', lineHeight: 1.55, margin: 0 }}>
              {isAuthenticated
                ? `Signed in as ${profile.full_name || profile.role} (${profile.role}). You need ${allowedRoles.join(' or ')} authorization.`
                : isCustomer
                ? 'Sign in with your registered account to access your resort bookings, services, and digital room pass.'
                : 'Enter authorized credentials to access this management portal.'}
            </p>
          </div>

          <form onSubmit={handleGateLogin}>
            {/* Email Field */}
            <div style={{ marginBottom: 16 }}>
              <label style={{
                display: 'block', fontSize: '.72rem', fontWeight: 700, letterSpacing: '.14em',
                color: '#94A3B8', textTransform: 'uppercase', marginBottom: 6,
              }}>
                EMAIL ADDRESS
              </label>
              <div style={{ position: 'relative' }}>
                <span style={{
                  position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)',
                  color: '#475569', fontSize: '1rem', pointerEvents: 'none',
                }}>✉</span>
                <input
                  type="email"
                  value={email}
                  placeholder={'your@email.com'}
                  onChange={(e) => setEmail(e.target.value)}
                  style={{
                    width: '100%', padding: '13px 14px 13px 40px', boxSizing: 'border-box',
                    background: 'rgba(30,41,59,0.7)', border: `1px solid rgba(${accentRgb},0.2)`,
                    borderRadius: 12, color: '#E2E8F0', fontSize: '.92rem',
                    outline: 'none', transition: 'border-color 0.3s, box-shadow 0.3s',
                  }}
                  onFocus={(e) => { e.target.style.borderColor = accent; e.target.style.boxShadow = `0 0 0 3px rgba(${accentRgb},0.15)`; }}
                  onBlur={(e) => { e.target.style.borderColor = `rgba(${accentRgb},0.2)`; e.target.style.boxShadow = 'none'; }}
                />
              </div>
            </div>

            {/* Password Field */}
            <div style={{ marginBottom: 20 }}>
              <label style={{
                display: 'block', fontSize: '.72rem', fontWeight: 700, letterSpacing: '.14em',
                color: '#94A3B8', textTransform: 'uppercase', marginBottom: 6,
              }}>
                PASSWORD
              </label>
              <div style={{ position: 'relative' }}>
                <span style={{
                  position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)',
                  color: '#475569', fontSize: '1rem', pointerEvents: 'none',
                }}>🔑</span>
                <input
                  type={showPwd ? 'text' : 'password'}
                  value={password}
                  placeholder="••••••••"
                  onChange={(e) => setPassword(e.target.value)}
                  style={{
                    width: '100%', padding: '13px 48px 13px 40px', boxSizing: 'border-box',
                    background: 'rgba(30,41,59,0.7)', border: `1px solid rgba(${accentRgb},0.2)`,
                    borderRadius: 12, color: '#E2E8F0', fontSize: '.92rem',
                    outline: 'none', transition: 'border-color 0.3s, box-shadow 0.3s',
                  }}
                  onFocus={(e) => { e.target.style.borderColor = accent; e.target.style.boxShadow = `0 0 0 3px rgba(${accentRgb},0.15)`; }}
                  onBlur={(e) => { e.target.style.borderColor = `rgba(${accentRgb},0.2)`; e.target.style.boxShadow = 'none'; }}
                />
                <button type="button" onClick={() => setShowPwd(!showPwd)} style={{
                  position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
                  background: 'none', border: 'none', color: '#64748B', cursor: 'pointer',
                  fontSize: '.82rem', padding: 4,
                }}>
                  {showPwd ? '🙈' : '👁'}
                </button>
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%', padding: '14px 20px', border: 'none', borderRadius: 12, cursor: 'pointer',
                background: loading
                  ? 'rgba(100,116,139,0.5)'
                  : `linear-gradient(135deg, ${accent}, ${isCustomer ? '#0EA5E9' : isAdmin ? '#8B5CF6' : '#10B981'})`,
                color: '#FFF', fontSize: '.9rem', fontWeight: 800, letterSpacing: '.08em',
                textTransform: 'uppercase', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                boxShadow: loading ? 'none' : `0 6px 24px rgba(${accentRgb},0.3)`,
                transition: 'all 0.3s ease', transform: 'scale(1)',
              }}
              onMouseEnter={(e) => { if (!loading) { e.target.style.transform = 'scale(1.02)'; e.target.style.boxShadow = `0 8px 32px rgba(${accentRgb},0.45)`; }}}
              onMouseLeave={(e) => { e.target.style.transform = 'scale(1)'; e.target.style.boxShadow = `0 6px 24px rgba(${accentRgb},0.3)`; }}
            >
              {loading && (
                <span style={{
                  width: 16, height: 16, border: '2px solid rgba(255,255,255,0.3)',
                  borderTopColor: '#FFF', borderRadius: '50%',
                  animation: 'gate-spin 0.8s linear infinite', display: 'inline-block',
                }} />
              )}
              {loading ? 'Authenticating…' : `Sign In to ${portalTitle}`}
            </button>
          </form>

          {/* Footer */}
          <div style={{
            marginTop: 20, textAlign: 'center', paddingTop: 16,
            borderTop: '1px solid rgba(255,255,255,0.06)',
          }}>
            <Link to="/" style={{
              fontSize: '.8rem', color: '#64748B', textDecoration: 'none',
              transition: 'color 0.2s',
            }}
              onMouseEnter={(e) => e.target.style.color = accent}
              onMouseLeave={(e) => e.target.style.color = '#64748B'}
            >
              ← Return to Public Guest Website
            </Link>
          </div>
        </div>

        {/* Trust badges for customer */}
        {isCustomer && (
          <div style={{
            display: 'flex', justifyContent: 'center', gap: 24, marginTop: 20,
            opacity: 0.5, fontSize: '.72rem', color: '#64748B', letterSpacing: '.05em',
          }}>
            <span>🔒 SSL Encrypted</span>
            <span>🏨 Verified Resort</span>
            <span>📟 SMS Alerts</span>
          </div>
        )}
      </div>
    </div>
  );
}
