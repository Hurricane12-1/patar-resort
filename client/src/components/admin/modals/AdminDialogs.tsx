import React from 'react';
import { fmtDate } from '../../../lib/format';
import { dispatchWordPrompt } from '../../../lib/wordPrompt';

export interface AdminDialogsProps {
  isLightMode: boolean;
  themeBorder: string;
  themeText: string;
  themeMuted: string;

  // Keyword intents modal
  showKeywordsModal: boolean;
  setShowKeywordsModal: (show: boolean) => void;

  // Staff provisioning modal
  showCreateModal: boolean;
  setShowCreateModal: (show: boolean) => void;
  newStaff: any;
  setNewStaff: React.Dispatch<React.SetStateAction<any>>;
  handleProvisionStaff: (e: React.FormEvent) => void;
  creatingStaff: boolean;

  // Password reset modal
  recoveryTarget: any;
  setRecoveryTarget: (target: any) => void;
  newPassword: string;
  setNewPassword: (pwd: string) => void;
  handlePasswordRecovery: (e: React.FormEvent) => void;
  resettingPass: boolean;

  // Edit user profile modal
  editingUser: any;
  setEditingUser: (user: any) => void;
  handleUpdateUser: (e: React.FormEvent) => void;
  savingUser: boolean;

  // Confirmation modals
  roomToRemove: any;
  setRoomToRemove: (room: any) => void;
  handleConfirmRemoveRoom: () => void;
  removingRoom: boolean;

  supplyToRemove: any;
  setSupplyToRemove: (supply: any) => void;
  handleConfirmRemoveSupply: () => void;
  removingSupply: boolean;

  reservationToRemove: any;
  setReservationToRemove: (res: any) => void;
  handleConfirmRemoveReservation: () => void;
  removingReservation: boolean;

  userToDelete: any;
  setUserToDelete: (user: any) => void;
  handleDeleteUser: () => void;
  deletingUser: boolean;

  // Admin forgot password modal
  showAdminForgotModal: boolean;
  setShowAdminForgotModal: (show: boolean) => void;
  adminRecoveryStep: number;
  setAdminRecoveryStep: (step: number) => void;
  adminRecoveryEmail: string;
  setAdminRecoveryEmail: (email: string) => void;
  adminRecoveryCode: string;
  setAdminRecoveryCode: (code: string) => void;
  adminRecoveryNewPass: string;
  setAdminRecoveryNewPass: (pwd: string) => void;
  handleAdminForgotPassword: (e: React.FormEvent) => void;
  handleAdminResetPassword: (e: React.FormEvent) => void;
  adminRecoveryBusy: boolean;

  // Refund modal
  refundTarget: any;
  setRefundTarget: (target: any) => void;
  refundMode: string;
  setRefundMode: (mode: string) => void;
  refundAmount: string;
  setRefundAmount: (amount: string) => void;
  refundMethod: string;
  setRefundMethod: (method: string) => void;
  refundRefNum: string;
  setRefundRefNum: (ref: string) => void;
  refundReason: string;
  setRefundReason: (reason: string) => void;
  handleRefundSubmit: (e: React.FormEvent) => void;
  submittingRefund: boolean;

  // Notification details modal
  viewingNotification: any;
  setViewingNotification: (notif: any) => void;
  handleDeleteNotif: (id: string) => Promise<void> | void;
  handleMarkNotifRead: (id: string) => Promise<void> | void;
}

