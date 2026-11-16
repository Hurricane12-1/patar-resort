import React, { useState, useEffect } from 'react';

export interface GoogleAccount {
  email: string;
  name: string;
  avatarBg?: string;
  avatarUrl?: string;
}

const DEFAULT_GOOGLE_ACCOUNTS: GoogleAccount[] = [
  { email: 'maria.santos@gmail.com', name: 'Maria Santos', avatarBg: '#1a73e8' },
  { email: 'juandelacruz@gmail.com', name: 'Juan Dela Cruz', avatarBg: '#1e8e3e' },
];

const STORAGE_KEY = 'rv_google_saved_accounts';

export function getSavedGoogleAccounts(): GoogleAccount[] {
  try {
    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    }
  } catch {}
  return DEFAULT_GOOGLE_ACCOUNTS;
}

export function saveGoogleAccount(acc: GoogleAccount) {
  try {
    if (typeof localStorage !== 'undefined') {
      const existing = getSavedGoogleAccounts();
      const filtered = existing.filter((a) => a.email.toLowerCase() !== acc.email.toLowerCase());
      const updated = [acc, ...filtered].slice(0, 5);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    }
  } catch {}
}

interface GoogleAccountChooserModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectAccount: (account: GoogleAccount) => Promise<void> | void;
  isLoading?: boolean;
}

