-- Migration: Add estimate_form_path to order_form_versions table
-- Date: 2025-11-17
-- Purpose: Support Estimate Form PDF generation alongside existing order forms

-- Add estimate_form_path column after master_form_path
ALTER TABLE order_form_versions
ADD COLUMN estimate_form_path VARCHAR(500)
COMMENT 'Path to estimate PDF (saved in order folder root alongside master form)'
AFTER master_form_path;

-- Verify column was added
SELECT 'Migration completed: estimate_form_path column added to order_form_versions' as status;
