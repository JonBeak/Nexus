-- Migration: Add cancelled and hold folder locations
-- Date: 2026-01-19
-- Purpose: Expand folder_location ENUM to support 1Cancelled and 1Hold folders

-- Expand folder_location ENUM to include 'cancelled' and 'hold' values
ALTER TABLE orders
  MODIFY COLUMN folder_location ENUM('active', 'finished', 'none', 'cancelled', 'hold')
  DEFAULT 'none'
  COMMENT 'Location of folder: active (Orders), finished (1Finished), cancelled (1Cancelled), hold (1Hold), or none';

-- Verify the change
-- DESCRIBE orders;
-- SHOW COLUMNS FROM orders LIKE 'folder_location';
