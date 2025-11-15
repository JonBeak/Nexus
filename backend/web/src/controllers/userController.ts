// File Clean up Finished: Nov 15, 2025
// Latest Cleanup Changes (Nov 15, 2025):
//   - Migrated all userService methods to ServiceResult<T> pattern
//   - Updated all controller methods to use handleServiceResult() helper
//   - Removed ~45 lines of manual error handling code
//   - Consistent error codes: VALIDATION_ERROR, PERMISSION_DENIED, USER_NOT_FOUND, etc.
//   - Reduced from 215 → 188 lines (13% reduction)
//
// Previous Cleanup (Nov 14, 2025):
//   - Removed 3 redundant auth checks (middleware guarantees user exists)
//   - Replaced ID validation with parseIntParam() helper
//   - Replaced error handling with sendErrorResponse() helper
//   - Changed Request param to AuthRequest for type safety
//   - Added non-null assertions (req.user!) since auth middleware guarantees user
//   - Reduced from 263 → 180 lines (32% reduction)

/**
 * User Controller
 * HTTP request/response handling for user-related operations
 *
 * Created: Nov 13, 2025
 * Part of cleanup: Consolidating /auth/users and /accounts/users endpoints
 */

import { Response } from 'express';
import { AuthRequest } from '../types';
import { userService, CreateUserData, UpdateUserData } from '../services/userService';
import { parseIntParam, sendErrorResponse, handleServiceResult } from '../utils/controllerHelpers';

export class UserController {
  /**
   * Get all users
   * Query params:
   *   - includeInactive: 'true' | 'false' (default: false)
   *   - fields: 'basic' | 'full' (default: basic)
   */
  async getUsers(req: AuthRequest, res: Response): Promise<void> {
    try {
      // Parse query parameters
      const includeInactive = req.query.includeInactive === 'true';
      const fieldsType = (req.query.fields as 'basic' | 'full') || 'basic';

      // Validate fieldsType
      if (fieldsType !== 'basic' && fieldsType !== 'full') {
        sendErrorResponse(res, 'Invalid fields parameter. Must be "basic" or "full".', 'VALIDATION_ERROR');
        return;
      }

      // Get users from service
      const result = await userService.getUsers({
        includeInactive,
        fieldsType
      });

      handleServiceResult(res, result);
    } catch (error) {
      console.error('Error in getUsers controller:', error);
      sendErrorResponse(res, 'Failed to fetch users', 'INTERNAL_ERROR', error instanceof Error ? error.message : undefined);
    }
  }

  /**
   * Get user by ID
   * Route param: userId
   */
  async getUserById(req: AuthRequest, res: Response): Promise<void> {
    try {
      const userId = parseIntParam(req.params.userId, 'user ID');
      if (userId === null) {
        return sendErrorResponse(res, 'Invalid user ID', 'VALIDATION_ERROR');
      }

      const result = await userService.getUserById(userId);

      if (!result.success) {
        return handleServiceResult(res, result);
      }

      if (!result.data) {
        return sendErrorResponse(res, 'User not found', 'NOT_FOUND');
      }

      // Remove sensitive fields
      const { password_hash, refresh_token, refresh_token_expires_at, ...userWithoutSensitive } = result.data;

      res.json(userWithoutSensitive);
    } catch (error) {
      console.error('Error in getUserById controller:', error);
      sendErrorResponse(res, 'Failed to fetch user', 'INTERNAL_ERROR', error instanceof Error ? error.message : undefined);
    }
  }

  /**
   * Create a new user
   * Body: CreateUserData
   * Auth: Manager+ only (enforced in route middleware)
   */
  async createUser(req: AuthRequest, res: Response): Promise<void> {
    try {
      // Extract user data from request body (convert undefined to null for SQL)
      const userData: CreateUserData = {
        first_name: req.body.first_name,
        last_name: req.body.last_name,
        email: req.body.email,
        password: req.body.password,
        role: req.body.role,
        user_group: req.body.user_group ?? null,
        hourly_wage: req.body.hourly_wage ?? null,
        auto_clock_in: req.body.auto_clock_in ?? null,
        auto_clock_out: req.body.auto_clock_out ?? null
      };

      // Create user via service (all business logic handled there)
      const result = await userService.createUser(userData, req.user!.user_id, req.user!.role);

      if (!result.success) {
        return handleServiceResult(res, result);
      }

      res.status(201).json({
        success: true,
        message: 'User created successfully',
        data: { user_id: result.data }
      });
    } catch (error) {
      console.error('Error in createUser controller:', error);
      sendErrorResponse(res, 'Failed to create user', 'INTERNAL_ERROR', error instanceof Error ? error.message : undefined);
    }
  }

  /**
   * Update a user
   * Route param: userId
   * Body: UpdateUserData
   * Auth: Manager+ only (enforced in route middleware)
   */
  async updateUser(req: AuthRequest, res: Response): Promise<void> {
    try {
      const userId = parseIntParam(req.params.userId, 'user ID');
      if (userId === null) {
        return sendErrorResponse(res, 'Invalid user ID', 'VALIDATION_ERROR');
      }

      // Extract update data from request body (convert undefined to null for SQL)
      const userData: UpdateUserData = {
        username: req.body.username,
        first_name: req.body.first_name,
        last_name: req.body.last_name,
        email: req.body.email,
        role: req.body.role,
        user_group: req.body.user_group ?? null,
        hourly_wage: req.body.hourly_wage ?? null,
        auto_clock_in: req.body.auto_clock_in ?? null,
        auto_clock_out: req.body.auto_clock_out ?? null,
        is_active: req.body.is_active ? 1 : 0
      };

      // Update user via service (all business logic handled there)
      const result = await userService.updateUser(userId, userData, req.user!.user_id, req.user!.role);

      handleServiceResult(res, result);
    } catch (error) {
      console.error('Error in updateUser controller:', error);
      sendErrorResponse(res, 'Failed to update user', 'INTERNAL_ERROR', error instanceof Error ? error.message : undefined);
    }
  }

  /**
   * Update user password
   * Route param: userId
   * Body: { password: string }
   * Auth: Manager+ only (enforced in route middleware)
   */
  async updatePassword(req: AuthRequest, res: Response): Promise<void> {
    try {
      const userId = parseIntParam(req.params.userId, 'user ID');
      if (userId === null) {
        return sendErrorResponse(res, 'Invalid user ID', 'VALIDATION_ERROR');
      }

      const { password } = req.body;

      // Update password via service (all business logic handled there)
      const result = await userService.updatePassword(userId, password, req.user!.user_id);

      handleServiceResult(res, result);
    } catch (error) {
      console.error('Error in updatePassword controller:', error);
      sendErrorResponse(res, 'Failed to update password', 'INTERNAL_ERROR', error instanceof Error ? error.message : undefined);
    }
  }
}

// Export singleton instance
export const userController = new UserController();