export default function GoogleAccountChooserModal({
  isOpen,
  onClose,
  onSelectAccount,
  isLoading = false,
}: GoogleAccountChooserModalProps) {
  const [accounts, setAccounts] = useState<GoogleAccount[]>([]);
  const [showAddAnother, setShowAddAnother] = useState(false);
  const [customEmail, setCustomEmail] = useState('');
  const [customName, setCustomName] = useState('');
  const [selectedEmail, setSelectedEmail] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setAccounts(getSavedGoogleAccounts());
      setShowAddAnother(false);
      setCustomEmail('');
      setCustomName('');
      setSelectedEmail(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handlePick = async (acc: GoogleAccount) => {
    if (isLoading) return;
    setSelectedEmail(acc.email);
    saveGoogleAccount(acc);
    await onSelectAccount(acc);
  };

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customEmail.trim() || !customEmail.includes('@')) return;
    const cleanEmail = customEmail.trim().toLowerCase();
    const cleanName = customName.trim() || cleanEmail.split('@')[0];
    const newAcc: GoogleAccount = {
      email: cleanEmail,
      name: cleanName,
      avatarBg: '#d93025',
    };
    setSelectedEmail(cleanEmail);
    saveGoogleAccount(newAcc);
    setAccounts((prev) => [newAcc, ...prev.filter((a) => a.email.toLowerCase() !== cleanEmail)]);
    await onSelectAccount(newAcc);
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 99999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(15, 23, 42, 0.72)',
        backdropFilter: 'blur(8px)',
        padding: '16px',
        animation: 'gFadeIn 0.18s ease-out',
      }}
      onClick={() => {
        if (!isLoading) onClose();
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 440,
          background: '#FFFFFF',
          borderRadius: 24,
          boxShadow: '0 12px 40px rgba(0, 0, 0, 0.28), 0 0 0 1px rgba(0, 0, 0, 0.06)',
          overflow: 'hidden',
          position: 'relative',
          fontFamily: "'Plus Jakarta Sans', Roboto, -apple-system, BlinkMacSystemFont, sans-serif",
          color: '#202124',
          animation: 'gScaleUp 0.22s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* TOP GOOGLE PROGRESS BAR */}
        {isLoading && (
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              height: 4,
              background: '#E8F0FE',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                width: '40%',
                height: '100%',
                background: '#1a73e8',
                borderRadius: 2,
                animation: 'gIndeterminate 1.2s infinite linear',
              }}
            />
          </div>
        )}

        {/* MODAL HEADER */}
        <div style={{ padding: '28px 28px 16px', position: 'relative' }}>
          {/* Close Button */}
          {!isLoading && (
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              style={{
                position: 'absolute',
                top: 20,
                right: 20,
                width: 34,
                height: 34,
                borderRadius: '50%',
                border: 'none',
                background: 'transparent',
                color: '#5f6368',
                fontSize: '1.25rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                transition: 'background 0.15s ease',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = '#f1f3f4')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
            >
              ×
            </button>
          )}

          {/* Google Logo */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
            <svg width="26" height="26" viewBox="0 0 24 24" aria-hidden="true">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
            </svg>
            <span style={{ fontSize: '0.98rem', fontWeight: 600, color: '#3c4043', letterSpacing: '-0.01em' }}>
              Sign in with Google
            </span>
          </div>

          <h2 style={{ margin: '0 0 4px', fontSize: '1.45rem', fontWeight: 500, color: '#202124', letterSpacing: '-0.01em' }}>
            Choose an account
          </h2>
          <p style={{ margin: 0, fontSize: '0.9rem', color: '#5f6368', lineHeight: 1.4 }}>
            to continue to <strong style={{ color: '#202124' }}>Rock View Beach Resort</strong>
          </p>
        </div>

        {/* DIVIDER */}
        <div style={{ height: 1, background: '#dadce0', margin: '0 28px' }} />

        {/* ACCOUNT LIST */}
        <div style={{ padding: '8px 16px 12px' }}>
          {!showAddAnother ? (
            <>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {accounts.map((acc) => {
                  const isThisSelected = selectedEmail === acc.email;
                  return (
                    <button
                      key={acc.email}
                      type="button"
                      disabled={isLoading}
                      onClick={() => handlePick(acc)}
                      style={{
                        width: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 16,
                        padding: '12px 14px',
                        borderRadius: 14,
                        border: 'none',
                        background: isThisSelected ? '#E8F0FE' : 'transparent',
                        textAlign: 'left',
                        cursor: isLoading ? 'default' : 'pointer',
                        transition: 'background 0.15s ease',
                      }}
                      onMouseEnter={(e) => {
                        if (!isLoading && !isThisSelected) e.currentTarget.style.background = '#f8fafd';
                      }}
                      onMouseLeave={(e) => {
                        if (!isThisSelected) e.currentTarget.style.background = 'transparent';
                      }}
                    >
                      {/* Avatar Circle */}
                      <div
                        style={{
                          width: 42,
                          height: 42,
                          borderRadius: '50%',
                          background: acc.avatarBg || '#1a73e8',
                          color: '#FFFFFF',
                          fontSize: '1.15rem',
                          fontWeight: 600,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                          boxShadow: '0 2px 6px rgba(0,0,0,0.1)',
                        }}
                      >
                        {acc.name ? acc.name.charAt(0).toUpperCase() : acc.email.charAt(0).toUpperCase()}
                      </div>

                      {/* Name & Email */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: '0.95rem', fontWeight: 600, color: '#202124', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {acc.name || acc.email.split('@')[0]}
                        </div>
                        <div style={{ fontSize: '0.82rem', color: '#5f6368', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {acc.email}
                        </div>
                      </div>

                      {/* Status / Check */}
                      {isThisSelected ? (
                        <div style={{ color: '#1a73e8', fontSize: '0.9rem', fontWeight: 600 }}>
                          Signing in…
                        </div>
                      ) : (
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="#9aa0a6" aria-hidden="true">
                          <path d="M8.59 16.59L13.17 12 8.59 7.41 10 6l6 6-6 6-1.41-1.41z" />
                        </svg>
                      )}
                    </button>
                  );
                })}

                {/* Use another account option */}
                <button
                  type="button"
                  disabled={isLoading}
                  onClick={() => setShowAddAnother(true)}
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 16,
                    padding: '12px 14px',
                    borderRadius: 14,
                    border: 'none',
                    background: 'transparent',
                    textAlign: 'left',
                    cursor: isLoading ? 'default' : 'pointer',
                    marginTop: 2,
                    transition: 'background 0.15s ease',
                  }}
                  onMouseEnter={(e) => {
                    if (!isLoading) e.currentTarget.style.background = '#f8fafd';
                  }}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                >
                  <div
                    style={{
                      width: 42,
                      height: 42,
                      borderRadius: '50%',
                      border: '1.5px solid #dadce0',
                      color: '#5f6368',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M15 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm-9-2V7H4v3H1v2h3v3h2v-3h3v-2H6zm9 4c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
                    </svg>
                  </div>
                  <div style={{ flex: 1, fontSize: '0.94rem', fontWeight: 500, color: '#202124' }}>
                    Use another account
                  </div>
                </button>
              </div>
            </>
          ) : (
            <form onSubmit={handleAddSubmit} style={{ padding: '8px 10px 4px' }}>
              <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#3c4043', marginBottom: 6 }}>
                  Email or phone
                </label>
                <input
                  type="email"
                  required
                  autoFocus
                  placeholder="yourname@gmail.com"
                  value={customEmail}
                  onChange={(e) => setCustomEmail(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '12px 14px',
                    borderRadius: 8,
                    border: '1px solid #747775',
                    fontSize: '0.95rem',
                    color: '#1f1f1f',
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                  onFocus={(e) => (e.currentTarget.style.borderColor = '#1a73e8')}
                  onBlur={(e) => (e.currentTarget.style.borderColor = '#747775')}
                />
              </div>

              <div style={{ marginBottom: 18 }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#3c4043', marginBottom: 6 }}>
                  Resident Name (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Maria Santos"
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '12px 14px',
                    borderRadius: 8,
                    border: '1px solid #747775',
                    fontSize: '0.95rem',
                    color: '#1f1f1f',
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                  onFocus={(e) => (e.currentTarget.style.borderColor = '#1a73e8')}
                  onBlur={(e) => (e.currentTarget.style.borderColor = '#747775')}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                <button
                  type="button"
                  onClick={() => setShowAddAnother(false)}
                  style={{
                    padding: '10px 18px',
                    borderRadius: 20,
                    border: 'none',
                    background: 'transparent',
                    color: '#1a73e8',
                    fontSize: '0.88rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Back
                </button>
                <button
                  type="submit"
                  disabled={isLoading}
                  style={{
                    padding: '10px 24px',
                    borderRadius: 20,
                    border: 'none',
                    background: '#1a73e8',
                    color: '#FFFFFF',
                    fontSize: '0.88rem',
                    fontWeight: 600,
                    cursor: isLoading ? 'default' : 'pointer',
                    boxShadow: '0 1px 3px rgba(66, 133, 244, 0.3)',
                  }}
                >
                  {isLoading ? 'Signing in…' : 'Next'}
                </button>
              </div>
            </form>
          )}
        </div>

        {/* FOOTER DISCLAIMER */}
        <div
          style={{
            padding: '16px 28px 24px',
            background: '#fafbfc',
            borderTop: '1px solid #f1f3f4',
            fontSize: '0.76rem',
            color: '#5f6368',
            lineHeight: 1.5,
          }}
        >
          To continue, Google will share your name, email address, language preference, and profile picture with Rock View Beach Resort.
          Before using this app, review Rock View Beach Resort’s <span style={{ color: '#1a73e8' }}>Privacy Policy</span> and <span style={{ color: '#1a73e8' }}>Terms of Service</span>.
        </div>
      </div>

      <style>{`
        @keyframes gFadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes gScaleUp {
          from { transform: scale(0.95); opacity: 0; }
          to { transform: scale(1); opacity: 1; }
        }
        @keyframes gIndeterminate {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(250%); }
        }
      `}</style>
    </div>
  );
}
