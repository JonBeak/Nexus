// File Clean up Finished: Nov 14, 2025
// Changes (Initial):
// - Standardized query patterns (getCredentialId, logAudit use query() helper when not in transaction)
// - Added IP address and user agent tracking to audit log
// - Added input validation (service_name, credential_key, encrypted_value cannot be empty)
// - Added comment explaining hardcoded QuickBooks ID (WHERE id = 1 is by design)
// - Simplified executor pattern with clear if/else branches
//
// Changes (Final Cleanup):
// - Removed dead code: updateQuickBooksTokens() method (52 lines, never called)
// - Fixed critical bug: Method referenced non-existent column 'expires_at' (should be 'access_token_expires_at')
// - QuickBooks OAuth managed by quickbooksRepository.ts instead
// - Reduced file size from 397 lines to 343 lines (13.6% reduction)
/**
 * Credential Repository
 *
 * Repository layer for encrypted credentials and QuickBooks OAuth tokens
 * Handles all database access for credential management
 *
 * Created: Nov 14, 2025 during routes/credentials.ts refactoring
 * Part of 3-layer architecture: Route → Controller → Service → Repository → Database
 */

import { query, pool } from '../config/database';
import { RowDataPacket, ResultSetHeader } from 'mysql2';
import { PoolConnection } from 'mysql2/promise';

// =============================================
// TYPE DEFINITIONS
// =============================================

export interface CredentialRow extends RowDataPacket {
  id: number;
  service_name: string;
  credential_key: string;
  encrypted_value: string;
  iv: string;
  auth_tag: string;
  metadata: string | null;
  created_at: Date;
  updated_at: Date;
  created_by_user_id: number | null;
  updated_by_user_id: number | null;
}

export interface AuditLogRow extends RowDataPacket {
  id: number;
  credential_id: number;
  operation: 'CREATE' | 'READ' | 'UPDATE' | 'DELETE';
  user_id: number;
  details: string | null;
  timestamp: Date;
}

export interface QuickBooksTokenRow extends RowDataPacket {
  id: number;
  realm_id: string;
  access_token_encrypted: string;
  access_token_iv: string;
  access_token_tag: string;
  refresh_token_encrypted: string;
  refresh_token_iv: string;
  refresh_token_tag: string;
  encryption_version: number;
  expires_at: Date;
  refresh_token_expires_at: Date;
  created_at: Date;
  updated_at: Date;
}

export interface EncryptedData {
  encrypted: string;
  iv: string;
  authTag: string;
}

export interface CredentialInput {
  service_name: string;
  credential_key: string;
  encrypted_value: string;
  iv: string;
  auth_tag: string;
  metadata?: Record<string, any>;
  created_by_user_id?: number;
  updated_by_user_id?: number;
}

// =============================================
// REPOSITORY CLASS
// =============================================

export class CredentialRepository {

  /**
   * Get a single credential by service name and key
   */
  async findByServiceAndKey(
    serviceName: string,
    credentialKey: string
  ): Promise<CredentialRow | null> {
    const rows = await query(
      `SELECT id, encrypted_value, iv, auth_tag, metadata
       FROM encrypted_credentials
       WHERE service_name = ? AND credential_key = ?`,
      [serviceName, credentialKey]
    ) as CredentialRow[];

    return rows.length > 0 ? rows[0] : null;
  }

  /**
   * Get all credentials for a service
   */
  async findByService(serviceName: string): Promise<CredentialRow[]> {
    return await query(
      `SELECT id, credential_key, encrypted_value, iv, auth_tag, metadata
       FROM encrypted_credentials
       WHERE service_name = ?`,
      [serviceName]
    ) as CredentialRow[];
  }

  /**
   * Get credential ID (helper for audit logging)
   * Uses query() helper when not in transaction, connection.execute() when transactional
   */
  async getCredentialId(
    serviceName: string,
    credentialKey: string,
    connection?: PoolConnection
  ): Promise<number | null> {
    let rows: any[];

    if (connection) {
      // In transaction - use connection.execute()
      const [result] = await connection.execute(
        `SELECT id FROM encrypted_credentials
         WHERE service_name = ? AND credential_key = ?`,
        [serviceName, credentialKey]
      );
      rows = result as any[];
    } else {
      // Not in transaction - use query() helper for consistency
      rows = await query(
        `SELECT id FROM encrypted_credentials
         WHERE service_name = ? AND credential_key = ?`,
        [serviceName, credentialKey]
      ) as RowDataPacket[];
    }

    return rows && rows.length > 0 ? rows[0].id : null;
  }

