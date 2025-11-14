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
  ): Promise<LockAcquisitionResult> {
    // Check if resource is already locked by someone else
    const existingLock = await this.lockRepository.findActiveLock(resourceType, resourceId);

    if (existingLock && existingLock.editing_user_id !== userId) {
      // Lock exists and is held by someone else
      return {
        success: false,
        lock_status: {
          resource_type: resourceType,
          resource_id: resourceId,
          can_edit: false,
          editing_user: existingLock.editing_user,
          editing_user_id: existingLock.editing_user_id,
          editing_started_at: existingLock.editing_started_at,
          editing_expires_at: existingLock.editing_expires_at,
          locked_by_override: existingLock.locked_by_override || false
        }
      };
    }

    // Acquire or refresh lock (10 minute expiry)
    // Normal acquisition always clears override flag
    await this.lockRepository.acquireOrRefreshLock(resourceType, resourceId, userId, false);

    // Get the actual lock status from database to return correct override flag
    const updatedLock = await this.lockRepository.findActiveLock(resourceType, resourceId);

    return {
      success: true,
      lock_status: {
        resource_type: resourceType,
        resource_id: resourceId,
        can_edit: true,
        editing_user: username,
        editing_user_id: userId,
        editing_started_at: updatedLock?.editing_started_at || new Date().toISOString(),
        editing_expires_at: updatedLock?.editing_expires_at || new Date(Date.now() + 10 * 60 * 1000).toISOString(),
        locked_by_override: updatedLock?.locked_by_override || false
      }
    };
  }

  /**
   * Release a lock on a resource
   * Only releases if the lock is owned by the specified user
   */
  async releaseLock(resourceType: string, resourceId: string, userId: number): Promise<void> {
    await this.lockRepository.releaseLock(resourceType, resourceId, userId);
  }

  /**
   * Check the current lock status of a resource
   * Returns status indicating if current user can edit
   */
  async checkLock(resourceType: string, resourceId: string, currentUserId: number): Promise<LockStatus> {
    const lock = await this.lockRepository.findActiveLock(resourceType, resourceId);

    if (!lock) {
      // No active lock
      return {
        resource_type: resourceType,
        resource_id: resourceId,
        can_edit: true,
        editing_user: null,
        editing_user_id: null,
        editing_started_at: null,
        editing_expires_at: null,
        locked_by_override: false
      };
    }

    // Lock exists - check if current user owns it
    const can_edit = lock.editing_user_id === currentUserId;

    return {
      resource_type: resourceType,
      resource_id: resourceId,
      can_edit,
      editing_user: lock.editing_user,
      editing_user_id: lock.editing_user_id,
      editing_started_at: lock.editing_started_at,
      editing_expires_at: lock.editing_expires_at,
      locked_by_override: lock.locked_by_override || false
    };
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
  ): Promise<LockStatus> {
    // Check permissions - only managers and owners can override
    if (userRole !== 'manager' && userRole !== 'owner') {
      throw new Error('Insufficient permissions to override locks');
    }

    // Force acquire the lock with override flag
    await this.lockRepository.acquireOrRefreshLock(resourceType, resourceId, userId, true);

    return {
      resource_type: resourceType,
      resource_id: resourceId,
      can_edit: true,
      editing_user: username,
      editing_user_id: userId,
      editing_started_at: new Date().toISOString(),
      editing_expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
      locked_by_override: true
    };
  }

  /**
   * Get all locks for a specific resource type (admin function)
   */
  async getResourceLocks(resourceType: string, userRole: string): Promise<LockData[]> {
    // Check permissions - only managers and owners can view all locks
    if (userRole !== 'manager' && userRole !== 'owner') {
      throw new Error('Insufficient permissions');
    }

    return this.lockRepository.getResourceLocks(resourceType);
  }

  /**
   * Get all active locks across all resources (admin function)
   */
  async getAllActiveLocks(userRole: string): Promise<LockData[]> {
    // Check permissions - only owners can view all locks across all resources
    if (userRole !== 'owner') {
      throw new Error('Insufficient permissions');
    }

    return this.lockRepository.getAllActiveLocks();
  }

  /**
   * Clean up expired locks (maintenance function)
   */
  async cleanupExpiredLocks(userRole: string): Promise<number> {
    // Check permissions - only managers and owners can run cleanup
    if (userRole !== 'manager' && userRole !== 'owner') {
      throw new Error('Insufficient permissions');
    }

    return this.lockRepository.cleanupExpiredLocks();
  }
}
