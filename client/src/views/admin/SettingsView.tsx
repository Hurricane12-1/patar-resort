import React, { useState } from 'react';
import { optimizeCloudinaryUrl } from '../../lib/cloudinary';
import { api } from '../../lib/api';

export interface SettingsViewProps {
  adminProfileState: any;
  setAdminProfileState: React.Dispatch<React.SetStateAction<any>>;
  currentAdminProfile: any;
  handleSaveSettings: (e: React.FormEvent) => void;
  savingSettings: boolean;
  handleAvatarUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  uploadingAvatar: boolean;
  handleRemoveAvatar: () => void;
  deleteAccount?: () => Promise<void>;
  updatePassword?: (pwd: string) => Promise<void>;
  setActiveTab: (tab: string) => void;
  isLightMode: boolean;
  themeCardBg: string;
  themeBorder: string;
  themeShadow: string;
  themeText: string;
  themeMuted: string;
  toast: (msg: string, isError?: boolean) => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  adminProfileState,
  setAdminProfileState,
  currentAdminProfile,
  handleSaveSettings,
  savingSettings,
  handleAvatarUpload,
  uploadingAvatar,
  handleRemoveAvatar,
  deleteAccount,
  updatePassword,
  setActiveTab,
  isLightMode,
  themeCardBg,
  themeBorder,
  themeShadow,
  themeText,
  themeMuted,
  toast,
}) => {
  const [sendingRecoveryEmail, setSendingRecoveryEmail] = useState(false);
  const [recoverySent, setRecoverySent] = useState(false);

  const handleTriggerEmailRecovery = async () => {
    const emailToRecover = adminProfileState.email || currentAdminProfile?.email;
    if (!emailToRecover) {
      toast('No registered email address found for this account.', true);
      return;
    }
    try {
      setSendingRecoveryEmail(true);
      await api.forgotPassword(emailToRecover);
      setRecoverySent(true);
      toast(`📧 Security password recovery OTP code sent to ${emailToRecover}! Check your inbox.`);
    } catch (err: any) {
      toast(err.message || 'Failed to dispatch email recovery code.', true);
    } finally {
      setSendingRecoveryEmail(false);
    }
  };

  return (
    <div className="panel" style={{ background: themeCardBg, border: `1px solid ${themeBorder}`, borderRadius: 20, padding: 28, boxShadow: themeShadow }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, borderBottom: `1px solid ${themeBorder}`, paddingBottom: 16 }}>
        <div>
          <span style={{ fontSize: '.76rem', color: '#0EA5E9', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.1em' }}>
            ADMINISTRATIVE PROFILE
          </span>
          <h3 className="serif" style={{ fontSize: '1.6rem', margin: '4px 0 0', color: themeText }}>
            Account Profile & Settings
          </h3>
          <p className="muted small" style={{ margin: '4px 0 0' }}>
            Update your administrative credentials, contact information, and security password.
          </p>
        </div>
        <span style={{ fontSize: '.76rem', color: '#10B981', fontWeight: 700, background: 'rgba(16, 185, 129, 0.1)', padding: '4px 14px', borderRadius: 20, border: '1px solid rgba(16, 185, 129, 0.25)', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <i className="fas fa-crown" /> {currentAdminProfile?.role?.toUpperCase() || 'ADMINISTRATOR'}
        </span>
      </div>

      <form onSubmit={handleSaveSettings} style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 20 }}>
        {/* 0. Cloudinary Executive Avatar & Identity Management */}
        <div style={{ background: isLightMode ? '#F8FAFC' : 'rgba(2,6,23,0.5)', border: `1px solid ${themeBorder}`, borderRadius: 18, padding: 22, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
            <div style={{ position: 'relative' }}>
              <div
                style={{
                  width: 80,
                  height: 80,
                  borderRadius: '50%',
                  overflow: 'hidden',
                  border: '3px solid #6366F1',
                  boxShadow: '0 8px 20px rgba(99, 102, 241, 0.3)',
                  background: isLightMode ? '#EEF2FF' : '#312E81',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {adminProfileState.customAvatarUrl ? (
                  <img
                    src={optimizeCloudinaryUrl(adminProfileState.customAvatarUrl, 'c_fill,w_200,h_200')}
                    alt="Profile Avatar"
                    onError={(e) => {
                      if (e.currentTarget.src !== adminProfileState.customAvatarUrl) {
                        e.currentTarget.src = adminProfileState.customAvatarUrl;
                      } else {
                        e.currentTarget.style.display = 'none';
                      }
                    }}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                ) : (
                  <span style={{ fontSize: '2rem', color: '#818CF8', fontWeight: 800 }}>
                    {adminProfileState.fullName ? adminProfileState.fullName.charAt(0).toUpperCase() : <i className="fas fa-user-tie" />}
                  </span>
                )}
              </div>
            </div>
            <div>
              <b style={{ fontSize: '1.05rem', color: themeText, display: 'block' }}>
                Executive Profile Picture
              </b>
              <p style={{ margin: '4px 0 8px', fontSize: '.8rem', color: themeMuted }}>
                Hosted on Cloudinary High-Performance CDN with auto-formatting & facial focus.
              </p>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <label
                  htmlFor="settings-avatar-upload"
                  className="btn btn-sky btn-sm"
                  style={{
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    borderRadius: 9999,
                    fontWeight: 700,
                    padding: '6px 16px',
                  }}
                >
                  {uploadingAvatar ? <i className="fas fa-spinner fa-spin" /> : <i className="fas fa-cloud-arrow-up" />}
                  {uploadingAvatar ? 'Uploading to Cloudinary…' : 'Upload Photo'}
                  <input
                    id="settings-avatar-upload"
                    type="file"
                    accept="image/*"
                    style={{ display: 'none' }}
                    onChange={handleAvatarUpload}
                    disabled={uploadingAvatar}
                  />
                </label>
                {adminProfileState.customAvatarUrl && (
                  <button
                    type="button"
                    onClick={handleRemoveAvatar}
                    disabled={uploadingAvatar}
                    className="btn btn-ghost btn-sm"
                    style={{
                      borderRadius: 9999,
                      color: '#EF4444',
                      borderColor: 'rgba(239, 68, 68, 0.4)',
                      fontWeight: 700,
                      padding: '6px 16px',
                    }}
                  >
                    Remove Photo
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Enterprise Domain Account Badge */}
          <div style={{ background: isLightMode ? '#EFF6FF' : 'rgba(59, 130, 246, 0.1)', border: `1px solid ${isLightMode ? '#BFDBFE' : 'rgba(59, 130, 246, 0.3)'}`, borderRadius: 14, padding: '12px 18px', textAlign: 'right' }}>
            <small style={{ fontSize: '.68rem', color: isLightMode ? '#1E40AF' : '#93C5FD', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.08em', display: 'block' }}>
              ENTERPRISE DOMAIN IDENTITY
            </small>
            <span style={{ fontSize: '.9rem', fontWeight: 800, color: isLightMode ? '#1E3A8A' : '#BFDBFE', display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
              <i className="fas fa-shield-halved" style={{ color: '#10B981' }} />
              {adminProfileState.domainAccount || 'admin@janddbeachhouse.ph'}
            </span>
            <span style={{ fontSize: '.72rem', color: isLightMode ? '#475569' : '#94A3B8', marginTop: 2, display: 'block' }}>
              Security Clearance: Tier-1 Master Access
            </span>
          </div>
        </div>

        {/* 1. Identity & Contact Information */}
        <div style={{ background: isLightMode ? '#F8FAFC' : 'rgba(2,6,23,0.5)', border: `1px solid ${themeBorder}`, borderRadius: 16, padding: 22 }}>
          <b style={{ fontSize: '1rem', color: themeText, display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
            <i className="fas fa-user" /> Profile Details
          </b>
          <div className="admin-grid-2-col" style={{ gap: 14 }}>
            <div className="field">
              <label style={{ fontSize: '.75rem', color: themeMuted, fontWeight: 700 }}>FULL NAME *</label>
              <input
                type="text"
                required
                style={{ background: isLightMode ? '#FFF' : undefined, color: themeText }}
                value={adminProfileState.fullName}
                onChange={(e) => setAdminProfileState({ ...adminProfileState, fullName: e.target.value })}
              />
            </div>
            <div className="field">
              <label style={{ fontSize: '.75rem', color: themeMuted, fontWeight: 700 }}>TITLE / POSITION *</label>
              <input
                type="text"
                required
                style={{ background: isLightMode ? '#FFF' : undefined, color: themeText }}
                value={adminProfileState.title}
                onChange={(e) => setAdminProfileState({ ...adminProfileState, title: e.target.value })}
              />
            </div>
            <div className="field">
              <label style={{ fontSize: '.75rem', color: themeMuted, fontWeight: 700 }}>EMAIL ADDRESS *</label>
              <input
                type="email"
                required
                style={{ background: isLightMode ? '#FFF' : undefined, color: themeText }}
                value={adminProfileState.email}
                onChange={(e) => setAdminProfileState({ ...adminProfileState, email: e.target.value })}
              />
            </div>
            <div className="field">
              <label style={{ fontSize: '.75rem', color: themeMuted, fontWeight: 700 }}>MOBILE PHONE (11-DIGIT PH)</label>
              <input
                type="tel"
                maxLength={11}
                style={{ background: isLightMode ? '#FFF' : undefined, color: themeText }}
                value={adminProfileState.phone}
                onChange={(e) => setAdminProfileState({ ...adminProfileState, phone: e.target.value.replace(/\D/g, '').slice(0, 11) })}
              />
            </div>
          </div>
        </div>

        {/* 2. Password Security Management */}
        <div style={{ background: isLightMode ? '#F8FAFC' : 'rgba(2,6,23,0.5)', border: `1px solid ${themeBorder}`, borderRadius: 16, padding: 22 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 8 }}>
            <b style={{ fontSize: '1rem', color: themeText, display: 'flex', alignItems: 'center', gap: 8 }}>
              <i className="fas fa-lock" /> Password Security
            </b>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              {currentAdminProfile?.employee_id && (
                <span style={{ fontSize: '0.72rem', padding: '3px 8px', borderRadius: 12, background: 'rgba(56, 189, 248, 0.15)', color: '#38BDF8', border: '1px solid rgba(56, 189, 248, 0.35)', fontWeight: 600 }}>
                  ID: {currentAdminProfile.employee_id} {currentAdminProfile.department ? `(${currentAdminProfile.department})` : ''}
                </span>
              )}
              <span style={{
                fontSize: '0.72rem',
                fontWeight: 700,
                padding: '3px 8px',
                borderRadius: 12,
                background: currentAdminProfile?.password_status === 'N/A' || !currentAdminProfile?.has_password ? 'rgba(245, 158, 11, 0.15)' : 'rgba(16, 185, 129, 0.15)',
                color: currentAdminProfile?.password_status === 'N/A' || !currentAdminProfile?.has_password ? '#F59E0B' : '#10B981',
                border: `1px solid ${currentAdminProfile?.password_status === 'N/A' || !currentAdminProfile?.has_password ? 'rgba(245, 158, 11, 0.35)' : 'rgba(16, 185, 129, 0.35)'}`,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
              }}>
                {currentAdminProfile?.password_status === 'N/A' || !currentAdminProfile?.has_password ? 'Password: N/A' : <>Password: Configured <i className="fas fa-lock" /></>}
              </span>
            </div>
          </div>
          <div className="admin-grid-2-col" style={{ gap: 14 }}>
            <div className="field">
              <label style={{ fontSize: '.75rem', color: themeMuted, fontWeight: 700 }}>NEW PASSWORD</label>
              <input
                type="password"
                placeholder="••••••••••••"
                style={{ background: isLightMode ? '#FFF' : undefined, color: themeText }}
                value={adminProfileState.newPassword || ''}
                onChange={(e) => setAdminProfileState({ ...adminProfileState, newPassword: e.target.value })}
              />
            </div>
            <div className="field">
              <label style={{ fontSize: '.75rem', color: themeMuted, fontWeight: 700 }}>CONFIRM NEW PASSWORD</label>
              <input
                type="password"
                placeholder="••••••••••••"
                style={{ background: isLightMode ? '#FFF' : undefined, color: themeText }}
                value={adminProfileState.confirmPassword || ''}
                onChange={(e) => setAdminProfileState({ ...adminProfileState, confirmPassword: e.target.value })}
              />
            </div>
          </div>
          {adminProfileState.newPassword && (
            <button
              type="button"
              onClick={() => {
                if (adminProfileState.newPassword.length < 6) return toast('Password must be at least 6 characters', true);
                if (adminProfileState.newPassword !== adminProfileState.confirmPassword) return toast('Passwords do not match', true);
                const doUpdate = updatePassword || api.updatePassword;
                doUpdate(adminProfileState.newPassword)
                  .then(() => {
                    toast('🔒 Security password updated successfully!');
                    setAdminProfileState({ ...adminProfileState, currentPassword: '', newPassword: '', confirmPassword: '' });
                  })
                  .catch((e: any) => toast(e.message, true));
              }}
              className="btn btn-sky btn-sm"
              style={{ marginTop: 12, fontWeight: 700 }}
            >
              Update Password Now
            </button>
          )}

          {/* EMAIL RECOVERY ASSISTANCE */}
          <div style={{ marginTop: 14, paddingTop: 14, borderTop: `1px dashed ${themeBorder}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
            <div>
              <span style={{ fontSize: '.78rem', fontWeight: 700, color: themeText, display: 'flex', alignItems: 'center', gap: 6 }}>
                <i className="fas fa-envelope-circle-check" style={{ color: '#0EA5E9' }} /> Account Email Recovery
              </span>
              <span style={{ fontSize: '.72rem', color: themeMuted, display: 'block', marginTop: 2 }}>
                Dispatches a 6-digit recovery OTP verification code to {adminProfileState.email || currentAdminProfile?.email || 'your registered email'}.
              </span>
            </div>
            <button
              type="button"
              disabled={sendingRecoveryEmail}
              onClick={handleTriggerEmailRecovery}
              className="btn btn-sm"
              style={{
                background: 'rgba(14, 165, 233, 0.12)',
                color: '#0EA5E9',
                border: '1px solid rgba(14, 165, 233, 0.35)',
                fontWeight: 700,
                fontSize: '.78rem',
                padding: '7px 14px',
                borderRadius: 10,
                cursor: sendingRecoveryEmail ? 'wait' : 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              {sendingRecoveryEmail ? (
                <>Sending Recovery Email…</>
              ) : recoverySent ? (
                <>✓ Recovery Code Sent</>
              ) : (
                <><i className="fas fa-paper-plane" /> Send Recovery Code via Email</>
              )}
            </button>
          </div>
        </div>

        {/* Action Button: SAVE PROFILE */}
        <div style={{ marginTop: 16 }}>
          <button
            type="submit"
            disabled={savingSettings}
            className="btn btn-sky"
            style={{
              width: '100%',
              justifyContent: 'center',
              padding: '14px 20px',
              fontWeight: 800,
              fontSize: '.95rem',
              borderRadius: 14,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            {savingSettings ? 'Saving to Database…' : <><i className="fas fa-floppy-disk" /> Save Profile</>}
          </button>
        </div>
      </form>
    </div>
  );
};
