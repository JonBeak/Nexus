/**
 * Edit Lock Service
 * 
 * Extracted from estimateVersioningService.ts during refactoring
 * Handles edit lock management and circular reference validation
 * 
 * Responsibilities:
 * - Edit lock acquisition and release
 * - Lock status checking and cleanup
 * - Circular reference validation for estimate hierarchies
 */

import { pool } from '../config/database';
import { RowDataPacket, ResultSetHeader } from 'mysql2';
import { EditLockStatus, EditLockResult } from '../interfaces/estimateTypes';

export class EditLockService {
  
  // =============================================
  // EDIT LOCK MANAGEMENT
  // =============================================

  async acquireEditLock(estimateId: number, userId: number): Promise<EditLockResult> {
    try {
      // Clean up expired locks first
      await this.cleanupExpiredLocks();

      // Check if estimate is currently locked by someone else
      const currentLock = await this.checkEditLock(estimateId);
      
      if (!currentLock.can_edit && currentLock.editing_user_id !== userId) {
        return {
          success: false,
          lockStatus: currentLock
        };
      }

      // Acquire or extend lock (2-hour timeout based on frontend heartbeat pattern)
      await pool.execute(
        `UPDATE job_estimates 
         SET editing_user_id = ?, 
             editing_started_at = NOW(),
             editing_expires_at = DATE_ADD(NOW(), INTERVAL 2 HOUR),
             editing_locked_by_override = 0
         WHERE id = ?`,
        [userId, estimateId]
      );

      // Return success with current lock status
      const newLockStatus = await this.checkEditLock(estimateId);
      return {
        success: true,
        lockStatus: newLockStatus
      };

    } catch (error) {
      console.error('Error acquiring edit lock:', error);
      throw new Error('Failed to acquire edit lock');
    }
  }

  async releaseEditLock(estimateId: number, userId: number): Promise<void> {
    try {
      // Only allow user to release their own lock
      await pool.execute(
        `UPDATE job_estimates 
         SET editing_user_id = NULL,
             editing_started_at = NULL,
             editing_expires_at = NULL,
             editing_locked_by_override = 0
         WHERE id = ? AND editing_user_id = ?`,
        [estimateId, userId]
      );

    } catch (error) {
      console.error('Error releasing edit lock:', error);
      throw new Error('Failed to release edit lock');
    }
  }

  async checkEditLock(estimateId: number): Promise<EditLockStatus> {
    try {
      const [rows] = await pool.execute<RowDataPacket[]>(
        `SELECT je.editing_user_id, je.editing_started_at, je.editing_expires_at,
                je.editing_locked_by_override, u.username as editing_user
         FROM job_estimates je
         LEFT JOIN users u ON je.editing_user_id = u.user_id  
         WHERE je.id = ?`,
        [estimateId]
      );

      if (rows.length === 0) {
        throw new Error('Estimate not found');
      }

      const row = rows[0];
      const now = new Date();
      const expiresAt = row.editing_expires_at ? new Date(row.editing_expires_at) : null;
      
      // Check if lock is expired
      const isExpired = expiresAt && expiresAt <= now;
      const hasActiveLock = row.editing_user_id && !isExpired;

      return {
        can_edit: !hasActiveLock,
        editing_user: hasActiveLock ? row.editing_user : undefined,
        editing_user_id: hasActiveLock ? row.editing_user_id : undefined,
        editing_started_at: hasActiveLock ? row.editing_started_at : undefined,
        editing_expires_at: hasActiveLock ? row.editing_expires_at : undefined,
        locked_by_override: hasActiveLock ? Boolean(row.editing_locked_by_override) : undefined
      };

    } catch (error) {
      console.error('Error checking edit lock:', error);
      throw new Error('Failed to check edit lock');
    }
  }