export const AdminDialogs: React.FC<AdminDialogsProps> = ({
  isLightMode,
  themeBorder,
  themeText,
  themeMuted,
  showKeywordsModal,
  setShowKeywordsModal,
  showCreateModal,
  setShowCreateModal,
  newStaff,
  setNewStaff,
  handleProvisionStaff,
  creatingStaff,
  recoveryTarget,
  setRecoveryTarget,
  newPassword,
  setNewPassword,
  handlePasswordRecovery,
  resettingPass,
  editingUser,
  setEditingUser,
  handleUpdateUser,
  savingUser,
  roomToRemove,
  setRoomToRemove,
  handleConfirmRemoveRoom,
  removingRoom,
  supplyToRemove,
  setSupplyToRemove,
  handleConfirmRemoveSupply,
  removingSupply,
  reservationToRemove,
  setReservationToRemove,
  handleConfirmRemoveReservation,
  removingReservation,
  userToDelete,
  setUserToDelete,
  handleDeleteUser,
  deletingUser,
  showAdminForgotModal,
  setShowAdminForgotModal,
  adminRecoveryStep,
  setAdminRecoveryStep,
  adminRecoveryEmail,
  setAdminRecoveryEmail,
  adminRecoveryCode,
  setAdminRecoveryCode,
  adminRecoveryNewPass,
  setAdminRecoveryNewPass,
  handleAdminForgotPassword,
  handleAdminResetPassword,
  adminRecoveryBusy,
  refundTarget,
  setRefundTarget,
  refundMode,
  setRefundMode,
  refundAmount,
  setRefundAmount,
  refundMethod,
  setRefundMethod,
  refundRefNum,
  setRefundRefNum,
  refundReason,
  setRefundReason,
  handleRefundSubmit,
  submittingRefund,
  viewingNotification,
  setViewingNotification,
  handleDeleteNotif,
  handleMarkNotifRead,
}) => {
  return (
    <>
      {/* 1. AI KEYWORD INTENT ANALYTICS */}
      {showKeywordsModal && (
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
          onClick={() => setShowKeywordsModal(false)}
        >
          <div
            style={{
              width: '100%',
              maxWidth: 560,
              background: isLightMode ? '#FFFFFF' : '#0F172A',
              borderRadius: 20,
              border: `1px solid ${themeBorder}`,
              padding: 24,
              boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 16,
                borderBottom: `1px solid ${themeBorder}`,
                paddingBottom: 12,
              }}
            >
              <div>
                <span
                  style={{
                    fontSize: '.74rem',
                    color: '#10B981',
                    fontWeight: 800,
                    textTransform: 'uppercase',
                    letterSpacing: '.08em',
                  }}
                >
                  AI CHATBOT INTENTS
                </span>
                <h3
                  style={{
                    margin: '4px 0 0',
                    fontSize: '1.4rem',
                    color: themeText,
                    fontFamily: "'Plus Jakarta Sans', sans-serif",
                  }}
                >
                  <i className="fas fa-tags" style={{ marginRight: 6 }} />
                  186 AI Keyword Intents
                </h3>
              </div>
              <button
                onClick={() => setShowKeywordsModal(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: themeMuted,
                  fontSize: '1.2rem',
                  cursor: 'pointer',
                }}
              >
                <i className="fas fa-xmark" />
              </button>
            </div>

            <p style={{ fontSize: '.84rem', color: themeMuted, margin: '0 0 16px' }}>
              Top automated intent keywords recognized from guest inquiries across Webchat, Messenger &amp; WhatsApp:
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 320, overflowY: 'auto' }}>
              {[
                { tag: '#early-checkin', count: 428, resRate: '98.2% AI Solved', category: 'Front Desk' },
                { tag: '#patar-beach-tour', count: 312, resRate: '96.5% AI Solved', category: 'Concierge' },
                { tag: '#villa-upgrade', count: 215, resRate: '84.1% Staff Routed', category: 'Reservations' },
                { tag: '#candlelight-dinner', count: 186, resRate: '92.0% AI Solved', category: 'Dining' },
                { tag: '#airport-van-transfer', count: 105, resRate: '95.0% AI Solved', category: 'Transport' },
              ].map((k) => (
                <div
                  key={k.tag}
                  className="clickable-prompt-word"
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '12px 16px',
                    background: isLightMode ? '#F8FAFC' : 'rgba(255,255,255,0.04)',
                    borderRadius: 12,
                    border: `1px solid ${themeBorder}`,
                    cursor: 'pointer',
                  }}
                  onClick={() => {
                    setShowKeywordsModal(false);
                    dispatchWordPrompt(k.tag, {
                      template: `Guest intent inquiry: ${k.tag.replace('#', '')} for ${k.category}`,
                    });
                  }}
                  title={`Click keyword to test prompt in AI Concierge: "${k.tag}"`}
                >
                  <div>
                    <b style={{ color: '#10B981', fontSize: '.92rem' }}>{k.tag}</b>
                    <span style={{ fontSize: '.74rem', color: themeMuted, display: 'block' }}>
                      Category: {k.category} · <i>Click to test type prompt</i>
                    </span>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <b style={{ color: themeText, fontSize: '.92rem' }}>{k.count} queries</b>
                    <span
                      style={{
                        fontSize: '.72rem',
                        color: k.resRate.includes('AI') ? '#10B981' : '#818CF8',
                        fontWeight: 700,
                        display: 'block',
                      }}
                    >
                      {k.resRate}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 2. PROVISION STAFF ACCOUNT MODAL */}
      {showCreateModal && (
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
          onClick={() => setShowCreateModal(false)}
        >
          <div
            style={{
              width: '100%',
              maxWidth: 520,
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
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 16,
                borderBottom: `1px solid ${themeBorder}`,
                paddingBottom: 12,
              }}
            >
              <div>
                <span
                  style={{
                    fontSize: '.74rem',
                    color: newStaff.role === 'administrator' ? '#8B5CF6' : '#6366F1',
                    fontWeight: 800,
                    textTransform: 'uppercase',
                    letterSpacing: '.08em',
                  }}
                >
                  {newStaff.role === 'administrator'
                    ? 'EXECUTIVE RBAC PROVISIONING'
                    : 'ADMINISTRATIVE ACCESS CONTROL'}
                </span>
                <h3
                  style={{
                    margin: '4px 0 0',
                    fontSize: '1.35rem',
                    color: themeText,
                    fontFamily: "'Plus Jakarta Sans', sans-serif",
                  }}
                >
                  {newStaff.role === 'administrator' ? (
                    <>
                      <i className="fas fa-crown" style={{ marginRight: 6 }} />
                      Provision Administrator Account
                    </>
                  ) : (
                    <>
                      <i className="fas fa-shield-halved" style={{ marginRight: 6 }} />
                      Provision Staff Account
                    </>
                  )}
                </h3>
              </div>
              <button
                onClick={() => setShowCreateModal(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: themeMuted,
                  fontSize: '1.2rem',
                  cursor: 'pointer',
                }}
              >
                <i className="fas fa-xmark" />
              </button>
            </div>

            <form onSubmit={handleProvisionStaff} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label style={{ fontSize: '.75rem', color: themeMuted, fontWeight: 700, display: 'block', marginBottom: 4 }}>
                    First Name *
                  </label>
                  <input
                    required
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: 8,
                      border: `1px solid ${themeBorder}`,
                      background: isLightMode ? '#F8FAFC' : 'rgba(255,255,255,0.05)',
                      color: themeText,
                    }}
                    value={newStaff.first_name}
                    onChange={(e) => setNewStaff({ ...newStaff, first_name: e.target.value })}
                    placeholder="e.g. Maria"
                  />
                </div>
                <div>
                  <label style={{ fontSize: '.75rem', color: themeMuted, fontWeight: 700, display: 'block', marginBottom: 4 }}>
                    Last Name *
                  </label>
                  <input
                    required
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: 8,
                      border: `1px solid ${themeBorder}`,
                      background: isLightMode ? '#F8FAFC' : 'rgba(255,255,255,0.05)',
                      color: themeText,
                    }}
                    value={newStaff.last_name}
                    onChange={(e) => setNewStaff({ ...newStaff, last_name: e.target.value })}
                    placeholder="e.g. Santos"
                  />
                </div>
              </div>

              <div>
                <label style={{ fontSize: '.75rem', color: themeMuted, fontWeight: 700, display: 'block', marginBottom: 4 }}>
                  Official Email Address
                </label>
                <input
                  type="email"
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: 8,
                    border: `1px solid ${themeBorder}`,
                    background: isLightMode ? '#F8FAFC' : 'rgba(255,255,255,0.05)',
                    color: themeText,
                  }}
                  value={newStaff.email}
                  onChange={(e) => setNewStaff({ ...newStaff, email: e.target.value })}
                  placeholder="auto-generated if left blank"
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label style={{ fontSize: '.75rem', color: themeMuted, fontWeight: 700, display: 'block', marginBottom: 4 }}>
                    Phone Number
                  </label>
                  <input
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: 8,
                      border: `1px solid ${themeBorder}`,
                      background: isLightMode ? '#F8FAFC' : 'rgba(255,255,255,0.05)',
                      color: themeText,
                    }}
                    value={newStaff.phone}
                    onChange={(e) => setNewStaff({ ...newStaff, phone: e.target.value })}
                    placeholder="09171234567"
                  />
                </div>
                <div>
                  <label style={{ fontSize: '.75rem', color: themeMuted, fontWeight: 700, display: 'block', marginBottom: 4 }}>
                    Assigned Role
                  </label>
                  <select
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: 8,
                      border: `1px solid ${themeBorder}`,
                      background: isLightMode ? '#F8FAFC' : '#1E293B',
                      color: themeText,
                    }}
                    value={newStaff.role}
                    onChange={(e) => setNewStaff({ ...newStaff, role: e.target.value })}
                  >
                    <option value="receptionist">Receptionist (Front Desk)</option>
                    <option value="accounting">Accounting (Ledger Access)</option>
                    <option value="staff">Staff (Operational View)</option>
                    <option value="administrator">Administrator (Full Control)</option>
                  </select>
                </div>
              </div>

              <div>
                <label style={{ fontSize: '.75rem', color: themeMuted, fontWeight: 700, display: 'block', marginBottom: 4 }}>
                  Initial Password *
                </label>
                <input
                  required
                  type="password"
                  minLength={6}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: 8,
                    border: `1px solid ${themeBorder}`,
                    background: isLightMode ? '#F8FAFC' : 'rgba(255,255,255,0.05)',
                    color: themeText,
                  }}
                  value={newStaff.password}
                  onChange={(e) => setNewStaff({ ...newStaff, password: e.target.value })}
                  placeholder="Min 6 characters"
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 8 }}>
                <button
                  type="button"
                  className="btn btn-sm"
                  onClick={() => setShowCreateModal(false)}
                  style={{ border: `1px solid ${themeBorder}`, color: themeText }}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-sky btn-sm" disabled={creatingStaff}>
                  {creatingStaff ? 'Provisioning…' : 'Create Staff Account ✦'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 3. RESET PASSWORD & SMS RECOVERY MODAL */}
      {recoveryTarget && (
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
          onClick={() => setRecoveryTarget(null)}
        >
          <div
            style={{
              width: '100%',
              maxWidth: 440,
              background: isLightMode ? '#FFFFFF' : '#0F172A',
              borderRadius: 20,
              border: `1px solid ${themeBorder}`,
              padding: 24,
              boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 14,
                borderBottom: `1px solid ${themeBorder}`,
                paddingBottom: 10,
              }}
            >
              <h3
                style={{
                  margin: 0,
                  fontSize: '1.2rem',
                  color: themeText,
                  fontFamily: "'Plus Jakarta Sans', sans-serif",
                }}
              >
                <i className="fas fa-key" style={{ marginRight: 6 }} />
                Reset Account Password
              </h3>
              <button
                onClick={() => setRecoveryTarget(null)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: themeMuted,
                  fontSize: '1.2rem',
                  cursor: 'pointer',
                }}
              >
                <i className="fas fa-xmark" />
              </button>
            </div>

            <p style={{ fontSize: '.84rem', color: themeMuted, margin: '0 0 16px', lineHeight: 1.5 }}>
              Reset password for <b>{recoveryTarget.full_name || recoveryTarget.email}</b> ({recoveryTarget.role}).
            </p>

            <form onSubmit={handlePasswordRecovery} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ fontSize: '.75rem', color: themeMuted, fontWeight: 700, display: 'block', marginBottom: 4 }}>
                  New Password *
                </label>
                <input
                  required
                  type="password"
                  minLength={6}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: 8,
                    border: `1px solid ${themeBorder}`,
                    background: isLightMode ? '#F8FAFC' : 'rgba(255,255,255,0.05)',
                    color: themeText,
                  }}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Min 6 characters"
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 6 }}>
                <button
                  type="button"
                  className="btn btn-sm"
                  onClick={() => setRecoveryTarget(null)}
                  style={{ border: `1px solid ${themeBorder}`, color: themeText }}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-sky btn-sm" disabled={resettingPass}>
                  {resettingPass ? 'Resetting…' : 'Save & Dispatch Reset ✦'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 4. EDIT USER PROFILE MODAL */}
      {editingUser && (
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
          onClick={() => setEditingUser(null)}
        >
          <div
            style={{
              width: '100%',
              maxWidth: 500,
              background: isLightMode ? '#FFFFFF' : '#0F172A',
              borderRadius: 20,
              border: `1px solid ${themeBorder}`,
              padding: 24,
              boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 16,
                borderBottom: `1px solid ${themeBorder}`,
                paddingBottom: 12,
              }}
            >
              <div>
                <span
                  style={{
                    fontSize: '.74rem',
                    color: '#0EA5E9',
                    fontWeight: 800,
                    textTransform: 'uppercase',
                    letterSpacing: '.08em',
                  }}
                >
                  ACCOUNT MANAGEMENT
                </span>
                <h3
                  style={{
                    margin: '4px 0 0',
                    fontSize: '1.25rem',
                    color: themeText,
                    fontFamily: "'Plus Jakarta Sans', sans-serif",
                  }}
                >
                  <i className="fas fa-pen-to-square" style={{ marginRight: 4 }} />
                  Edit Account Profile
                </h3>
              </div>
              <button
                onClick={() => setEditingUser(null)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: themeMuted,
                  fontSize: '1.2rem',
                  cursor: 'pointer',
                }}
              >
                <i className="fas fa-xmark" />
              </button>
            </div>

            <form onSubmit={handleUpdateUser} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                <div>
                  <label style={{ fontSize: '.75rem', color: themeMuted, fontWeight: 700, display: 'block', marginBottom: 4 }}>
                    First Name
                  </label>
                  <input
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: 8,
                      border: `1px solid ${themeBorder}`,
                      background: isLightMode ? '#F8FAFC' : 'rgba(255,255,255,0.05)',
                      color: themeText,
                    }}
                    value={editingUser.first_name || ''}
                    onChange={(e) => setEditingUser({ ...editingUser, first_name: e.target.value })}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '.75rem', color: themeMuted, fontWeight: 700, display: 'block', marginBottom: 4 }}>
                    Middle
                  </label>
                  <input
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: 8,
                      border: `1px solid ${themeBorder}`,
                      background: isLightMode ? '#F8FAFC' : 'rgba(255,255,255,0.05)',
                      color: themeText,
                    }}
                    value={editingUser.middle_name || ''}
                    onChange={(e) => setEditingUser({ ...editingUser, middle_name: e.target.value })}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '.75rem', color: themeMuted, fontWeight: 700, display: 'block', marginBottom: 4 }}>
                    Last Name
                  </label>
                  <input
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: 8,
                      border: `1px solid ${themeBorder}`,
                      background: isLightMode ? '#F8FAFC' : 'rgba(255,255,255,0.05)',
                      color: themeText,
                    }}
                    value={editingUser.last_name || ''}
                    onChange={(e) => setEditingUser({ ...editingUser, last_name: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <label style={{ fontSize: '.75rem', color: themeMuted, fontWeight: 700, display: 'block', marginBottom: 4 }}>
                  Display / Full Name *
                </label>
                <input
                  required
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: 8,
                    border: `1px solid ${themeBorder}`,
                    background: isLightMode ? '#F8FAFC' : 'rgba(255,255,255,0.05)',
                    color: themeText,
                  }}
                  value={editingUser.full_name || ''}
                  onChange={(e) => setEditingUser({ ...editingUser, full_name: e.target.value })}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label style={{ fontSize: '.75rem', color: themeMuted, fontWeight: 700, display: 'block', marginBottom: 4 }}>
                    Phone
                  </label>
                  <input
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: 8,
                      border: `1px solid ${themeBorder}`,
                      background: isLightMode ? '#F8FAFC' : 'rgba(255,255,255,0.05)',
                      color: themeText,
                    }}
                    value={editingUser.phone || ''}
                    onChange={(e) => setEditingUser({ ...editingUser, phone: e.target.value })}
                    placeholder="09171234567"
                  />
                </div>
                <div>
                  <label style={{ fontSize: '.75rem', color: themeMuted, fontWeight: 700, display: 'block', marginBottom: 4 }}>
                    {!editingUser.role || editingUser.role === 'customer'
                      ? 'Account Classification'
                      : 'Staff Role Assignment'}
                  </label>
                  {!editingUser.role || editingUser.role === 'customer' ? (
                    <div
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        borderRadius: 8,
                        border: `1px solid ${themeBorder}`,
                        background: isLightMode ? '#F1F5F9' : 'rgba(255,255,255,0.05)',
                        color: themeText,
                        fontSize: '.84rem',
                        fontWeight: 600,
                      }}
                    >
                      <i className="fas fa-user" style={{ marginRight: 6 }} />
                      Customer / Guest (Fixed)
                    </div>
                  ) : (
                    <select
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        borderRadius: 8,
                        border: `1px solid ${themeBorder}`,
                        background: isLightMode ? '#F8FAFC' : '#1E293B',
                        color: themeText,
                      }}
                      value={editingUser.role || 'staff'}
                      onChange={(e) => setEditingUser({ ...editingUser, role: e.target.value })}
                    >
                      <option value="receptionist">Receptionist</option>
                      <option value="accounting">Accounting</option>
                      <option value="staff">Staff</option>
                      <option value="administrator">Administrator</option>
                    </select>
                  )}
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 12 }}>
                <button
                  type="button"
                  className="btn btn-sm"
                  onClick={() => setEditingUser(null)}
                  style={{ border: `1px solid ${themeBorder}`, color: themeText }}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-sky btn-sm" disabled={savingUser}>
                  {savingUser ? (
                    'Saving…'
                  ) : (
                    <>
                      <i className="fas fa-floppy-disk" style={{ marginRight: 6 }} />
                      Save Changes ✦
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 5. REMOVE ROOM CONFIRMATION MODAL */}
      {roomToRemove && (
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
          onClick={() => setRoomToRemove(null)}
        >
          <div
            style={{
              width: '100%',
              maxWidth: 440,
              background: isLightMode ? '#FFFFFF' : '#0F172A',
              borderRadius: 20,
              border: '1px solid rgba(239, 68, 68, 0.4)',
              padding: 24,
              boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <span
                style={{
                  fontSize: '.74rem',
                  color: '#EF4444',
                  fontWeight: 800,
                  textTransform: 'uppercase',
                  letterSpacing: '.08em',
                }}
              >
                REMOVE ROOM
              </span>
              <button
                onClick={() => setRoomToRemove(null)}
                style={{ background: 'none', border: 'none', color: themeMuted, fontSize: '1.2rem', cursor: 'pointer' }}
              >
                <i className="fas fa-xmark" />
              </button>
            </div>
            <h3
              style={{
                margin: '0 0 10px',
                fontSize: '1.25rem',
                color: '#EF4444',
                fontFamily: "'Plus Jakarta Sans', sans-serif",
              }}
            >
              Remove &quot;{roomToRemove.name}&quot;?
            </h3>
            <p style={{ fontSize: '.86rem', color: themeText, lineHeight: 1.5, margin: '0 0 16px' }}>
              Are you sure you want to remove room <strong>{roomToRemove.name}</strong> ({roomToRemove.category || 'Cottage'})? This will permanently remove it from the resort catalog and inventory.
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button
                type="button"
                className="btn btn-sm"
                onClick={() => setRoomToRemove(null)}
                style={{ border: `1px solid ${themeBorder}`, color: themeText }}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-sm"
                onClick={handleConfirmRemoveRoom}
                disabled={removingRoom}
                style={{ background: '#EF4444', color: '#FFF', fontWeight: 700 }}
              >
                {removingRoom ? 'Removing…' : 'Remove Room'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 6. REMOVE SUPPLY ITEM CONFIRMATION MODAL */}
      {supplyToRemove && (
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
          onClick={() => setSupplyToRemove(null)}
        >
          <div
            style={{
              width: '100%',
              maxWidth: 420,
              background: isLightMode ? '#FFFFFF' : '#0F172A',
              borderRadius: 20,
              border: '1px solid rgba(239, 68, 68, 0.4)',
              padding: 24,
              boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <span
                style={{
                  fontSize: '.74rem',
                  color: '#EF4444',
                  fontWeight: 800,
                  textTransform: 'uppercase',
                  letterSpacing: '.08em',
                }}
              >
                REMOVE SUPPLY ITEM
              </span>
              <button
                onClick={() => setSupplyToRemove(null)}
                style={{ background: 'none', border: 'none', color: themeMuted, fontSize: '1.2rem', cursor: 'pointer' }}
              >
                <i className="fas fa-xmark" />
              </button>
            </div>
            <h3
              style={{
                margin: '0 0 10px',
                fontSize: '1.2rem',
                color: '#EF4444',
                fontFamily: "'Plus Jakarta Sans', sans-serif",
              }}
            >
              Remove &quot;{supplyToRemove.item_name}&quot;?
            </h3>
            <p style={{ fontSize: '.86rem', color: themeText, lineHeight: 1.5, margin: '0 0 16px' }}>
              Are you sure you want to remove supply item <strong>{supplyToRemove.item_name}</strong> from the warehouse inventory ledger?
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button
                type="button"
                className="btn btn-sm"
                onClick={() => setSupplyToRemove(null)}
                style={{ border: `1px solid ${themeBorder}`, color: themeText }}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-sm"
                onClick={handleConfirmRemoveSupply}
                disabled={removingSupply}
                style={{ background: '#EF4444', color: '#FFF', fontWeight: 700 }}
              >
                {removingSupply ? 'Removing…' : 'Remove Item'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 7. REMOVE RESERVATION CONFIRMATION MODAL */}
      {reservationToRemove && (
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
          onClick={() => setReservationToRemove(null)}
        >
          <div
            style={{
              width: '100%',
              maxWidth: 440,
              background: isLightMode ? '#FFFFFF' : '#0F172A',
              borderRadius: 20,
              border: '1px solid rgba(239, 68, 68, 0.4)',
              padding: 24,
              boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <span
                style={{
                  fontSize: '.74rem',
                  color: '#EF4444',
                  fontWeight: 800,
                  textTransform: 'uppercase',
                  letterSpacing: '.08em',
                }}
              >
                REMOVE BOOKING FOLIO
              </span>
              <button
                onClick={() => setReservationToRemove(null)}
                style={{ background: 'none', border: 'none', color: themeMuted, fontSize: '1.2rem', cursor: 'pointer' }}
              >
                <i className="fas fa-xmark" />
              </button>
            </div>
            <h3
              style={{
                margin: '0 0 10px',
                fontSize: '1.25rem',
                color: '#EF4444',
                fontFamily: "'Plus Jakarta Sans', sans-serif",
              }}
            >
              Remove Booking #{reservationToRemove.id.slice(0, 8)}?
            </h3>
            <p style={{ fontSize: '.86rem', color: themeText, lineHeight: 1.5, margin: '0 0 16px' }}>
              Are you sure you want to remove the booking folio for <strong>{reservationToRemove.guest_name || reservationToRemove.profiles?.full_name || 'Guest'}</strong> ({fmtDate(reservationToRemove.check_in)} → {fmtDate(reservationToRemove.check_out)})?
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button
                type="button"
                className="btn btn-sm"
                onClick={() => setReservationToRemove(null)}
                style={{ border: `1px solid ${themeBorder}`, color: themeText }}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-sm"
                onClick={handleConfirmRemoveReservation}
                disabled={removingReservation}
                style={{ background: '#EF4444', color: '#FFF', fontWeight: 700 }}
              >
                {removingReservation ? 'Removing…' : 'Remove Booking'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 8. DELETE USER CONFIRMATION MODAL */}
      {userToDelete && (
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
          onClick={() => setUserToDelete(null)}
        >
          <div
            style={{
              width: '100%',
              maxWidth: 440,
              background: isLightMode ? '#FFFFFF' : '#0F172A',
              borderRadius: 20,
              border: '1px solid rgba(239, 68, 68, 0.4)',
              padding: 24,
              boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <span
                style={{
                  fontSize: '.74rem',
                  color: '#EF4444',
                  fontWeight: 800,
                  textTransform: 'uppercase',
                  letterSpacing: '.08em',
                }}
              >
                DANGER ZONE
              </span>
              <button
                onClick={() => setUserToDelete(null)}
                style={{ background: 'none', border: 'none', color: themeMuted, fontSize: '1.2rem', cursor: 'pointer' }}
              >
                <i className="fas fa-xmark" />
              </button>
            </div>
            <h3
              style={{
                margin: '0 0 10px',
                fontSize: '1.25rem',
                color: '#EF4444',
                fontFamily: "'Plus Jakarta Sans', sans-serif",
              }}
            >
              <i className="fas fa-trash-can" style={{ marginRight: 6 }} />
              Delete Account Permanently?
            </h3>
            <p style={{ fontSize: '.86rem', color: themeText, lineHeight: 1.5, margin: '0 0 16px' }}>
              Are you sure you want to delete the account for <strong>{userToDelete.full_name || userToDelete.email || 'this user'}</strong> ({userToDelete.role})?
            </p>
            <p
              style={{
                fontSize: '.78rem',
                color: themeMuted,
                background: 'rgba(239, 68, 68, 0.1)',
                padding: '10px 12px',
                borderRadius: 8,
                margin: '0 0 18px',
                border: '1px solid rgba(239,68,68,0.2)',
              }}
            >
              <i className="fas fa-triangle-exclamation" style={{ marginRight: 6 }} />
              This will delete authentication credentials and profile records from Supabase and log an administrative audit event.
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button
                type="button"
                className="btn btn-sm"
                onClick={() => setUserToDelete(null)}
                style={{ border: `1px solid ${themeBorder}`, color: themeText }}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-sm"
                onClick={handleDeleteUser}
                disabled={deletingUser}
                style={{ background: '#EF4444', color: '#FFF', fontWeight: 700 }}
              >
                {deletingUser ? 'Deleting…' : 'Yes, Delete Account'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 9. ADMIN FORGOT PASSWORD OTP RECOVERY MODAL */}
      {showAdminForgotModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(2, 6, 23, 0.85)',
            backdropFilter: 'blur(8px)',
            zIndex: 1100,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 20,
          }}
          onClick={() => setShowAdminForgotModal(false)}
        >
          <div
            style={{
              width: '100%',
              maxWidth: 440,
              background: '#0F172A',
              borderRadius: 20,
              border: '1px solid rgba(34, 195, 238, 0.35)',
              padding: 26,
              boxShadow: '0 25px 50px -12px rgba(0,0,0,0.6)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <div>
                <span
                  style={{
                    fontSize: '.72rem',
                    color: '#22c3ee',
                    fontWeight: 800,
                    textTransform: 'uppercase',
                    letterSpacing: '.12em',
                  }}
                >
                  ADMIN SECURITY RECOVERY
                </span>
                <h3
                  style={{
                    margin: '4px 0 0',
                    fontSize: '1.25rem',
                    color: '#FFF',
                    fontFamily: "'Plus Jakarta Sans', sans-serif",
                  }}
                >
                  <i className="fas fa-key" style={{ marginRight: 4 }} />
                  Reset Administrator Password
                </h3>
              </div>
              <button
                onClick={() => setShowAdminForgotModal(false)}
                style={{ background: 'none', border: 'none', color: '#94A3B8', fontSize: '1.2rem', cursor: 'pointer' }}
              >
                <i className="fas fa-xmark" />
              </button>
            </div>

            {adminRecoveryStep === 1 ? (
              <form onSubmit={handleAdminForgotPassword} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <p style={{ fontSize: '.84rem', color: '#94A3B8', margin: 0, lineHeight: 1.5 }}>
                  Enter your registered administrator email. A secure 6-digit OTP verification code will be dispatched to your inbox via Google Mail / SMTP.
                </p>
                <div>
                  <label style={{ fontSize: '.76rem', color: '#22c3ee', fontWeight: 700, display: 'block', marginBottom: 4 }}>
                    ADMINISTRATOR EMAIL
                  </label>
                  <input
                    required
                    type="email"
                    value={adminRecoveryEmail}
                    onChange={(e) => setAdminRecoveryEmail(e.target.value)}
                    placeholder="admin@rockviewresort.ph"
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      borderRadius: 10,
                      border: '1px solid rgba(255,255,255,0.15)',
                      background: 'rgba(255,255,255,0.05)',
                      color: '#FFF',
                      fontSize: '.88rem',
                    }}
                  />
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 4 }}>
                  <button
                    type="button"
                    className="btn btn-sm"
                    onClick={() => setShowAdminForgotModal(false)}
                    style={{ border: '1px solid rgba(255,255,255,0.2)', color: '#FFF' }}
                  >
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-sky btn-sm" disabled={adminRecoveryBusy}>
                    {adminRecoveryBusy ? 'Sending OTP…' : 'Send 6-Digit OTP ✦'}
                  </button>
                </div>
              </form>
            ) : (
              <form onSubmit={handleAdminResetPassword} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <p style={{ fontSize: '.84rem', color: '#94A3B8', margin: 0, lineHeight: 1.5 }}>
                  Enter the 6-digit OTP sent to <strong>{adminRecoveryEmail}</strong> and choose a new password.
                </p>
                <div>
                  <label style={{ fontSize: '.76rem', color: '#22c3ee', fontWeight: 700, display: 'block', marginBottom: 4 }}>
                    6-DIGIT OTP VERIFICATION CODE
                  </label>
                  <input
                    required
                    maxLength={6}
                    value={adminRecoveryCode}
                    onChange={(e) => setAdminRecoveryCode(e.target.value.trim())}
                    placeholder="123456"
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      borderRadius: 10,
                      border: '1px solid #22c3ee',
                      background: 'rgba(255,255,255,0.05)',
                      color: '#38BDF8',
                      fontSize: '1.2rem',
                      textAlign: 'center',
                      letterSpacing: '0.3em',
                      fontWeight: 700,
                    }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '.76rem', color: '#22c3ee', fontWeight: 700, display: 'block', marginBottom: 4 }}>
                    NEW PASSWORD (MIN 6 CHARACTERS)
                  </label>
                  <input
                    required
                    type="password"
                    minLength={6}
                    value={adminRecoveryNewPass}
                    onChange={(e) => setAdminRecoveryNewPass(e.target.value)}
                    placeholder="••••••••"
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      borderRadius: 10,
                      border: '1px solid rgba(255,255,255,0.15)',
                      background: 'rgba(255,255,255,0.05)',
                      color: '#FFF',
                      fontSize: '.88rem',
                    }}
                  />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
                  <button
                    type="button"
                    onClick={() => setAdminRecoveryStep(1)}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#38BDF8',
                      fontSize: '.78rem',
                      cursor: 'pointer',
                      padding: 0,
                    }}
                  >
                    ← Back / Change Email
                  </button>
                  <button type="submit" className="btn btn-sky btn-sm" disabled={adminRecoveryBusy}>
                    {adminRecoveryBusy ? 'Resetting…' : 'Verify & Reset Password ✦'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* 10. LEDGER REFUND MODAL */}
      {refundTarget && (
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
          onClick={() => setRefundTarget(null)}
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
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 14,
                borderBottom: `1px solid ${themeBorder}`,
                paddingBottom: 10,
              }}
            >
              <div>
                <span
                  style={{
                    fontSize: '.74rem',
                    color: refundMode === 'confirm' ? '#10B981' : '#F59E0B',
                    fontWeight: 800,
                    textTransform: 'uppercase',
                    letterSpacing: '.08em',
                  }}
                >
                  {refundMode === 'confirm' ? 'ACCOUNTING REFUND APPROVAL' : 'GUEST REFUND CLAIM'}
                </span>
                <h3
                  style={{
                    margin: '4px 0 0',
                    fontSize: '1.25rem',
                    color: themeText,
                    fontFamily: "'Plus Jakarta Sans', sans-serif",
                  }}
                >
                  {refundMode === 'confirm' ? (
                    <>
                      <i className="fas fa-money-bill" style={{ marginRight: 6 }} />
                      Confirm &amp; Process Refund
                    </>
                  ) : (
                    <>
                      <i className="fas fa-money-bill-wave" style={{ marginRight: 6 }} />
                      Initiate Refund Request
                    </>
                  )}
                </h3>
              </div>
              <button
                onClick={() => setRefundTarget(null)}
                style={{ background: 'none', border: 'none', color: themeMuted, fontSize: '1.2rem', cursor: 'pointer' }}
              >
                <i className="fas fa-xmark" />
              </button>
            </div>

            <p style={{ fontSize: '.84rem', color: themeMuted, margin: '0 0 14px', lineHeight: 1.5 }}>
              Folio: <b>{refundTarget.guest_name || refundTarget.profiles?.full_name || 'Guest'}</b> · {refundTarget.rooms?.name || 'Villa'} ({fmtDate(refundTarget.check_in)} → {fmtDate(refundTarget.check_out)})
            </p>

            <form onSubmit={handleRefundSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label style={{ fontSize: '.75rem', color: themeMuted, fontWeight: 700, display: 'block', marginBottom: 4 }}>
                    Mode
                  </label>
                  <select
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: 8,
                      border: `1px solid ${themeBorder}`,
                      background: isLightMode ? '#F8FAFC' : '#1E293B',
                      color: themeText,
                    }}
                    value={refundMode}
                    onChange={(e) => setRefundMode(e.target.value)}
                  >
                    <option value="request">Request In-Process</option>
                    <option value="confirm">Approve &amp; Disburse</option>
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: '.75rem', color: themeMuted, fontWeight: 700, display: 'block', marginBottom: 4 }}>
                    Refund Amount (₱) *
                  </label>
                  <input
                    required
                    type="number"
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: 8,
                      border: `1px solid ${themeBorder}`,
                      background: isLightMode ? '#F8FAFC' : 'rgba(255,255,255,0.05)',
                      color: themeText,
                    }}
                    value={refundAmount}
                    onChange={(e) => setRefundAmount(e.target.value)}
                    placeholder="e.g. 3500"
                  />
                </div>
              </div>

              {refundMode === 'confirm' ? (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div>
                    <label style={{ fontSize: '.75rem', color: themeMuted, fontWeight: 700, display: 'block', marginBottom: 4 }}>
                      Payment Method
                    </label>
                    <select
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        borderRadius: 8,
                        border: `1px solid ${themeBorder}`,
                        background: isLightMode ? '#F8FAFC' : '#1E293B',
                        color: themeText,
                      }}
                      value={refundMethod}
                      onChange={(e) => setRefundMethod(e.target.value)}
                    >
                      <option value="GCash">GCash</option>
                      <option value="Maya">Maya</option>
                      <option value="Bank Transfer">Bank Transfer</option>
                      <option value="Credit Card">Credit Card</option>
                      <option value="Cash">Cash (Front Desk)</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: '.75rem', color: themeMuted, fontWeight: 700, display: 'block', marginBottom: 4 }}>
                      Reference Number
                    </label>
                    <input
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        borderRadius: 8,
                        border: `1px solid ${themeBorder}`,
                        background: isLightMode ? '#F8FAFC' : 'rgba(255,255,255,0.05)',
                        color: themeText,
                      }}
                      value={refundRefNum}
                      onChange={(e) => setRefundRefNum(e.target.value)}
                      placeholder="e.g. GCASH-998811"
                    />
                  </div>
                </div>
              ) : (
                <div>
                  <label style={{ fontSize: '.75rem', color: themeMuted, fontWeight: 700, display: 'block', marginBottom: 4 }}>
                    Reason for Refund
                  </label>
                  <input
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: 8,
                      border: `1px solid ${themeBorder}`,
                      background: isLightMode ? '#F8FAFC' : 'rgba(255,255,255,0.05)',
                      color: themeText,
                    }}
                    value={refundReason}
                    onChange={(e) => setRefundReason(e.target.value)}
                    placeholder="e.g. Typhoon weather advisory cancellation"
                  />
                </div>
              )}

              <div
                style={{
                  padding: '10px 12px',
                  background: isLightMode ? '#F1F5F9' : 'rgba(255,255,255,0.03)',
                  borderRadius: 10,
                  border: `1px solid ${themeBorder}`,
                  fontSize: '.76rem',
                  color: themeMuted,
                  lineHeight: 1.4,
                }}
              >
                <i className="fas fa-envelope" style={{ marginRight: 4 }} /> <strong>Automated Email Notification:</strong> Submitting will immediately trigger an automated email to <strong>{refundTarget.guest_email || refundTarget.profiles?.email || 'guest email'}</strong> notifying them of this status update.
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 8 }}>
                <button
                  type="button"
                  className="btn btn-sm"
                  onClick={() => setRefundTarget(null)}
                  style={{ border: `1px solid ${themeBorder}`, color: themeText }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className={`btn btn-sm ${refundMode === 'confirm' ? 'btn-green' : 'btn-sky'}`}
                  disabled={submittingRefund}
                  style={refundMode === 'confirm' ? { background: '#10B981', color: '#FFF', fontWeight: 700 } : {}}
                >
                  {submittingRefund ? 'Processing…' : refundMode === 'confirm' ? 'Confirm & Email Guest ✦' : 'Submit & Email Guest ✦'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 11. NOTIFICATION DETAILS & ACTION VIEWER MODAL */}
      {viewingNotification && (
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
          onClick={() => setViewingNotification(null)}
        >
          <div
            style={{
              width: '100%',
              maxWidth: 540,
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
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                marginBottom: 16,
                borderBottom: `1px solid ${themeBorder}`,
                paddingBottom: 14,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div
                  style={{
                    width: 38,
                    height: 38,
                    borderRadius: 10,
                    background:
                      viewingNotification.channel === 'sms'
                        ? 'rgba(16,185,129,0.15)'
                        : 'rgba(14,165,233,0.15)',
                    color: viewingNotification.channel === 'sms' ? '#10B981' : '#0EA5E9',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '1.1rem',
                  }}
                >
                  <i className={`fas ${viewingNotification.channel === 'sms' ? 'fa-sms' : 'fa-bell'}`} />
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span
                      style={{
                        fontSize: '.68rem',
                        fontWeight: 800,
                        padding: '2px 8px',
                        borderRadius: 12,
                        background: viewingNotification.is_read
                          ? isLightMode
                            ? '#F1F5F9'
                            : 'rgba(255,255,255,0.06)'
                          : 'rgba(14,165,233,0.15)',
                        color: viewingNotification.is_read ? themeMuted : '#0EA5E9',
                        border: `1px solid ${viewingNotification.is_read ? themeBorder : 'rgba(14,165,233,0.3)'}`,
                      }}
                    >
                      {viewingNotification.is_read ? 'READ' : 'UNREAD'}
                    </span>
                    <span style={{ fontSize: '.72rem', color: themeMuted }}>
                      {viewingNotification.channel?.toUpperCase() || 'SYSTEM'}
                    </span>
                  </div>
                  <h3
                    style={{
                      margin: '4px 0 0',
                      fontSize: '1.25rem',
                      color: themeText,
                      fontFamily: "'Plus Jakarta Sans', sans-serif",
                    }}
                  >
                    {viewingNotification.title || viewingNotification.subject || 'Notification Dispatch'}
                  </h3>
                </div>
              </div>
              <button
                onClick={() => setViewingNotification(null)}
                style={{ background: 'none', border: 'none', color: themeMuted, fontSize: '1.2rem', cursor: 'pointer' }}
              >
                <i className="fas fa-xmark" />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: 10,
                  background: isLightMode ? '#F8FAFC' : 'rgba(255,255,255,0.03)',
                  padding: 12,
                  borderRadius: 10,
                  border: `1px solid ${themeBorder}`,
                }}
              >
                <div>
                  <small style={{ fontSize: '.68rem', color: themeMuted, fontWeight: 700, display: 'block' }}>
                    RECORDED TIMESTAMP
                  </small>
                  <span
                    style={{
                      fontSize: '.78rem',
                      color: themeText,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 5,
                      marginTop: 2,
                    }}
                  >
                    <i className="fas fa-clock" style={{ color: '#0EA5E9', fontSize: '.72rem' }} />
                    {new Date(
                      viewingNotification.created_at || viewingNotification.timestamp || Date.now()
                    ).toLocaleString()}
                  </span>
                </div>
                <div>
                  <small style={{ fontSize: '.68rem', color: themeMuted, fontWeight: 700, display: 'block' }}>
                    TARGET RECIPIENT
                  </small>
                  <span
                    style={{
                      fontSize: '.78rem',
                      color: themeText,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 5,
                      marginTop: 2,
                    }}
                  >
                    <i className="fas fa-user-tag" style={{ color: '#10B981', fontSize: '.72rem' }} />
                    {viewingNotification.phone ||
                      viewingNotification.recipient ||
                      viewingNotification.guest_name ||
                      'Front Desk & Guest Broadcast'}
                  </span>
                </div>
              </div>

              <div>
                <label style={{ fontSize: '.74rem', color: themeMuted, fontWeight: 700, display: 'block', marginBottom: 6 }}>
                  MESSAGE BODY
                </label>
                <div
                  style={{
                    background: isLightMode ? '#F8FAFC' : '#0B1426',
                    border: `1px solid ${themeBorder}`,
                    borderRadius: 12,
                    padding: 16,
                    color: themeText,
                    fontSize: '.85rem',
                    lineHeight: 1.6,
                    whiteSpace: 'pre-wrap',
                  }}
                >
                  {viewingNotification.body || viewingNotification.message || 'No additional text content recorded.'}
                </div>
              </div>

              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginTop: 8,
                  borderTop: `1px solid ${themeBorder}`,
                  paddingTop: 14,
                }}
              >
                <button
                  type="button"
                  onClick={async () => {
                    const id = viewingNotification.id;
                    setViewingNotification(null);
                    await handleDeleteNotif(id);
                  }}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '8px 14px',
                    borderRadius: 8,
                    fontSize: '.78rem',
                    fontWeight: 700,
                    color: '#EF4444',
                    background: isLightMode ? '#FEF2F2' : 'rgba(239, 68, 68, 0.12)',
                    border: `1px solid ${isLightMode ? '#FECACA' : 'rgba(239, 68, 68, 0.3)'}`,
                    cursor: 'pointer',
                  }}
                >
                  <i className="fas fa-trash-alt" /> Remove
                </button>

                <div style={{ display: 'flex', gap: 10 }}>
                  <button
                    type="button"
                    onClick={async () => {
                      await handleMarkNotifRead(viewingNotification.id);
                      setViewingNotification({
                        ...viewingNotification,
                        is_read: !viewingNotification.is_read,
                      });
                    }}
                    className="btn btn-sm"
                    style={{
                      border: `1px solid ${themeBorder}`,
                      color: themeText,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                    }}
                  >
                    <i className={`fas ${viewingNotification.is_read ? 'fa-envelope' : 'fa-envelope-open'}`} />
                    {viewingNotification.is_read ? 'Mark Unread' : 'Mark as Read'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewingNotification(null)}
                    className="btn btn-sky btn-sm"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
