// File Clean up Finished: 2025-11-15
// Changes:
// - Removed 6 unused interfaces/types (49 lines of dead code):
//   - EncryptedCredential (repository uses CredentialRow instead)
//   - DecryptedCredential (never used)
//   - QuickBooksTokens (removed from usage Nov 14, 2025)
//   - CredentialAuditLog (repository uses AuditLogRow instead)
//   - ServiceName (never used)
//   - CredentialQueryOptions (never used)
// - Kept 3 actively used interfaces:
//   - CredentialInput (used by credentialService)
//   - QuickBooksCredentials (used by service, controller, migration script)
//   - CredentialServiceConfig (used by credentialService)
// - Reduced file from 74 lines to 30 lines (59% reduction)

/**
 * TypeScript type definitions for credential management system
 */

export interface CredentialInput {
  service_name: string;
  credential_key: string;
  value: string;
  metadata?: Record<string, any>;
}

export interface QuickBooksCredentials {
  client_id: string;
  client_secret: string;
  redirect_uri?: string;
  environment?: 'sandbox' | 'production';
}

export interface CredentialServiceConfig {
  enableAuditLog: boolean;
  cacheTTL?: number; // Cache time-to-live in seconds
  maxRetries?: number;
}