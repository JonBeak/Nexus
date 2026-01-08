-- ============================================================================
-- Multiple Active Tasks Migration
-- Created: 2025-01-08
-- Purpose: Remove single active task constraint, enable unlimited concurrent tasks
--
-- The task_sessions table already tracks active sessions via ended_at IS NULL.
-- The users.active_task_id and active_session_id columns were redundant cache.
-- ============================================================================

-- ============================================================================
-- STEP 1: Remove foreign key constraints
-- ============================================================================
ALTER TABLE users
DROP FOREIGN KEY fk_users_active_task,
DROP FOREIGN KEY fk_users_active_session;

-- ============================================================================
-- STEP 2: Drop the columns (no longer needed - query task_sessions directly)
-- ============================================================================
ALTER TABLE users
DROP KEY idx_users_active_task,
DROP COLUMN active_task_id,
DROP COLUMN active_session_id;

-- ============================================================================
-- VERIFICATION: After running, confirm with:
-- ============================================================================
-- DESCRIBE users;  -- Should not show active_task_id or active_session_id
--
-- SELECT COUNT(*) FROM task_sessions WHERE ended_at IS NULL;  -- Active sessions still tracked

-- ============================================================================
-- ROLLBACK SCRIPT (if needed):
-- ============================================================================
-- ALTER TABLE users
-- ADD COLUMN active_task_id INT NULL DEFAULT NULL
--   COMMENT 'Currently active task (1 per user max)',
-- ADD COLUMN active_session_id INT NULL DEFAULT NULL
--   COMMENT 'Currently active session ID';
--
-- ALTER TABLE users
-- ADD CONSTRAINT fk_users_active_task
--   FOREIGN KEY (active_task_id) REFERENCES order_tasks (task_id)
--   ON DELETE SET NULL,
-- ADD CONSTRAINT fk_users_active_session
--   FOREIGN KEY (active_session_id) REFERENCES task_sessions (session_id)
--   ON DELETE SET NULL;
--
-- ALTER TABLE users
-- ADD KEY idx_users_active_task (active_task_id);
