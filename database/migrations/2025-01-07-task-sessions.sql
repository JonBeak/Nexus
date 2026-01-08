-- ============================================================================
-- Task Sessions Migration
-- Created: 2025-01-07
-- Purpose: Replace single start/finish task timing with multi-session tracking
-- ============================================================================

-- ============================================================================
-- STEP 1: Create task_sessions table
-- ============================================================================
CREATE TABLE IF NOT EXISTS task_sessions (
  session_id INT NOT NULL AUTO_INCREMENT,
  task_id INT NOT NULL COMMENT 'Reference to order_tasks.task_id',
  user_id INT NOT NULL COMMENT 'Staff member who worked on this session',
  started_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'Session start time',
  ended_at TIMESTAMP NULL DEFAULT NULL COMMENT 'Session end time (NULL = currently active)',
  duration_minutes INT GENERATED ALWAYS AS (
    CASE
      WHEN ended_at IS NULL THEN NULL
      ELSE TIMESTAMPDIFF(MINUTE, started_at, ended_at)
    END
  ) STORED COMMENT 'Calculated duration in minutes',
  notes TEXT NULL COMMENT 'Session-specific notes (optional)',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (session_id),
  KEY idx_task_sessions_task (task_id),
  KEY idx_task_sessions_user (user_id),
  KEY idx_task_sessions_ended (ended_at),
  KEY idx_task_sessions_active (task_id, ended_at) COMMENT 'Find active sessions for a task',
  KEY idx_task_sessions_user_active (user_id, ended_at) COMMENT 'Find user active session',

  CONSTRAINT fk_task_sessions_task FOREIGN KEY (task_id)
    REFERENCES order_tasks (task_id) ON DELETE CASCADE,
  CONSTRAINT fk_task_sessions_user FOREIGN KEY (user_id)
    REFERENCES users (user_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='Task work sessions - tracks individual work periods per staff member';

-- ============================================================================
-- STEP 2: Add active task tracking columns to users table
-- ============================================================================
ALTER TABLE users
ADD COLUMN active_task_id INT NULL DEFAULT NULL
  COMMENT 'Currently active task (1 per user max)',
ADD COLUMN active_session_id INT NULL DEFAULT NULL
  COMMENT 'Currently active session ID';

-- Add foreign key constraints (after columns exist)
ALTER TABLE users
ADD CONSTRAINT fk_users_active_task
  FOREIGN KEY (active_task_id) REFERENCES order_tasks (task_id)
  ON DELETE SET NULL,
ADD CONSTRAINT fk_users_active_session
  FOREIGN KEY (active_session_id) REFERENCES task_sessions (session_id)
  ON DELETE SET NULL;

-- Add index for fast lookup
ALTER TABLE users
ADD KEY idx_users_active_task (active_task_id);

-- ============================================================================
-- STEP 3: Mark deprecated columns in order_tasks (add comments only)
-- ============================================================================
ALTER TABLE order_tasks
MODIFY COLUMN started_at TIMESTAMP NULL DEFAULT NULL
  COMMENT 'DEPRECATED - Use task_sessions table instead. Will be removed in future migration.',
MODIFY COLUMN started_by INT NULL DEFAULT NULL
  COMMENT 'DEPRECATED - Use task_sessions table instead. Will be removed in future migration.';

-- ============================================================================
-- STEP 4: Migrate existing started tasks to task_sessions
-- ============================================================================
-- Insert sessions for tasks that were started but not completed
INSERT INTO task_sessions (task_id, user_id, started_at, ended_at, notes)
SELECT
  task_id,
  started_by,
  started_at,
  NULL,  -- Still active (not ended)
  'Migrated from legacy started_at field'
FROM order_tasks
WHERE started_at IS NOT NULL
  AND started_by IS NOT NULL
  AND completed = 0;

-- Update users.active_task_id for users who have active sessions
UPDATE users u
INNER JOIN task_sessions ts ON u.user_id = ts.user_id AND ts.ended_at IS NULL
SET
  u.active_task_id = ts.task_id,
  u.active_session_id = ts.session_id
WHERE ts.notes = 'Migrated from legacy started_at field';

-- ============================================================================
-- VERIFICATION QUERIES (run manually to verify migration)
-- ============================================================================
-- Check migration counts:
-- SELECT 'order_tasks with started_at' as source, COUNT(*) as count
-- FROM order_tasks WHERE started_at IS NOT NULL AND started_by IS NOT NULL AND completed = 0;
--
-- SELECT 'task_sessions migrated' as source, COUNT(*) as count
-- FROM task_sessions WHERE notes = 'Migrated from legacy started_at field';
--
-- SELECT 'users with active_task_id set' as source, COUNT(*) as count
-- FROM users WHERE active_task_id IS NOT NULL;

-- ============================================================================
-- ROLLBACK SCRIPT (if needed)
-- ============================================================================
-- DROP TABLE IF EXISTS task_sessions;
-- ALTER TABLE users DROP FOREIGN KEY fk_users_active_task;
-- ALTER TABLE users DROP FOREIGN KEY fk_users_active_session;
-- ALTER TABLE users DROP KEY idx_users_active_task;
-- ALTER TABLE users DROP COLUMN active_task_id;
-- ALTER TABLE users DROP COLUMN active_session_id;
