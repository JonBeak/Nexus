-- Material Requirements Table
-- Tracks all material requirements across orders and stock replenishment
-- Source of truth for Overview and Shopping Cart
-- Created: 2025-01-27

CREATE TABLE IF NOT EXISTS material_requirements (
  requirement_id INT NOT NULL AUTO_INCREMENT,

  -- Order or Stock reference
  order_id INT DEFAULT NULL,              -- FK to orders, NULL for stock items
  is_stock_item TINYINT(1) DEFAULT 0,     -- TRUE for inventory replenishment

  -- Product identification
  archetype_id INT DEFAULT NULL,          -- FK to product_archetypes (Product Type)
  custom_product_type VARCHAR(255),       -- Free text if not in archetypes
  supplier_product_id INT DEFAULT NULL,   -- FK to supplier_products (Specific Product)

  -- Size and quantity
  size_description VARCHAR(255),          -- Human-readable size string
  quantity_ordered DECIMAL(10,2) NOT NULL,
  quantity_received DECIMAL(10,2) DEFAULT 0,  -- Partial receipt support

  -- Vendor
  supplier_id INT DEFAULT NULL,           -- FK to suppliers

  -- Dates
  entry_date DATE NOT NULL,               -- When requirement was created
  ordered_date DATE DEFAULT NULL,         -- Auto-fills from Shopping Cart
  expected_delivery_date DATE DEFAULT NULL,
  received_date DATE DEFAULT NULL,

  -- Delivery & Status
  delivery_method ENUM('pickup', 'shipping') DEFAULT 'shipping',
  status ENUM('pending', 'ordered', 'backordered', 'partial_received', 'received', 'cancelled') DEFAULT 'pending',

  -- Notes & Integration
  notes TEXT,
  cart_id VARCHAR(50),                    -- Shopping cart link
  purchase_order_id INT DEFAULT NULL,     -- Future PO system

  -- Audit
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  created_by INT,
  updated_at DATETIME ON UPDATE CURRENT_TIMESTAMP,
  updated_by INT,

  PRIMARY KEY (requirement_id),
  INDEX idx_order_id (order_id),
  INDEX idx_status (status),
  INDEX idx_supplier_id (supplier_id),
  INDEX idx_entry_date (entry_date),
  INDEX idx_is_stock (is_stock_item),
  INDEX idx_archetype_id (archetype_id),
  INDEX idx_supplier_product_id (supplier_product_id),

  FOREIGN KEY (order_id) REFERENCES orders(order_id) ON DELETE CASCADE,
  FOREIGN KEY (archetype_id) REFERENCES product_archetypes(archetype_id) ON DELETE SET NULL,
  FOREIGN KEY (supplier_product_id) REFERENCES supplier_products(supplier_product_id) ON DELETE SET NULL,
  FOREIGN KEY (supplier_id) REFERENCES suppliers(supplier_id) ON DELETE SET NULL
);

-- Add comments for documentation
ALTER TABLE material_requirements
  COMMENT = 'Material requirements tracking for orders and stock replenishment';
