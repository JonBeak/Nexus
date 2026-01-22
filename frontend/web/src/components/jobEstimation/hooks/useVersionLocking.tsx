/**
 * Phase 1 Cleanup: Nov 14, 2025
 * Updated to use generic lockService (resource_locks table) instead of legacy
 * estimate-specific lock API (job_estimates columns - never used, 0 locks in DB)
 */
import { useState, useCallback } from 'react';
import { lockService } from '../../../services/lockService';
import { EstimateVersion, EditLockStatus } from '../types';
import { User } from '../../../types';
import { useAlert } from '../../../contexts/AlertContext';

interface UseVersionLockingParams {
  user: User;
  onVersionSelect: (estimateId: number) => void;
}

export const useVersionLocking = ({ user, onVersionSelect }: UseVersionLockingParams) => {
  const { showConfirmation } = useAlert();
  const [lockStatuses, setLockStatuses] = useState<Record<number, EditLockStatus>>({});

  const checkEditLockStatus = useCallback(async (estimateId: number) => {
    try {
      // Use generic lock service (resource_locks table - 331 active locks)
      const response = await lockService.checkLock('estimate', estimateId.toString());
      if (response) {
        setLockStatuses(prev => ({
          ...prev,
          [estimateId]: response
        }));
      }
    } catch (err) {
      console.error('Error checking lock status:', err);
    }
  }, []);

  const handleOverrideLock = useCallback(async (estimateId: number) => {
    if (user.role !== 'manager' && user.role !== 'owner') return;

    try {
      // Use generic lock service override
      await lockService.overrideLock('estimate', estimateId.toString());
      await checkEditLockStatus(estimateId);
      // After successfully overriding, open the estimate for editing
      onVersionSelect(estimateId);
    } catch (err) {
      console.error('Error overriding lock:', err);
    }
  }, [user.role, checkEditLockStatus, onVersionSelect]);

  const showLockConflictDialog = useCallback(async (version: EstimateVersion, lockStatus: EditLockStatus) => {
    const canOverride = user.role === 'manager' || user.role === 'owner';
    const message = `${lockStatus.editing_user} is currently editing this estimate.`;

    const firstConfirm = await showConfirmation({
      title: 'Edit Lock Conflict',
      message: message,
      variant: 'warning',
      confirmText: canOverride ? 'Override Lock' : 'View Read-Only',
      cancelText: 'Cancel'
    });

    if (firstConfirm) {
      if (canOverride) {
        const secondConfirm = await showConfirmation({
          title: 'Confirm Override',
          message: 'Are you sure you want to override the edit lock? This may cause conflicts.',
          variant: 'danger',
          confirmText: 'Override',
          cancelText: 'Cancel'
        });
        if (secondConfirm) {
          handleOverrideLock(version.id);
        }
      } else {
        onVersionSelect(version.id);
      }
    }
  }, [user.role, handleOverrideLock, onVersionSelect, showConfirmation]);

  const handleVersionSelect = useCallback((version: EstimateVersion) => {
    if (version.is_draft) {
      const lockStatus = lockStatuses[version.id];
      if (lockStatus && !lockStatus.can_edit && lockStatus.editing_user_id !== user.user_id) {
        // Show lock conflict modal
        showLockConflictDialog(version, lockStatus);
        return;
      }
    }
    onVersionSelect(version.id);
  }, [lockStatuses, user.user_id, showLockConflictDialog, onVersionSelect]);

  const getLockIndicator = useCallback((version: EstimateVersion) => {
    if (!version.is_draft) return null;

    const lockStatus = lockStatuses[version.id];
    if (!lockStatus) return null;

    if (!lockStatus.can_edit && lockStatus.editing_user_id !== user.user_id) {
      return (
        <div className="flex items-center text-orange-600 text-sm">
          <span>Editing: {lockStatus.editing_user}</span>
        </div>
      );
    }

    return null;
  }, [lockStatuses, user.user_id]);

  return {
    lockStatuses,
    checkEditLockStatus,
    handleVersionSelect,
    getLockIndicator
  };
};
