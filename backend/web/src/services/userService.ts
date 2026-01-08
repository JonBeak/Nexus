// File Clean up Finished: 2025-11-15 (Third cleanup - ServiceResult Migration)
// Latest Cleanup Changes (Nov 15, 2025 - 3rd cleanup):
// - ✅ Migrated all 5 methods to ServiceResult<T> pattern for consistency
// - ✅ getUsers() → ServiceResult<RowDataPacket[]>
// - ✅ getUserById() → ServiceResult<RowDataPacket | null>
// - ✅ createUser() → ServiceResult<number>
// - ✅ updateUser() → ServiceResult<void>
// - ✅ updatePassword() → ServiceResult<void>
// - ✅ All business logic errors now return structured error codes
// - ✅ Zero breaking changes - controllers updated to match
// - Consistent error codes: VALIDATION_ERROR, PERMISSION_DENIED, DUPLICATE_EMAIL, etc.
//
// Second Cleanup (Nov 15, 2025 - Audit Trail Refactoring):
// - Migrated from userRepository.createAuditEntry() to centralized auditRepository
// - Updated all 3 audit trail calls to use auditRepository.createAuditEntry()
// - Added import for auditRepository
// - Part of Phase 1: Centralized Audit Repository implementation
//
// First Cleanup (Nov 14, 2025):
// - Added cache invalidation when user role changes (bug fix)
/**
 * User Service
 * Business logic layer for user-related operations
 *
 * Created: Nov 13, 2025
 * Part of cleanup: Consolidating /auth/users and /accounts/users endpoints
 */

import { userRepository, UserFields, BasicUserFields } from '../repositories/userRepository';
import { auditRepository } from '../repositories/auditRepository';
import { RowDataPacket } from 'mysql2';
import bcrypt from 'bcrypt';
import { clearUserPermissionCache } from '../middleware/rbac';
import { ServiceResult } from '../types/serviceResults';

export interface CreateUserData {
  first_name: string;
  last_name: string;
  email: string;
  password: string;
  role: string;
  user_group?: string | null;
  hourly_wage?: number | null;
  auto_clock_in?: string | null;
  auto_clock_out?: string | null;
}

export interface UpdateUserData {
  username: string;
  first_name: string;
  last_name: string;
  email: string;
  role: string;
  user_group?: string | null;
  hourly_wage?: number | null;
  auto_clock_in?: string | null;
  auto_clock_out?: string | null;
  is_active: number;
  production_roles?: string[] | null;  // Array of role_key values (e.g., ["designer", "vinyl_applicator"])
}

export class UserService {
  /**
   * Get all users based on filters
   * @param options - Filtering options
   * @returns Array of users
   */
  async getUsers(options: {
    includeInactive?: boolean;
    fieldsType?: 'basic' | 'full';
  } = {}): Promise<ServiceResult<RowDataPacket[]>> {
    try {
      const {
        includeInactive = false,
        fieldsType = 'basic'
      } = options;

      // Business rule: Only return basic fields by default for security
      const users = await userRepository.getAllUsers(includeInactive, fieldsType);

      return {
        success: true,
        data: users
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Failed to fetch users',
        code: 'FETCH_USERS_ERROR'
      };
    }
  }

  /**
   * Get user by ID
   * @param userId - User ID to fetch
   * @returns User or null if not found
   */
  async getUserById(userId: number): Promise<ServiceResult<RowDataPacket | null>> {
    try {
      const user = await userRepository.getUserById(userId);
      return {
        success: true,
        data: user
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Failed to fetch user',
        code: 'FETCH_USER_ERROR'
      };
    }
  }

  /**
   * Get user by username
   * @param username - Username to fetch
   * @returns User or null if not found
   */
  async getUserByUsername(username: string): Promise<RowDataPacket | null> {
    return await userRepository.getUserByUsername(username);
  }

  /**
   * Validate if email is available
   * @param email - Email to check
   * @param excludeUserId - Optional user ID to exclude
   * @returns True if email is available (doesn't exist)
   */
  async isEmailAvailable(email: string, excludeUserId?: number): Promise<boolean> {
    const exists = await userRepository.emailExists(email, excludeUserId);
    return !exists;
  }

