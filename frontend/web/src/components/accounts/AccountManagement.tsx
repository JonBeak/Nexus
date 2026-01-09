import React from 'react';
import { Users, Shield, Activity, Calendar } from 'lucide-react';
import { HomeButton } from '../common/HomeButton';
import { useNavigate } from 'react-router-dom';
import { PAGE_STYLES, MODULE_COLORS } from '../../constants/moduleColors';
import '../jobEstimation/JobEstimation.css';
import { UserModal } from './modals/UserModal';
import { PasswordModal } from './modals/PasswordModal';
import { VacationModal } from './modals/VacationModal';
import { ConfirmDialog } from './components/ConfirmDialog';
import { NotificationSystem } from './components/NotificationSystem';
import { useNotifications } from './hooks/useNotifications';
import { useAccountManagement } from './hooks/useAccountManagement';
import { UsersTab } from './components/tabs/UsersTab';
import { LoginLogsTab } from './components/tabs/LoginLogsTab';
import { VacationTab } from './components/tabs/VacationTab';
import type { AccountUser } from '../../types/user';

interface AccountManagementProps {
  user: AccountUser;
}

export const AccountManagement: React.FC<AccountManagementProps> = ({ user }) => {
  const navigate = useNavigate();
  const { notifications, removeNotification } = useNotifications();
  const tabs = [
    { id: 'users', label: 'User Accounts', icon: Users },
    { id: 'logs', label: 'Login Logs', icon: Activity },
    { id: 'vacations', label: 'Vacation Periods', icon: Calendar }
  ] as const;

  const {
    users,
    selectedUser,
    activeTab,
    showUserModal,
    showPasswordModal,
    showVacationModal,
    showDeleteConfirm,
    loginLogs,
    vacationPeriods,
    selectedVacation,
    apiLoading,
    setActiveTab,
    handleUserSave,
    handlePasswordChange,
    handleCreateVacation,
    handleDeleteVacation,
    openUserModal,
    openPasswordModal,
    openVacationModal,
    openDeleteConfirm,
    viewUserLogs,
    closeModals
  } = useAccountManagement();

  // Only managers and owners can access this component
  if (user.role !== 'manager' && user.role !== 'owner') {
    return (
      <div className={`${PAGE_STYLES.fullPage} flex items-center justify-center`}>
        <div className="text-center">
          <h1 className="text-2xl font-bold text-red-600">Access Denied</h1>
          <p className={`${PAGE_STYLES.panel.textSecondary} mt-2`}>Only managers and owners can access account management.</p>
        </div>
      </div>
    );
  }


  return (
    <div className={PAGE_STYLES.fullPage}>
      {/* Header */}
      <div className={`${PAGE_STYLES.panel.background} shadow-lg border-b-4 ${MODULE_COLORS.accounts.border}`}>
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <HomeButton />
              <div className={`w-12 h-12 ${MODULE_COLORS.accounts.base} rounded-xl flex items-center justify-center`}>
                <Shield className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className={`text-3xl font-bold ${PAGE_STYLES.panel.text}`}>Account Management</h1>
                <p className={PAGE_STYLES.panel.textSecondary}>Manage user accounts, roles, and settings</p>
              </div>
            </div>

            {/* Tabs */}
            <nav className="flex space-x-2">
              {tabs.map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  onClick={() => setActiveTab(id)}
                  className={`flex items-center space-x-2 px-4 py-2 rounded-lg font-medium transition-colors ${
                    activeTab === id
                      ? `${PAGE_STYLES.header.background} ${PAGE_STYLES.panel.text}`
                      : `${PAGE_STYLES.panel.textSecondary} hover:bg-gray-200`
                  }`}
                >
                  <Icon className="h-5 w-5" />
                  <span>{label}</span>
                </button>
              ))}
            </nav>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Tab Content */}
        {activeTab === 'users' && (
          <UsersTab
            users={users}
            onCreateUser={() => openUserModal()}
            onEditUser={openUserModal}
            onChangePassword={openPasswordModal}
            onViewLogs={viewUserLogs}
            onManageVacation={openVacationModal}
          />
        )}

        {activeTab === 'logs' && (
          <LoginLogsTab loginLogs={loginLogs} />
        )}

        {activeTab === 'vacations' && (
          <VacationTab
            vacationPeriods={vacationPeriods}
            users={users}
            onCreateVacation={() => openVacationModal()}
            onDeleteVacation={(vacationId) => openDeleteConfirm('vacation', vacationId)}
          />
        )}
      </div>

      {/* Modals */}
      <UserModal
        isOpen={showUserModal}
        onClose={closeModals}
        user={selectedUser}
        users={users}
        onSave={handleUserSave}
        currentUser={user}
      />

      <PasswordModal
        isOpen={showPasswordModal}
        onClose={closeModals}
        user={selectedUser}
        onSave={handlePasswordChange}
      />

      <VacationModal
        isOpen={showVacationModal}
        onClose={closeModals}
        users={users}
        selectedUser={selectedUser}
        vacation={selectedVacation}
        onSave={handleCreateVacation}
      />

      <ConfirmDialog
        isOpen={showDeleteConfirm}
        onClose={closeModals}
        onConfirm={handleDeleteVacation}
        title="Delete Vacation Period"
        message="Are you sure you want to delete this vacation period? This action cannot be undone."
        confirmText="Delete"
        type="danger"
        loading={apiLoading}
      />

      <NotificationSystem
        notifications={notifications}
        onRemove={removeNotification}
      />
    </div>
  );
};
