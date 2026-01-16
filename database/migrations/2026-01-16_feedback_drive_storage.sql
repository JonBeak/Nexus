-- Migration: Switch feedback screenshots from base64 database storage to Google Drive
-- Date: 2026-01-16
-- Purpose: Store screenshot_drive_id instead of screenshot_data (LONGTEXT)

-- Step 1: Add new column for Drive file ID
ALTER TABLE feedback_requests
ADD COLUMN screenshot_drive_id VARCHAR(255) DEFAULT NULL AFTER priority;

-- Step 2: Drop old base64 columns (screenshot_data is huge, this saves space)
-- Note: Any existing screenshots will be lost. Run this only after confirming no critical data.
ALTER TABLE feedback_requests
DROP COLUMN screenshot_data;

-- Keep filename and mime_type for serving the file with correct headers
-- screenshot_filename and screenshot_mime_type remain unchanged
