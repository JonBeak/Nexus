-- Vinyl Application Task Matrix
-- Maps Product Type × Vinyl Application to tasks
-- Similar pattern to painting_task_matrix

-- Create the vinyl application matrix table
CREATE TABLE IF NOT EXISTS vinyl_application_matrix (
  matrix_id INT PRIMARY KEY AUTO_INCREMENT,
  product_type VARCHAR(100) NOT NULL,
  product_type_key VARCHAR(100) NOT NULL,
  application VARCHAR(100) NOT NULL,
  application_key VARCHAR(100) NOT NULL,
  task_names JSON NOT NULL,              -- Array of task name strings
  is_active BOOLEAN DEFAULT TRUE,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  updated_by INT DEFAULT NULL,
  UNIQUE KEY uk_product_application (product_type_key, application_key),
  INDEX idx_product_type (product_type_key),
  INDEX idx_application (application_key),
  INDEX idx_active (is_active)
);

-- Seed with default rules (product_type_key = '_default' means applies to all product types)
-- These mirror the current hard-coded logic in taskRules.ts

INSERT INTO vinyl_application_matrix (product_type, product_type_key, application, application_key, task_names) VALUES
-- Face, Full → Vinyl Face Before Cutting
('Default (All Products)', '_default', 'Face, Full', 'face_full', '["Vinyl Face Before Cutting"]'),

-- Face, White Keyline → Vinyl Plotting + Vinyl Face After Cutting
('Default (All Products)', '_default', 'Face, White Keyline', 'face_white_keyline', '["Vinyl Plotting", "Vinyl Face After Cutting"]'),

-- Face, Custom Cut → Vinyl Plotting + Vinyl Face After Cutting
('Default (All Products)', '_default', 'Face, Custom Cut', 'face_custom_cut', '["Vinyl Plotting", "Vinyl Face After Cutting"]'),

-- Return Wrap → Vinyl Plotting + Vinyl Wrap Return/Trim
('Default (All Products)', '_default', 'Return Wrap', 'return_wrap', '["Vinyl Plotting", "Vinyl Wrap Return/Trim"]'),

-- Trim Wrap → Vinyl Plotting + Vinyl Wrap Return/Trim
('Default (All Products)', '_default', 'Trim Wrap', 'trim_wrap', '["Vinyl Plotting", "Vinyl Wrap Return/Trim"]'),

-- Return & Trim Wrap → Vinyl Plotting + Vinyl Wrap Return/Trim
('Default (All Products)', '_default', 'Return & Trim Wrap', 'return_trim_wrap', '["Vinyl Plotting", "Vinyl Wrap Return/Trim"]')

ON DUPLICATE KEY UPDATE
  task_names = VALUES(task_names),
  updated_at = CURRENT_TIMESTAMP;

-- Note: "Face & Return Wrap" is intentionally NOT seeded - it requires manual input
-- because it's ambiguous whether it needs Face tasks, Wrap tasks, or both
