-- Create resource_locks table for generic edit locking system
-- Migration: Create resource locks table
-- Date: 2025-09-10
-- Description: Generic edit locking system that can lock any type of resource

CREATE TABLE IF NOT EXISTS resource_locks (
  resource_type VARCHAR(50) NOT NULL COMMENT 'Type of resource (estimate, job, customer, etc.)',
  resource_id VARCHAR(255) NOT NULL COMMENT 'ID of the resource being locked',
  editing_user_id INT NOT NULL COMMENT 'User who has the lock',
  editing_started_at DATETIME NOT NULL COMMENT 'When the lock was acquired',
  editing_expires_at DATETIME NOT NULL COMMENT 'When the lock expires',
  locked_by_override BOOLEAN DEFAULT FALSE COMMENT 'Whether this lock was acquired via override',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  PRIMARY KEY (resource_type, resource_id),
  FOREIGN KEY (editing_user_id) REFERENCES users(user_id) ON DELETE CASCADE,
  
  INDEX idx_expires (editing_expires_at),
  INDEX idx_user (editing_user_id),
  INDEX idx_resource_type (resource_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Migrate existing job_estimates locks to new system
-- Only migrate if the columns exist and have data
INSERT IGNORE INTO resource_locks (
  resource_type, 
  resource_id, 
  editing_user_id, 
  editing_started_at, 
  editing_expires_at,
  locked_by_override
)
SELECT 
  'estimate' as resource_type,
  CAST(id AS CHAR) as resource_id,
  editing_user_id,
  COALESCE(editing_started_at, NOW()) as editing_started_at,
  CASE 
    WHEN editing_started_at IS NOT NULL THEN DATE_ADD(editing_started_at, INTERVAL 10 MINUTE)
    ELSE DATE_ADD(NOW(), INTERVAL 10 MINUTE)
  END as editing_expires_at,
  FALSE as locked_by_override
FROM job_estimates 
WHERE editing_user_id IS NOT NULL 
  AND (editing_started_at IS NULL OR editing_started_at > DATE_SUB(NOW(), INTERVAL 1 HOUR));

-- Create automatic cleanup event (runs every hour)
-- This will automatically remove expired locks
DROP EVENT IF EXISTS cleanup_expired_resource_locks;

DELIMITER $$
CREATE EVENT cleanup_expired_resource_locks
ON SCHEDULE EVERY 1 HOUR
STARTS CURRENT_TIMESTAMP
DO
BEGIN
  DELETE FROM resource_locks WHERE editing_expires_at <= NOW();
END$$
DELIMITER ;

-- Note: After confirming the new system works, you can remove the old columns:
-- ALTER TABLE job_estimates DROP COLUMN editing_user_id;
-- ALTER TABLE job_estimates DROP COLUMN editing_started_at;

-- Create a view for easy querying of active locks with user details
CREATE OR REPLACE VIEW active_resource_locks AS
SELECT 
  rl.resource_type,
  rl.resource_id,
  rl.editing_user_id,
  u.username as editing_user,
  u.email as editing_user_email,
  rl.editing_started_at,
  rl.editing_expires_at,
  rl.locked_by_override,
  TIMESTAMPDIFF(MINUTE, rl.editing_started_at, NOW()) as minutes_locked,
  TIMESTAMPDIFF(MINUTE, NOW(), rl.editing_expires_at) as minutes_remaining
FROM resource_locks rl
JOIN users u ON rl.editing_user_id = u.user_id
WHERE rl.editing_expires_at > NOW()
ORDER BY rl.editing_started_at DESC;