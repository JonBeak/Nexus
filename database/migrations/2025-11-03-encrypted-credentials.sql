-- Migration: Add encrypted_credentials table for secure credential storage
-- Date: 2025-11-03
-- Purpose: Store encrypted API credentials and secrets using AES-256-GCM encryption

-- Create the encrypted_credentials table
CREATE TABLE IF NOT EXISTS encrypted_credentials (
  id INT AUTO_INCREMENT PRIMARY KEY,
  service_name VARCHAR(100) NOT NULL COMMENT 'Service identifier (e.g., quickbooks, stripe, etc.)',
  credential_key VARCHAR(100) NOT NULL COMMENT 'Credential key name (e.g., client_id, client_secret)',
  encrypted_value TEXT NOT NULL COMMENT 'AES-256-GCM encrypted credential value',
  iv VARCHAR(32) NOT NULL COMMENT 'Initialization vector for encryption',
  auth_tag VARCHAR(32) NOT NULL COMMENT 'Authentication tag for GCM mode',
  metadata JSON DEFAULT NULL COMMENT 'Optional metadata (environment, expiry, etc.)',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  created_by_user_id INT DEFAULT NULL,
  updated_by_user_id INT DEFAULT NULL,
  UNIQUE KEY unique_service_key (service_name, credential_key),
  INDEX idx_service_name (service_name),
  INDEX idx_created_at (created_at),
  FOREIGN KEY (created_by_user_id) REFERENCES users(user_id) ON DELETE SET NULL,
  FOREIGN KEY (updated_by_user_id) REFERENCES users(user_id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='Stores encrypted credentials for external services';

-- Add audit trail for credential operations
CREATE TABLE IF NOT EXISTS credential_audit_log (
  id INT AUTO_INCREMENT PRIMARY KEY,
  credential_id INT NOT NULL,
  operation ENUM('CREATE', 'READ', 'UPDATE', 'DELETE', 'ROTATE') NOT NULL,
  user_id INT NOT NULL,
  ip_address VARCHAR(45) DEFAULT NULL,
  user_agent TEXT DEFAULT NULL,
  details JSON DEFAULT NULL COMMENT 'Additional operation details',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_credential_id (credential_id),
  INDEX idx_user_id (user_id),
  INDEX idx_operation (operation),
  INDEX idx_created_at (created_at),
  FOREIGN KEY (credential_id) REFERENCES encrypted_credentials(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='Audit log for all credential operations';

-- Add encrypted fields to existing qb_oauth_tokens table for migration
ALTER TABLE qb_oauth_tokens
  ADD COLUMN access_token_encrypted TEXT DEFAULT NULL AFTER access_token,
  ADD COLUMN access_token_iv VARCHAR(32) DEFAULT NULL AFTER access_token_encrypted,
  ADD COLUMN access_token_tag VARCHAR(32) DEFAULT NULL AFTER access_token_iv,
  ADD COLUMN refresh_token_encrypted TEXT DEFAULT NULL AFTER refresh_token,
  ADD COLUMN refresh_token_iv VARCHAR(32) DEFAULT NULL AFTER refresh_token_encrypted,
  ADD COLUMN refresh_token_tag VARCHAR(32) DEFAULT NULL AFTER refresh_token_iv,
  ADD COLUMN encryption_version INT DEFAULT 0 COMMENT '0=plaintext, 1=encrypted';

-- Rollback script (save separately)
-- DROP TABLE IF EXISTS credential_audit_log;
-- DROP TABLE IF EXISTS encrypted_credentials;
-- ALTER TABLE qb_oauth_tokens
--   DROP COLUMN access_token_encrypted,
--   DROP COLUMN access_token_iv,
--   DROP COLUMN access_token_tag,
--   DROP COLUMN refresh_token_encrypted,
--   DROP COLUMN refresh_token_iv,
--   DROP COLUMN refresh_token_tag,
--   DROP COLUMN encryption_version;