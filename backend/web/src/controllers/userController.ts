// File Clean up Finished: Nov 14, 2025
// Changes:
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
import { parseIntParam, sendErrorResponse } from '../utils/controllerHelpers';

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
      const users = await userService.getUsers({
        includeInactive,
        fieldsType
      });

      res.json(users);
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

      const user = await userService.getUserById(userId);

      if (!user) {
        return sendErrorResponse(res, 'User not found', 'NOT_FOUND');
      }

      // Remove sensitive fields
      const { password_hash, refresh_token, refresh_token_expires_at, ...userWithoutSensitive } = user;

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
      // Extract user data from request body
      const userData: CreateUserData = {
        first_name: req.body.first_name,
        last_name: req.body.last_name,
        email: req.body.email,
        password: req.body.password,
        role: req.body.role,
        user_group: req.body.user_group,
        hourly_wage: req.body.hourly_wage,
        auto_clock_in: req.body.auto_clock_in,
        auto_clock_out: req.body.auto_clock_out
      };

      // Create user via service (all business logic handled there)
      const userId = await userService.createUser(userData, req.user!.user_id, req.user!.role);

      res.json({
        message: 'User created successfully',
        user_id: userId
      });
    } catch (error) {
      console.error('Error in createUser controller:', error);

      // Handle specific error cases
      if (error instanceof Error) {
        if (error.message.includes('Missing required fields')) {
          return sendErrorResponse(res, error.message, 'VALIDATION_ERROR');
        }
        if (error.message.includes('Only owners can create owner accounts')) {
          return sendErrorResponse(res, error.message, 'PERMISSION_DENIED');
        }
        if (error.message.includes('Email already exists') || error.message.includes('Username')) {
          return sendErrorResponse(res, error.message, 'VALIDATION_ERROR');
        }
      }

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

      // Extract update data from request body
      const userData: UpdateUserData = {
        username: req.body.username,
        first_name: req.body.first_name,
        last_name: req.body.last_name,
        email: req.body.email,
        role: req.body.role,
        user_group: req.body.user_group,
        hourly_wage: req.body.hourly_wage,
        auto_clock_in: req.body.auto_clock_in,
        auto_clock_out: req.body.auto_clock_out,
        is_active: req.body.is_active
      };

      // Update user via service (all business logic handled there)
      await userService.updateUser(userId, userData, req.user!.user_id, req.user!.role);

      res.json({ message: 'User updated successfully' });
    } catch (error) {
      console.error('Error in updateUser controller:', error);

      // Handle specific error cases
      if (error instanceof Error) {
        if (error.message.includes('User not found')) {
          return sendErrorResponse(res, error.message, 'NOT_FOUND');
        }
        if (error.message.includes('Only owners can create owner accounts')) {
          return sendErrorResponse(res, error.message, 'PERMISSION_DENIED');
        }
        if (error.message.includes('Cannot deactivate the last owner')) {
          return sendErrorResponse(res, error.message, 'VALIDATION_ERROR');
        }
      }

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
      await userService.updatePassword(userId, password, req.user!.user_id);

      res.json({ message: 'Password updated successfully' });
    } catch (error) {
      console.error('Error in updatePassword controller:', error);

      // Handle specific error cases
      if (error instanceof Error) {
        if (error.message.includes('Password is required')) {
          return sendErrorResponse(res, error.message, 'VALIDATION_ERROR');
        }
        if (error.message.includes('User not found')) {
          return sendErrorResponse(res, error.message, 'NOT_FOUND');
        }
      }

      sendErrorResponse(res, 'Failed to update password', 'INTERNAL_ERROR', error instanceof Error ? error.message : undefined);
    }
  }
}

// Export singleton instance
export const userController = new UserController();