  async overrideEditLock(estimateId: number, userId: number): Promise<void> {
    try {
      // Override any existing lock (Manager+ permission checked in controller)
      await pool.execute(
        `UPDATE job_estimates 
         SET editing_user_id = ?,
             editing_started_at = NOW(),
             editing_expires_at = DATE_ADD(NOW(), INTERVAL 2 HOUR),
             editing_locked_by_override = 1
         WHERE id = ?`,
        [userId, estimateId]
      );

    } catch (error) {
      console.error('Error overriding edit lock:', error);
      throw new Error('Failed to override edit lock');
    }
  }

  async cleanupExpiredLocks(): Promise<void> {
    try {
      // Clear all expired locks automatically
      await pool.execute(
        `UPDATE job_estimates 
         SET editing_user_id = NULL,
             editing_started_at = NULL,
             editing_expires_at = NULL,
             editing_locked_by_override = 0
         WHERE editing_expires_at IS NOT NULL 
         AND editing_expires_at < NOW()`
      );

    } catch (error) {
      console.error('Error cleaning up expired locks:', error);
      // Don't throw - this is a maintenance operation
    }
  }

  // =============================================
  // CIRCULAR REFERENCE VALIDATION
  // =============================================

  async validateParentChain(parentEstimateId: number): Promise<boolean> {
    try {
      const visited = new Set<number>();
      let currentId: number | null = parentEstimateId;
      
      // Follow the parent chain to detect cycles
      while (currentId !== null) {
        // If we've seen this ID before, there's a cycle
        if (visited.has(currentId)) {
          console.warn(`Circular reference detected in parent chain starting from estimate ID ${parentEstimateId}`);
          return false;
        }
        
        visited.add(currentId);
        
        // Get the parent of the current estimate
        const [rows]: any = await pool.execute<RowDataPacket[]>(
          'SELECT parent_estimate_id FROM job_estimates WHERE id = ?',
          [currentId]
        );
        
        if (rows.length === 0) {
          // Estimate not found - this shouldn't happen but is not a circular reference
          break;
        }
        
        currentId = rows[0].parent_estimate_id;
        
        // Safety check - prevent infinite loops with depth limit
        if (visited.size > 50) {
          console.warn(`Parent chain validation exceeded depth limit for estimate ID ${parentEstimateId}`);
          return false;
        }
      }
      
      return true; // No cycle detected
    } catch (error) {
      console.error('Error validating parent chain:', error);
      return false; // Fail safe - reject if we can't validate
    }
  }

  async wouldCreateCircularReference(newEstimateId: number, parentEstimateId: number): Promise<boolean> {
    try {
      // Check if setting parentEstimateId as parent of newEstimateId would create a cycle
      // This happens if parentEstimateId has newEstimateId anywhere in its parent chain
      let currentId: number | null = parentEstimateId;
      const visited = new Set<number>();
      
      while (currentId !== null) {
        if (currentId === newEstimateId) {
          return true; // Would create cycle
        }
        
        if (visited.has(currentId)) {
          // Already has a cycle in parent chain - don't make it worse
          return true;
        }
        
        visited.add(currentId);
        
        const [rows]: any = await pool.execute<RowDataPacket[]>(
          'SELECT parent_estimate_id FROM job_estimates WHERE id = ?',
          [currentId]
        );
        
        if (rows.length === 0) break;
        currentId = rows[0].parent_estimate_id;
        
        // Safety depth limit
        if (visited.size > 50) return true;
      }
      
      return false; // No cycle would be created
    } catch (error) {
      console.error('Error checking circular reference:', error);
      return true; // Fail safe - assume it would create a cycle
    }
  }

  // =============================================
  // VALIDATION METHODS
  // =============================================

  async validateEstimateAccess(estimateId: number, jobId?: number): Promise<boolean> {
    try {
      let query = 'SELECT id FROM job_estimates WHERE id = ?';
      let params: any[] = [estimateId];
      
      if (jobId) {
        query += ' AND job_id = ?';
        params.push(jobId);
      }
      
      const [rows] = await pool.execute<RowDataPacket[]>(query, params);
      return rows.length > 0;
    } catch (error) {
      console.error('Error validating estimate access:', error);
      return false;
    }
  }
}