  /**
   * Create a new user
   * @param userData - User creation data
   * @param creatorUserId - ID of the user creating this account
   * @param creatorRole - Role of the user creating this account
   * @returns Created user ID
   */
  async createUser(
    userData: CreateUserData,
    creatorUserId: number,
    creatorRole: string
  ): Promise<ServiceResult<number>> {
    try {
      // Validate required fields
      if (!userData.first_name || !userData.last_name || !userData.email || !userData.password || !userData.role) {
        return {
          success: false,
          error: 'Missing required fields',
          code: 'VALIDATION_ERROR'
        };
      }

      // Business rule: Only owners can create owner accounts
      if (userData.role === 'owner' && creatorRole !== 'owner') {
        return {
          success: false,
          error: 'Only owners can create owner accounts',
          code: 'PERMISSION_DENIED'
        };
      }

      // Check if email already exists
      const emailExists = await userRepository.emailExists(userData.email);
      if (emailExists) {
        return {
          success: false,
          error: 'Email already exists',
          code: 'DUPLICATE_EMAIL'
        };
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(userData.password, 12);

      // Create username from email (before @ symbol)
      const username = userData.email.split('@')[0];

      // Check if username already exists (unlikely but possible)
      const usernameExists = await userRepository.usernameExists(username);
      if (usernameExists) {
        return {
          success: false,
          error: `Username ${username} already exists. Please use a different email or contact admin.`,
          code: 'DUPLICATE_USERNAME'
        };
      }

      // Create user in database
      const userId = await userRepository.createUser({
        username,
        first_name: userData.first_name,
        last_name: userData.last_name,
        email: userData.email,
        password_hash: hashedPassword,
        role: userData.role,
        user_group: userData.user_group,
        hourly_wage: userData.hourly_wage,
        auto_clock_in: userData.auto_clock_in,
        auto_clock_out: userData.auto_clock_out
      });

      // Log audit trail
      await auditRepository.createAuditEntry({
        user_id: creatorUserId,
        action: 'create',
        entity_type: 'user',
        entity_id: userId,
        details: JSON.stringify({
          first_name: userData.first_name,
          last_name: userData.last_name,
          email: userData.email,
          role: userData.role
        })
      });

      return {
        success: true,
        data: userId
      };
    } catch (error: any) {
      console.error('Error in UserService.createUser:', error);
      return {
        success: false,
        error: error.message || 'Failed to create user',
        code: 'CREATE_USER_ERROR'
      };
    }
  }

  /**
   * Update a user
   * @param userId - User ID to update
   * @param userData - User update data
   * @param updaterUserId - ID of the user performing the update
   * @param updaterRole - Role of the user performing the update
   */
  async updateUser(
    userId: number,
    userData: UpdateUserData,
    updaterUserId: number,
    updaterRole: string
  ): Promise<ServiceResult<void>> {
    try {
      // Check if user exists
      const existingUser = await userRepository.getUserById(userId);
      if (!existingUser) {
        return {
          success: false,
          error: 'User not found',
          code: 'USER_NOT_FOUND'
        };
      }

      // Business rule: Only owners can create owner accounts or change roles to owner
      if (userData.role === 'owner' && updaterRole !== 'owner') {
        return {
          success: false,
          error: 'Only owners can create owner accounts',
          code: 'PERMISSION_DENIED'
        };
      }

      // Business rule: Cannot deactivate the last owner
      if (userData.is_active === 0 && (existingUser.role === 'owner' || userData.role === 'owner')) {
        const activeOwnerCount = await userRepository.countActiveOwners();
        if (activeOwnerCount <= 1) {
          return {
            success: false,
            error: 'Cannot deactivate the last owner account. At least one owner must remain active.',
            code: 'LAST_OWNER_ERROR'
          };
        }
      }

      // Update user in database
      await userRepository.updateUser(userId, userData);

      // Clear permission cache if role changed (ensures immediate permission updates)
      if (existingUser.role !== userData.role) {
        clearUserPermissionCache(userId);
      }

      // Log audit trail
      await auditRepository.createAuditEntry({
        user_id: updaterUserId,
        action: 'update',
        entity_type: 'user',
        entity_id: userId,
        details: JSON.stringify({
          first_name: userData.first_name,
          last_name: userData.last_name,
          email: userData.email,
          role: userData.role,
          hourly_wage: userData.hourly_wage,
          is_active: userData.is_active,
          production_roles: userData.production_roles
        })
      });

      return {
        success: true,
        data: undefined
      };
    } catch (error: any) {
      console.error('Error in UserService.updateUser:', error);
      return {
        success: false,
        error: error.message || 'Failed to update user',
        code: 'UPDATE_USER_ERROR'
      };
    }
  }

  /**
   * Update user password
   * @param userId - User ID to update password for
   * @param newPassword - New plain text password
   * @param updaterUserId - ID of the user performing the update
   */
  async updatePassword(
    userId: number,
    newPassword: string,
    updaterUserId: number
  ): Promise<ServiceResult<void>> {
    try {
      if (!newPassword) {
        return {
          success: false,
          error: 'Password is required',
          code: 'VALIDATION_ERROR'
        };
      }

      // Check if user exists
      const existingUser = await userRepository.getUserById(userId);
      if (!existingUser) {
        return {
          success: false,
          error: 'User not found',
          code: 'USER_NOT_FOUND'
        };
      }

      // Hash new password
      const hashedPassword = await bcrypt.hash(newPassword, 12);

      // Update password in database
      await userRepository.updatePassword(userId, hashedPassword);

      // Log audit trail
      await auditRepository.createAuditEntry({
        user_id: updaterUserId,
        action: 'update',
        entity_type: 'user_password',
        entity_id: userId,
        details: JSON.stringify({ action: 'password_reset' })
      });

      return {
        success: true,
        data: undefined
      };
    } catch (error: any) {
      console.error('Error in UserService.updatePassword:', error);
      return {
        success: false,
        error: error.message || 'Failed to update password',
        code: 'UPDATE_PASSWORD_ERROR'
      };
    }
  }
}

// Export singleton instance
export const userService = new UserService();
