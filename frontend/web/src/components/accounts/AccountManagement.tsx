import React from 'react';
import { Users, Shield, Activity, Calendar, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { UserModal } from './modals/UserModal';
import { PasswordModal } from './modals/PasswordModal';
import { VacationModal } from './modals/VacationModal';
import { ConfirmDialog } from './components/ConfirmDialog';
import { NotificationSystem, useNotifications } from './components/NotificationSystem';
import { useAccountManagement } from './hooks/useAccountManagement';
import { UsersTab } from './components/tabs/UsersTab';
import { LoginLogsTab } from './components/tabs/LoginLogsTab';
import { VacationTab } from './components/tabs/VacationTab';

interface AccountManagementProps {
  user: any;
}

export const AccountManagement: React.FC<AccountManagementProps> = ({ user }) => {
  const navigate = useNavigate();
  const { notifications, removeNotification } = useNotifications();
  
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
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-red-600">Access Denied</h1>
          <p className="text-gray-600 mt-2">Only managers and owners can access account management.</p>
        </div>
      </div>
    );
  }


  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <div className="bg-white shadow-lg border-b-4 border-indigo-500">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => navigate('/dashboard')}
                className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-md"
                title="Return to Dashboard"
              >
                <ArrowLeft className="h-6 w-6" />
              </button>
              <div className="w-12 h-12 bg-indigo-600 rounded-xl flex items-center justify-center">
                <Shield className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-gray-800">Account Management</h1>
                <p className="text-gray-600">Manage user accounts, roles, and settings</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Tabs */}
        <div className="mb-8">
          <nav className="flex space-x-8">
            {[
              { id: 'users', label: 'User Accounts', icon: Users },
              { id: 'logs', label: 'Login Logs', icon: Activity },
              { id: 'vacations', label: 'Vacation Periods', icon: Calendar }
            ].map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setActiveTab(id as any)}
                className={`flex items-center space-x-2 px-4 py-2 border-b-2 font-medium transition-colors ${
                  activeTab === id
                    ? 'border-indigo-500 text-indigo-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                <Icon className="h-5 w-5" />
                <span>{label}</span>
              </button>
            ))}
          </nav>
        </div>

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