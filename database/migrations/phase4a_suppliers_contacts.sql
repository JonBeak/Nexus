-- Phase 4.a: Suppliers + Contacts Schema
-- Date: 2025-12-18
-- Description: Extend suppliers table and add supplier_contacts for multi-contact support

-- ============================================
-- STEP 1: Clear placeholder data
-- ============================================
SET FOREIGN_KEY_CHECKS = 0;

-- Clear existing placeholder suppliers
DELETE FROM product_suppliers;
DELETE FROM suppliers;

-- Reset auto-increment
ALTER TABLE suppliers AUTO_INCREMENT = 1;

SET FOREIGN_KEY_CHECKS = 1;

-- ============================================
-- STEP 2: Alter suppliers table
-- ============================================

-- Add new business fields
ALTER TABLE suppliers
  ADD COLUMN payment_terms VARCHAR(50) DEFAULT NULL
    COMMENT 'Net 30, Net 60, COD, Credit Card, etc.' AFTER notes,
  ADD COLUMN default_lead_days INT DEFAULT NULL
    COMMENT 'Typical shipping/fulfillment time in business days' AFTER payment_terms,
  ADD COLUMN account_number VARCHAR(100) DEFAULT NULL
    COMMENT 'Our account number with this supplier' AFTER default_lead_days;

-- Add address fields
ALTER TABLE suppliers
  ADD COLUMN address_line1 VARCHAR(255) DEFAULT NULL AFTER account_number,
  ADD COLUMN address_line2 VARCHAR(255) DEFAULT NULL AFTER address_line1,
  ADD COLUMN city VARCHAR(100) DEFAULT NULL AFTER address_line2,
  ADD COLUMN province VARCHAR(100) DEFAULT NULL AFTER city,
  ADD COLUMN postal_code VARCHAR(20) DEFAULT NULL AFTER province,
  ADD COLUMN country VARCHAR(100) DEFAULT 'Canada' AFTER postal_code;

-- Remove old single-contact fields (contacts now in separate table)
ALTER TABLE suppliers
  DROP COLUMN contact_email,
  DROP COLUMN contact_phone;

-- ============================================
-- STEP 3: Create supplier_contacts table
-- ============================================

CREATE TABLE supplier_contacts (
  contact_id INT AUTO_INCREMENT PRIMARY KEY,
  supplier_id INT NOT NULL,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) DEFAULT NULL,
  phone VARCHAR(50) DEFAULT NULL,
  role ENUM('sales', 'accounts_payable', 'customer_service', 'technical', 'general')
    DEFAULT 'general' COMMENT 'Contact role/department',
  is_primary BOOLEAN DEFAULT FALSE COMMENT 'Primary contact for this supplier',
  notes TEXT DEFAULT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  CONSTRAINT fk_supplier_contacts_supplier
    FOREIGN KEY (supplier_id) REFERENCES suppliers(supplier_id) ON DELETE CASCADE,

  INDEX idx_supplier_contacts_supplier (supplier_id),
  INDEX idx_supplier_contacts_primary (supplier_id, is_primary),
  INDEX idx_supplier_contacts_role (role)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='Multiple contacts per supplier with role assignments';

-- ============================================
-- VERIFICATION
-- ============================================

-- Show updated suppliers structure
-- DESCRIBE suppliers;

-- Show new contacts table
-- DESCRIBE supplier_contacts;

SELECT 'Phase 4.a migration complete: suppliers extended, supplier_contacts created' AS status;
