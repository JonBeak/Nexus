// File Clean up Finished: Nov 14, 2025 (Phase 2)
// Refactored to proper 3-layer architecture
/**
 * Lock Controller
 *
 * HTTP request handling for resource locking system
 * Part of Phase 2 cleanup - proper 3-layer architecture
 *
 * Changes from Phase 2 refactoring:
 * - Removed all database queries (moved to LockRepository)
 * - Removed business logic (moved to LockService)
 * - Migrated from pool.execute() to query() helper (via repository)
 * - Controller now only handles HTTP concerns
 *
 * Architecture: Route → Controller → Service → Repository → Database
 */

import { Request, Response } from 'express';
import { AuthenticatedRequest } from '../types';
import { LockService } from '../services/lockService';

const lockService = new LockService();

/**
 * Acquire a lock on a resource
 * @route POST /api/locks/acquire
 */
export const acquireLock = async (req: Request, res: Response) => {
  try {
    const reqUser = (req as AuthenticatedRequest).user;
    const { resource_type, resource_id } = req.body;

    if (!resource_type || !resource_id) {
      return res.status(400).json({
        success: false,
        message: 'Resource type and ID are required'
      });
    }

    const result = await lockService.acquireLock(
      resource_type,
      resource_id,
      reqUser.user_id,
      reqUser.username
    );

    if (result.success) {
      res.json({
        success: true,
        lock_status: result.lock_status
      });
    } else {
      res.json({
        success: false,
        lock_status: result.lock_status
      });
    }
  } catch (error) {
    console.error('Controller error acquiring lock:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to acquire lock'
    });
  }
};

/**
 * Release a lock on a resource
 * @route POST /api/locks/release
 */
export const releaseLock = async (req: Request, res: Response) => {
  try {
    const reqUser = (req as AuthenticatedRequest).user;
    const { resource_type, resource_id } = req.body;

    if (!resource_type || !resource_id) {
      return res.status(400).json({
        success: false,
        message: 'Resource type and ID are required'
      });
    }

    await lockService.releaseLock(resource_type, resource_id, reqUser.user_id);

    res.json({ success: true });
  } catch (error) {
    console.error('Controller error releasing lock:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to release lock'
    });
  }
};

/**
 * Check lock status of a resource
 * @route GET /api/locks/check/:resource_type/:resource_id
 */
export const checkLock = async (req: Request, res: Response) => {
  try {
    const reqUser = (req as AuthenticatedRequest).user;
    const { resource_type, resource_id } = req.params;

    if (!resource_type || !resource_id) {
      return res.status(400).json({
        message: 'Resource type and ID are required'
      });
    }

    const lockStatus = await lockService.checkLock(
      resource_type,
      resource_id,
      reqUser.user_id
    );

    res.json(lockStatus);
  } catch (error) {
    console.error('Controller error checking lock status:', error);
    res.status(500).json({
      message: 'Failed to check lock status'
    });
  }
};

/**
 * Override an existing lock (requires manager+ permissions)
 * @route POST /api/locks/override
 */
export const overrideLock = async (req: Request, res: Response) => {
  try {
    const reqUser = (req as AuthenticatedRequest).user;
    const { resource_type, resource_id } = req.body;

    if (!resource_type || !resource_id) {
      return res.status(400).json({
        success: false,
        message: 'Resource type and ID are required'
      });
    }

    const lockStatus = await lockService.overrideLock(
      resource_type,
      resource_id,
      reqUser.user_id,
      reqUser.username,
      reqUser.role
    );

    res.json({
      success: true,
      lock_status: lockStatus
    });
  } catch (error) {
    console.error('Controller error overriding lock:', error);

    // Check for permission error
    if (error instanceof Error && error.message.includes('Insufficient permissions')) {
      return res.status(403).json({
        success: false,
        message: error.message
      });
    }

    res.status(500).json({
      success: false,
      message: 'Failed to override lock'
    });
  }
};

/**
 * Get all locks for a specific resource type (admin function)
 * @route GET /api/locks/resource/:resource_type
 */
export const getResourceLocks = async (req: Request, res: Response) => {
  try {
    const reqUser = (req as AuthenticatedRequest).user;
    const { resource_type } = req.params;

    const locks = await lockService.getResourceLocks(resource_type, reqUser.role);

    res.json(locks);
  } catch (error) {
    console.error('Controller error getting resource locks:', error);

    // Check for permission error
    if (error instanceof Error && error.message.includes('Insufficient permissions')) {
      return res.status(403).json({
        message: error.message
      });
    }

    res.status(500).json({
      message: 'Failed to get resource locks'
    });
  }
};

/**
 * Get all active locks (admin function)
 * @route GET /api/locks/active
 */
export const getAllActiveLocks = async (req: Request, res: Response) => {
  try {
    const reqUser = (req as AuthenticatedRequest).user;

    const locks = await lockService.getAllActiveLocks(reqUser.role);

    res.json(locks);
  } catch (error) {
    console.error('Controller error getting all active locks:', error);

    // Check for permission error
    if (error instanceof Error && error.message.includes('Insufficient permissions')) {
      return res.status(403).json({
        message: error.message
      });
    }

    res.status(500).json({
      message: 'Failed to get active locks'
    });
  }
};

/**
 * Clean up expired locks (maintenance function)
 * @route POST /api/locks/cleanup
 */
export const cleanupExpiredLocks = async (req: Request, res: Response) => {
  try {
    const reqUser = (req as AuthenticatedRequest).user;

    const cleaned = await lockService.cleanupExpiredLocks(reqUser.role);

    res.json({
      cleaned,
      message: `Cleaned up ${cleaned} expired locks`
    });
  } catch (error) {
    console.error('Controller error cleaning up expired locks:', error);

    // Check for permission error
    if (error instanceof Error && error.message.includes('Insufficient permissions')) {
      return res.status(403).json({
        message: error.message
      });
    }

    res.status(500).json({
      message: 'Failed to cleanup expired locks'
    });
  }
};
