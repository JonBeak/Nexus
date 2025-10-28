-- OAuth State Storage for CSRF Protection
-- Stores temporary state tokens during QuickBooks OAuth flow

CREATE TABLE IF NOT EXISTS qb_oauth_states (
  id INT AUTO_INCREMENT PRIMARY KEY,
  state_token VARCHAR(64) NOT NULL UNIQUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP NOT NULL,
  INDEX idx_state_token (state_token),
  INDEX idx_expires_at (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Add comment to table
ALTER TABLE qb_oauth_states
  COMMENT = 'Temporary storage for OAuth state tokens (CSRF protection). Tokens expire after 10 minutes.';
