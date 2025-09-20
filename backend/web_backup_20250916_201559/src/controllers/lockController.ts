import { Request, Response } from 'express';
import { AuthRequest } from '../types';
import { pool } from '../config/database';
import { ResultSetHeader, RowDataPacket } from 'mysql2';

interface LockStatus {
  resource_type: string;
  resource_id: string;
  can_edit: boolean;
  editing_user: string | null;
  editing_user_id: number | null;
  editing_started_at: string | null;
  editing_expires_at: string | null;
  locked_by_override: boolean;
}

/**
 * Acquire a lock on a resource
 */
export const acquireLock = async (req: AuthRequest, res: Response) => {
  try {
    const { resource_type, resource_id } = req.body;
    const user_id = req.user.user_id;
    const username = req.user.username;

    if (!resource_type || !resource_id) {
      return res.status(400).json({
        success: false,
        message: 'Resource type and ID are required'
      });
    }

    // Check if resource is already locked by someone else
    const [existing] = await pool.execute<RowDataPacket[]>(
      `SELECT rl.*, u.username as editing_user
       FROM resource_locks rl
       JOIN users u ON rl.editing_user_id = u.user_id
       WHERE rl.resource_type = ? AND rl.resource_id = ? 
       AND rl.editing_expires_at > NOW()`,
      [resource_type, resource_id]
    );

    if (existing.length > 0 && existing[0].editing_user_id !== user_id) {
      // Lock exists and is held by someone else
      return res.json({
        success: false,
        lock_status: {
          resource_type,
          resource_id,
          can_edit: false,
          editing_user: existing[0].editing_user,
          editing_user_id: existing[0].editing_user_id,
          editing_started_at: existing[0].editing_started_at,
          editing_expires_at: existing[0].editing_expires_at,
          locked_by_override: existing[0].locked_by_override || false
        }
      });
    }

    // Acquire or refresh lock (10 minute expiry)
    // Normal acquisition always clears override flag - only explicit override should set it
    await pool.execute(
      `INSERT INTO resource_locks
       (resource_type, resource_id, editing_user_id, editing_started_at, editing_expires_at, locked_by_override)
       VALUES (?, ?, ?, NOW(), DATE_ADD(NOW(), INTERVAL 10 MINUTE), FALSE)
       ON DUPLICATE KEY UPDATE
       editing_expires_at = DATE_ADD(NOW(), INTERVAL 10 MINUTE),
       locked_by_override = FALSE`,
      [resource_type, resource_id, user_id]
    );

    // Get the actual lock status from database to return correct override flag
    const [updated] = await pool.execute<RowDataPacket[]>(
      `SELECT rl.*, u.username as editing_user
       FROM resource_locks rl
       JOIN users u ON rl.editing_user_id = u.user_id
       WHERE rl.resource_type = ? AND rl.resource_id = ?
       AND rl.editing_expires_at > NOW()`,
      [resource_type, resource_id]
    );

    const lockData = updated[0];

    res.json({
      success: true,
      lock_status: {
        resource_type,
        resource_id,
        can_edit: true,
        editing_user: username,
        editing_user_id: user_id,
        editing_started_at: lockData.editing_started_at,
        editing_expires_at: lockData.editing_expires_at,
        locked_by_override: lockData.locked_by_override || false
      }
    });
  } catch (error) {
    console.error('Error acquiring lock:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to acquire lock'
    });
  }
};

/**
 * Release a lock on a resource
 */
export const releaseLock = async (req: AuthRequest, res: Response) => {
  try {
    const { resource_type, resource_id } = req.body;
    const user_id = req.user.user_id;

    if (!resource_type || !resource_id) {
      return res.status(400).json({
        success: false,
        message: 'Resource type and ID are required'
      });
    }

    // Only allow users to release their own locks
    await pool.execute(
      `DELETE FROM resource_locks 
       WHERE resource_type = ? AND resource_id = ? AND editing_user_id = ?`,
      [resource_type, resource_id, user_id]
    );

    res.json({ success: true });
  } catch (error) {
    console.error('Error releasing lock:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to release lock'
    });
  }
};

/**
 * Check lock status of a resource
 */
export const checkLock = async (req: AuthRequest, res: Response) => {
  try {
    const { resource_type, resource_id } = req.params;
    const current_user_id = req.user.user_id;

    if (!resource_type || !resource_id) {
      return res.status(400).json({
        message: 'Resource type and ID are required'
      });
    }

    // Get current lock status
    const [locks] = await pool.execute<RowDataPacket[]>(
      `SELECT rl.*, u.username as editing_user
       FROM resource_locks rl
       JOIN users u ON rl.editing_user_id = u.user_id
       WHERE rl.resource_type = ? AND rl.resource_id = ?
       AND rl.editing_expires_at > NOW()`,
      [resource_type, resource_id]
    );

    if (locks.length === 0) {
      // No active lock
      return res.json({
        resource_type,
        resource_id,
        can_edit: true,
        editing_user: null,
        editing_user_id: null,
        editing_started_at: null,
        editing_expires_at: null,
        locked_by_override: false
      });
    }

    const lock = locks[0];
    const can_edit = lock.editing_user_id === current_user_id;

    res.json({
      resource_type,
      resource_id,
      can_edit,
      editing_user: lock.editing_user,
      editing_user_id: lock.editing_user_id,
      editing_started_at: lock.editing_started_at,
      editing_expires_at: lock.editing_expires_at,
      locked_by_override: lock.locked_by_override || false
    });
  } catch (error) {
    console.error('Error checking lock status:', error);
    res.status(500).json({
      message: 'Failed to check lock status'
    });
  }
};

