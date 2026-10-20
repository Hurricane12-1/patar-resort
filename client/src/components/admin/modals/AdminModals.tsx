import React from 'react';
import AddReservationModal from './AddReservationModal';
import JournalVoucherModal from './JournalVoucherModal';
import BackupMigrationModal from './BackupMigrationModal';
import { GuestFolioReceiptModal } from './GuestFolioReceiptModal';
import { RoomEditorModal } from './RoomEditorModal';
import { CreateRoomModal } from './CreateRoomModal';
import { CreateSupplyModal } from './CreateSupplyModal';
import { AdminDialogs } from './AdminDialogs';
import StatusTimelineModal from '../../StatusTimelineModal';
import { AnalyticsGlossaryModal } from '../../AnalyticsGlossaryModal';
import { ExecutiveGuestChatModal } from '../../ExecutiveGuestChatModal';
import { AdminState } from '../../../hooks/useAdminState';

export interface AdminModalsProps {
  state: AdminState;
}

export const AdminModals: React.FC<AdminModalsProps> = ({ state }) => {
  return (
    <>
      {state.showAddReservationModal && (
        <AddReservationModal
          isOpen={state.showAddReservationModal}
          onClose={() => state.setShowAddReservationModal(false)}
          newReservation={state.newReservation}
          setNewReservation={state.setNewReservation}
          onSubmit={state.handleCreateReservation}
          creatingReservation={state.creatingReservation}
          activeRoomsList={state.activeRoomsList}
          roomsList={state.roomsList}
          reservationsList={state.reservationsList}
          walkInPoolAddon={state.walkInPoolAddon}
          setWalkInPoolAddon={state.setWalkInPoolAddon}
          isLightMode={state.isLightMode}
          themeBorder={state.themeBorder}
        />
      )}

      {state.showAddJournalModal && (
        <JournalVoucherModal
          isOpen={state.showAddJournalModal}
          onClose={() => state.setShowAddJournalModal(false)}
          journalForm={state.journalForm}
          setJournalForm={state.setJournalForm}
          onSubmit={state.handlePostJournalEntry}
          postingJournal={state.postingJournal}
          chartOfAccounts={state.chartOfAccounts}
          isLightMode={state.isLightMode}
          themeBorder={state.themeBorder}
        />
      )}

      {state.showBackupModal && (
        <BackupMigrationModal
          isOpen={state.showBackupModal}
          onClose={() => state.setShowBackupModal(false)}
          backupTab={state.backupTab}
          setBackupTab={state.setBackupTab}
          exportFormat={state.exportFormat}
          setExportFormat={state.setExportFormat}
          previewSqlText={state.previewSqlText}
          setPreviewSqlText={state.setPreviewSqlText}
          loadingPreviewSql={state.loadingPreviewSql}
          importContent={state.importContent}
          setImportContent={state.setImportContent}
          importMode={state.importMode}
          setImportMode={state.setImportMode}
          importingBackup={state.importingBackup}
          onDownloadExport={state.handleDownloadExport}
          onExecuteImport={state.handleExecuteImport}
          isLightMode={state.isLightMode}
          themeBorder={state.themeBorder}
        />
      )}

      {state.receiptModalBooking && (
        <GuestFolioReceiptModal
          booking={state.receiptModalBooking}
          onClose={() => state.setReceiptModalBooking(null)}
          isLightMode={state.isLightMode}
          themeBorder={state.themeBorder}
        />
      )}

      {state.editingRoom && (
        <RoomEditorModal
          editingRoom={state.editingRoom}
          setEditingRoom={state.setEditingRoom}
          onSubmit={state.handleUpdateRoomSubmit}
          onPhotoUpload={state.handleRoomPhotoUpload}
          uploadingRoomPhoto={state.uploadingRoomPhoto}
          onAddPhotoUrl={state.handleAddPhotoUrl}
          onAddPresetPhoto={state.handleAddPresetPhoto}
          onRemovePhoto={state.handleRemovePhoto}
          onSetPrimaryPhoto={state.handleSetPrimaryPhoto}
          onDeleteRoom={() => {
            state.setRoomToRemove(state.editingRoom);
          }}
          isLightMode={state.isLightMode}
          themeBorder={state.themeBorder}
        />
      )}

      {state.showCreateRoomModal && (
        <CreateRoomModal
          isOpen={state.showCreateRoomModal}
          onClose={() => state.setShowCreateRoomModal(false)}
          newRoom={state.newRoom}
          setNewRoom={state.setNewRoom}
          onSubmit={state.handleCreateRoom}
          isLightMode={state.isLightMode}
          themeBorder={state.themeBorder}
        />
      )}

      {state.showCreateSupplyModal && (
        <CreateSupplyModal
          isOpen={state.showCreateSupplyModal}
          onClose={() => state.setShowCreateSupplyModal(false)}
          newSupply={state.newSupply}
          setNewSupply={state.setNewSupply}
          onSubmit={state.handleCreateSupply}
          isLightMode={state.isLightMode}
          themeBorder={state.themeBorder}
        />
      )}

      {state.timelineBooking && (
        <StatusTimelineModal
          booking={state.timelineBooking}
          onClose={() => state.setTimelineBooking(null)}
          onStatusUpdated={() => {
            state.refreshReservations();
          }}
        />
      )}

      {state.showGlossaryModal && (
        <AnalyticsGlossaryModal onClose={() => state.setShowGlossaryModal(false)} isLightMode={state.isLightMode} />
      )}

      {state.activeChatGuest && (
        <ExecutiveGuestChatModal guest={state.activeChatGuest} onClose={() => state.setActiveChatGuest(null)} />
      )}

      <AdminDialogs
        isLightMode={state.isLightMode}
        themeBorder={state.themeBorder}
        themeText={state.themeText}
        themeMuted={state.themeMuted}
        showKeywordsModal={state.showKeywordsModal}
        setShowKeywordsModal={state.setShowKeywordsModal}
        showCreateModal={state.showCreateModal}
        setShowCreateModal={state.setShowCreateModal}
        newStaff={state.newStaff}
        setNewStaff={state.setNewStaff}
        handleProvisionStaff={state.handleProvisionStaff}
        creatingStaff={state.creatingStaff}
        recoveryTarget={state.recoveryTarget}
        setRecoveryTarget={state.setRecoveryTarget}
        newPassword={state.newPassword}
        setNewPassword={state.setNewPassword}
        handlePasswordRecovery={state.handlePasswordRecovery}
        resettingPass={state.resettingPass}
        editingUser={state.editingUser}
        setEditingUser={state.setEditingUser}
        handleUpdateUser={state.handleUpdateUser}
        savingUser={state.savingUser}
        roomToRemove={state.roomToRemove}
        setRoomToRemove={state.setRoomToRemove}
        handleConfirmRemoveRoom={state.handleConfirmRemoveRoom}
        removingRoom={state.removingRoom}
        supplyToRemove={state.supplyToRemove}
        setSupplyToRemove={state.setSupplyToRemove}
        handleConfirmRemoveSupply={state.handleConfirmRemoveSupply}
        removingSupply={state.removingSupply}
        reservationToRemove={state.reservationToRemove}
        setReservationToRemove={state.setReservationToRemove}
        handleConfirmRemoveReservation={state.handleConfirmRemoveReservation}
        removingReservation={state.removingReservation}
        userToDelete={state.userToDelete}
        setUserToDelete={state.setUserToDelete}
        handleDeleteUser={state.handleDeleteUser}
        deletingUser={state.deletingUser}
        showAdminForgotModal={state.showAdminForgotModal}
        setShowAdminForgotModal={state.setShowAdminForgotModal}
        adminRecoveryStep={state.adminRecoveryStep}
        setAdminRecoveryStep={state.setAdminRecoveryStep}
        adminRecoveryEmail={state.adminRecoveryEmail}
        setAdminRecoveryEmail={state.setAdminRecoveryEmail}
        adminRecoveryCode={state.adminRecoveryCode}
        setAdminRecoveryCode={state.setAdminRecoveryCode}
        adminRecoveryNewPass={state.adminRecoveryNewPass}
        setAdminRecoveryNewPass={state.setAdminRecoveryNewPass}
        handleAdminForgotPassword={state.handleAdminForgotPassword}
        handleAdminResetPassword={state.handleAdminResetPassword}
        adminRecoveryBusy={state.adminRecoveryBusy}
        refundTarget={state.refundTarget}
        setRefundTarget={state.setRefundTarget}
        refundMode={state.refundMode}
        setRefundMode={state.setRefundMode}
        refundAmount={state.refundAmount}
        setRefundAmount={state.setRefundAmount}
        refundMethod={state.refundMethod}
        setRefundMethod={state.setRefundMethod}
        refundRefNum={state.refundRefNum}
        setRefundRefNum={state.setRefundRefNum}
        refundReason={state.refundReason}
        setRefundReason={state.setRefundReason}
        handleRefundSubmit={state.handleRefundSubmit}
        submittingRefund={state.submittingRefund}
        viewingNotification={state.viewingNotification}
        setViewingNotification={state.setViewingNotification}
        handleDeleteNotif={state.handleDeleteNotif}
        handleMarkNotifRead={state.handleMarkNotifRead}
      />
    </>
  );
};
