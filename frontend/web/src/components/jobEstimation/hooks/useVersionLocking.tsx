import { useState, useCallback } from 'react';
import { jobVersioningApi } from '../../../services/api';
import { EstimateVersion, EditLockStatus } from '../types';
import { User } from '../../../types';

interface UseVersionLockingParams {
  user: User;
  onVersionSelect: (estimateId: number) => void;
}

export const useVersionLocking = ({ user, onVersionSelect }: UseVersionLockingParams) => {
  const [lockStatuses, setLockStatuses] = useState<Record<number, EditLockStatus>>({});

  const checkEditLockStatus = useCallback(async (estimateId: number) => {
    try {
      const response = await jobVersioningApi.checkEditLock(estimateId);
      setLockStatuses(prev => ({
        ...prev,
        [estimateId]: response
      }));
    } catch (err) {
      console.error('Error checking lock status:', err);
    }
  }, []);

  const handleOverrideLock = useCallback(async (estimateId: number) => {
    if (user.role !== 'manager' && user.role !== 'owner') return;

    try {
      await jobVersioningApi.overrideEditLock(estimateId);
      await checkEditLockStatus(estimateId);
    } catch (err) {
      console.error('Error overriding lock:', err);
    }
  }, [user.role, checkEditLockStatus]);

  const showLockConflictDialog = useCallback((version: EstimateVersion, lockStatus: EditLockStatus) => {
    const canOverride = user.role === 'manager' || user.role === 'owner';
    const message = `${lockStatus.editing_user} is currently editing this estimate.`;

    if (window.confirm(`${message}\n\n${canOverride ? 'Override lock and edit anyway?' : 'View in read-only mode?'}`)) {
      if (canOverride && window.confirm('Are you sure you want to override the edit lock? This may cause conflicts.')) {
        handleOverrideLock(version.id);
      } else {
        onVersionSelect(version.id);
      }
    }
  }, [user.role, handleOverrideLock, onVersionSelect]);

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
