// File Clean up Finished: Nov 14, 2025 (Phase 2)
// Created as part of lock system 3-layer architecture refactoring
/**
 * Lock Service
 *
 * Handles business logic for resource locking system
 * Part of Phase 2 cleanup - proper 3-layer architecture
 *
 * Responsibilities:
 * - Lock acquisition conflict resolution
 * - Permission checking for admin operations
 * - Lock status determination
 *
 * Architecture: Controller → Service → Repository → Database
 */

import { LockRepository, LockData } from '../repositories/lockRepository';
import { ServiceResult } from '../types/serviceResults';

export interface LockStatus {
  resource_type: string;
  resource_id: string;
  can_edit: boolean;
  editing_user: string | null;
  editing_user_id: number | null;
  editing_started_at: string | null;
  editing_expires_at: string | null;
  locked_by_override: boolean;
}

export interface LockAcquisitionResult {
  success: boolean;
  lock_status: LockStatus;
}

export class LockService {
  private lockRepository: LockRepository;

  constructor() {
    this.lockRepository = new LockRepository();
  }

  /**
   * Attempt to acquire a lock on a resource
   * Returns success=false if resource is locked by someone else
   */
  async acquireLock(
    resourceType: string,
    resourceId: string,
    userId: number,
    username: string
  ): Promise<ServiceResult<LockAcquisitionResult>> {
    try {
      // Check if resource is already locked by someone else
      const existingLock = await this.lockRepository.findActiveLock(resourceType, resourceId);

      if (existingLock && existingLock.editing_user_id !== userId) {
        // Lock exists and is held by someone else
        const lockStatus: LockStatus = {
          resource_type: resourceType,
          resource_id: resourceId,
          can_edit: false,
          editing_user: existingLock.editing_user,
          editing_user_id: existingLock.editing_user_id,
          editing_started_at: existingLock.editing_started_at,
          editing_expires_at: existingLock.editing_expires_at,
          locked_by_override: existingLock.locked_by_override || false
        };

        return {
          success: true,
          data: {
            success: false,
            lock_status: lockStatus
          }
        };
      }

      // Acquire or refresh lock (10 minute expiry)
      // Normal acquisition always clears override flag
      await this.lockRepository.acquireOrRefreshLock(resourceType, resourceId, userId, false);

      // Get the actual lock status from database to return correct override flag
      const updatedLock = await this.lockRepository.findActiveLock(resourceType, resourceId);

      const lockStatus: LockStatus = {
        resource_type: resourceType,
        resource_id: resourceId,
        can_edit: true,
        editing_user: username,
        editing_user_id: userId,
        editing_started_at: updatedLock?.editing_started_at || new Date().toISOString(),
        editing_expires_at: updatedLock?.editing_expires_at || new Date(Date.now() + 10 * 60 * 1000).toISOString(),
        locked_by_override: updatedLock?.locked_by_override || false
      };

      return {
        success: true,
        data: {
          success: true,
          lock_status: lockStatus
        }
      };
    } catch (error) {
      console.error('Service error acquiring lock:', error);
      return {
        success: false,
        error: 'Failed to acquire lock',
        code: 'INTERNAL_ERROR'
      };
    }
  }

  /**
   * Release a lock on a resource
   * Only releases if the lock is owned by the specified user
   */
  async releaseLock(resourceType: string, resourceId: string, userId: number): Promise<ServiceResult<void>> {
    try {
      await this.lockRepository.releaseLock(resourceType, resourceId, userId);
      return { success: true, data: undefined };
    } catch (error) {
      console.error('Service error releasing lock:', error);
      return {
        success: false,
        error: 'Failed to release lock',
        code: 'INTERNAL_ERROR'
      };
    }
  }

