/**
 * User Repository
 * Data access layer for user-related database operations
 *
 * Created: Nov 13, 2025
 * Part of cleanup: Consolidating /auth/users and /accounts/users endpoints
 */

import { query } from '../config/database';
import { RowDataPacket } from 'mysql2';

export interface UserFields {
  user_id: number;
  username: string;
  first_name: string;
  last_name: string;
  email: string;
  role: string;
  user_group: string | null;
  hourly_wage: number | null;
  is_active: boolean;
  auto_clock_in: string | null;
  auto_clock_out: string | null;
  created_at: Date;
  last_login: Date | null;
}

export type BasicUserFields = Pick<UserFields, 'user_id' | 'username' | 'first_name' | 'last_name' | 'email' | 'role' | 'user_group'>;
export type FullUserFields = UserFields;

export class UserRepository {
  /**
   * Get all users with optional filtering
   * @param includeInactive - Whether to include inactive users (default: false)
   * @param fieldsType - 'basic' (7 fields) or 'full' (12 fields)
   * @returns Array of user records
   */
  async getAllUsers(
    includeInactive: boolean = false,
    fieldsType: 'basic' | 'full' = 'basic'
  ): Promise<RowDataPacket[]> {
    // Define field sets
    const basicFields = `
      user_id,
      username,
      first_name,
      last_name,
      email,
      role,
      user_group
    `;

    const fullFields = `
      user_id,
      username,
      first_name,
      last_name,
      email,
      role,
      user_group,
      hourly_wage,
      is_active,
      auto_clock_in,
      auto_clock_out,
      created_at,
      last_login
    `;

    const fields = fieldsType === 'full' ? fullFields : basicFields;
    const whereClause = includeInactive ? '' : 'WHERE is_active = 1';

    const sql = `
      SELECT ${fields}
      FROM users
      ${whereClause}
      ORDER BY first_name, last_name
    `;

    const users = await query(sql) as RowDataPacket[];
    return users;
  }

  /**
   * Get user by ID
   * @param userId - User ID to fetch
   * @returns User record or null if not found
   */
  async getUserById(userId: number): Promise<RowDataPacket | null> {
    const users = await query(
      'SELECT * FROM users WHERE user_id = ?',
      [userId]
    ) as RowDataPacket[];

    return users.length > 0 ? users[0] : null;
  }

  /**
   * Get user by username
   * @param username - Username to fetch
   * @returns User record or null if not found
   */
  async getUserByUsername(username: string): Promise<RowDataPacket | null> {
    const users = await query(
      'SELECT * FROM users WHERE username = ? AND is_active = 1',
      [username]
    ) as RowDataPacket[];

    return users.length > 0 ? users[0] : null;
  }

  /**
   * Check if email exists
   * @param email - Email to check
   * @param excludeUserId - Optional user ID to exclude from check (for updates)
   * @returns True if email exists
   */
  async emailExists(email: string, excludeUserId?: number): Promise<boolean> {
    const params: any[] = [email];
    let sql = 'SELECT user_id FROM users WHERE email = ?';

    if (excludeUserId) {
      sql += ' AND user_id != ?';
      params.push(excludeUserId);
    }

    const users = await query(sql, params) as RowDataPacket[];
    return users.length > 0;
  }

  /**
   * Check if username exists
   * @param username - Username to check
   * @param excludeUserId - Optional user ID to exclude from check (for updates)
   * @returns True if username exists
   */
  async usernameExists(username: string, excludeUserId?: number): Promise<boolean> {
    const params: any[] = [username];
    let sql = 'SELECT user_id FROM users WHERE username = ?';

    if (excludeUserId) {
      sql += ' AND user_id != ?';
      params.push(excludeUserId);
    }

    const users = await query(sql, params) as RowDataPacket[];
    return users.length > 0;
  }

  /**
   * Count active owners
   * @returns Number of active owner accounts
   */
  async countActiveOwners(): Promise<number> {
    const result = await query(
      'SELECT COUNT(*) as count FROM users WHERE role = ? AND is_active = 1',
      ['owner']
    ) as RowDataPacket[];

    return result[0].count;
  }

  /**
   * Create a new user
   * @param userData - User data to insert
   * @returns Inserted user ID
   */
  async createUser(userData: {
    username: string;
    first_name: string;
    last_name: string;
    email: string;
    password_hash: string;
    role: string;
    user_group?: string | null;
    hourly_wage?: number | null;
    auto_clock_in?: string | null;
    auto_clock_out?: string | null;
  }): Promise<number> {
    const result = await query(`
      INSERT INTO users (
        username,
        first_name,
        last_name,
        email,
        password_hash,
        role,
        user_group,
        hourly_wage,
        auto_clock_in,
        auto_clock_out,
        is_active,
        created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, NOW())
    `, [
      userData.username,
      userData.first_name,
      userData.last_name,
      userData.email,
      userData.password_hash,
      userData.role,
      userData.user_group || null,
      userData.hourly_wage || null,
      userData.auto_clock_in || null,
      userData.auto_clock_out || null
    ]) as any;

    return result.insertId;
  }

  /**
   * Update a user
   * @param userId - User ID to update
   * @param userData - User data to update
   */
  async updateUser(userId: number, userData: {
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
  }): Promise<void> {
    await query(`
      UPDATE users SET
        username = ?,
        first_name = ?,
        last_name = ?,
        email = ?,
        role = ?,
        user_group = ?,
        hourly_wage = ?,
        auto_clock_in = ?,
        auto_clock_out = ?,
        is_active = ?,
        updated_at = NOW()
      WHERE user_id = ?
    `, [
      userData.username,
      userData.first_name,
      userData.last_name,
      userData.email,
      userData.role,
      userData.user_group || null,
      userData.hourly_wage || null,
      userData.auto_clock_in || null,
      userData.auto_clock_out || null,
      userData.is_active,
      userId
    ]);
  }

  /**
   * Update user password
   * @param userId - User ID to update
   * @param passwordHash - New password hash
   */
  async updatePassword(userId: number, passwordHash: string): Promise<void> {
    await query(
      'UPDATE users SET password_hash = ?, updated_at = NOW() WHERE user_id = ?',
      [passwordHash, userId]
    );
  }

  /**
   * Create audit trail entry
   * @param auditData - Audit data to insert
   */
  async createAuditEntry(auditData: {
    user_id: number;
    action: string;
    entity_type: string;
    entity_id: number | string;
    details: string;
  }): Promise<void> {
    await query(
      `INSERT INTO audit_trail (user_id, action, entity_type, entity_id, details)
       VALUES (?, ?, ?, ?, ?)`,
      [auditData.user_id, auditData.action, auditData.entity_type, auditData.entity_id, auditData.details]
    );
  }
}

// Export singleton instance
export const userRepository = new UserRepository();
