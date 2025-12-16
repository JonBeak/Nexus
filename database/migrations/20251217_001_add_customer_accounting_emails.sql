-- Migration: Add customer_accounting_emails table
-- Date: 2025-12-17
-- Purpose: Support multiple accounting emails per customer with email type (to/cc/bcc)

CREATE TABLE customer_accounting_emails (
  id INT AUTO_INCREMENT PRIMARY KEY,
  customer_id INT NOT NULL,
  email VARCHAR(255) NOT NULL,
  email_type ENUM('to', 'cc', 'bcc') DEFAULT 'to',
  label VARCHAR(100) NULL,
  is_active BOOLEAN DEFAULT TRUE,
  display_order INT DEFAULT 0,
  notes TEXT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_by INT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  updated_by INT NULL,
  FOREIGN KEY (customer_id) REFERENCES customers(customer_id) ON DELETE CASCADE,
  INDEX idx_customer_active (customer_id, is_active)
);

-- Migrate existing invoice_email data from customers table
INSERT INTO customer_accounting_emails (customer_id, email, email_type, label, created_by)
SELECT customer_id, invoice_email, 'to', 'Primary Accounting', 1
FROM customers
WHERE invoice_email IS NOT NULL AND invoice_email != '';
