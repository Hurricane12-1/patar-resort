import React from 'react';
import '../styles/admin.css';
import { useAdminState } from '../hooks/useAdminState';
import { AdminLoginView } from '../views/admin/AdminLoginView';
import { OverviewView } from '../views/admin/OverviewView';
import { LedgerView } from '../views/admin/LedgerView';
import { RoomInventoryView } from '../views/admin/RoomInventoryView';
import { AccountDirectoryView } from '../views/admin/AccountDirectoryView';
import { AuditTrailView } from '../views/admin/AuditTrailView';
import { NotificationsView } from '../views/admin/NotificationsView';
import { SettingsView } from '../views/admin/SettingsView';
import { ExecutiveGuestConversationsPanel } from '../components/ExecutiveGuestConversationsPanel';
import CsvTableViewer from '../components/CsvTableViewer';
import { AdminSidebar } from '../components/admin/AdminSidebar';
import { AdminHeader } from '../components/admin/AdminHeader';
import { AdminModals } from '../components/admin/modals/AdminModals';
import { toast } from '../components/Toasts';

export default function Admin() {
  const state = useAdminState();

  if (!state.isAdministrator) {
    return (
      <AdminLoginView
        session={state.session} profile={state.profile} user={state.user}
        signOut={state.signOut} authError={state.authError} authenticating={state.authenticating}
        adminEmail={state.adminEmail} setAdminEmail={state.setAdminEmail}
        adminPass={state.adminPass} setAdminPass={state.setAdminPass}
        handleAdminLogin={state.handleAdminLogin}
        handleAdminBypass={state.handleAdminBypass}
        setAdminRecoveryEmail={state.setAdminRecoveryEmail}
        setAdminRecoveryStep={state.setAdminRecoveryStep}
        setShowAdminForgotModal={state.setShowAdminForgotModal}
      />
    );
  }

  if (state.loading || !state.data) {
    return (
      <div className="container section">
        <div className="skel" style={{ height: 120, marginBottom: 20 }} />
        <div className="skel" style={{ height: 320 }} />
      </div>
    );
  }

  const themeProps = {
    isLightMode: state.isLightMode,
    themeCardBg: state.themeCardBg,
    themeBorder: state.themeBorder,
    themeShadow: state.themeShadow,
    themeText: state.themeText,
    themeMuted: state.themeMuted,
  };

  return (
    <div className={`admin-portal ${state.isLightMode ? 'light-mode' : 'dark-mode'}`}>
      {state.sidebarMobileOpen && (
        <div
          onClick={() => state.setSidebarMobileOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.45)',
            backdropFilter: 'blur(4px)',
            zIndex: 998,
          }}
        />
      )}

      <AdminSidebar
        sidebarHidden={state.sidebarHidden} setSidebarHidden={state.setSidebarHidden}
        sidebarCollapsed={state.sidebarCollapsed} setSidebarCollapsed={state.setSidebarCollapsed}
        sidebarMobileOpen={state.sidebarMobileOpen} setSidebarMobileOpen={state.setSidebarMobileOpen}
        activeTab={state.activeTab} setActiveTab={state.setActiveTab}
        themeSidebarBg={state.themeSidebarBg} themeBorder={state.themeBorder}
        themeText={state.themeText} themeMuted={state.themeMuted}
        allBookingsCount={state.allBookings.length} unreadNotifsCount={state.unreadNotifsCount}
        usersCount={state.users.length} conversationsCount={state.guestConversations.length}
        setShowGlossaryModal={state.setShowGlossaryModal} signOut={state.signOut}
      />

      <div className="admin-right-pane">
        <AdminHeader
          themeHeaderBg={state.themeHeaderBg} themeBorder={state.themeBorder}
          themeText={state.themeText} themeMuted={state.themeMuted}
          isLightMode={state.isLightMode} toggleThemeMode={state.toggleThemeMode}
          sidebarHidden={state.sidebarHidden} setSidebarHidden={state.setSidebarHidden}
          sidebarMobileOpen={state.sidebarMobileOpen} setSidebarMobileOpen={state.setSidebarMobileOpen}
          activeTab={state.activeTab} setActiveTab={state.setActiveTab}
          searchQuery={state.searchQuery} setSearchQuery={state.setSearchQuery}
          unreadNotifsCount={state.unreadNotifsCount} notifications={state.notifications}
          handleMarkAllNotifsRead={state.handleMarkAllNotifsRead}
          handleMarkNotifRead={state.handleMarkNotifRead}
          handleDeleteNotif={state.handleDeleteNotif}
          adminProfileState={state.adminProfileState} profile={state.profile}
        />

        <main
          className="admin-main-content admin-content"
          style={{ background: state.themeBg, color: state.themeText, minHeight: 'calc(100vh - 70px)' }}
        >
          {state.activeTab === 'overview' && (
            <OverviewView
              {...themeProps} toast={toast}
              roomsList={state.roomsList} activeRoomsList={state.activeRoomsList}
              allBookings={state.allBookings} data={state.data}
              octoberSalesData={state.octoberSalesData} setActiveTab={state.setActiveTab}
              newReservation={state.newReservation} setNewReservation={state.setNewReservation}
              setShowAddReservationModal={state.setShowAddReservationModal}
              guestConversations={state.guestConversations}
              setSelectedPanelGuest={state.setSelectedPanelGuest}
              setActiveChatGuest={state.setActiveChatGuest}
            />
          )}

          {state.activeTab === 'ledger' && (
            <LedgerView
              {...themeProps} toast={toast}
              ledgerSubView={state.ledgerSubView} setLedgerSubView={state.setLedgerSubView}
              allBookings={state.allBookings} activeRoomsList={state.activeRoomsList}
              roomsList={state.roomsList} setRoomsList={state.setRoomsList}
              ledgerEntriesList={state.ledgerEntriesList} trialBalance={state.trialBalance}
              chartOfAccounts={state.chartOfAccounts} loadingLedger={state.loadingLedger}
              loadingReservations={state.loadingReservations} reconcilingLedger={state.reconcilingLedger}
              handleReconcileLedger={state.handleReconcileLedger}
              refreshReservations={state.refreshReservations} refreshLedgerEntries={state.refreshLedgerEntries}
              updateStatus={state.updateStatus} setTimelineBooking={state.setTimelineBooking}
              setReceiptModalBooking={state.setReceiptModalBooking}
              setReservationToRemove={state.setReservationToRemove}
              setRefundTarget={state.setRefundTarget} setRefundMode={state.setRefundMode}
              setRefundAmount={state.setRefundAmount} setRefundMethod={state.setRefundMethod}
              setShowAddReservationModal={state.setShowAddReservationModal}
              setShowAddJournalModal={state.setShowAddJournalModal}
              setShowBackupModal={state.setShowBackupModal} setBackupTab={state.setBackupTab}
              newReservation={state.newReservation} setNewReservation={state.setNewReservation}
            />
          )}

          {state.activeTab === 'inventory' && (
            <RoomInventoryView
              {...themeProps} toast={toast}
              roomsList={state.roomsList} allBookings={state.allBookings}
              inventoryList={state.inventoryList} loadingRoomsAndInv={state.loadingRoomsAndInv}
              refreshRoomsAndInventory={state.refreshRoomsAndInventory}
              setShowCreateRoomModal={state.setShowCreateRoomModal}
              setShowCreateSupplyModal={state.setShowCreateSupplyModal}
              setEditingRoom={state.setEditingRoom} setRoomToRemove={state.setRoomToRemove}
              setSupplyToRemove={state.setSupplyToRemove}
              handleToggleRoomActive={state.handleToggleRoomActive}
              handleAdjustSupplyStock={state.handleAdjustSupplyStock}
            />
          )}

          {state.activeTab === 'conversations' && (
            <ExecutiveGuestConversationsPanel
              {...themeProps}
              initialGuest={state.selectedPanelGuest}
              conversations={state.guestConversations}
            />
          )}

          {state.activeTab === 'settings' && (
            <SettingsView
              {...themeProps} toast={toast}
              adminProfileState={state.adminProfileState}
              setAdminProfileState={state.setAdminProfileState}
              currentAdminProfile={state.currentAdminProfile}
              handleSaveSettings={state.handleSaveSettings} savingSettings={state.savingSettings}
              handleAvatarUpload={state.handleAvatarUpload} uploadingAvatar={state.uploadingAvatar}
              handleRemoveAvatar={state.handleRemoveAvatar}
              deleteAccount={state.deleteAccount} updatePassword={state.updatePassword}
              setActiveTab={state.setActiveTab}
            />
          )}

          {state.activeTab === 'audit' && (
            <AuditTrailView
              {...themeProps} toast={toast}
              auditLogs={state.auditLogs} setAuditLogs={state.setAuditLogs}
              loadingAudit={state.loadingAudit} fetchAuditLogs={state.fetchAuditLogs}
              auditAutoRefresh={state.auditAutoRefresh} setAuditAutoRefresh={state.setAuditAutoRefresh}
              securityPosture={state.securityPosture} handleUnbanIp={state.handleUnbanIp}
            />
          )}

          {state.activeTab === 'accounts' && (
            <AccountDirectoryView
              {...themeProps}
              users={state.users} searchingUsers={state.searchingUsers}
              fetchUsers={state.fetchUsers} searchQuery={state.searchQuery}
              setSearchQuery={state.setSearchQuery} handleRoleChange={state.handleRoleChange}
              setNewStaff={state.setNewStaff} setShowCreateModal={state.setShowCreateModal}
              setEditingUser={state.setEditingUser} setRecoveryTarget={state.setRecoveryTarget}
              setNewPassword={state.setNewPassword} setUserToDelete={state.setUserToDelete}
            />
          )}

          {state.activeTab === 'notifications' && (
            <NotificationsView
              {...themeProps} toast={toast}
              notifications={state.notifications} setNotifications={state.setNotifications}
              handleMarkAllNotifsRead={state.handleMarkAllNotifsRead}
              handleClearReadNotifs={state.handleClearReadNotifs}
              handleClearAllNotifs={state.handleClearAllNotifs}
              handleMarkNotifRead={state.handleMarkNotifRead}
              handleDeleteNotif={state.handleDeleteNotif}
              setViewingNotification={state.setViewingNotification}
            />
          )}

          {state.activeTab === 'csv' && (
            <div
              className="panel"
              style={{
                background: state.themeCardBg,
                border: `1px solid ${state.themeBorder}`,
                borderRadius: 16,
                padding: 24,
                boxShadow: state.themeShadow,
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: 20,
                  flexWrap: 'wrap',
                  gap: 12,
                }}
              >
                <div>
                  <h3 className="serif" style={{ fontSize: '1.5rem', margin: 0, color: state.themeText }}>
                    Backup &amp; Data Explorer
                  </h3>
                  <p className="muted small" style={{ margin: '4px 0 0' }}>
                    Explore system tables, export datasets, and inspect schema structures.
                  </p>
                </div>
                <button onClick={() => state.setShowBackupModal(true)} className="btn btn-sky btn-sm">
                  <i className="fas fa-database" style={{ marginRight: 6 }} /> Open Migration Engine
                </button>
              </div>
              <CsvTableViewer isLightMode={state.isLightMode} />
            </div>
          )}
        </main>
      </div>

      <AdminModals state={state} />
    </div>
  );
}
