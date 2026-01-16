-- ============================================================================
-- Fractional Time Tracking Migration
-- Created: 2025-01-16
-- Purpose: Add effective_duration column for proportional time distribution
--          when users work on multiple tasks concurrently
-- ============================================================================

-- Step 1: Add effective_duration_minutes column
-- This stores the proportionally calculated duration accounting for concurrent sessions
-- NULL for legacy sessions (not recalculated) and active sessions (not yet calculated)
ALTER TABLE task_sessions
ADD COLUMN effective_duration_minutes DECIMAL(10,2) NULL DEFAULT NULL
  COMMENT 'Proportionally calculated duration accounting for concurrent sessions. NULL for legacy/active sessions.'
AFTER duration_minutes;

-- Step 2: Add index for queries that filter by effective duration
-- Supports queries like "get user's completed sessions with effective time"
ALTER TABLE task_sessions
ADD INDEX idx_task_sessions_effective_duration (user_id, ended_at, effective_duration_minutes);
