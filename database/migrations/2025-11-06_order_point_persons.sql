-- Migration: Add is_primary to customer_contacts and create order_point_persons table
-- Date: 2025-11-06
-- Purpose: Support multiple point persons per order with customer primary contact auto-fill

-- ============================================
-- 1. Add is_primary column to customer_contacts
-- ============================================

ALTER TABLE customer_contacts
ADD COLUMN is_primary BOOLEAN DEFAULT FALSE AFTER contact_role,
ADD INDEX idx_primary (customer_id, is_primary);

-- Note: Multiple contacts per customer can have is_primary = TRUE
-- All primary contacts will auto-fill when creating orders for that customer

-- ============================================
-- 2. Create order_point_persons table
-- ============================================

CREATE TABLE IF NOT EXISTS order_point_persons (
  id INT AUTO_INCREMENT PRIMARY KEY,
  order_id INT NOT NULL,
  contact_id INT NULL COMMENT 'FK to customer_contacts if selected from existing, NULL if custom entry',
  contact_email VARCHAR(255) NOT NULL,
  contact_name VARCHAR(255) NULL COMMENT 'Denormalized for display, especially for custom entries',
  contact_phone VARCHAR(50) NULL,
  contact_role VARCHAR(100) NULL,
  display_order INT DEFAULT 0 COMMENT 'For maintaining UI order',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (order_id) REFERENCES orders(order_id) ON DELETE CASCADE,
  FOREIGN KEY (contact_id) REFERENCES customer_contacts(contact_id) ON DELETE SET NULL,

  INDEX idx_order (order_id),
  INDEX idx_contact (contact_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- 3. Migrate existing point_person_email to new table
-- ============================================

-- For existing orders with point_person_email, create entries in order_point_persons
INSERT INTO order_point_persons (order_id, contact_id, contact_email, contact_name, contact_phone, contact_role, display_order)
SELECT
  o.order_id,
  cc.contact_id,
  o.point_person_email,
  cc.contact_name,
  cc.contact_phone,
  cc.contact_role,
  0 AS display_order
FROM orders o
LEFT JOIN customer_contacts cc ON o.point_person_email = cc.contact_email AND o.customer_id = cc.customer_id
WHERE o.point_person_email IS NOT NULL
  AND o.point_person_email != '';

-- ============================================
-- 4. Verification queries (run manually to check)
-- ============================================

-- Check customer_contacts with is_primary
-- SELECT customer_id, contact_name, contact_email, is_primary FROM customer_contacts WHERE is_primary = TRUE;

-- Check order_point_persons migration
-- SELECT opp.*, o.order_number, o.point_person_email
-- FROM order_point_persons opp
-- JOIN orders o ON opp.order_id = o.order_id
-- LIMIT 10;

-- Note: orders.point_person_email column is kept for backward compatibility
-- Future migration may remove it once all code is migrated
