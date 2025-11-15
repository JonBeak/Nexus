// File Clean up Finished: Nov 14, 2025
// Changes (Initial):
// - Added IP address and user agent parameters to all credential methods
// - Now passes audit trail info through to repository layer
//
// Changes (Final Cleanup):
// - Removed dead code: setQuickBooksTokens() method (25 lines, never called)
// - Removed unused import: QuickBooksTokens type
// - QuickBooks OAuth token management now handled by repositories/quickbooksRepository.ts
// - Reduced file size from 353 lines to 327 lines (7.4% reduction)
/**
 * Credential Service
 *
 * Business logic layer for credential management
 * Handles encryption/decryption and QuickBooks-specific operations
 *
 * Refactored: Nov 14, 2025 to use CredentialRepository (3-layer architecture)
 * Part of: Route → Controller → Service → Repository → Database
 */

import { EncryptionService } from './encryptionService';
import { CredentialRepository } from '../repositories/credentialRepository';
import {
  CredentialInput,
  QuickBooksCredentials,
  CredentialServiceConfig
} from '../types/credentials';

export class CredentialService {
  private static instance: CredentialService;
  private encryptionService: EncryptionService;
  private repository: CredentialRepository;
  private config: CredentialServiceConfig;
  private cache: Map<string, { value: string; timestamp: number }> = new Map();

  private constructor(config?: Partial<CredentialServiceConfig>) {
    this.encryptionService = EncryptionService.getInstance();
    this.repository = new CredentialRepository();
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
    userId?: number,
    ipAddress?: string,
    userAgent?: string
  ): Promise<void> {
    try {
      // Encrypt the value
      const encrypted = this.encryptionService.encrypt(input.value);

      // Store in database via repository
      await this.repository.upsert(
        {
          service_name: input.service_name,
          credential_key: input.credential_key,
          encrypted_value: encrypted.encrypted,
          iv: encrypted.iv,
          auth_tag: encrypted.authTag,
          metadata: input.metadata
        },
        userId,
        this.config.enableAuditLog,
        ipAddress,
        userAgent
      );

      // Clear cache for this credential
      this.clearCache(`${input.service_name}:${input.credential_key}`);
    } catch (error) {
      console.error('Failed to store credential:', error);
      throw new Error('Failed to store credential');
    }
  }

  /**
   * Retrieve and decrypt a credential
   */
  public async getCredential(
    serviceName: string,
    credentialKey: string,
    userId?: number,
    ipAddress?: string,
    userAgent?: string
  ): Promise<string | null> {
    // Check cache first
    const cacheKey = `${serviceName}:${credentialKey}`;
    const cached = this.getFromCache(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      const credential = await this.repository.findByServiceAndKey(serviceName, credentialKey);

      if (!credential) {
        return null;
      }

      // Decrypt the value
      const decrypted = this.encryptionService.decrypt(
        credential.encrypted_value,
        credential.iv,
        credential.auth_tag
      );

      // Log audit trail
      if (this.config.enableAuditLog && userId && credential.id) {
        await this.repository.logAudit(
          credential.id,
          'READ',
          userId,
          undefined, // connection
          undefined, // details
          ipAddress,
          userAgent
        );
      }

      // Cache the decrypted value
      this.setCache(cacheKey, decrypted);

      return decrypted;
    } catch (error) {
      console.error('Failed to retrieve credential:', error);
      throw new Error('Failed to retrieve credential');
    }
  }

  /**
   * Get all credentials for a service (decrypted)
   */
  public async getServiceCredentials(
    serviceName: string,
    userId?: number,
    ipAddress?: string,
    userAgent?: string
  ): Promise<Record<string, string>> {
    try {
      const rows = await this.repository.findByService(serviceName);

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
          if (this.config.enableAuditLog && userId && row.id) {
            await this.repository.logAudit(
              row.id,
              'READ',
              userId,
              undefined, // connection
              undefined, // details
              ipAddress,
              userAgent
            );
          }
        }
      }

      return credentials;
    } catch (error) {
      console.error('Failed to retrieve service credentials:', error);
      throw new Error('Failed to retrieve service credentials');
    }
  }

  /**
   * Delete a credential
   */
  public async deleteCredential(
    serviceName: string,
    credentialKey: string,
    userId?: number,
    ipAddress?: string,
    userAgent?: string
  ): Promise<boolean> {
    try {
      const deleted = await this.repository.delete(
        serviceName,
        credentialKey,
        userId,
        this.config.enableAuditLog,
        ipAddress,
        userAgent
      );

      if (deleted) {
        // Clear cache
        this.clearCache(`${serviceName}:${credentialKey}`);
      }

      return deleted;
    } catch (error) {
      console.error('Failed to delete credential:', error);
      throw new Error('Failed to delete credential');
    }
  }

  /**
   * QuickBooks-specific: Store credentials
   */
  public async setQuickBooksCredentials(
    credentials: QuickBooksCredentials,
    userId?: number,
    ipAddress?: string,
    userAgent?: string
  ): Promise<void> {
    await this.setCredential({
      service_name: 'quickbooks',
      credential_key: 'client_id',
      value: credentials.client_id
    }, userId, ipAddress, userAgent);

    await this.setCredential({
      service_name: 'quickbooks',
      credential_key: 'client_secret',
      value: credentials.client_secret
    }, userId, ipAddress, userAgent);

    if (credentials.redirect_uri) {
      await this.setCredential({
        service_name: 'quickbooks',
        credential_key: 'redirect_uri',
        value: credentials.redirect_uri
      }, userId, ipAddress, userAgent);
    }

    if (credentials.environment) {
      await this.setCredential({
        service_name: 'quickbooks',
        credential_key: 'environment',
        value: credentials.environment
      }, userId, ipAddress, userAgent);
    }
  }

  /**
   * QuickBooks-specific: Get credentials
   */
  public async getQuickBooksCredentials(
    userId?: number,
    ipAddress?: string,
    userAgent?: string
  ): Promise<QuickBooksCredentials | null> {
    const credentials = await this.getServiceCredentials('quickbooks', userId, ipAddress, userAgent);

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
      return await this.repository.serviceHasCredentials(serviceName);
    } catch {
      return false;
    }
  }
}

// Export singleton instance
export const credentialService = CredentialService.getInstance();