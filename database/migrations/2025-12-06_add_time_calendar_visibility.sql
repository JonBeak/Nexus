-- Migration: Add time tracking calendar visibility flag
-- Date: 2025-12-06
-- Purpose: Control which users appear in Time Management Bi-Weekly Calendar
-- Author: Claude Code
--
-- This migration adds a flag to hide specific users from the time tracking calendar.
-- Users like admin, designers, and managers who don't track time can be hidden.

-- Add show_in_time_calendar column
ALTER TABLE users
ADD COLUMN show_in_time_calendar TINYINT(1) NOT NULL DEFAULT 1
COMMENT 'Whether user appears in time tracking calendar (1=visible, 0=hidden)'
AFTER is_active;

-- Add index for query performance (frequently used in WHERE clauses)
CREATE INDEX idx_show_in_time_calendar ON users(show_in_time_calendar);

-- Hide specified users from calendar (users who don't track time)
-- User IDs: 1, 2, 3, 4, 5, 10
UPDATE users
SET show_in_time_calendar = 0
WHERE user_id IN (1, 2, 3, 4, 5, 10);

-- Verification query - Check results
SELECT
  user_id,
  username,
  first_name,
  last_name,
  is_active,
  show_in_time_calendar,
  CASE
    WHEN show_in_time_calendar = 1 THEN 'VISIBLE IN CALENDAR'
    ELSE 'HIDDEN FROM CALENDAR'
  END as calendar_status
FROM users
WHERE is_active = 1
ORDER BY show_in_time_calendar DESC, first_name;

-- Rollback instructions (if needed):
-- ALTER TABLE users DROP INDEX idx_show_in_time_calendar;
-- ALTER TABLE users DROP COLUMN show_in_time_calendar;
