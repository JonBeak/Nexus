/**
 * User Controller
 * HTTP request/response handling for user-related operations
 *
 * Created: Nov 13, 2025
 * Part of cleanup: Consolidating /auth/users and /accounts/users endpoints
 */

import { Request, Response } from 'express';
import { userService, CreateUserData, UpdateUserData } from '../services/userService';

export class UserController {
  /**
   * Get all users
   * Query params:
   *   - includeInactive: 'true' | 'false' (default: false)
   *   - fields: 'basic' | 'full' (default: basic)
   */
  async getUsers(req: Request, res: Response): Promise<void> {
    try {
      // Parse query parameters
      const includeInactive = req.query.includeInactive === 'true';
      const fieldsType = (req.query.fields as 'basic' | 'full') || 'basic';

      // Validate fieldsType
      if (fieldsType !== 'basic' && fieldsType !== 'full') {
        res.status(400).json({
          error: 'Invalid fields parameter. Must be "basic" or "full".'
        });
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
      res.status(500).json({
        error: 'Failed to fetch users',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Get user by ID
   * Route param: userId
   */
  async getUserById(req: Request, res: Response): Promise<void> {
    try {
      const userId = parseInt(req.params.userId);

      if (isNaN(userId)) {
        res.status(400).json({ error: 'Invalid user ID' });
        return;
      }

      const user = await userService.getUserById(userId);

      if (!user) {
        res.status(404).json({ error: 'User not found' });
        return;
      }

      // Remove sensitive fields
      const { password_hash, refresh_token, refresh_token_expires_at, ...userWithoutSensitive } = user;

      res.json(userWithoutSensitive);
    } catch (error) {
      console.error('Error in getUserById controller:', error);
      res.status(500).json({
        error: 'Failed to fetch user',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Create a new user
   * Body: CreateUserData
   * Auth: Manager+ only (enforced in route middleware)
   */
  async createUser(req: Request, res: Response): Promise<void> {
    try {
      const authUser = (req as any).user;

      if (!authUser) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

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
      const userId = await userService.createUser(userData, authUser.user_id, authUser.role);

      res.json({
        message: 'User created successfully',
        user_id: userId
      });
    } catch (error) {
      console.error('Error in createUser controller:', error);

      // Handle specific error cases
      if (error instanceof Error) {
        if (error.message.includes('Missing required fields')) {
          res.status(400).json({ error: error.message });
          return;
        }
        if (error.message.includes('Only owners can create owner accounts')) {
          res.status(403).json({ error: error.message });
          return;
        }
        if (error.message.includes('Email already exists')) {
          res.status(400).json({ error: error.message });
          return;
        }
        if (error.message.includes('Username')) {
          res.status(400).json({ error: error.message });
          return;
        }
      }

      res.status(500).json({
        error: 'Failed to create user',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Update a user
   * Route param: userId
   * Body: UpdateUserData
   * Auth: Manager+ only (enforced in route middleware)
   */
  async updateUser(req: Request, res: Response): Promise<void> {
    try {
      const authUser = (req as any).user;

      if (!authUser) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const userId = parseInt(req.params.userId);
      if (isNaN(userId)) {
        res.status(400).json({ error: 'Invalid user ID' });
        return;
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
      await userService.updateUser(userId, userData, authUser.user_id, authUser.role);

      res.json({ message: 'User updated successfully' });
    } catch (error) {
      console.error('Error in updateUser controller:', error);

      // Handle specific error cases
      if (error instanceof Error) {
        if (error.message.includes('User not found')) {
          res.status(404).json({ error: error.message });
          return;
        }
        if (error.message.includes('Only owners can create owner accounts')) {
          res.status(403).json({ error: error.message });
          return;
        }
        if (error.message.includes('Cannot deactivate the last owner')) {
          res.status(400).json({ error: error.message });
          return;
        }
      }

      res.status(500).json({
        error: 'Failed to update user',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Update user password
   * Route param: userId
   * Body: { password: string }
   * Auth: Manager+ only (enforced in route middleware)
   */
  async updatePassword(req: Request, res: Response): Promise<void> {
    try {
      const authUser = (req as any).user;

      if (!authUser) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const userId = parseInt(req.params.userId);
      if (isNaN(userId)) {
        res.status(400).json({ error: 'Invalid user ID' });
        return;
      }

      const { password } = req.body;

      // Update password via service (all business logic handled there)
      await userService.updatePassword(userId, password, authUser.user_id);

      res.json({ message: 'Password updated successfully' });
    } catch (error) {
      console.error('Error in updatePassword controller:', error);

      // Handle specific error cases
      if (error instanceof Error) {
        if (error.message.includes('Password is required')) {
          res.status(400).json({ error: error.message });
          return;
        }
        if (error.message.includes('User not found')) {
          res.status(404).json({ error: error.message });
          return;
        }
      }

      res.status(500).json({
        error: 'Failed to update password',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
}

// Export singleton instance
export const userController = new UserController();
