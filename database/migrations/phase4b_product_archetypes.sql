-- Phase 4.b: Product Archetypes Schema
-- Date: 2025-12-18
-- Description: Product archetypes - our canonical material definitions for BOMs
-- Data model: product_archetypes (our definitions) -> supplier_products (their offerings) -> pricing_history

-- ============================================
-- CREATE product_archetypes TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS product_archetypes (
  archetype_id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL COMMENT 'Canonical name: "0.5\" Black Acrylic", "3/4W White LED Module"',
  category ENUM(
    'led',
    'transformer',
    'substrate',      -- Acrylic, aluminum, PVC, etc.
    'hardware',       -- Standoffs, J-channel, mounting hardware
    'paint',
    'vinyl',          -- Note: existing vinyl_products system remains separate
    'trim_cap',
    'electrical',     -- Wire, connectors, etc.
    'misc'
  ) NOT NULL,
  subcategory VARCHAR(100) DEFAULT NULL COMMENT 'Optional: acrylic, aluminum, pvc for substrates',
  unit_of_measure VARCHAR(50) NOT NULL COMMENT 'each, linear_ft, sq_ft, sheet, roll, gallon, lb',
  specifications JSON DEFAULT NULL COMMENT 'Flexible specs: { thickness: "0.5\"", color: "black", wattage: "0.75W" }',
  description TEXT DEFAULT NULL COMMENT 'Longer description if needed',
  reorder_point INT DEFAULT 0 COMMENT 'Alert when stock falls below this',
  safety_stock INT DEFAULT 0 COMMENT 'Minimum stock to maintain',
  default_lead_days INT DEFAULT NULL COMMENT 'Expected lead time if not specified by supplier',
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  created_by INT DEFAULT NULL,
  updated_by INT DEFAULT NULL,

  UNIQUE KEY uk_archetype_name (name),
  INDEX idx_archetype_category (category),
  INDEX idx_archetype_subcategory (subcategory),
  INDEX idx_archetype_active (is_active),
  INDEX idx_archetype_category_active (category, is_active),

  CONSTRAINT fk_archetype_created_by FOREIGN KEY (created_by) REFERENCES users(user_id) ON DELETE SET NULL,
  CONSTRAINT fk_archetype_updated_by FOREIGN KEY (updated_by) REFERENCES users(user_id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='Product archetypes - our canonical material definitions for BOMs';

-- ============================================
-- SAMPLE DATA FOR TESTING
-- ============================================

-- LEDs
INSERT INTO product_archetypes (name, category, unit_of_measure, specifications, description) VALUES
('0.72W White LED Module', 'led', 'each', '{"wattage": 0.72, "color_temp": "6500K", "voltage": "12V", "lens": "160deg"}', 'Standard white LED module for channel letters'),
('0.72W RGB LED Module', 'led', 'each', '{"wattage": 0.72, "type": "RGB", "voltage": "12V", "lens": "160deg"}', 'RGB LED module for color-changing signs'),
('1.5W White LED Module', 'led', 'each', '{"wattage": 1.5, "color_temp": "6500K", "voltage": "12V"}', 'High-output LED module for deep signs');

-- Substrates
INSERT INTO product_archetypes (name, category, subcategory, unit_of_measure, specifications, description) VALUES
('3mm White Acrylic', 'substrate', 'acrylic', 'sheet', '{"thickness": "3mm", "color": "white", "sheet_size": "4x8 ft", "finish": "glossy"}', 'Standard white acrylic for face panels'),
('6mm Black Acrylic', 'substrate', 'acrylic', 'sheet', '{"thickness": "6mm", "color": "black", "sheet_size": "4x8 ft", "finish": "matte"}', 'Black acrylic for halo-lit letters'),
('0.040 in White Aluminum', 'substrate', 'aluminum', 'sheet', '{"thickness": "0.040 in", "color": "white", "sheet_size": "4x8 ft"}', 'Standard aluminum for sign backs'),
('0.063 in White Aluminum', 'substrate', 'aluminum', 'sheet', '{"thickness": "0.063 in", "color": "white", "sheet_size": "4x8 ft"}', 'Heavy-duty aluminum for large signs'),
('3mm White PVC', 'substrate', 'pvc', 'sheet', '{"thickness": "3mm", "color": "white", "sheet_size": "4x8 ft"}', 'PVC for indoor signage');

-- Transformers / Power Supplies
INSERT INTO product_archetypes (name, category, unit_of_measure, specifications, description) VALUES
('100W 12V LED Driver', 'transformer', 'each', '{"wattage": 100, "input": "120V AC", "output": "12V DC", "efficiency": "90%"}', '100W LED power supply'),
('200W 12V LED Driver', 'transformer', 'each', '{"wattage": 200, "input": "120V AC", "output": "12V DC", "efficiency": "90%"}', '200W LED power supply'),
('350W 12V LED Driver', 'transformer', 'each', '{"wattage": 350, "input": "120V AC", "output": "12V DC", "efficiency": "92%"}', 'High-capacity LED power supply');

-- Hardware
INSERT INTO product_archetypes (name, category, subcategory, unit_of_measure, specifications, description) VALUES
('1 in Aluminum Standoff', 'hardware', 'standoff', 'each', '{"material": "aluminum", "length": "1 in", "finish": "brushed", "thread": "1/4-20"}', 'Standard standoff for wall mounting'),
('2 in Aluminum Standoff', 'hardware', 'standoff', 'each', '{"material": "aluminum", "length": "2 in", "finish": "brushed", "thread": "1/4-20"}', 'Extended standoff for wall mounting'),
('Flat J-Channel 1 in', 'hardware', 'j-channel', 'linear_ft', '{"material": "aluminum", "width": "1 in", "type": "flat", "finish": "mill"}', 'J-channel for sign trim'),
('Flat J-Channel 1.5 in', 'hardware', 'j-channel', 'linear_ft', '{"material": "aluminum", "width": "1.5 in", "type": "flat", "finish": "mill"}', 'Wide J-channel for sign trim');

-- Trim Cap
INSERT INTO product_archetypes (name, category, unit_of_measure, specifications, description) VALUES
('1 in Black Trim Cap', 'trim_cap', 'roll', '{"width": "1 in", "color": "black", "roll_length": "100ft"}', 'Black plastic trim cap'),
('1 in White Trim Cap', 'trim_cap', 'roll', '{"width": "1 in", "color": "white", "roll_length": "100ft"}', 'White plastic trim cap'),
('3/4 in Black Trim Cap', 'trim_cap', 'roll', '{"width": "0.75 in", "color": "black", "roll_length": "100ft"}', 'Narrow black trim cap');

-- Electrical
INSERT INTO product_archetypes (name, category, subcategory, unit_of_measure, specifications, description) VALUES
('18 AWG Red Wire', 'electrical', 'wire', 'linear_ft', '{"gauge": "18 AWG", "color": "red", "type": "stranded"}', 'Standard hookup wire - positive'),
('18 AWG Black Wire', 'electrical', 'wire', 'linear_ft', '{"gauge": "18 AWG", "color": "black", "type": "stranded"}', 'Standard hookup wire - negative'),
('2-Pin Waterproof Connector', 'electrical', 'connector', 'each', '{"pins": 2, "rating": "IP65", "wire_gauge": "18-22 AWG"}', 'Waterproof LED connector');

-- Paint
INSERT INTO product_archetypes (name, category, unit_of_measure, specifications, description) VALUES
('White Sign Enamel', 'paint', 'gallon', '{"type": "enamel", "color": "white", "finish": "gloss", "coverage_sqft": 350}', 'Standard white sign paint'),
('Black Sign Enamel', 'paint', 'gallon', '{"type": "enamel", "color": "black", "finish": "gloss", "coverage_sqft": 350}', 'Standard black sign paint');

-- ============================================
-- VERIFICATION
-- ============================================

SELECT 'Phase 4.b migration complete: product_archetypes table created with sample data' AS status;
SELECT COUNT(*) AS total_archetypes FROM product_archetypes;
SELECT category, COUNT(*) AS count FROM product_archetypes GROUP BY category ORDER BY category;
