/**
 * User Service
 * Business logic layer for user-related operations
 *
 * Created: Nov 13, 2025
 * Part of cleanup: Consolidating /auth/users and /accounts/users endpoints
 *
 * File Clean up Finished: Nov 14, 2025
 * Changes: Added cache invalidation when user role changes (bug fix)
 */

import { userRepository, UserFields, BasicUserFields } from '../repositories/userRepository';
import { RowDataPacket } from 'mysql2';
import bcrypt from 'bcrypt';
import { clearUserPermissionCache } from '../middleware/rbac';

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
  } = {}): Promise<RowDataPacket[]> {
    const {
      includeInactive = false,
      fieldsType = 'basic'
    } = options;

    // Business rule: Only return basic fields by default for security
    const users = await userRepository.getAllUsers(includeInactive, fieldsType);

    return users;
  }

  /**
   * Get user by ID
   * @param userId - User ID to fetch
   * @returns User or null if not found
   */
  async getUserById(userId: number): Promise<RowDataPacket | null> {
    return await userRepository.getUserById(userId);
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
  ): Promise<number> {
    // Validate required fields
    if (!userData.first_name || !userData.last_name || !userData.email || !userData.password || !userData.role) {
      throw new Error('Missing required fields');
    }

    // Business rule: Only owners can create owner accounts
    if (userData.role === 'owner' && creatorRole !== 'owner') {
      throw new Error('Only owners can create owner accounts');
    }

    // Check if email already exists
    const emailExists = await userRepository.emailExists(userData.email);
    if (emailExists) {
      throw new Error('Email already exists');
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(userData.password, 12);

    // Create username from email (before @ symbol)
    const username = userData.email.split('@')[0];

    // Check if username already exists (unlikely but possible)
    const usernameExists = await userRepository.usernameExists(username);
    if (usernameExists) {
      // Add a random suffix if username exists
      const suffix = Math.floor(Math.random() * 1000);
      throw new Error(`Username ${username} already exists. Please use a different email or contact admin.`);
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
    await userRepository.createAuditEntry({
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

    return userId;
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
  ): Promise<void> {
    // Check if user exists
    const existingUser = await userRepository.getUserById(userId);
    if (!existingUser) {
      throw new Error('User not found');
    }

    // Business rule: Only owners can create owner accounts or change roles to owner
    if (userData.role === 'owner' && updaterRole !== 'owner') {
      throw new Error('Only owners can create owner accounts');
    }

    // Business rule: Cannot deactivate the last owner
    if (userData.is_active === 0 && (existingUser.role === 'owner' || userData.role === 'owner')) {
      const activeOwnerCount = await userRepository.countActiveOwners();
      if (activeOwnerCount <= 1) {
        throw new Error('Cannot deactivate the last owner account. At least one owner must remain active.');
      }
    }

    // Update user in database
    await userRepository.updateUser(userId, userData);

    // Clear permission cache if role changed (ensures immediate permission updates)
    if (existingUser.role !== userData.role) {
      clearUserPermissionCache(userId);
    }

    // Log audit trail
    await userRepository.createAuditEntry({
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
        is_active: userData.is_active
      })
    });
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
  ): Promise<void> {
    if (!newPassword) {
      throw new Error('Password is required');
    }

    // Check if user exists
    const existingUser = await userRepository.getUserById(userId);
    if (!existingUser) {
      throw new Error('User not found');
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 12);

    // Update password in database
    await userRepository.updatePassword(userId, hashedPassword);

    // Log audit trail
    await userRepository.createAuditEntry({
      user_id: updaterUserId,
      action: 'update',
      entity_type: 'user_password',
      entity_id: userId,
      details: JSON.stringify({ action: 'password_reset' })
    });
  }
}

// Export singleton instance
export const userService = new UserService();
