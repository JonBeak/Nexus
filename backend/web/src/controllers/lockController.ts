// FINISHED: Migrated to ServiceResult<T> system - Completed 2025-11-15
// Changes:
// - Added imports: handleServiceResult, sendErrorResponse from controllerHelpers
// - Updated LockService to return ServiceResult<T> for all methods
// - Replaced 14 instances of manual res.status().json() with helper functions
// - Replaced manual validation error responses with sendErrorResponse()
// - All permission errors now use ServiceResult with PERMISSION_DENIED code
// - Zero breaking changes - all endpoints continue to work with same response format

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
import { handleServiceResult, sendErrorResponse } from '../utils/controllerHelpers';

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
      return sendErrorResponse(res, 'Resource type and ID are required', 'VALIDATION_ERROR');
    }

    const result = await lockService.acquireLock(
      resource_type,
      resource_id,
      reqUser.user_id,
      reqUser.username
    );

    if (!result.success) {
      return sendErrorResponse(res, result.error || 'Failed to acquire lock', result.code);
    }

    // Special handling for lock acquisition - return the inner result
    if (result.data.success) {
      res.json({
        success: true,
        lock_status: result.data.lock_status
      });
    } else {
      res.json({
        success: false,
        lock_status: result.data.lock_status
      });
    }
  } catch (error) {
    console.error('Controller error acquiring lock:', error);
    sendErrorResponse(res, 'Failed to acquire lock', 'INTERNAL_ERROR');
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
      return sendErrorResponse(res, 'Resource type and ID are required', 'VALIDATION_ERROR');
    }

    const result = await lockService.releaseLock(resource_type, resource_id, reqUser.user_id);

    if (!result.success) {
      return sendErrorResponse(res, result.error || 'Failed to release lock', result.code);
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Controller error releasing lock:', error);
    sendErrorResponse(res, 'Failed to release lock', 'INTERNAL_ERROR');
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
      return sendErrorResponse(res, 'Resource type and ID are required', 'VALIDATION_ERROR');
    }

    const result = await lockService.checkLock(
      resource_type,
      resource_id,
      reqUser.user_id
    );

    return handleServiceResult(res, result);
  } catch (error) {
    console.error('Controller error checking lock status:', error);
    sendErrorResponse(res, 'Failed to check lock status', 'INTERNAL_ERROR');
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
      return sendErrorResponse(res, 'Resource type and ID are required', 'VALIDATION_ERROR');
    }

    const result = await lockService.overrideLock(
      resource_type,
      resource_id,
      reqUser.user_id,
      reqUser.username,
      reqUser.role
    );

    if (!result.success) {
      return sendErrorResponse(res, result.error || 'Failed to override lock', result.code);
    }

    res.json({
      success: true,
      lock_status: result.data
    });
  } catch (error) {
    console.error('Controller error overriding lock:', error);
    sendErrorResponse(res, 'Failed to override lock', 'INTERNAL_ERROR');
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

    const result = await lockService.getResourceLocks(resource_type, reqUser.role);

    return handleServiceResult(res, result);
  } catch (error) {
    console.error('Controller error getting resource locks:', error);
    sendErrorResponse(res, 'Failed to get resource locks', 'INTERNAL_ERROR');
  }
};

/**
 * Get all active locks (admin function)
 * @route GET /api/locks/active
 */
export const getAllActiveLocks = async (req: Request, res: Response) => {
  try {
    const reqUser = (req as AuthenticatedRequest).user;

    const result = await lockService.getAllActiveLocks(reqUser.role);

    return handleServiceResult(res, result);
  } catch (error) {
    console.error('Controller error getting all active locks:', error);
    sendErrorResponse(res, 'Failed to get active locks', 'INTERNAL_ERROR');
  }
};

/**
 * Clean up expired locks (maintenance function)
 * @route POST /api/locks/cleanup
 */
export const cleanupExpiredLocks = async (req: Request, res: Response) => {
  try {
    const reqUser = (req as AuthenticatedRequest).user;

    const result = await lockService.cleanupExpiredLocks(reqUser.role);

    if (!result.success) {
      return sendErrorResponse(res, result.error || 'Failed to cleanup expired locks', result.code);
    }

    res.json({
      cleaned: result.data,
      message: `Cleaned up ${result.data} expired locks`
    });
  } catch (error) {
    console.error('Controller error cleaning up expired locks:', error);
    sendErrorResponse(res, 'Failed to cleanup expired locks', 'INTERNAL_ERROR');
  }
};
