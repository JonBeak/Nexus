import { useState, useEffect, useCallback } from 'react';
import { useAccountAPI, LoginLog, VacationPeriod } from './useAccountAPI';
import { useNotifications } from './useNotifications';
import type { AccountUser } from '../../../types/user';

export const useAccountManagement = () => {
  type AccountTab = 'users' | 'logs' | 'vacations';

  const [users, setUsers] = useState<AccountUser[]>([]);
  const [selectedUser, setSelectedUser] = useState<AccountUser | null>(null);
  const [activeTab, setActiveTab] = useState<AccountTab>('users');
  const [showUserModal, setShowUserModal] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [showVacationModal, setShowVacationModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{type: 'vacation', id: number} | null>(null);
  const [loginLogs, setLoginLogs] = useState<LoginLog[]>([]);
  const [vacationPeriods, setVacationPeriods] = useState<VacationPeriod[]>([]);
  const [selectedVacation, setSelectedVacation] = useState<VacationPeriod | null>(null);

  const {
    apiLoading,
    fetchUsers,
    fetchLoginLogs,
    fetchVacationPeriods,
    createUser,
    updateUser,
    changePassword,
    createVacation,
    deleteVacation
  } = useAccountAPI();

  const { showSuccess, showError } = useNotifications();

  // Load users on component mount
  const loadUsers = useCallback(async () => {
    try {
      const userData = await fetchUsers();
      setUsers(userData);
    } catch (error) {
      console.error('Failed to load users', error);
      showError('Error', 'Failed to load users');
    }
  }, [fetchUsers, showError]);

  const loadLoginLogs = useCallback(async (userId?: number) => {
    try {
      const logs = await fetchLoginLogs(userId);
      setLoginLogs(logs);
    } catch (error) {
      console.error('Failed to load login logs', error);
      showError('Error', 'Failed to load login logs');
    }
  }, [fetchLoginLogs, showError]);

  const loadVacationPeriods = useCallback(async (userId?: number) => {
    try {
      const vacations = await fetchVacationPeriods(userId);
      setVacationPeriods(vacations);
    } catch (error) {
      console.error('Failed to load vacation periods', error);
      showError('Error', 'Failed to load vacation periods');
    }
  }, [fetchVacationPeriods, showError]);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  // Load data based on active tab
  useEffect(() => {
    if (activeTab === 'logs') {
      loadLoginLogs();
    } else if (activeTab === 'vacations') {
      loadVacationPeriods();
    }
  }, [activeTab, loadLoginLogs, loadVacationPeriods]);

  const handleCreateUser = async (userData: AccountUser) => {
    try {
      await createUser(userData);
      showSuccess('User Created', `${userData.first_name} ${userData.last_name} has been created successfully.`);
      await loadUsers();
      setShowUserModal(false);
      setSelectedUser(null);
    } catch (error) {
      console.error('User creation failed', error);
      const message = error instanceof Error ? error.message : 'Failed to create user';
      showError('Creation Failed', message);
    }
  };

  const handleUpdateUser = async (userData: AccountUser) => {
    if (!userData.user_id) return;
    
    // Check if this would deactivate the last admin
    const activeAdmins = users.filter(u => u.role === 'manager' && u.is_active);
    const currentUser = users.find(u => u.user_id === userData.user_id);
    const isDeactivatingLastAdmin = currentUser?.role === 'manager' && 
                                    currentUser.is_active && 
                                    !userData.is_active && 
                                    activeAdmins.length === 1;
    
    if (isDeactivatingLastAdmin) {
      showError('Cannot Deactivate', 'Cannot deactivate the last admin account. At least one admin must remain active.');
      return;
    }
    
    try {
      await updateUser(userData);
      showSuccess('User Updated', `${userData.first_name} ${userData.last_name} has been updated successfully.`);
      await loadUsers();
      setShowUserModal(false);
      setSelectedUser(null);
    } catch (error) {
      console.error('User update failed', error);
      const message = error instanceof Error ? error.message : 'Failed to update user';
      showError('Update Failed', message);
    }
  };

  const handleUserSave = async (userData: AccountUser) => {
    if (userData.user_id) {
      await handleUpdateUser(userData);
    } else {
      await handleCreateUser(userData);
    }
  };

  const handlePasswordChange = async (userId: number, newPassword: string) => {
    try {
      await changePassword(userId, newPassword);
      const targetUser = users.find(u => u.user_id === userId);
      showSuccess('Password Changed', `Password updated for ${targetUser?.first_name} ${targetUser?.last_name}`);
      setShowPasswordModal(false);
      setSelectedUser(null);
    } catch (error) {
      console.error('Password change failed', error);
      const message = error instanceof Error ? error.message : 'Failed to change password';
      showError('Password Change Failed', message);
    }
  };

  const handleCreateVacation = async (vacationData: VacationPeriod) => {
    try {
      await createVacation(vacationData);
      const targetUser = users.find(u => u.user_id === vacationData.user_id);
      showSuccess('Vacation Added', `Vacation period created for ${targetUser?.first_name} ${targetUser?.last_name}`);
      await loadVacationPeriods();
      setShowVacationModal(false);
      setSelectedUser(null);
      setSelectedVacation(null);
    } catch (error) {
      console.error('Vacation creation failed', error);
      const message = error instanceof Error ? error.message : 'Failed to create vacation period';
      showError('Creation Failed', message);
    }
  };

  const handleDeleteVacation = async () => {
    if (!deleteTarget || deleteTarget.type !== 'vacation') return;
    
    try {
      await deleteVacation(deleteTarget.id);
      showSuccess('Vacation Deleted', 'Vacation period has been removed successfully.');
      await loadVacationPeriods();
      setShowDeleteConfirm(false);
      setDeleteTarget(null);
    } catch (error) {
      console.error('Vacation deletion failed', error);
      const message = error instanceof Error ? error.message : 'Failed to delete vacation period';
      showError('Deletion Failed', message);
    }
  };

  const openUserModal = (user?: AccountUser) => {
    setSelectedUser(user || null);
    setShowUserModal(true);
  };

  const openPasswordModal = (user: AccountUser) => {
    setSelectedUser(user);
    setShowPasswordModal(true);
  };

  const openVacationModal = (user?: AccountUser, vacation?: VacationPeriod) => {
    setSelectedUser(user || null);
    setSelectedVacation(vacation || null);
    setShowVacationModal(true);
  };

  const openDeleteConfirm = (type: 'vacation', id: number) => {
    setDeleteTarget({ type, id });
    setShowDeleteConfirm(true);
  };

  const viewUserLogs = (user: AccountUser) => {
    setSelectedUser(user);
    setActiveTab('logs');
    loadLoginLogs(user.user_id);
  };

  const closeModals = () => {
    setShowUserModal(false);
    setShowPasswordModal(false);
    setShowVacationModal(false);
    setShowDeleteConfirm(false);
    setSelectedUser(null);
    setSelectedVacation(null);
    setDeleteTarget(null);
  };

  return {
    // State
    users,
    selectedUser,
    activeTab,
    showUserModal,
    showPasswordModal,
    showVacationModal,
    showDeleteConfirm,
    deleteTarget,
    loginLogs,
    vacationPeriods,
    selectedVacation,
    apiLoading,
    
    // Actions
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
    closeModals,
    loadUsers,
    loadLoginLogs,
    loadVacationPeriods
  };
};
