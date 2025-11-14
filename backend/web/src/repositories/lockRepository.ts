// File Clean up Finished: Nov 14, 2025 (Phase 2)
// Created as part of lock system 3-layer architecture refactoring
/**
 * Lock Repository
 *
 * Handles all database operations for the resource_locks table
 * Part of Phase 2 cleanup - proper 3-layer architecture
 *
 * Architecture: Controller → Service → Repository → Database
 */

import { query } from '../config/database';
import { RowDataPacket, ResultSetHeader } from 'mysql2';

export interface LockData {
  resource_type: string;
  resource_id: string;
  editing_user_id: number;
  editing_user: string;
  editing_started_at: string;
  editing_expires_at: string;
  locked_by_override: boolean;
}

export class LockRepository {

  /**
   * Find active lock for a resource (with user information)
   * Returns null if no active lock exists
   */
  async findActiveLock(resourceType: string, resourceId: string): Promise<LockData | null> {
    const rows = await query(
      `SELECT rl.*, u.username as editing_user
       FROM resource_locks rl
       JOIN users u ON rl.editing_user_id = u.user_id
       WHERE rl.resource_type = ? AND rl.resource_id = ?
       AND rl.editing_expires_at > NOW()`,
      [resourceType, resourceId]
    ) as RowDataPacket[];

    return rows.length > 0 ? rows[0] as LockData : null;
  }

  /**
   * Acquire or refresh a lock
   * Uses INSERT ... ON DUPLICATE KEY UPDATE for atomic operation
   *
   * @param override - If true, sets locked_by_override flag
   */
  async acquireOrRefreshLock(
    resourceType: string,
    resourceId: string,
    userId: number,
    override: boolean = false
  ): Promise<void> {
    await query(
      `INSERT INTO resource_locks
       (resource_type, resource_id, editing_user_id, editing_started_at, editing_expires_at, locked_by_override)
       VALUES (?, ?, ?, NOW(), DATE_ADD(NOW(), INTERVAL 10 MINUTE), ?)
       ON DUPLICATE KEY UPDATE
       editing_user_id = VALUES(editing_user_id),
       editing_started_at = NOW(),
       editing_expires_at = DATE_ADD(NOW(), INTERVAL 10 MINUTE),
       locked_by_override = VALUES(locked_by_override)`,
      [resourceType, resourceId, userId, override]
    );
  }

  /**
   * Release a lock owned by specific user
   * Only deletes if the lock is owned by the specified user
   */
  async releaseLock(resourceType: string, resourceId: string, userId: number): Promise<void> {
    await query(
      `DELETE FROM resource_locks
       WHERE resource_type = ? AND resource_id = ? AND editing_user_id = ?`,
      [resourceType, resourceId, userId]
    );
  }

  /**
   * Get all active locks for a specific resource type
   * Ordered by most recent first
   */
  async getResourceLocks(resourceType: string): Promise<LockData[]> {
    const rows = await query(
      `SELECT rl.*, u.username as editing_user
       FROM resource_locks rl
       JOIN users u ON rl.editing_user_id = u.user_id
       WHERE rl.resource_type = ? AND rl.editing_expires_at > NOW()
       ORDER BY rl.editing_started_at DESC`,
      [resourceType]
    ) as RowDataPacket[];

    return rows as LockData[];
  }

  /**
   * Get all active locks across all resource types
   * Ordered by resource type, then most recent first
   */
  async getAllActiveLocks(): Promise<LockData[]> {
    const rows = await query(
      `SELECT rl.*, u.username as editing_user
       FROM resource_locks rl
       JOIN users u ON rl.editing_user_id = u.user_id
       WHERE rl.editing_expires_at > NOW()
       ORDER BY rl.resource_type, rl.editing_started_at DESC`
    ) as RowDataPacket[];

    return rows as LockData[];
  }

  /**
   * Delete all expired locks
   * Returns the number of locks cleaned up
   */
  async cleanupExpiredLocks(): Promise<number> {
    const result = await query(
      `DELETE FROM resource_locks WHERE editing_expires_at <= NOW()`
    ) as ResultSetHeader;

    return result.affectedRows;
  }
}
