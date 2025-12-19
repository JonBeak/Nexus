-- Phase 4.c: Create supplier_product_pricing_history table
-- Purpose: Time-series price tracking with effective dates for full history preservation
-- Created: 2025-12-19

CREATE TABLE IF NOT EXISTS supplier_product_pricing_history (
  pricing_id INT AUTO_INCREMENT PRIMARY KEY COMMENT 'Unique identifier for this price entry',

  supplier_product_id INT NOT NULL COMMENT 'FK to supplier_products',

  -- Price Information
  unit_price DECIMAL(10,4) NOT NULL COMMENT 'Price per unit_of_measure',
  cost_currency VARCHAR(3) DEFAULT 'CAD' COMMENT 'Currency code: CAD, USD, etc.',

  -- Effective Dates
  effective_start_date DATE NOT NULL COMMENT 'Date when this price became active',
  effective_end_date DATE DEFAULT NULL COMMENT 'Date when price expired (NULL = current price)',

  -- Change Tracking
  price_change_percent DECIMAL(10,2) DEFAULT NULL COMMENT 'Percentage change from previous price',
  notes TEXT DEFAULT NULL COMMENT 'Reason for price change',

  -- Audit Trail
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT 'When this price was recorded',
  created_by INT DEFAULT NULL COMMENT 'User who recorded this price',

  -- Indexes for query optimization
  INDEX idx_supplier_product (supplier_product_id),
  INDEX idx_effective_dates (effective_start_date, effective_end_date),
  INDEX idx_current_prices (supplier_product_id, effective_end_date),

  -- Foreign Keys
  CONSTRAINT fk_pricing_supplier_product
    FOREIGN KEY (supplier_product_id) REFERENCES supplier_products(supplier_product_id)
    ON DELETE CASCADE
    ON UPDATE CASCADE,

  CONSTRAINT fk_pricing_created_by
    FOREIGN KEY (created_by) REFERENCES users(user_id)
    ON DELETE SET NULL

) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='Time-series pricing history for supplier products - current price has effective_end_date = NULL';
