-- Test vinyl table creation
CREATE TABLE vinyl_types_pricing (
  id INT PRIMARY KEY AUTO_INCREMENT,
  vinyl_type VARCHAR(100) NOT NULL,
  vinyl_code VARCHAR(20) UNIQUE NOT NULL,
  description TEXT,
  
  -- Excel pricing structure
  base_price_per_sqft DECIMAL(8,4) NOT NULL,
  application_fee DECIMAL(8,2) DEFAULT 0.00,
  setup_charge DECIMAL(8,2) DEFAULT 0.00,
  minimum_charge DECIMAL(8,2) DEFAULT 0.00,
  
  -- Excel formula integration  
  size_rules JSON, -- Stores size calculation logic
  application_rules JSON, -- Application method pricing
  
  -- Effective dating
  effective_date DATE NOT NULL,
  expires_date DATE,
  is_active BOOLEAN DEFAULT true,
  
  -- Audit fields
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  INDEX idx_effective_date (effective_date, expires_date),
  INDEX idx_vinyl_code (vinyl_code),
  INDEX idx_active (is_active)
);

-- Test insert
INSERT INTO vinyl_types_pricing (vinyl_type, vinyl_code, base_price_per_sqft, effective_date) VALUES
('Standard Cut Vinyl', 'VIN_STD', 2.50, CURDATE());