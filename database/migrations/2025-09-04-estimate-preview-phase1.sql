-- Migration: Estimate Preview System Phase 1
-- Date: 2025-09-04
-- Purpose: Add new item types and QTY field for flexible estimate preview system
-- Requirements: Based on estimate-preview-requirements.md

-- =============================================
-- STEP 1: EXTEND ITEM_TYPE ENUM WITH NEW TYPES
-- =============================================

-- Add new item types for estimate preview system
ALTER TABLE job_estimate_items 
MODIFY COLUMN item_type ENUM(
  'product', 'assembly', 'assembly_fee', 'sub_item', 'empty', 
  'custom', 'note', 'divider', 'subtotal', 'discount', 'multiplier', 'text'
) DEFAULT 'product';

-- =============================================
-- STEP 2: ADD NEW FIELDS FOR ESTIMATE PREVIEW SYSTEM
-- =============================================

-- Add qty field (separate from 12-column calculations)
ALTER TABLE job_estimate_items
ADD COLUMN qty INT DEFAULT 1 COMMENT 'Line quantity separate from base_quantity' AFTER base_quantity;

-- Add multiplier configuration fields
ALTER TABLE job_estimate_items
ADD COLUMN multiplier_value DECIMAL(10,4) NULL COMMENT 'Multiplier value to apply' AFTER qty,
ADD COLUMN multiplier_target_lines TEXT NULL COMMENT 'Target line format: "1-10" | "1,2,3,6" | "all_above"' AFTER multiplier_value;

-- Add discount configuration fields  
ALTER TABLE job_estimate_items
ADD COLUMN discount_percentage DECIMAL(5,2) NULL COMMENT 'Discount percentage (0-100)' AFTER multiplier_target_lines,
ADD COLUMN discount_flat_amount DECIMAL(10,2) NULL COMMENT 'Flat discount amount' AFTER discount_percentage,
ADD COLUMN discount_target_lines TEXT NULL COMMENT 'Same format as multiplier_target_lines' AFTER discount_flat_amount;

-- Add assembly configuration
ALTER TABLE job_estimate_items
ADD COLUMN assembly_start_line INT NULL COMMENT 'Line ID where assembly begins' AFTER discount_target_lines;

-- Add text content for text lines
ALTER TABLE job_estimate_items
ADD COLUMN text_content TEXT NULL COMMENT 'Content for text/note/section header lines' AFTER assembly_start_line;

-- =============================================
-- STEP 3: ADD INDEXES FOR PERFORMANCE
-- =============================================

-- Add indexes for new fields that will be queried
ALTER TABLE job_estimate_items
ADD INDEX idx_qty (qty),
ADD INDEX idx_item_type_enhanced (item_type, estimate_id);

-- =============================================
-- STEP 4: VALIDATION CONSTRAINTS
-- =============================================

-- Add constraints for data integrity
ALTER TABLE job_estimate_items
ADD CONSTRAINT chk_multiplier_value_positive CHECK (multiplier_value IS NULL OR multiplier_value > 0),
ADD CONSTRAINT chk_discount_percentage_range CHECK (discount_percentage IS NULL OR (discount_percentage >= 0 AND discount_percentage <= 100)),
ADD CONSTRAINT chk_discount_flat_amount_range CHECK (discount_flat_amount IS NULL OR discount_flat_amount >= 0),
ADD CONSTRAINT chk_qty_positive CHECK (qty > 0);

-- =============================================
-- STEP 5: VERIFICATION
-- =============================================

-- Verify migration structure
SELECT 'Phase 1 estimate preview migration completed successfully' as status;

-- Show updated table structure for verification
DESCRIBE job_estimate_items;

-- Show new item type options
SHOW COLUMNS FROM job_estimate_items WHERE Field = 'item_type';

-- Record migration in system log
INSERT INTO system_logs (action, description, created_at) 
VALUES ('MIGRATION', 'Phase 1: Added estimate preview item types and QTY field', NOW());