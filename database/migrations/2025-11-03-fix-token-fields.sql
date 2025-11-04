-- Migration: Fix qb_oauth_tokens for encrypted token storage
-- Date: 2025-11-03
-- Purpose: Make plaintext token fields nullable since we use encrypted storage

-- Make access_token and refresh_token nullable
-- These fields are kept for backward compatibility but not used with encryption_version = 1
ALTER TABLE qb_oauth_tokens
  MODIFY COLUMN access_token TEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL COMMENT 'DEPRECATED - Use access_token_encrypted when encryption_version = 1',
  MODIFY COLUMN refresh_token TEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL COMMENT 'DEPRECATED - Use refresh_token_encrypted when encryption_version = 1';

-- Update any existing NULL values to empty strings
UPDATE qb_oauth_tokens
SET access_token = ''
WHERE access_token IS NULL;

UPDATE qb_oauth_tokens
SET refresh_token = ''
WHERE refresh_token IS NULL;