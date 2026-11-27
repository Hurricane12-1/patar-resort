import React, { useEffect, useState } from 'react';
import { optimizeCloudinaryUrl } from '../../lib/cloudinary';
import { api } from '../../lib/api';
import { to11Digits } from '../../lib/format';
import { usePageSettings, savePageSettings } from '../../lib/pageSettings';
import { PageAdjustmentView } from './PageAdjustmentView';

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
  initialViewMode?: 'account' | 'dashboard-layout' | 'layout';
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
  initialViewMode,
  isLightMode,
  themeCardBg,
  themeBorder,
  themeShadow,
  themeText,
  themeMuted,
  toast,
}) => {
  const [viewMode, setViewMode] = useState<'account' | 'dashboard-layout' | 'layout'>(initialViewMode || 'account');
  const [sendingRecoveryEmail, setSendingRecoveryEmail] = useState(false);
  const [recoverySent, setRecoverySent] = useState(false);

  // Guest & Users Dashboard Layout Customizer State
  const pageSettings = usePageSettings();
  const [dashGreeting, setDashGreeting] = useState('');
  const [dashSubtitle, setDashSubtitle] = useState('');
  const [dashAnnouncement, setDashAnnouncement] = useState('');
  const [dashBadge, setDashBadge] = useState('');
  const [dashShowQuickBooking, setDashShowQuickBooking] = useState(true);
  const [dashThemeAccent, setDashThemeAccent] = useState('ocean');
  const [savingLayout, setSavingLayout] = useState(false);

  useEffect(() => {
    if (pageSettings) {
      if (pageSettings.dashboardGreeting !== undefined) setDashGreeting(pageSettings.dashboardGreeting);
      if (pageSettings.dashboardSubtitle !== undefined) setDashSubtitle(pageSettings.dashboardSubtitle);
      if (pageSettings.dashboardAnnouncement !== undefined) setDashAnnouncement(pageSettings.dashboardAnnouncement);
      if (pageSettings.dashboardBadge !== undefined) setDashBadge(pageSettings.dashboardBadge);
      if (pageSettings.dashboardShowQuickBooking !== undefined) setDashShowQuickBooking(pageSettings.dashboardShowQuickBooking);
      if (pageSettings.dashboardThemeAccent !== undefined) setDashThemeAccent(pageSettings.dashboardThemeAccent);
    }
  }, [pageSettings]);

  const handleSaveDashboardLayout = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSavingLayout(true);
      await savePageSettings({
        dashboardGreeting: dashGreeting.trim(),
        dashboardSubtitle: dashSubtitle.trim(),
        dashboardAnnouncement: dashAnnouncement.trim(),
        dashboardBadge: dashBadge.trim(),
        dashboardShowQuickBooking: dashShowQuickBooking,
        dashboardThemeAccent: dashThemeAccent,
      });
      toast('✓ Guest & Users dashboard layout updated and published live!');
    } catch (err: any) {
      toast(err?.message || 'Failed to update dashboard layout', true);
    } finally {
      setSavingLayout(false);
    }
  };

  const handleResetDashboardLayout = async () => {
    setDashGreeting('');
    setDashSubtitle('');
    setDashAnnouncement('');
    setDashBadge('');
    setDashShowQuickBooking(true);
    setDashThemeAccent('ocean');
    try {
      setSavingLayout(true);
      await savePageSettings({
        dashboardGreeting: '',
        dashboardSubtitle: '',
        dashboardAnnouncement: '',
        dashboardBadge: '',
        dashboardShowQuickBooking: true,
        dashboardThemeAccent: 'ocean',
      });
      toast('Dashboard layout reset to system defaults.');
    } catch (err: any) {
      toast(err?.message || 'Failed to reset layout', true);
    } finally {
      setSavingLayout(false);
    }
  };

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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, borderBottom: `1px solid ${themeBorder}`, paddingBottom: 16, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <span style={{ fontSize: '.76rem', color: viewMode === 'account' ? '#0EA5E9' : viewMode === 'dashboard-layout' ? '#8B5CF6' : '#6366F1', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.1em', display: 'inline-flex', alignItems: 'center' }}>
            {viewMode === 'account' ? 'ADMINISTRATIVE PROFILE' : viewMode === 'dashboard-layout' ? 'PORTAL PRESENTATION & LAYOUT' : 'LANDING PAGE & HERO ADJUSTMENT'}
          </span>
          <h3 className="serif" style={{ fontSize: '1.6rem', margin: '4px 0 0', color: themeText }}>
            {viewMode === 'account'
              ? 'Account Profile & Settings'
              : viewMode === 'dashboard-layout'
              ? 'Guest & Users Dashboard Layout'
              : 'Hero Titles & Landing Imagery (Page Adjustment)'}
          </h3>
          <p className="muted small" style={{ margin: '4px 0 0' }}>
            {viewMode === 'account'
              ? 'Update your administrative credentials, contact information, and security password.'
              : viewMode === 'dashboard-layout'
              ? 'Customize the presentation, headline greetings, and announcement banner for guest & user dashboards.'
              : 'Customize headline titles, subtitle descriptions, and hero background imagery on the public landing page.'}
          </p>
        </div>
        <span style={{ fontSize: '.76rem', color: '#10B981', fontWeight: 700, background: 'rgba(16, 185, 129, 0.1)', padding: '4px 14px', borderRadius: 20, border: '1px solid rgba(16, 185, 129, 0.25)', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <i className="fas fa-crown" /> {currentAdminProfile?.role?.toUpperCase() || 'ADMINISTRATOR'}
        </span>
      </div>

      {/* Mode Switcher Buttons */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 24 }}>
        <button
          type="button"
          onClick={() => setViewMode('account')}
          style={{
            padding: '9px 18px',
            borderRadius: 12,
            border: `1.5px solid ${viewMode === 'account' ? '#0EA5E9' : themeBorder}`,
            background: viewMode === 'account' ? (isLightMode ? '#E0F2FE' : 'rgba(14, 165, 233, 0.2)') : 'transparent',
            color: viewMode === 'account' ? (isLightMode ? '#0369A1' : '#38BDF8') : themeMuted,
            fontWeight: 700,
            fontSize: '.85rem',
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            transition: 'all 0.2s ease',
          }}
        >
          <i className="fas fa-user-gear" /> Account & Security Settings
        </button>
        <button
          type="button"
          onClick={() => setViewMode('dashboard-layout')}
          style={{
            padding: '9px 18px',
            borderRadius: 12,
            border: `1.5px solid ${viewMode === 'dashboard-layout' ? '#8B5CF6' : themeBorder}`,
            background: viewMode === 'dashboard-layout' ? (isLightMode ? '#EDE9FE' : 'rgba(139, 92, 246, 0.2)') : 'transparent',
            color: viewMode === 'dashboard-layout' ? (isLightMode ? '#6D28D9' : '#A78BFA') : themeMuted,
            fontWeight: 700,
            fontSize: '.85rem',
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            transition: 'all 0.2s ease',
          }}
        >
          <i className="fas fa-palette" /> Change Layout of Guest & Users Dashboard
        </button>
        <button
          type="button"
          onClick={() => setViewMode('layout')}
          style={{
            padding: '9px 18px',
            borderRadius: 12,
            border: `1.5px solid ${viewMode === 'layout' ? '#6366F1' : themeBorder}`,
            background: viewMode === 'layout' ? (isLightMode ? '#EEF2FF' : 'rgba(99, 102, 241, 0.2)') : 'transparent',
            color: viewMode === 'layout' ? (isLightMode ? '#4338CA' : '#818CF8') : themeMuted,
            fontWeight: 700,
            fontSize: '.85rem',
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            transition: 'all 0.2s ease',
          }}
        >
          <i className="fas fa-image" /> Page Adjustment
        </button>
      </div>

      {/* MODE 1: GUEST & USER DASHBOARD LAYOUT (Hides account settings when clicked) */}
      {viewMode === 'dashboard-layout' && (
        <form onSubmit={handleSaveDashboardLayout} style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Data Protection Guardrail Alert */}
          <div
            style={{
              background: isLightMode ? '#EFF6FF' : 'rgba(30, 58, 138, 0.25)',
              border: '1.5px solid rgba(59, 130, 246, 0.4)',
              borderRadius: 16,
              padding: '16px 20px',
              display: 'flex',
              alignItems: 'flex-start',
              gap: 14,
            }}
          >
            <i className="fas fa-shield-halved" style={{ fontSize: 22, color: '#3B82F6', marginTop: 2, flexShrink: 0 }} />
            <div>
              <b style={{ fontSize: '0.95rem', color: themeText, display: 'block', marginBottom: 2 }}>
                🔒 Strict Data Guardrail Active
              </b>
              <span style={{ fontSize: '0.82rem', color: themeMuted, lineHeight: 1.5 }}>
                You are editing layout, headline greetings, and announcement banners for the Guest & Users Dashboard.
                <strong> Live customer data, active bookings, payment histories, and PMS ledger transactions are strictly immutable</strong> and cannot be altered here.
              </span>
            </div>
          </div>

          {/* Interactive Live Preview of Guest Dashboard Header */}
          <div style={{ background: isLightMode ? '#F8FAFC' : 'rgba(2,6,23,0.5)', border: `1px solid ${themeBorder}`, borderRadius: 16, padding: 22 }}>
            <span style={{ fontSize: '.75rem', color: '#8B5CF6', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.1em', display: 'block', marginBottom: 10 }}>
              Live Guest Dashboard Preview
            </span>
            <div
              style={{
                borderRadius: 16,
                border: '1px solid #E8E2D6',
                background: '#FFFFFF',
                padding: '20px 24px',
                color: '#18222B',
                boxShadow: '0 4px 14px rgba(0,0,0,0.06)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
                <div>
                  <span style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.15em', color: '#9E7E46' }}>
                    {dashBadge || 'Guest dashboard'}
                  </span>
                  <h4 style={{ margin: '6px 0 4px', fontSize: 24, fontWeight: 700, color: '#18222B', fontFamily: 'serif' }}>
                    {dashGreeting ? `${dashGreeting}, Maria` : 'Good morning, Maria'}
                  </h4>
                  <p style={{ margin: 0, fontSize: 13.5, color: '#5F5B53' }}>
                    {dashSubtitle || 'Plan your first Bolinao getaway. We match a room to your party size automatically.'}
                  </p>
                </div>
                {dashShowQuickBooking && (
                  <span style={{ background: '#18222B', color: '#FFFFFF', padding: '6px 14px', borderRadius: 9999, fontSize: 12, fontWeight: 700 }}>
                    Book a stay →
                  </span>
                )}
              </div>

              {dashAnnouncement && (
                <div style={{ marginTop: 16, background: '#FEF3C7', border: '1px solid #FCD34D', borderRadius: 12, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
                  <i className="fas fa-bullhorn" style={{ color: '#D97706', fontSize: 14 }} />
                  <span style={{ fontSize: 12.5, fontWeight: 600, color: '#92400E' }}>
                    {dashAnnouncement}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Form Fields for Customizing Dashboard Layout */}
          <div style={{ background: isLightMode ? '#F8FAFC' : 'rgba(2,6,23,0.5)', border: `1px solid ${themeBorder}`, borderRadius: 16, padding: 22 }}>
            <b style={{ fontSize: '1rem', color: themeText, display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
              <i className="fas fa-sliders" style={{ color: '#8B5CF6' }} /> Header & Announcement Content
            </b>

            <div className="admin-grid-2-col" style={{ gap: 16 }}>
              <div className="field">
                <label style={{ fontSize: '.75rem', color: themeMuted, fontWeight: 700 }}>DASHBOARD CATEGORY BADGE</label>
                <input
                  type="text"
                  placeholder="Guest dashboard"
                  style={{ background: isLightMode ? '#FFF' : undefined, color: themeText }}
                  value={dashBadge}
                  onChange={(e) => setDashBadge(e.target.value)}
                />
                <span style={{ fontSize: '.7rem', color: themeMuted, marginTop: 4, display: 'block' }}>
                  Tag shown above the greeting header (e.g. &quot;Guest dashboard&quot;, &quot;VIP Resident Hub&quot;).
                </span>
              </div>

              <div className="field">
                <label style={{ fontSize: '.75rem', color: themeMuted, fontWeight: 700 }}>GREETING PREFIX</label>
                <input
                  type="text"
                  placeholder="e.g. Welcome back, Mabuhay, Good day (leave blank for automatic time-of-day)"
                  style={{ background: isLightMode ? '#FFF' : undefined, color: themeText }}
                  value={dashGreeting}
                  onChange={(e) => setDashGreeting(e.target.value)}
                />
                <span style={{ fontSize: '.7rem', color: themeMuted, marginTop: 4, display: 'block' }}>
                  Prefix before guest name (e.g. &quot;Welcome back, [Name]&quot;).
                </span>
              </div>
            </div>

            <div className="field" style={{ marginTop: 14 }}>
              <label style={{ fontSize: '.75rem', color: themeMuted, fontWeight: 700 }}>WELCOME SUBTITLE / GETAWAY PROMPT</label>
              <textarea
                rows={2}
                placeholder="Plan your first Bolinao getaway. We match a room to your party size automatically."
                style={{ background: isLightMode ? '#FFF' : undefined, color: themeText, width: '100%', padding: '10px 12px', borderRadius: 10, border: `1px solid ${themeBorder}` }}
                value={dashSubtitle}
                onChange={(e) => setDashSubtitle(e.target.value)}
              />
            </div>

            <div className="field" style={{ marginTop: 14 }}>
              <label style={{ fontSize: '.75rem', color: themeMuted, fontWeight: 700 }}>RESORT ANNOUNCEMENT BANNER (OPTIONAL)</label>
              <input
                type="text"
                placeholder="e.g. High tide sunset tours now boarding at 5:00 PM. Book via concierge."
                style={{ background: isLightMode ? '#FFF' : undefined, color: themeText }}
                value={dashAnnouncement}
                onChange={(e) => setDashAnnouncement(e.target.value)}
              />
              <span style={{ fontSize: '.7rem', color: themeMuted, marginTop: 4, display: 'block' }}>
                Highlighted alert banner broadcast across all guest and user dashboards.
              </span>
            </div>

            {/* Quick Actions & Accent */}
            <div style={{ marginTop: 16, paddingTop: 16, borderTop: `1px dashed ${themeBorder}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 14 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={dashShowQuickBooking}
                  onChange={(e) => setDashShowQuickBooking(e.target.checked)}
                  style={{ width: 18, height: 18, accentColor: '#8B5CF6', cursor: 'pointer' }}
                />
                <div>
                  <span style={{ fontSize: '.82rem', fontWeight: 700, color: themeText, display: 'block' }}>
                    Show Quick &quot;Book a stay&quot; Action
                  </span>
                  <span style={{ fontSize: '.72rem', color: themeMuted }}>
                    Displays shortcut card to explore available dates and reserve villas.
                  </span>
                </div>
              </label>

              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: '.75rem', fontWeight: 700, color: themeMuted }}>THEME ACCENT:</span>
                <select
                  value={dashThemeAccent}
                  onChange={(e) => setDashThemeAccent(e.target.value)}
                  style={{
                    background: isLightMode ? '#FFF' : 'rgba(255,255,255,0.08)',
                    color: themeText,
                    border: `1px solid ${themeBorder}`,
                    borderRadius: 8,
                    padding: '6px 12px',
                    fontSize: '.8rem',
                    fontWeight: 600,
                  }}
                >
                  <option value="ocean">Ocean Azure (Default)</option>
                  <option value="emerald">Emerald Cove</option>
                  <option value="coral">Sunset Coral</option>
                  <option value="slate">Slate Sanctuary</option>
                </select>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 8 }}>
            <button
              type="submit"
              disabled={savingLayout}
              style={{
                flex: 1,
                minWidth: 200,
                padding: '13px 22px',
                borderRadius: 14,
                border: 'none',
                background: '#8B5CF6',
                color: '#FFFFFF',
                fontWeight: 800,
                fontSize: '.92rem',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                opacity: savingLayout ? 0.6 : 1,
              }}
            >
              <i className={savingLayout ? 'fas fa-spinner fa-spin' : 'fas fa-floppy-disk'} />
              {savingLayout ? 'Publishing Layout…' : 'Save Dashboard Layout & Publish'}
            </button>
            <button
              type="button"
              onClick={handleResetDashboardLayout}
              disabled={savingLayout}
              style={{
                padding: '13px 20px',
                borderRadius: 14,
                border: `1px solid ${themeBorder}`,
                background: 'transparent',
                color: themeMuted,
                fontWeight: 700,
                fontSize: '.88rem',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <i className="fas fa-rotate-left" /> Reset Layout Defaults
            </button>
          </div>
        </form>
      )}

      {/* MODE 2: ACCOUNT PROFILE & SECURITY (Hidden when viewing dashboard layout) */}
      {viewMode === 'account' && (
        <form onSubmit={handleSaveSettings} style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* 0. Cloudinary Executive Avatar & Identity Management */}
          {(() => {
            const avatarUrl = adminProfileState.customAvatarUrl || currentAdminProfile?.avatar_url || currentAdminProfile?.picture || '';
            return (
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
                      {avatarUrl ? (
                        <img
                          key={avatarUrl}
                          src={avatarUrl}
                          alt="Executive Profile Avatar"
                          onError={(e) => {
                            e.currentTarget.style.display = 'none';
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
                      Shown next to your name across the admin pages.
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
                        {uploadingAvatar ? 'Uploading…' : 'Upload Photo'}
                        <input
                          id="settings-avatar-upload"
                          type="file"
                          accept="image/*"
                          style={{ display: 'none' }}
                          onChange={handleAvatarUpload}
                          disabled={uploadingAvatar}
                        />
                      </label>
                      {avatarUrl && (
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
              </div>
            );
          })()}

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
                  inputMode="numeric"
                  maxLength={11}
                  style={{ background: isLightMode ? '#FFF' : undefined, color: themeText }}
                  value={adminProfileState.phone}
                  onChange={(e) => setAdminProfileState({ ...adminProfileState, phone: to11Digits(e.target.value) })}
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
      )}

      {/* MODE 3: SECRET LANDING LAYOUT & HERO ADJUSTMENT (Page Adjustment hidden under Settings) */}
      {viewMode === 'layout' && (
        <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '12px 18px',
              background: isLightMode ? '#F8FAFC' : 'rgba(30, 41, 59, 0.4)',
              borderRadius: 14,
              border: `1px solid ${themeBorder}`,
              flexWrap: 'wrap',
              gap: 10,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <i className="fas fa-image" style={{ color: '#6366F1', fontSize: 13 }} />
              <span style={{ fontSize: '.84rem', fontWeight: 700, color: themeText }}>
                Page Adjustment · Landing Page &amp; Hero Imagery
              </span>
            </div>
            <button
              type="button"
              onClick={() => setViewMode('account')}
              style={{
                background: isLightMode ? '#FFFFFF' : 'rgba(255, 255, 255, 0.08)',
                border: `1px solid ${themeBorder}`,
                borderRadius: 8,
                padding: '6px 14px',
                fontSize: '.78rem',
                fontWeight: 600,
                color: themeText,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <i className="fas fa-arrow-left" style={{ fontSize: 11 }} /> Back to Account Settings
            </button>
          </div>

          <PageAdjustmentView
            isLightMode={isLightMode}
            themeCardBg={themeCardBg}
            themeBorder={themeBorder}
            themeShadow={themeShadow}
            themeText={themeText}
            themeMuted={themeMuted}
            toast={toast}
          />
        </div>
      )}

      {/* Subtle security & system footer */}
      <div style={{ marginTop: 28, paddingTop: 16, borderTop: `1px solid ${themeBorder}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <span style={{ fontSize: '.72rem', color: themeMuted, opacity: 0.55 }}>
          Rock View Resort Administrative Console • RBAC Session Verified
        </span>
      </div>
    </div>
  );
};