  /**
   * Check the current lock status of a resource
   * Returns status indicating if current user can edit
   */
  async checkLock(resourceType: string, resourceId: string, currentUserId: number): Promise<ServiceResult<LockStatus>> {
    try {
      const lock = await this.lockRepository.findActiveLock(resourceType, resourceId);

      if (!lock) {
        // No active lock
        return {
          success: true,
          data: {
            resource_type: resourceType,
            resource_id: resourceId,
            can_edit: true,
            editing_user: null,
            editing_user_id: null,
            editing_started_at: null,
            editing_expires_at: null,
            locked_by_override: false
          }
        };
      }

      // Lock exists - check if current user owns it
      const can_edit = lock.editing_user_id === currentUserId;

      return {
        success: true,
        data: {
          resource_type: resourceType,
          resource_id: resourceId,
          can_edit,
          editing_user: lock.editing_user,
          editing_user_id: lock.editing_user_id,
          editing_started_at: lock.editing_started_at,
          editing_expires_at: lock.editing_expires_at,
          locked_by_override: lock.locked_by_override || false
        }
      };
    } catch (error) {
      console.error('Service error checking lock:', error);
      return {
        success: false,
        error: 'Failed to check lock status',
        code: 'INTERNAL_ERROR'
      };
    }
  }

  /**
   * Override an existing lock (requires manager+ permissions)
   * Force acquires the lock with override flag set
   */
  async overrideLock(
    resourceType: string,
    resourceId: string,
    userId: number,
    username: string,
    userRole: string
  ): Promise<ServiceResult<LockStatus>> {
    try {
      // Check permissions - only managers and owners can override
      if (userRole !== 'manager' && userRole !== 'owner') {
        return {
          success: false,
          error: 'Insufficient permissions to override locks',
          code: 'PERMISSION_DENIED'
        };
      }

      // Force acquire the lock with override flag
      await this.lockRepository.acquireOrRefreshLock(resourceType, resourceId, userId, true);

      return {
        success: true,
        data: {
          resource_type: resourceType,
          resource_id: resourceId,
          can_edit: true,
          editing_user: username,
          editing_user_id: userId,
          editing_started_at: new Date().toISOString(),
          editing_expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
          locked_by_override: true
        }
      };
    } catch (error) {
      console.error('Service error overriding lock:', error);
      return {
        success: false,
        error: 'Failed to override lock',
        code: 'INTERNAL_ERROR'
      };
    }
  }

  /**
   * Get all locks for a specific resource type (admin function)
   */
  async getResourceLocks(resourceType: string, userRole: string): Promise<ServiceResult<LockData[]>> {
    try {
      // Check permissions - only managers and owners can view all locks
      if (userRole !== 'manager' && userRole !== 'owner') {
        return {
          success: false,
          error: 'Insufficient permissions',
          code: 'PERMISSION_DENIED'
        };
      }

      const locks = await this.lockRepository.getResourceLocks(resourceType);
      return { success: true, data: locks };
    } catch (error) {
      console.error('Service error getting resource locks:', error);
      return {
        success: false,
        error: 'Failed to get resource locks',
        code: 'INTERNAL_ERROR'
      };
    }
  }

  /**
   * Get all active locks across all resources (admin function)
   */
  async getAllActiveLocks(userRole: string): Promise<ServiceResult<LockData[]>> {
    try {
      // Check permissions - only owners can view all locks across all resources
      if (userRole !== 'owner') {
        return {
          success: false,
          error: 'Insufficient permissions',
          code: 'PERMISSION_DENIED'
        };
      }

      const locks = await this.lockRepository.getAllActiveLocks();
      return { success: true, data: locks };
    } catch (error) {
      console.error('Service error getting all active locks:', error);
      return {
        success: false,
        error: 'Failed to get active locks',
        code: 'INTERNAL_ERROR'
      };
    }
  }

  /**
   * Clean up expired locks (maintenance function)
   */
  async cleanupExpiredLocks(userRole: string): Promise<ServiceResult<number>> {
    try {
      // Check permissions - only managers and owners can run cleanup
      if (userRole !== 'manager' && userRole !== 'owner') {
        return {
          success: false,
          error: 'Insufficient permissions',
          code: 'PERMISSION_DENIED'
        };
      }

      const cleaned = await this.lockRepository.cleanupExpiredLocks();
      return { success: true, data: cleaned };
    } catch (error) {
      console.error('Service error cleaning up expired locks:', error);
      return {
        success: false,
        error: 'Failed to cleanup expired locks',
        code: 'INTERNAL_ERROR'
      };
    }
  }
}
