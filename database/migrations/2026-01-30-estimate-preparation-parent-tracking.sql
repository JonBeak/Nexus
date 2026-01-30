-- Migration: Add parent tracking columns to estimate_preparation_items
-- Purpose: Store isParent and estimatePreviewDisplayNumber during preparation
--          so order conversion preserves correct parent/child relationships
-- Date: 2026-01-30

ALTER TABLE estimate_preparation_items
ADD COLUMN is_parent TINYINT(1) DEFAULT NULL
  COMMENT 'TRUE for parent items ("1", "2"), FALSE for sub-items ("1a", "1b"). NULL for legacy items.',
ADD COLUMN estimate_preview_display_number VARCHAR(10) DEFAULT NULL
  COMMENT 'Display number from estimate preview (e.g., "1", "1a", "2", "2a")';

-- Note: Existing rows will have NULL values for these columns
-- Legacy estimates will continue to work with fallback logic in frontend
-- Re-preparing an old estimate will populate the new columns
