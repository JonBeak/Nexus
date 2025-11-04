-- =============================================
-- Migration: Orders System - Phase 1 Database Foundation
-- Version: 1.0.0
-- Date: 2025-11-03
-- Description: Creates all tables for Orders system Phase 1
-- Dependencies: job_estimates, customers, users, channel_letter_types, product_types
-- =============================================

START TRANSACTION;

-- =============================================
-- 1. CREATE ORDERS TABLE
-- =============================================
-- Core table for order records with sequential numbering starting at 200000

CREATE TABLE orders (
  order_id INT AUTO_INCREMENT PRIMARY KEY,
  order_number INT NOT NULL UNIQUE COMMENT 'Sequential starting at 200000',
  version_number INT DEFAULT 1 COMMENT 'Order version for tracking major changes',
  order_name VARCHAR(255) NOT NULL,
  estimate_id INT,
  customer_id INT NOT NULL,
  customer_po VARCHAR(100),
  point_person_email VARCHAR(255),
  order_date DATE NOT NULL,
  due_date DATE,
  production_notes TEXT,
  sign_image_path VARCHAR(500),
  form_version TINYINT UNSIGNED DEFAULT 1,
  shipping_required BOOLEAN DEFAULT false,
  status ENUM(
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
  ) DEFAULT 'initiated',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  created_by INT,
  FOREIGN KEY (estimate_id) REFERENCES job_estimates(id) ON DELETE SET NULL,
  FOREIGN KEY (customer_id) REFERENCES customers(customer_id) ON DELETE RESTRICT,
  FOREIGN KEY (created_by) REFERENCES users(user_id) ON DELETE SET NULL,
  INDEX idx_order_number (order_number),
  INDEX idx_customer (customer_id),
  INDEX idx_status (status),
  INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Set AUTO_INCREMENT to start at 200000
ALTER TABLE orders AUTO_INCREMENT = 200000;

-- =============================================
-- 2. CREATE ORDER_PARTS TABLE
-- =============================================
-- Parts/components of each order with dual product_type approach

CREATE TABLE order_parts (
  part_id INT AUTO_INCREMENT PRIMARY KEY,
  order_id INT NOT NULL,
  part_number TINYINT UNSIGNED NOT NULL,

  -- Dual-field approach for product types
  product_type VARCHAR(100) NOT NULL COMMENT 'Human-readable: "Channel Letter - 3\" Front Lit"',
  product_type_id VARCHAR(100) NOT NULL COMMENT 'Machine-readable: "channel_letters_3_front_lit"',

  -- Source references (one should be populated)
  channel_letter_type_id INT COMMENT 'FK to channel_letter_types if applicable',
  base_product_type_id INT COMMENT 'FK to product_types if not channel letter',

  quantity DECIMAL(10,2) NOT NULL,
  specifications JSON,
  production_notes TEXT,
  FOREIGN KEY (order_id) REFERENCES orders(order_id) ON DELETE CASCADE,
  FOREIGN KEY (channel_letter_type_id) REFERENCES channel_letter_types(id) ON DELETE SET NULL,
  FOREIGN KEY (base_product_type_id) REFERENCES product_types(id) ON DELETE SET NULL,
  INDEX idx_order (order_id),
  INDEX idx_product_type (product_type_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================
-- 3. CREATE ORDER_TASKS TABLE
-- =============================================
-- Role-based tasks for production tracking

CREATE TABLE order_tasks (
  task_id INT AUTO_INCREMENT PRIMARY KEY,
  order_id INT NOT NULL,
  part_id INT COMMENT 'NULL for order-level tasks',
  task_name VARCHAR(255) NOT NULL,
  task_order TINYINT UNSIGNED NOT NULL,
  completed BOOLEAN DEFAULT false,
  completed_at TIMESTAMP NULL,
  completed_by INT,
  FOREIGN KEY (order_id) REFERENCES orders(order_id) ON DELETE CASCADE,
  FOREIGN KEY (part_id) REFERENCES order_parts(part_id) ON DELETE CASCADE,
  FOREIGN KEY (completed_by) REFERENCES users(user_id) ON DELETE SET NULL,
  INDEX idx_order (order_id),
  INDEX idx_part (part_id),
  INDEX idx_completed (completed)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================
-- 4. CREATE ORDER_FORM_VERSIONS TABLE
-- =============================================
-- Tracks PDF form versions for each order

CREATE TABLE order_form_versions (
  version_id INT AUTO_INCREMENT PRIMARY KEY,
  order_id INT NOT NULL,
  version_number TINYINT UNSIGNED NOT NULL,
  master_form_path VARCHAR(500),
  shop_form_path VARCHAR(500),
  customer_form_path VARCHAR(500),
  packing_list_path VARCHAR(500),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_by INT,
  FOREIGN KEY (order_id) REFERENCES orders(order_id) ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES users(user_id) ON DELETE SET NULL,
  UNIQUE KEY unique_version (order_id, version_number)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================
-- 5. CREATE ORDER_STATUS_HISTORY TABLE
-- =============================================
-- Audit trail for status changes

CREATE TABLE order_status_history (
  history_id INT AUTO_INCREMENT PRIMARY KEY,
  order_id INT NOT NULL,
  status VARCHAR(50) NOT NULL,
  changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  changed_by INT,
  notes TEXT,
  FOREIGN KEY (order_id) REFERENCES orders(order_id) ON DELETE CASCADE,
  FOREIGN KEY (changed_by) REFERENCES users(user_id) ON DELETE SET NULL,
  INDEX idx_order (order_id),
  INDEX idx_changed_at (changed_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================
-- 6. MODIFY USERS TABLE
-- =============================================
-- Add production_roles JSON column for Phase 1 Orders system

ALTER TABLE users
ADD COLUMN production_roles JSON
COMMENT 'Array of production roles: ["designer", "vinyl_cnc", "painting", "cut_bend", "leds", "packing"]';

-- =============================================
-- 7. VERIFICATION TEST - ORDER NUMBERING
-- =============================================
-- Test that order_id AUTO_INCREMENT starts at 200000
-- Note: order_number will be set by application layer in Phase 1.b
-- For this test, we manually set order_number = order_id to verify AUTO_INCREMENT

INSERT INTO orders (order_number, order_name, customer_id, order_date, created_by)
VALUES (200000, 'TEST_ORDER_NUMBERING_VERIFICATION', 1, CURDATE(), 1);

-- Verify order_id = 200000 (AUTO_INCREMENT working)
SELECT
  order_id,
  order_number,
  order_name,
  CASE
    WHEN order_id = 200000 THEN '✓ AUTO_INCREMENT VERIFIED: order_id starting at 200000'
    ELSE '✗ ERROR: order_id is not 200000'
  END AS verification_status
FROM orders
WHERE order_name = 'TEST_ORDER_NUMBERING_VERIFICATION';

-- Clean up test order
DELETE FROM orders WHERE order_name = 'TEST_ORDER_NUMBERING_VERIFICATION';

-- Reset AUTO_INCREMENT back to 200000 after test deletion
ALTER TABLE orders AUTO_INCREMENT = 200000;

COMMIT;

-- =============================================
-- MIGRATION COMPLETE
-- =============================================

-- Verification Queries (run these after migration):
-- 1. Verify all tables created:
--    SHOW TABLES LIKE 'order%';
--
-- 2. Verify foreign key constraints:
--    SELECT TABLE_NAME, COLUMN_NAME, CONSTRAINT_NAME, REFERENCED_TABLE_NAME, REFERENCED_COLUMN_NAME
--    FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
--    WHERE TABLE_SCHEMA = 'sign_manufacturing'
--      AND TABLE_NAME LIKE 'order%'
--      AND REFERENCED_TABLE_NAME IS NOT NULL;
--
-- 3. Verify indexes:
--    SHOW INDEX FROM orders;
--    SHOW INDEX FROM order_parts;
--    SHOW INDEX FROM order_tasks;
--
-- 4. Verify ENUM constraint:
--    SHOW CREATE TABLE orders;
--
-- 5. Verify production_roles column:
--    DESCRIBE users;

-- =============================================
-- ROLLBACK SCRIPT (if needed)
-- =============================================
-- START TRANSACTION;
-- DROP TABLE IF EXISTS order_status_history;
-- DROP TABLE IF EXISTS order_form_versions;
-- DROP TABLE IF EXISTS order_tasks;
-- DROP TABLE IF EXISTS order_parts;
-- DROP TABLE IF EXISTS orders;
-- ALTER TABLE users DROP COLUMN IF EXISTS production_roles;
-- COMMIT;
