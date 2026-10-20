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
import { uploadImageToCloudinary } from '../../../lib/cloudinary';
import { api } from '../../../lib/api';
import { toast } from '../../Toasts';

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
          reservationsList={state.allBookings}
          walkInPoolAddon={state.walkInPoolAddon}
          setWalkInPoolAddon={state.setWalkInPoolAddon}
          isLightMode={state.isLightMode}
          themeBorder={state.themeBorder}
          themeText={state.themeText}
          themeMuted={state.themeMuted}
          getRoomImageUrl={(room: any) =>
            room?.image_url ||
            (Array.isArray(room?.images) && room.images[0]) ||
            ''
          }
        />
      )}

      {state.showAddJournalModal && (
        <JournalVoucherModal
          isOpen={state.showAddJournalModal}
          onClose={() => state.setShowAddJournalModal(false)}
          journalForm={state.journalForm as any}
          setJournalForm={state.setJournalForm as any}
          onSubmit={state.handlePostJournalEntry}
          postingJournal={state.postingJournal}
          chartOfAccounts={state.chartOfAccounts}
          isLightMode={state.isLightMode}
          themeBorder={state.themeBorder}
          themeText={state.themeText}
          themeMuted={state.themeMuted}
        />
      )}

      {state.showBackupModal && (
        <BackupMigrationModal
          isOpen={state.showBackupModal}
          onClose={() => state.setShowBackupModal(false)}
          backupTab={state.backupTab === 'import' ? 'import' : 'export'}
          setBackupTab={state.setBackupTab}
          downloadingExport={null}
          previewSqlText={state.previewSqlText}
          setPreviewSqlText={state.setPreviewSqlText}
          loadingPreviewSql={state.loadingPreviewSql}
          setLoadingPreviewSql={state.setLoadingPreviewSql}
          importContent={state.importContent}
          setImportContent={state.setImportContent}
          importMode={state.importMode}
          setImportMode={state.setImportMode}
          importingBackup={state.importingBackup}
          handleDownloadExport={state.handleDownloadExport}
          handleExecuteImport={state.handleExecuteImport}
          onFetchBackupText={(fmt) => api.fetchLedgerBackupText(fmt)}
          isLightMode={state.isLightMode}
          themeBorder={state.themeBorder}
          themeText={state.themeText}
          themeMuted={state.themeMuted}
        />
      )}

      {state.receiptModalBooking && (
        <GuestFolioReceiptModal
          booking={state.receiptModalBooking}
          onClose={() => state.setReceiptModalBooking(null)}
          adminProfileState={state.adminProfileState}
        />
      )}

      {state.editingRoom && (
        <RoomEditorModal
          room={state.editingRoom}
          isOpen={Boolean(state.editingRoom)}
          onClose={() => state.setEditingRoom(null)}
          onSave={state.handleSaveEditedRoom}
          onDelete={(room) => {
            state.setRoomToRemove(room);
          }}
          isLightMode={state.isLightMode}
          themeBorder={state.themeBorder}
          themeText={state.themeText}
          themeMuted={state.themeMuted}
          uploadImageToCloudinary={uploadImageToCloudinary}
          toast={toast}
        />
      )}

      {state.showCreateRoomModal && (
        <CreateRoomModal
          isOpen={state.showCreateRoomModal}
          onClose={() => state.setShowCreateRoomModal(false)}
          newRoom={state.newRoom}
          setNewRoom={state.setNewRoom}
          handleCreateRoom={state.handleCreateRoom}
          isLightMode={state.isLightMode}
          themeBorder={state.themeBorder}
          themeText={state.themeText}
          themeMuted={state.themeMuted}
          uploadImageToCloudinary={uploadImageToCloudinary}
          toast={toast}
        />
      )}

      {state.showCreateSupplyModal && (
        <CreateSupplyModal
          isOpen={state.showCreateSupplyModal}
          onClose={() => state.setShowCreateSupplyModal(false)}
          newSupply={state.newSupply}
          setNewSupply={state.setNewSupply}
          handleCreateSupply={state.handleCreateSupply}
          isLightMode={state.isLightMode}
          themeBorder={state.themeBorder}
          themeText={state.themeText}
          themeMuted={state.themeMuted}
        />
      )}

      {state.timelineBooking && (
        <StatusTimelineModal
          isOpen={Boolean(state.timelineBooking)}
          booking={state.timelineBooking}
          onClose={() => state.setTimelineBooking(null)}
          viewerRole="administrator"
          onUpdateStatus={(id, status) => {
            state.updateStatus(id, status);
          }}
        />
      )}

      {state.showGlossaryModal && (
        <AnalyticsGlossaryModal onClose={() => state.setShowGlossaryModal(false)} isLightMode={state.isLightMode} />
      )}

      {state.activeChatGuest && (
        <ExecutiveGuestChatModal
          guest={state.activeChatGuest}
          onClose={() => state.setActiveChatGuest(null)}
          isLightMode={state.isLightMode}
        />
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
