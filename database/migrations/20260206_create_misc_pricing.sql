-- Create misc_pricing table for miscellaneous pricing constants
-- Key-value style (same pattern as blade_sign_pricing)
-- Holds angle, assembly, and mounting pricing constants

CREATE TABLE IF NOT EXISTS misc_pricing (
  id INT AUTO_INCREMENT PRIMARY KEY,
  config_name VARCHAR(100) NOT NULL,
  config_value DECIMAL(12,4) NOT NULL,
  config_description VARCHAR(255) DEFAULT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_misc_config_name (config_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Seed with current hardcoded values

-- Aluminum backer angle/assembly constants
INSERT INTO misc_pricing (config_name, config_value, config_description) VALUES
  ('alum_angle_cost', 50.0000, '1.25" Angle cost per 240" linear'),
  ('alum_assembly_cost', 50.0000, 'Aluminum assembly cost per 240" linear'),
  ('alum_mounting_angle_cost', 50.0000, 'Aluminum mounting angle cost per 240" linear'),
  ('alum_per_angle_cut', 25.0000, 'Per angle cut fee (aluminum)'),
  ('angle_linear_divisor', 240.0000, 'Linear inches divisor for angle cost calculation');

-- ACM backer angle/assembly constants
INSERT INTO misc_pricing (config_name, config_value, config_description) VALUES
  ('acm_angle_cost', 75.0000, '2" Angle cost per 240" linear'),
  ('acm_assembly_cost', 100.0000, 'ACM assembly + VHB tape cost per 240" linear'),
  ('acm_mounting_angle_cost', 50.0000, 'ACM mounting angle cost per 240" linear'),
  ('acm_per_length_cut', 25.0000, 'Per length cut fee (ACM)');
