/**
 * TypeScript type definitions for credential management system
 */

export interface EncryptedCredential {
  id?: number;
  service_name: string;
  credential_key: string;
  encrypted_value: string;
  iv: string;
  auth_tag: string;
  metadata?: Record<string, any>;
  created_at?: Date;
  updated_at?: Date;
  created_by_user_id?: number;
  updated_by_user_id?: number;
}

export interface CredentialInput {
  service_name: string;
  credential_key: string;
  value: string;
  metadata?: Record<string, any>;
}

export interface DecryptedCredential {
  service_name: string;
  credential_key: string;
  value: string;
  metadata?: Record<string, any>;
  created_at?: Date;
  updated_at?: Date;
}

export interface QuickBooksCredentials {
  client_id: string;
  client_secret: string;
  redirect_uri?: string;
  environment?: 'sandbox' | 'production';
}

export interface QuickBooksTokens {
  access_token: string;
  refresh_token: string;
  token_type?: string;
  expires_in?: number;
  x_refresh_token_expires_in?: number;
  realm_id?: string;
}

export interface CredentialAuditLog {
  id?: number;
  credential_id: number;
  operation: 'CREATE' | 'READ' | 'UPDATE' | 'DELETE' | 'ROTATE';
  user_id: number;
  ip_address?: string;
  user_agent?: string;
  details?: Record<string, any>;
  created_at?: Date;
}

export interface CredentialServiceConfig {
  enableAuditLog: boolean;
  cacheTTL?: number; // Cache time-to-live in seconds
  maxRetries?: number;
}

export type ServiceName = 'quickbooks' | 'stripe' | 'smtp' | 'aws' | 'custom';

export interface CredentialQueryOptions {
  includeMetadata?: boolean;
  decrypt?: boolean;
  auditLog?: boolean;
}