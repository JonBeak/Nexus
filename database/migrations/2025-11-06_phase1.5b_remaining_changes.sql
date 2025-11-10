-- Phase 1.5.b: Remaining Schema Updates
-- Date: 2025-11-06
-- Purpose: Complete the schema updates (order_parts already done)

-- ============================================================================
-- PART 1: Update orders table - Status enum
-- ============================================================================

-- Step 1: Add 'job_details_setup' to the enum (keeping 'initiated' temporarily)
ALTER TABLE orders
  MODIFY COLUMN status ENUM(
    'initiated',
    'job_details_setup',
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
    'job_details_setup',
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
-- PART 2: Add order-level fields for Phase 1.5.c
-- ============================================================================

ALTER TABLE orders
  ADD COLUMN customer_job_number VARCHAR(100) AFTER customer_po,
  ADD COLUMN hard_due_date_time DATETIME AFTER due_date,
  ADD COLUMN manufacturing_note TEXT AFTER production_notes,
  ADD COLUMN internal_note TEXT AFTER manufacturing_note,
  ADD COLUMN finalized_at TIMESTAMP NULL AFTER internal_note,
  ADD COLUMN finalized_by INT NULL AFTER finalized_at,
  ADD COLUMN modified_after_finalization BOOLEAN DEFAULT FALSE AFTER finalized_by;

-- Add foreign key constraint
ALTER TABLE orders
  ADD CONSTRAINT fk_orders_finalized_by
    FOREIGN KEY (finalized_by) REFERENCES users(user_id)
    ON DELETE SET NULL;

-- ============================================================================
-- PART 3: Update order_tasks table
-- ============================================================================

-- Remove task_order column (order derived from depends_on_task_id chain)
ALTER TABLE order_tasks
  DROP COLUMN task_order;

-- ============================================================================
-- Verification
-- ============================================================================

SELECT 'Orders status enum updated:' as status;
SHOW COLUMNS FROM orders LIKE 'status';

SELECT 'Orders new columns:' as status;
DESCRIBE orders;

SELECT 'Order tasks (task_order removed):' as status;
DESCRIBE order_tasks;

SELECT 'Current order status:' as status;
SELECT order_id, order_number, status FROM orders;