  /**
   * Create or update a credential (transactional)
   * Returns the credential ID
   */
  async upsert(
    input: CredentialInput,
    userId?: number,
    enableAuditLog: boolean = true,
    ipAddress?: string,
    userAgent?: string
  ): Promise<number> {
    // Input validation
    if (!input.service_name || input.service_name.trim() === '') {
      throw new Error('service_name is required and cannot be empty');
    }
    if (!input.credential_key || input.credential_key.trim() === '') {
      throw new Error('credential_key is required and cannot be empty');
    }
    if (!input.encrypted_value || input.encrypted_value.trim() === '') {
      throw new Error('encrypted_value is required and cannot be empty');
    }

    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      // Upsert credential
      const [result] = await connection.execute<ResultSetHeader>(
        `INSERT INTO encrypted_credentials
         (service_name, credential_key, encrypted_value, iv, auth_tag, metadata, created_by_user_id, updated_by_user_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
         encrypted_value = VALUES(encrypted_value),
         iv = VALUES(iv),
         auth_tag = VALUES(auth_tag),
         metadata = VALUES(metadata),
         updated_by_user_id = VALUES(updated_by_user_id),
         updated_at = CURRENT_TIMESTAMP`,
        [
          input.service_name,
          input.credential_key,
          input.encrypted_value,
          input.iv,
          input.auth_tag,
          input.metadata ? JSON.stringify(input.metadata) : null,
          userId || null,
          userId || null
        ]
      );

      const credentialId = result.insertId || await this.getCredentialId(
        input.service_name,
        input.credential_key,
        connection
      );

      if (!credentialId) {
        throw new Error('Failed to get credential ID after upsert');
      }

      // Log audit trail
      if (enableAuditLog && userId) {
        await this.logAudit(
          credentialId,
          result.insertId ? 'CREATE' : 'UPDATE',
          userId,
          connection,
          undefined, // details
          ipAddress,
          userAgent
        );
      }

      await connection.commit();
      return credentialId;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  /**
   * Delete a credential (transactional)
   * Returns true if deleted, false if not found
   */
  async delete(
    serviceName: string,
    credentialKey: string,
    userId?: number,
    enableAuditLog: boolean = true,
    ipAddress?: string,
    userAgent?: string
  ): Promise<boolean> {
    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      // Get credential ID for audit log
      const credentialId = await this.getCredentialId(
        serviceName,
        credentialKey,
        connection
      );

      if (!credentialId) {
        await connection.rollback();
        return false;
      }

      // Log audit trail before deletion
      if (enableAuditLog && userId) {
        await this.logAudit(
          credentialId,
          'DELETE',
          userId,
          connection,
          undefined, // details
          ipAddress,
          userAgent
        );
      }

      // Delete the credential
      const [result] = await connection.execute<ResultSetHeader>(
        `DELETE FROM encrypted_credentials
         WHERE service_name = ? AND credential_key = ?`,
        [serviceName, credentialKey]
      );

      await connection.commit();
      return result.affectedRows > 0;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  /**
   * Log audit trail entry
   * Uses query() helper when not in transaction, connection.execute() when transactional
   */
  async logAudit(
    credentialId: number,
    operation: 'CREATE' | 'READ' | 'UPDATE' | 'DELETE',
    userId: number,
    connection?: PoolConnection,
    details?: Record<string, any>,
    ipAddress?: string,
    userAgent?: string
  ): Promise<void> {
    const sql = `INSERT INTO credential_audit_log
       (credential_id, operation, user_id, ip_address, user_agent, details)
       VALUES (?, ?, ?, ?, ?, ?)`;

    const params = [
      credentialId,
      operation,
      userId,
      ipAddress || null,
      userAgent || null,
      details ? JSON.stringify(details) : null
    ];

    if (connection) {
      // In transaction - use connection.execute()
      await connection.execute(sql, params);
    } else {
      // Not in transaction - use query() helper for consistency
      await query(sql, params);
    }
  }

  /**
   * Test if credentials exist for a service
   */
  async serviceHasCredentials(serviceName: string): Promise<boolean> {
    const rows = await query(
      'SELECT COUNT(*) as count FROM encrypted_credentials WHERE service_name = ?',
      [serviceName]
    ) as RowDataPacket[];

    return rows[0].count > 0;
  }
}
