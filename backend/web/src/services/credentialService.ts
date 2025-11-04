/**
 * Credential Service
 * Manages encrypted storage and retrieval of sensitive credentials
 */

import { pool } from '../config/database';
import { EncryptionService } from './encryptionService';
import {
  EncryptedCredential,
  CredentialInput,
  DecryptedCredential,
  QuickBooksCredentials,
  QuickBooksTokens,
  CredentialAuditLog,
  CredentialServiceConfig
} from '../types/credentials';
import { ResultSetHeader, RowDataPacket } from 'mysql2';

export class CredentialService {
  private static instance: CredentialService;
  private encryptionService: EncryptionService;
  private config: CredentialServiceConfig;
  private cache: Map<string, { value: string; timestamp: number }> = new Map();

  private constructor(config?: Partial<CredentialServiceConfig>) {
    this.encryptionService = EncryptionService.getInstance();
    this.config = {
      enableAuditLog: true,
      cacheTTL: 300, // 5 minutes default
      maxRetries: 3,
      ...config
    };
  }

  /**
   * Get singleton instance
   */
  public static getInstance(config?: Partial<CredentialServiceConfig>): CredentialService {
    if (!CredentialService.instance) {
      CredentialService.instance = new CredentialService(config);
    }
    return CredentialService.instance;
  }

