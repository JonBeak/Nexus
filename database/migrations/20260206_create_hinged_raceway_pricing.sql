-- Hinged raceway pricing - category-based lookup table
-- Each row is a max-width category with a fixed price

CREATE TABLE IF NOT EXISTS hinged_raceway_pricing (
  id INT AUTO_INCREMENT PRIMARY KEY,
  category_max_width DECIMAL(10,2) NOT NULL,
  price DECIMAL(12,4) NOT NULL,
  config_description VARCHAR(255) DEFAULT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_raceway_category (category_max_width)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Seed with current values
INSERT INTO hinged_raceway_pricing (category_max_width, price, config_description) VALUES
  (59.5, 190.0000, 'Hinged raceway ≤ 59.5"'),
  (119.5, 305.0000, 'Hinged raceway ≤ 119.5"'),
  (179.5, 420.0000, 'Hinged raceway ≤ 179.5"'),
  (239.5, 570.0000, 'Hinged raceway ≤ 239.5"'),
  (299.5, 685.0000, 'Hinged raceway ≤ 299.5"');
