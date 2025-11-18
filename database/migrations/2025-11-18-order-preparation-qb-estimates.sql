-- Phase 1.5.c.6.1: Order Preparation - QuickBooks Estimate Tracking
-- Created: 2025-11-18
-- Purpose: Track QB estimates created for orders with staleness detection

-- QuickBooks Estimate History Table
-- Tracks all QB estimates created for orders with version history
CREATE TABLE IF NOT EXISTS order_qb_estimates (
  id INT PRIMARY KEY AUTO_INCREMENT,
  order_id INT NOT NULL,
  qb_estimate_id VARCHAR(50) NOT NULL COMMENT 'QuickBooks estimate ID',
  qb_estimate_number VARCHAR(50) NOT NULL COMMENT 'QB estimate document number (e.g., EST-12345)',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  created_by INT DEFAULT NULL COMMENT 'User who created the estimate',
  is_current BOOLEAN DEFAULT TRUE COMMENT 'TRUE for most recent estimate, FALSE for superseded versions',
  estimate_data_hash VARCHAR(64) NOT NULL COMMENT 'SHA256 hash of order parts for staleness detection',
  qb_estimate_url VARCHAR(500) COMMENT 'QuickBooks estimate URL (optional)',

  FOREIGN KEY (order_id) REFERENCES orders(order_id) ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES users(user_id) ON DELETE SET NULL,
  INDEX idx_order_current (order_id, is_current),
  INDEX idx_qb_estimate (qb_estimate_id),
  INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='Tracks QuickBooks estimates created for orders with version history and staleness detection';
