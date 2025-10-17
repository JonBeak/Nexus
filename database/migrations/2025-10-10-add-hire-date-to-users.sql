-- Add hire_date column to users table
-- This allows proper filtering of missing entries to start from employment date

ALTER TABLE users
ADD COLUMN hire_date DATE DEFAULT NULL COMMENT 'Employment start date - missing entries will only be checked from this date forward';

-- Backfill existing employees with their first clock-in date as a reasonable default
UPDATE users u
SET u.hire_date = (
    SELECT DATE(MIN(te.clock_in))
    FROM time_entries te
    WHERE te.user_id = u.user_id
    AND te.is_deleted = 0
)
WHERE u.is_active = 1
AND EXISTS (
    SELECT 1
    FROM time_entries te
    WHERE te.user_id = u.user_id
    AND te.is_deleted = 0
);

-- Show results
SELECT
    user_id,
    username,
    first_name,
    last_name,
    hire_date,
    is_active
FROM users
ORDER BY hire_date, user_id;
