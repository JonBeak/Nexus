-- Phase 1.5.b: Order Schema Updates
-- Date: 2025-11-06
-- Purpose: Add fields for Job Details Setup UI and dual-table interface

-- ============================================================================
-- PART 1: Update order_parts table
-- ============================================================================

-- Add new columns to order_parts for Phase 1.5
ALTER TABLE order_parts
  -- Display numbering (1, 1a, 1b, 1c)
  ADD COLUMN display_number VARCHAR(10) AFTER part_number,

  -- Mark first item in each section as parent
  ADD COLUMN is_parent BOOLEAN DEFAULT FALSE AFTER display_number,

  -- Invoice-side data (nullable = acts as "row type")
  ADD COLUMN invoice_description TEXT AFTER specifications,
  ADD COLUMN unit_price DECIMAL(10,2) AFTER invoice_description,
  ADD COLUMN extended_price DECIMAL(10,2) AFTER unit_price,

  -- Add indexes for performance
  ADD INDEX idx_display_number (display_number),
  ADD INDEX idx_is_parent (is_parent);

-- Note: Row "types" are implicit based on nullable columns:
--   - Both specs + invoice data present = "both" type
--   - Only specifications JSON populated = "specs_only" type
--   - Only invoice fields populated = "invoice_only" type
--   - Neither populated = "separator" type (visual divider)

-- ============================================================================
-- PART 2: Update orders table - Status enum
-- ============================================================================

-- Step 1: Add 'job_details_setup' to the enum (keeping 'initiated' temporarily)
ALTER TABLE orders
  MODIFY COLUMN status ENUM(
    'initiated',
    'job_details_setup',              -- NEW NAME
    'pending_confirmation',
    'pending_production_files_creation',
    'pending_production_files_approval',
    'production_queue',
    'in_production',
    'on_hold',
    'overdue',
    'qc_packing',
    'shipping',
    'pick_up',
    'awaiting_payment',
    'completed',
    'cancelled'
  ) DEFAULT 'job_details_setup';

-- Step 2: Update existing records
UPDATE orders
SET status = 'job_details_setup'
WHERE status = 'initiated';

-- Step 3: Remove 'initiated' from the enum
ALTER TABLE orders
  MODIFY COLUMN status ENUM(
    'job_details_setup',              -- NEW NAME (was 'initiated')
    'pending_confirmation',
    'pending_production_files_creation',
    'pending_production_files_approval',
    'production_queue',
    'in_production',
    'on_hold',
    'overdue',
    'qc_packing',
    'shipping',
    'pick_up',
    'awaiting_payment',
    'completed',
    'cancelled'
  ) DEFAULT 'job_details_setup';

-- ============================================================================
-- PART 3: Add order-level fields for Phase 1.5.c (Job Details Setup UI)
-- ============================================================================

ALTER TABLE orders
  -- Customer job tracking
  ADD COLUMN customer_job_number VARCHAR(100) AFTER customer_po,

  -- Hard deadline with time component (optional)
  ADD COLUMN hard_due_date_time DATETIME AFTER due_date,

  -- Notes
  ADD COLUMN manufacturing_note TEXT AFTER production_notes,
  ADD COLUMN internal_note TEXT AFTER manufacturing_note,

  -- Finalization tracking
  ADD COLUMN finalized_at TIMESTAMP NULL AFTER internal_note,
  ADD COLUMN finalized_by INT NULL AFTER finalized_at,
  ADD COLUMN modified_after_finalization BOOLEAN DEFAULT FALSE AFTER finalized_by,

  -- Foreign keys
  ADD CONSTRAINT fk_orders_finalized_by
    FOREIGN KEY (finalized_by) REFERENCES users(user_id)
    ON DELETE SET NULL;

-- ============================================================================
-- PART 4: Update order_tasks table - Remove task_order column
-- ============================================================================

-- Remove task_order column (order now derived from depends_on_task_id chain)
ALTER TABLE order_tasks
  DROP COLUMN task_order;

-- Note: We keep the auto-generated tasks for now. Phase 1.5.a will continue
-- to use the existing task generation from templates.

-- ============================================================================
-- Verification Queries
-- ============================================================================

-- Verify order_parts structure
DESCRIBE order_parts;

-- Verify orders structure
DESCRIBE orders;

-- Verify order_tasks structure
DESCRIBE order_tasks;

-- Check existing orders status
SELECT order_id, order_number, status, created_at
FROM orders
ORDER BY order_id;

-- Check existing order_parts (should see new columns)
SELECT part_id, order_id, part_number, display_number, is_parent,
       product_type, quantity, unit_price, extended_price
FROM order_parts
ORDER BY order_id, part_number;

-- ============================================================================
-- Rollback Script (if needed)
-- ============================================================================

/*
-- ROLLBACK: Reverse all changes

-- Remove new columns from orders
ALTER TABLE orders
  DROP COLUMN customer_job_number,
  DROP COLUMN hard_due_date_time,
  DROP COLUMN manufacturing_note,
  DROP COLUMN internal_note,
  DROP COLUMN finalized_at,
  DROP COLUMN finalized_by,
  DROP COLUMN modified_after_finalization,
  DROP FOREIGN KEY fk_orders_finalized_by;

-- Remove new columns from order_parts
ALTER TABLE order_parts
  DROP INDEX idx_display_number,
  DROP INDEX idx_is_parent,
  DROP COLUMN display_number,
  DROP COLUMN is_parent,
  DROP COLUMN invoice_description,
  DROP COLUMN unit_price,
  DROP COLUMN extended_price;

-- Restore old status enum
ALTER TABLE orders
  MODIFY COLUMN status ENUM(
    'initiated',
    'pending_confirmation',
    'pending_production_files_creation',
    'pending_production_files_approval',
    'production_queue',
    'in_production',
    'on_hold',
    'overdue',
    'qc_packing',
    'shipping',
    'pick_up',
    'awaiting_payment',
    'completed',
    'cancelled'
  ) DEFAULT 'initiated';

UPDATE orders
SET status = 'initiated'
WHERE status = 'job_details_setup';

-- Restore task_order column
ALTER TABLE order_tasks
  ADD COLUMN task_order TINYINT UNSIGNED AFTER task_name;
*/