/**
 * Override an existing lock (requires manager+ permissions)
 */
export const overrideLock = async (req: AuthRequest, res: Response) => {
  try {
    const { resource_type, resource_id } = req.body;
    const user_id = req.user.user_id;
    const username = req.user.username;
    const user_role = req.user.role;

    if (!resource_type || !resource_id) {
      return res.status(400).json({
        success: false,
        message: 'Resource type and ID are required'
      });
    }

    // Check permissions - only managers and owners can override
    if (user_role !== 'manager' && user_role !== 'owner') {
      return res.status(403).json({
        success: false,
        message: 'Insufficient permissions to override locks'
      });
    }

    // Force acquire the lock with override flag
    await pool.execute(
      `INSERT INTO resource_locks 
       (resource_type, resource_id, editing_user_id, editing_started_at, editing_expires_at, locked_by_override)
       VALUES (?, ?, ?, NOW(), DATE_ADD(NOW(), INTERVAL 10 MINUTE), TRUE)
       ON DUPLICATE KEY UPDATE
       editing_user_id = VALUES(editing_user_id),
       editing_started_at = NOW(),
       editing_expires_at = DATE_ADD(NOW(), INTERVAL 10 MINUTE),
       locked_by_override = TRUE`,
      [resource_type, resource_id, user_id]
    );

    res.json({ 
      success: true,
      lock_status: {
        resource_type,
        resource_id,
        can_edit: true,
        editing_user: username,
        editing_user_id: user_id,
        editing_started_at: new Date().toISOString(),
        editing_expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
        locked_by_override: true
      }
    });
  } catch (error) {
    console.error('Error overriding lock:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to override lock'
    });
  }
};

/**
 * Get all locks for a specific resource type (admin function)
 */
export const getResourceLocks = async (req: AuthRequest, res: Response) => {
  try {
    const { resource_type } = req.params;
    const user_role = req.user.role;

    // Only managers and owners can view all locks
    if (user_role !== 'manager' && user_role !== 'owner') {
      return res.status(403).json({
        message: 'Insufficient permissions'
      });
    }

    const [locks] = await pool.execute<RowDataPacket[]>(
      `SELECT rl.*, u.username as editing_user
       FROM resource_locks rl
       JOIN users u ON rl.editing_user_id = u.user_id
       WHERE rl.resource_type = ? AND rl.editing_expires_at > NOW()
       ORDER BY rl.editing_started_at DESC`,
      [resource_type]
    );

    res.json(locks);
  } catch (error) {
    console.error('Error getting resource locks:', error);
    res.status(500).json({
      message: 'Failed to get resource locks'
    });
  }
};

/**
 * Get all active locks (admin function)
 */
export const getAllActiveLocks = async (req: AuthRequest, res: Response) => {
  try {
    const user_role = req.user.role;

    // Only owners can view all locks across all resources
    if (user_role !== 'owner') {
      return res.status(403).json({
        message: 'Insufficient permissions'
      });
    }

    const [locks] = await pool.execute<RowDataPacket[]>(
      `SELECT rl.*, u.username as editing_user
       FROM resource_locks rl
       JOIN users u ON rl.editing_user_id = u.user_id
       WHERE rl.editing_expires_at > NOW()
       ORDER BY rl.resource_type, rl.editing_started_at DESC`
    );

    res.json(locks);
  } catch (error) {
    console.error('Error getting all active locks:', error);
    res.status(500).json({
      message: 'Failed to get active locks'
    });
  }
};

/**
 * Clean up expired locks (maintenance function)
 */
export const cleanupExpiredLocks = async (req: AuthRequest, res: Response) => {
  try {
    const user_role = req.user.role;

    // Only managers and owners can run cleanup
    if (user_role !== 'manager' && user_role !== 'owner') {
      return res.status(403).json({
        message: 'Insufficient permissions'
      });
    }

    const [result] = await pool.execute<ResultSetHeader>(
      `DELETE FROM resource_locks WHERE editing_expires_at <= NOW()`
    );

    res.json({ 
      cleaned: result.affectedRows,
      message: `Cleaned up ${result.affectedRows} expired locks`
    });
  } catch (error) {
    console.error('Error cleaning up expired locks:', error);
    res.status(500).json({
      message: 'Failed to cleanup expired locks'
    });
  }
};