  /**
   * Store a new credential or update existing
   */
  public async setCredential(
    input: CredentialInput,
    userId?: number
  ): Promise<void> {
    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      // Encrypt the value
      const encrypted = this.encryptionService.encrypt(input.value);

      // Store in database
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
          encrypted.encrypted,
          encrypted.iv,
          encrypted.authTag,
          input.metadata ? JSON.stringify(input.metadata) : null,
          userId || null,
          userId || null
        ]
      );

      // Log audit trail
      if (this.config.enableAuditLog && userId) {
        const credentialId = result.insertId || await this.getCredentialId(
          input.service_name,
          input.credential_key,
          connection
        );

        if (credentialId) {
          await this.logAuditTrail(
            credentialId,
            result.insertId ? 'CREATE' : 'UPDATE',
            userId,
            connection
          );
        }
      }

      await connection.commit();

      // Clear cache for this credential
      this.clearCache(`${input.service_name}:${input.credential_key}`);
    } catch (error) {
      await connection.rollback();
      console.error('Failed to store credential:', error);
      throw new Error('Failed to store credential');
    } finally {
      connection.release();
    }
  }

  /**
   * Retrieve and decrypt a credential
   */
  public async getCredential(
    serviceName: string,
    credentialKey: string,
    userId?: number
  ): Promise<string | null> {
    // Check cache first
    const cacheKey = `${serviceName}:${credentialKey}`;
    const cached = this.getFromCache(cacheKey);
    if (cached) {
      return cached;
    }

    const connection = await pool.getConnection();

    try {
      const [rows] = await connection.execute(
        `SELECT id, encrypted_value, iv, auth_tag
         FROM encrypted_credentials
         WHERE service_name = ? AND credential_key = ?`,
        [serviceName, credentialKey]
      ) as any;

      if (!rows || rows.length === 0) {
        return null;
      }

      const credential = rows[0];

      // Decrypt the value
      const decrypted = this.encryptionService.decrypt(
        credential.encrypted_value,
        credential.iv,
        credential.auth_tag
      );

      // Log audit trail
      if (this.config.enableAuditLog && userId) {
        await this.logAuditTrail(credential.id, 'READ', userId, connection);
      }

      // Cache the decrypted value
      this.setCache(cacheKey, decrypted);

      return decrypted;
    } catch (error) {
      console.error('Failed to retrieve credential:', error);
      throw new Error('Failed to retrieve credential');
    } finally {
      connection.release();
    }
  }

  /**
   * Get all credentials for a service (decrypted)
   */
  public async getServiceCredentials(
    serviceName: string,
    userId?: number
  ): Promise<Record<string, string>> {
    const connection = await pool.getConnection();

    try {
      const [rows] = await connection.execute(
        `SELECT id, credential_key, encrypted_value, iv, auth_tag
         FROM encrypted_credentials
         WHERE service_name = ?`,
        [serviceName]
      ) as any;

      const credentials: Record<string, string> = {};

      if (rows && rows.length > 0) {
        for (const row of rows) {
          const decrypted = this.encryptionService.decrypt(
            row.encrypted_value,
            row.iv,
            row.auth_tag
          );
          credentials[row.credential_key] = decrypted;

          // Log audit trail
          if (this.config.enableAuditLog && userId) {
            await this.logAuditTrail(row.id, 'READ', userId, connection);
          }
        }
      }

      return credentials;
    } catch (error) {
      console.error('Failed to retrieve service credentials:', error);
      throw new Error('Failed to retrieve service credentials');
    } finally {
      connection.release();
    }
  }

  /**
   * Delete a credential
   */
  public async deleteCredential(
    serviceName: string,
    credentialKey: string,
    userId?: number
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
      if (this.config.enableAuditLog && userId) {
        await this.logAuditTrail(credentialId, 'DELETE', userId, connection);
      }

      // Delete the credential
      const [result] = await connection.execute<ResultSetHeader>(
        `DELETE FROM encrypted_credentials
         WHERE service_name = ? AND credential_key = ?`,
        [serviceName, credentialKey]
      );

      await connection.commit();

      // Clear cache
      this.clearCache(`${serviceName}:${credentialKey}`);

      return result.affectedRows > 0;
    } catch (error) {
      await connection.rollback();
      console.error('Failed to delete credential:', error);
      throw new Error('Failed to delete credential');
    } finally {
      connection.release();
    }
  }

  /**
   * QuickBooks-specific: Store credentials
   */
  public async setQuickBooksCredentials(
    credentials: QuickBooksCredentials,
    userId?: number
  ): Promise<void> {
    await this.setCredential({
      service_name: 'quickbooks',
      credential_key: 'client_id',
      value: credentials.client_id
    }, userId);

    await this.setCredential({
      service_name: 'quickbooks',
      credential_key: 'client_secret',
      value: credentials.client_secret
    }, userId);

    if (credentials.redirect_uri) {
      await this.setCredential({
        service_name: 'quickbooks',
        credential_key: 'redirect_uri',
        value: credentials.redirect_uri
      }, userId);
    }

    if (credentials.environment) {
      await this.setCredential({
        service_name: 'quickbooks',
        credential_key: 'environment',
        value: credentials.environment
      }, userId);
    }
  }

  /**
   * QuickBooks-specific: Get credentials
   */
  public async getQuickBooksCredentials(userId?: number): Promise<QuickBooksCredentials | null> {
    const credentials = await this.getServiceCredentials('quickbooks', userId);

    if (!credentials.client_id || !credentials.client_secret) {
      return null;
    }

    return {
      client_id: credentials.client_id,
      client_secret: credentials.client_secret,
      redirect_uri: credentials.redirect_uri,
      environment: credentials.environment as 'sandbox' | 'production' | undefined
    };
  }

  /**
   * QuickBooks-specific: Store OAuth tokens
   */
  public async setQuickBooksTokens(
    tokens: QuickBooksTokens,
    userId?: number
  ): Promise<void> {
    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      // Encrypt tokens
      const accessEncrypted = this.encryptionService.encrypt(tokens.access_token);
      const refreshEncrypted = this.encryptionService.encrypt(tokens.refresh_token);

      // Update tokens in qb_oauth_tokens table
      await connection.execute(
        `UPDATE qb_oauth_tokens SET
         access_token_encrypted = ?,
         access_token_iv = ?,
         access_token_tag = ?,
         refresh_token_encrypted = ?,
         refresh_token_iv = ?,
         refresh_token_tag = ?,
         encryption_version = 1,
         expires_at = DATE_ADD(NOW(), INTERVAL ? SECOND),
         refresh_token_expires_at = DATE_ADD(NOW(), INTERVAL ? SECOND),
         updated_at = CURRENT_TIMESTAMP
         WHERE id = 1`,
        [
          accessEncrypted.encrypted,
          accessEncrypted.iv,
          accessEncrypted.authTag,
          refreshEncrypted.encrypted,
          refreshEncrypted.iv,
          refreshEncrypted.authTag,
          tokens.expires_in || 3600,
          tokens.x_refresh_token_expires_in || 8726400
        ]
      );

      await connection.commit();
    } catch (error) {
      await connection.rollback();
      console.error('Failed to store QuickBooks tokens:', error);
      throw error;
    } finally {
      connection.release();
    }
  }

  /**
   * Helper: Get credential ID
   */
  private async getCredentialId(
    serviceName: string,
    credentialKey: string,
    connection: any
  ): Promise<number | null> {
    const [rows] = await connection.execute(
      `SELECT id FROM encrypted_credentials
       WHERE service_name = ? AND credential_key = ?`,
      [serviceName, credentialKey]
    ) as any;

    return rows && rows.length > 0 ? rows[0].id : null;
  }

  /**
   * Log audit trail
   */
  private async logAuditTrail(
    credentialId: number,
    operation: CredentialAuditLog['operation'],
    userId: number,
    connection: any,
    details?: Record<string, any>
  ): Promise<void> {
    await connection.execute(
      `INSERT INTO credential_audit_log
       (credential_id, operation, user_id, details)
       VALUES (?, ?, ?, ?)`,
      [
        credentialId,
        operation,
        userId,
        details ? JSON.stringify(details) : null
      ]
    );
  }

  /**
   * Cache management
   */
  private getFromCache(key: string): string | null {
    const cached = this.cache.get(key);
    if (!cached) return null;

    const age = Date.now() - cached.timestamp;
    if (age > (this.config.cacheTTL! * 1000)) {
      this.cache.delete(key);
      return null;
    }

    return cached.value;
  }

  private setCache(key: string, value: string): void {
    this.cache.set(key, {
      value,
      timestamp: Date.now()
    });
  }

  private clearCache(key?: string): void {
    if (key) {
      this.cache.delete(key);
    } else {
      this.cache.clear();
    }
  }

  /**
   * Test credential access
   */
  public async testCredentials(serviceName: string): Promise<boolean> {
    try {
      const creds = await this.getServiceCredentials(serviceName);
      return Object.keys(creds).length > 0;
    } catch {
      return false;
    }
  }
}

// Export singleton instance
export const credentialService = CredentialService.getInstance();