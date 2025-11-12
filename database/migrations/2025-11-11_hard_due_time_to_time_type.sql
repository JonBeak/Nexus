-- Migration: Change hard_due_date_time from DATETIME to TIME
-- Date: 2025-11-11
-- Purpose: Fix data type for hard_due_date_time since we only store time portion

-- Change column type from DATETIME to TIME
ALTER TABLE orders
  MODIFY COLUMN hard_due_date_time TIME NULL;

-- Note: Existing data will be converted automatically
-- DATETIME '2025-11-21 16:00:00' becomes TIME '16:00:00'
