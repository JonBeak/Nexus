-- Migration: Add theme_preference to users table
-- Date: 2025-01-01
-- Purpose: Store user's UI theme preference per-user instead of localStorage

-- Add theme_preference column with 'industrial' as default (matches current default)
ALTER TABLE users
ADD COLUMN theme_preference ENUM('industrial', 'light') NOT NULL DEFAULT 'industrial'
AFTER show_in_time_calendar;

-- Verify the column was added
SELECT
  COLUMN_NAME,
  COLUMN_TYPE,
  COLUMN_DEFAULT
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = 'sign_manufacturing'
  AND TABLE_NAME = 'users'
  AND COLUMN_NAME = 'theme_preference';
