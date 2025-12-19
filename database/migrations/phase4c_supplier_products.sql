-- Phase 4.c: Create supplier_products table
-- Purpose: Link product archetypes to suppliers with optional product-specific details
-- Created: 2025-12-19

CREATE TABLE IF NOT EXISTS supplier_products (
  supplier_product_id INT AUTO_INCREMENT PRIMARY KEY COMMENT 'Unique identifier for this supplier product',

  -- Core Links (REQUIRED)
  archetype_id INT NOT NULL COMMENT 'Which product archetype this represents',
  supplier_id INT NOT NULL COMMENT 'Which supplier sells this',

  -- Product Details (OPTIONAL)
  brand_name VARCHAR(100) DEFAULT NULL COMMENT 'Supplier brand: 3M, Avery, etc.',
  sku VARCHAR(100) DEFAULT NULL COMMENT 'Supplier part number/SKU',
  min_order_quantity DECIMAL(10,2) DEFAULT NULL COMMENT 'Minimum order quantity if applicable',
  lead_time_days INT DEFAULT NULL COMMENT 'Overrides supplier.default_lead_days if set',
  specifications JSON DEFAULT NULL COMMENT 'Product-specific specs if different from archetype',
  notes TEXT DEFAULT NULL COMMENT 'Internal notes about this supplier product',

  -- Flags
  is_active BOOLEAN DEFAULT TRUE COMMENT 'Can we still purchase this?',
  is_preferred BOOLEAN DEFAULT FALSE COMMENT 'Preferred supplier for this archetype in BOMs',

  -- Audit Trail
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  created_by INT DEFAULT NULL COMMENT 'User who created',
  updated_by INT DEFAULT NULL COMMENT 'User who last updated',

  -- Indexes for query optimization
  INDEX idx_archetype (archetype_id),
  INDEX idx_supplier (supplier_id),
  INDEX idx_active (is_active),
  INDEX idx_preferred (is_preferred),
  INDEX idx_archetype_supplier (archetype_id, supplier_id),

  -- Unique constraint: prevent duplicate supplier products for same archetype
  UNIQUE KEY uk_archetype_supplier_sku (archetype_id, supplier_id, sku),

  -- Foreign Keys
  CONSTRAINT fk_supplier_product_archetype
    FOREIGN KEY (archetype_id) REFERENCES product_archetypes(archetype_id)
    ON DELETE RESTRICT
    ON UPDATE CASCADE,

  CONSTRAINT fk_supplier_product_supplier
    FOREIGN KEY (supplier_id) REFERENCES suppliers(supplier_id)
    ON DELETE RESTRICT
    ON UPDATE CASCADE,

  CONSTRAINT fk_supplier_product_created_by
    FOREIGN KEY (created_by) REFERENCES users(user_id)
    ON DELETE SET NULL,

  CONSTRAINT fk_supplier_product_updated_by
    FOREIGN KEY (updated_by) REFERENCES users(user_id)
    ON DELETE SET NULL

) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='Supplier-specific products linked to archetypes with optional pricing details';
