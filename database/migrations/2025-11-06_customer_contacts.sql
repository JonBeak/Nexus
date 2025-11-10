-- Phase 1.5.a.5: Customer Contacts Table Migration
-- Created: 2025-11-06
-- Purpose: Support multiple contacts per customer for order creation

-- ============================================================================
-- CREATE customer_contacts TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS customer_contacts (
  contact_id INT AUTO_INCREMENT PRIMARY KEY,
  customer_id INT NOT NULL,
  contact_name VARCHAR(255) NOT NULL,
  contact_email VARCHAR(255) NOT NULL,
  contact_phone VARCHAR(50),
  contact_role VARCHAR(100) COMMENT 'e.g., Project Manager, Owner, Foreman, Admin',
  is_active BOOLEAN DEFAULT TRUE,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_by INT,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  updated_by INT,

  FOREIGN KEY (customer_id) REFERENCES customers(customer_id) ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES users(user_id) ON DELETE SET NULL,
  FOREIGN KEY (updated_by) REFERENCES users(user_id) ON DELETE SET NULL,

  INDEX idx_customer (customer_id),
  INDEX idx_email (contact_email),
  INDEX idx_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- SEED SAMPLE DATA (First 5 Customers)
-- ============================================================================

-- Migrate existing customer primary contact data to customer_contacts table
INSERT INTO customer_contacts (
  customer_id,
  contact_name,
  contact_email,
  contact_phone,
  contact_role,
  created_by
)
SELECT
  c.customer_id,
  CONCAT(c.contact_first_name, ' ', c.contact_last_name) AS contact_name,
  c.email AS contact_email,
  c.phone AS contact_phone,
  'Primary Contact' AS contact_role,
  1 AS created_by
FROM customers c
WHERE c.customer_id <= 5
  AND c.email IS NOT NULL
  AND c.email != ''
  AND NOT EXISTS (
    SELECT 1 FROM customer_contacts cc
    WHERE cc.customer_id = c.customer_id
      AND cc.contact_email = c.email
  );

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================

-- Check table structure
SELECT 'Table Structure:' AS info;
DESCRIBE customer_contacts;

-- Check sample data
SELECT 'Sample Data (First 5):' AS info;
SELECT
  contact_id,
  customer_id,
  contact_name,
  contact_email,
  contact_role,
  is_active
FROM customer_contacts
ORDER BY customer_id
LIMIT 5;

-- Count contacts per customer
SELECT 'Contacts Per Customer:' AS info;
SELECT
  customer_id,
  COUNT(*) AS contact_count
FROM customer_contacts
WHERE is_active = TRUE
GROUP BY customer_id
ORDER BY customer_id
LIMIT 5;

SELECT '✅ Migration completed successfully!' AS status;
