CREATE TABLE channel_letter_types (
  id INT PRIMARY KEY AUTO_INCREMENT,
  type_name VARCHAR(100) NOT NULL,
  type_code VARCHAR(20) UNIQUE NOT NULL,
  description TEXT,
  
  -- Size constraints (matches Excel logic)
  min_size_inches DECIMAL(5,2) DEFAULT 3.0,
  max_size_inches DECIMAL(5,2) DEFAULT 48.0,
  
  -- Pricing structure (Excel: base rate per inch)
  base_rate_per_inch DECIMAL(8,4) NOT NULL,
  minimum_charge DECIMAL(8,2) DEFAULT 0,
  
  -- Labor factors (Excel: complexity multipliers)
  setup_time_minutes INT DEFAULT 15,
  complexity_multiplier DECIMAL(4,2) DEFAULT 1.0,
  
  -- Excel formula integration
  size_adjustment_rules JSON, -- Stores size adjustment logic (6-7" = 9", etc.)
  calculation_rules JSON, -- Stores Excel formula logic
  
  -- Effective dating
  effective_date DATE NOT NULL,
  expires_date DATE,
  is_active BOOLEAN DEFAULT true,
  
  -- Audit fields (using existing pattern)
  created_by INT,
  updated_by INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  FOREIGN KEY (created_by) REFERENCES users(user_id),
  FOREIGN KEY (updated_by) REFERENCES users(user_id),
  INDEX idx_effective_date (effective_date, expires_date),
  INDEX idx_type_code (type_code),
  INDEX idx_active (is_active)
);