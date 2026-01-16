-- ============================================================================
-- Task Session Notes Migration
-- Created: 2025-01-15
-- Purpose: Add per-user notes for task sessions (multiple notes per session)
-- ============================================================================

-- ============================================================================
-- STEP 1: Create task_session_notes table
-- ============================================================================
CREATE TABLE IF NOT EXISTS task_session_notes (
  note_id INT NOT NULL AUTO_INCREMENT,
  session_id INT NOT NULL COMMENT 'Reference to task_sessions.session_id',
  user_id INT NOT NULL COMMENT 'User who created this note',
  note_text TEXT NOT NULL COMMENT 'The note content',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (note_id),
  KEY idx_session_notes_session (session_id),
  KEY idx_session_notes_user (user_id),
  KEY idx_session_notes_created (session_id, created_at),

  CONSTRAINT fk_session_notes_session FOREIGN KEY (session_id)
    REFERENCES task_sessions (session_id) ON DELETE CASCADE,
  CONSTRAINT fk_session_notes_user FOREIGN KEY (user_id)
    REFERENCES users (user_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='Per-user notes for task sessions - users can only edit their own notes';

-- ============================================================================
-- STEP 2: Migrate existing session notes to new table (if any exist)
-- ============================================================================
INSERT INTO task_session_notes (session_id, user_id, note_text, created_at)
SELECT
  ts.session_id,
  ts.user_id,
  ts.notes,
  ts.created_at
FROM task_sessions ts
WHERE ts.notes IS NOT NULL AND ts.notes != '';

-- ============================================================================
-- Note: The task_sessions.notes column is retained for backwards compatibility
-- but should be considered deprecated for new notes. Future cleanup can remove it.
-- ============================================================================

-- ============================================================================
-- VERIFICATION QUERIES (run manually to verify migration)
-- ============================================================================
-- Check migration counts:
-- SELECT 'task_sessions with notes' as source, COUNT(*) as count
-- FROM task_sessions WHERE notes IS NOT NULL AND notes != '';
--
-- SELECT 'task_session_notes migrated' as source, COUNT(*) as count
-- FROM task_session_notes;

-- ============================================================================
-- ROLLBACK SCRIPT (if needed)
-- ============================================================================
-- DROP TABLE IF EXISTS task_session_notes;
