-- LED Neon Pricing - Solder Structure Migration
-- Replaces complex led_neon_pricing table with simple solder pricing
-- Date: 2025-10-16

-- Drop existing table and create new simplified structure
DROP TABLE IF EXISTS led_neon_pricing;

CREATE TABLE led_neon_pricing (
  id INT NOT NULL AUTO_INCREMENT,
  solder_type VARCHAR(50) NOT NULL,
  price DECIMAL(8,2) NOT NULL,
  is_active TINYINT(1) DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY unique_solder_type (solder_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Insert solder pricing data
INSERT INTO led_neon_pricing (solder_type, price, is_active) VALUES
('Clear', 14.00, 1),
('Opaque', 7.00, 1);
