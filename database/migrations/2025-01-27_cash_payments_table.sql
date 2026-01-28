-- Cash Payments Table for Cash Job Workflow
-- Created: 2025-01-27
-- Description: Track internal payments (cash, e-transfer, check) for cash job orders

-- ============================================
-- 1. Create cash_payments table
-- ============================================

CREATE TABLE cash_payments (
  payment_id INT NOT NULL AUTO_INCREMENT,
  order_id INT NOT NULL,
  amount DECIMAL(15,2) NOT NULL,
  payment_method ENUM('cash', 'e_transfer', 'check') NOT NULL,
  payment_date DATE NOT NULL,
  reference_number VARCHAR(100) DEFAULT NULL COMMENT 'Check number, e-transfer reference, etc.',
  memo VARCHAR(500) DEFAULT NULL,
  created_by INT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

  PRIMARY KEY (payment_id),
  INDEX idx_cash_payments_order (order_id),
  INDEX idx_cash_payments_date (payment_date),
  INDEX idx_cash_payments_created_by (created_by),

  CONSTRAINT fk_cash_payments_order
    FOREIGN KEY (order_id) REFERENCES orders(order_id) ON DELETE CASCADE,
  CONSTRAINT fk_cash_payments_user
    FOREIGN KEY (created_by) REFERENCES users(user_id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='Cash/E-transfer/Check payments for cash job orders';

-- ============================================
-- Verification queries (run manually)
-- ============================================
-- DESCRIBE cash_payments;
-- SHOW CREATE TABLE cash_payments;
